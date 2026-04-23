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

from satellites import RUSSIAN_CUBESATS, is_operational

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
_last_fetch_ok: bool = False
_last_fetch_error: Optional[str] = None
_last_fetch_attempt: float = 0.0


def get_cache_status() -> Dict[str, object]:
    """Public snapshot of CelesTrak cache state. Used by API clients
    to display data freshness and surface network/parse failures instead
    of silently serving embedded data.
    """
    now = time.time()
    age_sec: Optional[float] = (now - _cache_timestamp) if _cache_timestamp > 0 else None
    last_attempt_age: Optional[float] = (now - _last_fetch_attempt) if _last_fetch_attempt > 0 else None
    stale = age_sec is not None and age_sec > CACHE_TTL_SEC
    return {
        "entries": len(_tle_cache),
        "cache_age_sec": round(age_sec, 1) if age_sec is not None else None,
        "cache_ttl_sec": CACHE_TTL_SEC,
        "stale": stale,
        "last_fetch_ok": _last_fetch_ok,
        "last_fetch_error": _last_fetch_error,
        "last_fetch_age_sec": round(last_attempt_age, 1) if last_attempt_age is not None else None,
    }

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
    global _tle_cache, _cache_timestamp, _last_fetch_ok, _last_fetch_error, _last_fetch_attempt

    if norad_ids is None:
        # Operational satellites only — CelesTrak returns 404 for decayed sats.
        norad_ids = [s.norad_id for s in RUSSIAN_CUBESATS if is_operational(s.status)]

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
        network_error: Optional[str] = None
        _last_fetch_attempt = time.time()

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Load group files in parallel
                tasks = [_fetch_url(client, url) for url in CELESTRAK_URLS]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for result in results:
                    if isinstance(result, dict):
                        for nid, tle in result.items():
                            if nid in target_set:
                                all_tle[nid] = tle

                # For satellites not found in group files — fetch individually.
                missing = target_set - set(all_tle.keys())
                if missing:
                    logger.info("Fetching %d missing satellites individually", len(missing))
                    individual_tasks = [
                        _fetch_url(
                            client,
                            f"https://celestrak.org/NORAD/elements/gp.php?CATNR={nid}&FORMAT=tle",
                        )
                        for nid in missing
                    ]
                    ind_results = await asyncio.gather(*individual_tasks, return_exceptions=True)
                    for result in ind_results:
                        if isinstance(result, dict):
                            for nid, tle in result.items():
                                if nid in target_set:
                                    all_tle[nid] = tle
        except Exception as e:
            network_error = f"{type(e).__name__}: {e}"
            logger.error("CelesTrak network error: %s", network_error)

        # Update cache
        if all_tle:
            _tle_cache.update(all_tle)
            _cache_timestamp = time.time()
            _last_fetch_ok = True
            _last_fetch_error = None
            logger.info(
                "TLE cache updated: %d/%d satellites fetched from CelesTrak",
                len(all_tle), len(norad_ids),
            )
            result = {}
            for nid in norad_ids:
                if nid in all_tle:
                    result[nid] = all_tle[nid]
                elif nid in _tle_cache:
                    result[nid] = _tle_cache[nid]
            return result

        _last_fetch_ok = False
        _last_fetch_error = network_error or "CelesTrak returned no usable TLE"

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


async def get_tle_by_source(source: str = "embedded") -> Dict[str, object]:
    """Get TLE data for the given source and return it alongside an
    explicit meta block describing where every entry came from.

    The response is:
      {
        "tle_data": [ {..., "source": "celestrak"|"embedded"|"embedded_fallback"}, ...],
        "meta": {
          "requested_source": "embedded" | "celestrak",
          "effective_source": "embedded" | "celestrak" | "embedded_fallback",
          "fallback": bool,      # True if we could not honor requested source fully
          "error": Optional[str], # Populated on network/parse failures
          ...cache_status
        }
      }

    Callers (API layer) are expected to surface `meta` to the client so
    end-users can see data freshness and any upstream failures.
    """
    cache_status = get_cache_status()

    if source == "celestrak":
        try:
            live_tle = await fetch_celestrak_tle()
        except Exception as e:
            # Full failure — surface it, do not silently degrade.
            err = f"{type(e).__name__}: {e}"
            logger.error("CelesTrak fetch failed: %s", err)
            tle_list = _get_embedded_tle_list(tag="embedded_fallback")
            cache_status = get_cache_status()
            return {
                "tle_data": tle_list,
                "meta": {
                    "requested_source": "celestrak",
                    "effective_source": "embedded_fallback",
                    "fallback": True,
                    "error": err,
                    **cache_status,
                },
            }

        result: List[dict] = []
        any_fallback = False
        for s in RUSSIAN_CUBESATS:
            if not s.tle_line1 or not s.tle_line2:
                continue
            if not is_operational(s.status):
                # Archival satellite — never include in live TLE output.
                continue
            if s.norad_id in live_tle:
                line1, line2 = live_tle[s.norad_id]
                entry_source = "celestrak"
            else:
                line1, line2 = s.tle_line1, s.tle_line2
                entry_source = "embedded_fallback"
                any_fallback = True
            result.append({
                "norad_id": s.norad_id,
                "name": s.name,
                "constellation": s.constellation,
                "tle_line1": line1,
                "tle_line2": line2,
                "source": entry_source,
            })

        fresh_status = get_cache_status()
        effective = "celestrak"
        if not result:
            effective = "embedded_fallback"
        elif any_fallback:
            effective = "mixed"

        return {
            "tle_data": result,
            "meta": {
                "requested_source": "celestrak",
                "effective_source": effective,
                "fallback": any_fallback or not result,
                "error": fresh_status.get("last_fetch_error") if not fresh_status.get("last_fetch_ok") else None,
                **fresh_status,
            },
        }

    # Embedded
    return {
        "tle_data": _get_embedded_tle_list(tag="embedded"),
        "meta": {
            "requested_source": "embedded",
            "effective_source": "embedded",
            "fallback": False,
            "error": None,
            **cache_status,
        },
    }


def _get_embedded_tle_list(tag: str = "embedded") -> List[dict]:
    """Built-in TLE as list of dicts. Archival satellites are excluded."""
    return [
        {
            "norad_id": s.norad_id,
            "name": s.name,
            "constellation": s.constellation,
            "tle_line1": s.tle_line1,
            "tle_line2": s.tle_line2,
            "source": tag,
        }
        for s in RUSSIAN_CUBESATS
        if s.tle_line1 and s.tle_line2 and is_operational(s.status)
    ]


def invalidate_cache():
    """Reset TLE cache (for forced refresh)."""
    global _tle_cache, _cache_timestamp, _last_fetch_ok, _last_fetch_error, _last_fetch_attempt
    _tle_cache = {}
    _cache_timestamp = 0.0
    _last_fetch_ok = False
    _last_fetch_error = None
    _last_fetch_attempt = 0.0
