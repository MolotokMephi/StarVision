"""
celestrak.py — Automatic TLE data loading from CelesTrak.
Supports caching with TTL, TLE validation, race condition protection,
and fallback to built-in data.
"""

import asyncio
import time
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple

import httpx

from satellites import RUSSIAN_CUBESATS

logger = logging.getLogger(__name__)

# CelesTrak URLs for TLE (CubeSat and amateur-radio — cover Russian CubeSats)
CELESTRAK_URLS = [
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=cubesat&FORMAT=tle",
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle",
]

# TLE data cache: norad_id -> (tle_line1, tle_line2)
CACHE_TTL_SEC = 3600  # refresh every hour
_tle_cache: Dict[int, Tuple[str, str]] = {}
_cache_timestamp: float = 0.0
_cache_lock: asyncio.Lock = asyncio.Lock()

# TLE line regex: basic format validation
_TLE_LINE1_RE = re.compile(r'^1 \d{5}[A-Z ]')
_TLE_LINE2_RE = re.compile(r'^2 \d{5} ')


def _tle_checksum(line: str) -> int:
    """Calculate TLE line checksum (modulo 10)."""
    total = 0
    for ch in line[:68]:
        if ch.isdigit():
            total += int(ch)
        elif ch == '-':
            total += 1
    return total % 10


def _validate_tle_line(line: str, line_num: int) -> bool:
    """Validate format and checksum of a TLE line."""
    if len(line) < 69:
        return False
    pattern = _TLE_LINE1_RE if line_num == 1 else _TLE_LINE2_RE
    if not pattern.match(line):
        return False
    expected_checksum = int(line[68])
    return _tle_checksum(line) == expected_checksum


def _tle_epoch_age_days(line1: str) -> float:
    """Calculate TLE epoch age in days relative to current UTC.
    Returns number of days since TLE epoch. Negative means TLE is from the future.
    """
    try:
        year_2d = int(line1[18:20])
        day_frac = float(line1[20:32])
        year = 2000 + year_2d if year_2d < 57 else 1900 + year_2d
        epoch = datetime(year, 1, 1, tzinfo=timezone.utc)
        epoch += timedelta(days=day_frac - 1)
        now = datetime.now(timezone.utc)
        return (now - epoch).total_seconds() / 86400.0
    except (ValueError, IndexError):
        return 9999.0  # failed to parse — treat as very old


def _is_tle_valid(line1: str, line2: str, max_age_days: float = 365.0) -> bool:
    """Full TLE validation: format, checksums, and epoch freshness."""
    if not _validate_tle_line(line1, 1):
        return False
    if not _validate_tle_line(line2, 2):
        return False
    age = _tle_epoch_age_days(line1)
    if age < 0 or age > max_age_days:
        return False
    return True


def _parse_tle_text(text: str) -> Dict[int, Tuple[str, str]]:
    """Parse TLE-format text (3 lines per satellite: name, line1, line2).
    Validates each set — skips corrupted entries."""
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    result: Dict[int, Tuple[str, str]] = {}

    i = 0
    while i < len(lines) - 2:
        # Skip lines that are not the start of a TLE block
        if not lines[i + 1].startswith("1 ") or not lines[i + 2].startswith("2 "):
            i += 1
            continue

        line1 = lines[i + 1]
        line2 = lines[i + 2]

        try:
            norad_id = int(line1[2:7].strip())
            if _is_tle_valid(line1, line2):
                result[norad_id] = (line1, line2)
            else:
                logger.debug("TLE validation failed for NORAD %d (checksum or epoch)", norad_id)
        except (ValueError, IndexError):
            # Invalid TLE line format — skip this satellite
            logger.debug("Failed to parse NORAD ID from TLE line: %r", line1)

        i += 3

    return result


