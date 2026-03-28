/**
 * @file dataManager.js
 * @description Управление данными — загрузка каталога спутников,
 * TLE-элементов с сервера, кэширование.
 */

/** Кэш загруженных данных */
const cache = {
  catalog: null,
  tle: new Map(),
  lastFetch: 0,
};

/** Базовый URL API (относительный, проксируется через nginx) */
const API_BASE = '/api';

/**
 * Загрузить каталог спутников с сервера.
 * GET /api/satellites
 * @returns {Promise<Array<object>>} массив спутников
 */
export async function fetchSatelliteCatalog() {
  try {
    const res = await fetch(`${API_BASE}/satellites`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    cache.catalog = data;
    cache.lastFetch = Date.now();
    return data;
  } catch (err) {
    console.error('[DataManager] Ошибка загрузки каталога:', err);
    return cache.catalog || [];
  }
}

/**
 * Загрузить TLE для конкретного спутника по NORAD ID.
 * GET /api/tle/fetch/:id
 * @param {number|string} noradId — NORAD каталожный номер
 * @returns {Promise<object|null>} TLE-данные
 */
export async function fetchTLE(noradId) {
  // Проверить кэш
  if (cache.tle.has(noradId)) {
    return cache.tle.get(noradId);
  }

  try {
    const res = await fetch(`${API_BASE}/tle/fetch/${noradId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    cache.tle.set(noradId, data);
    return data;
  } catch (err) {
    console.error(`[DataManager] Ошибка загрузки TLE ${noradId}:`, err);
    return null;
  }
}

/**
 * Получить кэшированные данные.
 * @returns {{ catalog: Array|null, tle: Map, lastFetch: number }}
 */
export function getCachedData() {
  return {
    catalog: cache.catalog,
    tle: new Map(cache.tle),
    lastFetch: cache.lastFetch,
  };
}

/**
 * Принудительно обновить все данные (сбросить кэш и загрузить заново).
 * @returns {Promise<Array<object>>}
 */
export async function refreshData() {
  cache.catalog = null;
  cache.tle.clear();
  cache.lastFetch = 0;
  return fetchSatelliteCatalog();
}
