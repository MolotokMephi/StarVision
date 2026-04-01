"""
celestrak.py — Автоматическая подгрузка TLE-данных с CelesTrak.
Поддерживает кэширование и fallback на встроенные данные.
"""

import asyncio
import time
import logging
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
_cache_timestamp: float = 0.0


def _parse_tle_text(text: str) -> Dict[int, Tuple[str, str]]:
    """Разобрать текст в формате TLE (3 строки на спутник: имя, line1, line2)."""
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
            result[norad_id] = (line1, line2)
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
    """
    global _tle_cache, _cache_timestamp

    if norad_ids is None:
        norad_ids = [s.norad_id for s in RUSSIAN_CUBESATS]

    # Проверяем кэш
    now = time.time()
    if _tle_cache and (now - _cache_timestamp) < CACHE_TTL_SEC:
        cached = {nid: _tle_cache[nid] for nid in norad_ids if nid in _tle_cache}
        if len(cached) == len(norad_ids):
            return cached

    # Пробуем загрузить из групповых файлов
    all_tle: Dict[int, Tuple[str, str]] = {}
    target_set = set(norad_ids)

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

    # Обновляем кэш
    if all_tle:
        _tle_cache.update(all_tle)
        _cache_timestamp = now

    return {nid: all_tle[nid] for nid in norad_ids if nid in all_tle}


async def _fetch_url(client: httpx.AsyncClient, url: str) -> Dict[int, Tuple[str, str]]:
    """Загрузить и разобрать TLE с одного URL."""
    try:
        resp = await client.get(url)
        resp.raise_for_status()
        return _parse_tle_text(resp.text)
    except Exception as e:
        logger.warning(f"CelesTrak fetch failed for {url}: {e}")
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
            logger.error(f"CelesTrak fetch failed, falling back to embedded: {e}")
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
    global _tle_cache, _cache_timestamp
    _tle_cache = {}
    _cache_timestamp = 0.0