async def fetch_celestrak_tle(norad_ids: Optional[List[int]] = None) -> Dict[int, Tuple[str, str]]:
    """
    Загрузить TLE с CelesTrak для указанных NORAD ID.
    Если norad_ids=None, загружает для всех спутников из каталога.
    Возвращает dict: norad_id -> (tle_line1, tle_line2).
    Потокобезопасен благодаря asyncio.Lock.
    """
    global _tle_cache, _cache_timestamp

    if norad_ids is None:
        norad_ids = [s.norad_id for s in RUSSIAN_CUBESATS]

    async with _cache_lock:
        # Check cache (inside lock to prevent duplicate requests)
        now = time.time()
        if _tle_cache and (now - _cache_timestamp) < CACHE_TTL_SEC:
            cached = {nid: _tle_cache[nid] for nid in norad_ids if nid in _tle_cache}
            if len(cached) == len(norad_ids):
                logger.debug("TLE cache hit: %d/%d satellites", len(cached), len(norad_ids))
                return cached

        # Try to load from group files
        all_tle: Dict[int, Tuple[str, str]] = {}
        target_set = set(norad_ids)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Load group files in parallel
                tasks = []
                for url in CELESTRAK_URLS:
                    tasks.append(_fetch_url(client, url))

                results = await asyncio.gather(*tasks, return_exceptions=True)

                for result in results:
                    if isinstance(result, dict):
                        for nid, tle in result.items():
                            if nid in target_set:
                                all_tle[nid] = tle

                # For satellites not found in group files — fetch individually
                # Skip deorbited satellites (CelesTrak returns 404 for them)
                deorbited_ids = {
                    s.norad_id for s in RUSSIAN_CUBESATS
                    if s.status == "deorbited"
                }
                missing = target_set - set(all_tle.keys()) - deorbited_ids
                if missing:
                    logger.info("Fetching %d missing satellites individually", len(missing))
                    individual_tasks = []
                    for nid in missing:
                        url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={nid}&FORMAT=tle"
                        individual_tasks.append(_fetch_url(client, url))

                    ind_results = await asyncio.gather(*individual_tasks, return_exceptions=True)
                    for result in ind_results:
                        if isinstance(result, dict):
                            for nid, tle in result.items():
                                if nid in target_set:
                                    all_tle[nid] = tle
        except Exception as e:
            logger.error("CelesTrak network error: %s", e)

        # Update cache
        if all_tle:
            _tle_cache.update(all_tle)
            _cache_timestamp = time.time()
            fetched_count = len(all_tle)
            total_requested = len(norad_ids)
            logger.info(
                "TLE cache updated: %d/%d satellites fetched from CelesTrak",
                fetched_count, total_requested,
            )
            # Return everything found (from fresh fetch + from cache for missing)
            result = {}
            for nid in norad_ids:
                if nid in all_tle:
                    result[nid] = all_tle[nid]
                elif nid in _tle_cache:
                    result[nid] = _tle_cache[nid]
            return result

        # Network down — serve stale cache if available
        if _tle_cache:
            logger.warning("CelesTrak unavailable, using stale cache (%d entries)", len(_tle_cache))
            return {nid: _tle_cache[nid] for nid in norad_ids if nid in _tle_cache}

        return {}


async def _fetch_url(client: httpx.AsyncClient, url: str) -> Dict[int, Tuple[str, str]]:
    """Fetch and parse TLE from a single URL."""
    try:
        resp = await client.get(url)
        if resp.status_code == 404:
            logger.debug("CelesTrak 404 for %s (satellite may be deorbited)", url.split("CATNR=")[-1].split("&")[0] if "CATNR=" in url else url)
            return {}
        resp.raise_for_status()
        parsed = _parse_tle_text(resp.text)
        if parsed:
            logger.debug("Fetched %d TLE entries from %s", len(parsed), url.split("?")[0])
        return parsed
    except Exception as e:
        logger.warning("CelesTrak fetch failed for %s: %s", url, e)
        return {}


