"""
celestrak.py — Автоматическая подгрузка TLE-данных с CelesTrak.
Поддерживает кэширование с TTL, валидацию TLE, защиту от гонок
и fallback на встроенные данные.
"""

import asyncio
import time
import logging
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import httpx

from satellites import RUSSIAN_CUBESATS

logger = logging.getLogger(__name__)

# URL-ы CelesTrak для получения TLE
CELESTRAK_URLS = [
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
]

# Кэш TLE-данных: norad_id -> (tle_line1, tle_line2)
CACHE_TTL_SEC = 3600  # обновлять раз в час
_tle_cache: Dict[int, Tuple[str, str]] = {}
_tle_cache_epochs: Dict[int, float] = {}  # norad_id -> TLE epoch (julian day fraction)
_cache_timestamp: float = 0.0
_cache_lock: asyncio.Lock = asyncio.Lock()

# TLE line regex: basic format validation
_TLE_LINE1_RE = re.compile(r'^1 \d{5}[A-Z ]')
_TLE_LINE2_RE = re.compile(r'^2 \d{5} ')


def _tle_checksum(line: str) -> int:
    """Вычислить контрольную сумму строки TLE (modulo 10)."""
    total = 0
    for ch in line[:68]:
        if ch.isdigit():
            total += int(ch)
        elif ch == '-':
            total += 1
    return total % 10


def _validate_tle_line(line: str, line_num: int) -> bool:
    """Проверить формат и контрольную сумму строки TLE."""
    if len(line) < 69:
        return False
    pattern = _TLE_LINE1_RE if line_num == 1 else _TLE_LINE2_RE
    if not pattern.match(line):
        return False
    expected_checksum = int(line[68])
    return _tle_checksum(line) == expected_checksum


def _tle_epoch_age_days(line1: str) -> float:
    """Рассчитать возраст TLE-набора в днях относительно текущего UTC.
    Возвращает кол-во дней с момента эпохи TLE. Отрицательное — TLE из будущего.
    """
    try:
        year_2d = int(line1[18:20])
        day_frac = float(line1[20:32])
        year = 2000 + year_2d if year_2d < 57 else 1900 + year_2d
        epoch = datetime(year, 1, 1, tzinfo=timezone.utc)
        from datetime import timedelta
        epoch += timedelta(days=day_frac - 1)
        now = datetime.now(timezone.utc)
        return (now - epoch).total_seconds() / 86400.0
    except (ValueError, IndexError):
        return 9999.0  # не удалось разобрать — считаем очень старым


def _is_tle_valid(line1: str, line2: str, max_age_days: float = 365.0) -> bool:
    """Полная валидация TLE-набора: формат, контрольные суммы и свежесть эпохи."""
    if not _validate_tle_line(line1, 1):
        return False
    if not _validate_tle_line(line2, 2):
        return False
    age = _tle_epoch_age_days(line1)
    if age < 0 or age > max_age_days:
        return False
    return True


def _parse_tle_text(text: str) -> Dict[int, Tuple[str, str]]:
    """Разобрать текст в формате TLE (3 строки на спутник: имя, line1, line2).
    Валидирует каждый набор — пропускает повреждённые записи."""
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    result: Dict[int, Tuple[str, str]] = {}

    i = 0
    while i < len(lines) - 2:
        # Пропускаем строки, не являющиеся началом блока TLE
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
            # Некорректный формат строки TLE — пропускаем этот спутник
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
        # Проверяем кэш (внутри лока, чтобы избежать двойных запросов)
        now = time.time()
        if _tle_cache and (now - _cache_timestamp) < CACHE_TTL_SEC:
            cached = {nid: _tle_cache[nid] for nid in norad_ids if nid in _tle_cache}
            if len(cached) == len(norad_ids):
                logger.debug("TLE cache hit: %d/%d satellites", len(cached), len(norad_ids))
                return cached

        # Пробуем загрузить из групповых файлов
        all_tle: Dict[int, Tuple[str, str]] = {}
        target_set = set(norad_ids)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Загружаем групповые файлы параллельно
                tasks = []
                for url in CELESTRAK_URLS:
                    tasks.append(_fetch_url(client, url))

                results = await asyncio.gather(*tasks, return_exceptions=True)

                for result in results:
                    if isinstance(result, dict):
                        for nid, tle in result.items():
                            if nid in target_set:
                                all_tle[nid] = tle

                # Для спутников, не найденных в групповых файлах — запрос поштучно
                missing = target_set - set(all_tle.keys())
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

        # Обновляем кэш
        if all_tle:
            _tle_cache.update(all_tle)
            _cache_timestamp = time.time()
            fetched_count = len(all_tle)
            total_requested = len(norad_ids)
            logger.info(
                "TLE cache updated: %d/%d satellites fetched from CelesTrak",
                fetched_count, total_requested,
            )
            # Возвращаем всё что нашли (из свежего фетча + из кэша для недостающих)
            result = {}
            for nid in norad_ids:
                if nid in all_tle:
                    result[nid] = all_tle[nid]
                elif nid in _tle_cache:
                    result[nid] = _tle_cache[nid]
            return result

        # Сеть упала — отдаём устаревший кэш если он есть
        if _tle_cache:
            logger.warning("CelesTrak unavailable, using stale cache (%d entries)", len(_tle_cache))
            return {nid: _tle_cache[nid] for nid in norad_ids if nid in _tle_cache}

        return {}


async def _fetch_url(client: httpx.AsyncClient, url: str) -> Dict[int, Tuple[str, str]]:
    """Загрузить и разобрать TLE с одного URL."""
    try:
        resp = await client.get(url)
        resp.raise_for_status()
        parsed = _parse_tle_text(resp.text)
        if parsed:
            logger.debug("Fetched %d TLE entries from %s", len(parsed), url.split("?")[0])
        return parsed
    except Exception as e:
        logger.warning("CelesTrak fetch failed for %s: %s", url, e)
        return {}


def get_embedded_tle() -> Dict[int, Tuple[str, str]]:
    """Получить встроенные TLE-данные из каталога."""
    return {
        s.norad_id: (s.tle_line1, s.tle_line2)
        for s in RUSSIAN_CUBESATS
        if s.tle_line1 and s.tle_line2
    }


async def get_tle_by_source(source: str = "embedded") -> List[dict]:
    """
    Получить TLE-данные в зависимости от источника.
    source: "embedded" | "celestrak"
    """
    if source == "celestrak":
        try:
            live_tle = await fetch_celestrak_tle()
            result = []
            for s in RUSSIAN_CUBESATS:
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
                elif s.tle_line1 and s.tle_line2:
                    # Fallback на встроенные данные для этого спутника
                    result.append({
                        "norad_id": s.norad_id,
                        "name": s.name,
                        "constellation": s.constellation,
                        "tle_line1": s.tle_line1,
                        "tle_line2": s.tle_line2,
                        "source": "embedded_fallback",
                    })
            return result
        except Exception as e:
            logger.error("CelesTrak fetch failed, falling back to embedded: %s", e)
            # Полный fallback
            return _get_embedded_tle_list()
    else:
        return _get_embedded_tle_list()


def _get_embedded_tle_list() -> List[dict]:
    """Встроенные TLE как список dict."""
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
    ]


def invalidate_cache():
    """Сбросить кэш TLE (для принудительного обновления)."""
    global _tle_cache, _cache_timestamp, _tle_cache_epochs
    _tle_cache = {}
    _tle_cache_epochs = {}
    _cache_timestamp = 0.0