async def get_tle_by_source(
    source: str = "embedded",
    operational_only: bool = True,
) -> Tuple[List[dict], Dict[str, object]]:
    """
    Get TLE data depending on source, plus a meta dict describing what was actually
    returned. The caller owns the decision of how to surface the meta to the user.

    source: "embedded" | "celestrak"
    operational_only: if True, exclude satellites with status == "deorbited".

    Returns (tle_data, meta). Meta keys:
      - requested_source: what the caller asked for ("embedded" | "celestrak").
      - effective_source: what actually served most records ("embedded", "celestrak",
        or "embedded_fallback" if CelesTrak failed entirely and we fell back to
        the built-in catalog).
      - fallback_count: number of individual satellites that fell back to embedded
        even though the requested source was celestrak.
      - live_count: number of satellites served with fresh CelesTrak TLE.
      - total: total TLE records returned.
      - network_error: True if CelesTrak fetch raised or returned nothing when
        requested.
      - fetched_at: ISO timestamp (UTC) when this call produced data.
      - cache_age_sec: age of the CelesTrak cache in seconds, or None.
      - operational_only: mirrors the arg.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    base_meta: Dict[str, object] = {
        "requested_source": source,
        "operational_only": operational_only,
        "fetched_at": now_iso,
        "cache_age_sec": None,
        "network_error": False,
        "fallback_count": 0,
        "live_count": 0,
    }

    def _is_available(s) -> bool:
        if not (s.tle_line1 and s.tle_line2):
            return False
        if operational_only and s.status == "deorbited":
            return False
        return True

    if source == "celestrak":
        try:
            live_tle = await fetch_celestrak_tle()
        except Exception as e:
            logger.error("CelesTrak fetch failed, falling back to embedded: %s", e)
            live_tle = {}
            base_meta["network_error"] = True

        if _cache_timestamp:
            base_meta["cache_age_sec"] = max(0.0, time.time() - _cache_timestamp)

        result = []
        fallback_count = 0
        live_count = 0
        for s in RUSSIAN_CUBESATS:
            if not _is_available(s):
                continue
            if s.norad_id in live_tle:
                line1, line2 = live_tle[s.norad_id]
                result.append({
                    "norad_id": s.norad_id,
                    "name": s.name,
                    "constellation": s.constellation,
                    "tle_line1": line1,
                    "tle_line2": line2,
                    "source": "celestrak",
                })
                live_count += 1
            else:
                result.append({
                    "norad_id": s.norad_id,
                    "name": s.name,
                    "constellation": s.constellation,
                    "tle_line1": s.tle_line1,
                    "tle_line2": s.tle_line2,
                    "source": "embedded_fallback",
                })
                fallback_count += 1

        base_meta["fallback_count"] = fallback_count
        base_meta["live_count"] = live_count
        base_meta["total"] = len(result)
        if live_count == 0:
            base_meta["effective_source"] = "embedded_fallback"
        elif fallback_count == 0:
            base_meta["effective_source"] = "celestrak"
        else:
            base_meta["effective_source"] = "celestrak_partial"
        return result, base_meta

    result = _get_embedded_tle_list(operational_only=operational_only)
    base_meta["effective_source"] = "embedded"
    base_meta["total"] = len(result)
    return result, base_meta


def _get_embedded_tle_list(operational_only: bool = True) -> List[dict]:
    """Built-in TLE as list of dicts. Skips deorbited spacecraft unless
    operational_only=False, because stale TLE for decayed satellites produces
    physically meaningless positions."""
    return [
        {
            "norad_id": s.norad_id,
            "name": s.name,
            "constellation": s.constellation,
            "tle_line1": s.tle_line1,
            "tle_line2": s.tle_line2,
            "source": "embedded",
        }
        for s in RUSSIAN_CUBESATS
        if s.tle_line1 and s.tle_line2
        and (not operational_only or s.status != "deorbited")
    ]


def get_cache_info() -> Dict[str, object]:
    """Inspector for /api/health: is the CelesTrak cache warm and how old is it."""
    if not _cache_timestamp:
        return {"warm": False, "age_sec": None, "entries": len(_tle_cache)}
    return {
        "warm": True,
        "age_sec": max(0.0, time.time() - _cache_timestamp),
        "entries": len(_tle_cache),
    }


def invalidate_cache():
    """Reset TLE cache (for forced refresh)."""
    global _tle_cache, _cache_timestamp
    _tle_cache = {}
    _cache_timestamp = 0.0
