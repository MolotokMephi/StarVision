/**
 * Сервис получения данных о спутниках
 *
 * Загрузка TLE с CelesTrak, обновление каталога российских кубсатов
 * и взаимодействие с внешними API (n2yo, Space-Track).
 *
 * Источники данных о российских кубсатах:
 *   - CelesTrak: https://celestrak.org/NORAD/elements/gp.php
 *     (основной источник TLE, бесплатный доступ)
 *   - N2YO: https://www.n2yo.com/rest/v1/satellite/
 *     (REST API, требует бесплатный API-ключ)
 *   - Space-Track: https://www.space-track.org/
 *     (официальный источник NORAD, требует регистрацию)
 *   - Роскосмос / ЦНИИМАШ: данные по российским аппаратам
 *     (ограниченный доступ для российских КА)
 *
 * Примечание: большинство российских кубсатов запускались как попутная
 * нагрузка с МКС (программа «Радиоскаф»), с пусков «Союз» и «Протон»,
 * а также на ракетах-носителях иностранного производства.
 */

const path = require('path');
const fs = require('fs');

// URL-ы внешних API
const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';
const CELESTRAK_CUBESAT_GROUP = `${CELESTRAK_BASE}?GROUP=cubesat&FORMAT=tle`;
const N2YO_BASE = 'https://www.n2yo.com/rest/v1/satellite';

// Путь к локальному каталогу
const CATALOG_PATH = path.join(__dirname, '..', 'data', 'russian-cubesats.json');

/**
 * Загружает TLE-данные с CelesTrak по NORAD ID
 *
 * @param {number|string} noradId — идентификатор NORAD
 * @returns {Promise<object>} объект с TLE-данными
 */
async function fetchFromCelestrak(noradId) {
  const url = `${CELESTRAK_BASE}?CATNR=${noradId}&FORMAT=TLE`;

  // TODO: Реализовать реальный HTTP-запрос
  // Пример реализации с node-fetch:
  //
  // const fetch = require('node-fetch');
  // const response = await fetch(url);
  //
  // if (!response.ok) {
  //   throw new Error(`CelesTrak вернул статус ${response.status}`);
  // }
  //
  // const text = await response.text();
  // const lines = text.trim().split('\n');
  //
  // if (lines.length < 2) {
  //   throw new Error(`TLE не найден для NORAD ID ${noradId}`);
  // }
  //
  // // TLE может содержать 2 или 3 строки (имя + line1 + line2)
  // let name, line1, line2;
  // if (lines.length >= 3) {
  //   name = lines[0].trim();
  //   line1 = lines[1].trim();
  //   line2 = lines[2].trim();
  // } else {
  //   name = `NORAD ${noradId}`;
  //   line1 = lines[0].trim();
  //   line2 = lines[1].trim();
  // }
  //
  // return { noradId, name, line1, line2, fetchedAt: new Date().toISOString() };

  console.log(`[dataFetcher] Запрос TLE для NORAD ID ${noradId}: ${url}`);

  return {
    noradId: parseInt(noradId, 10),
    name: `Спутник NORAD ${noradId}`,
    line1: null,
    line2: null,
    source: 'заглушка',
    url,
    fetchedAt: new Date().toISOString(),
    note: 'TODO: подключить реальный HTTP-запрос к CelesTrak'
  };
}

/**
 * Загружает список российских кубсатов с внешних источников
 *
 * Стратегия:
 *   1. Получаем полный список кубсатов с CelesTrak (GROUP=cubesat)
 *   2. Фильтруем по стране запуска (Россия / РФ) или оператору
 *   3. Дополняем данными из N2YO (если доступен API-ключ)
 *   4. Обновляем локальный каталог
 *
 * Фильтрация российских аппаратов:
 *   - По международному обозначению (COSPAR ID): коды запусков с Байконура,
 *     Восточного, Плесецка
 *   - По известным NORAD ID из локального каталога
 *   - По имени спутника (поиск по ключевым словам)
 *
 * @returns {Promise<Array>} массив данных о российских кубсатах
 */
async function fetchRussianCubesats() {
  // TODO: Реализовать реальный запрос
  //
  // const fetch = require('node-fetch');
  //
  // // Шаг 1: Получаем все кубсаты с CelesTrak
  // const response = await fetch(CELESTRAK_CUBESAT_GROUP);
  // const tleText = await response.text();
  //
  // // Шаг 2: Парсим TLE-текст в массив объектов
  // const allCubesats = parseTLEBulk(tleText);
  //
  // // Шаг 3: Фильтруем российские аппараты
  // const russianKeywords = [
  //   'SIRIUSSAT', 'YARILO', 'ORBICRAFT', 'GEOSCAN', 'NORBI',
  //   'CUBESX', 'TABLETSAT', 'TUSUR', 'DECAWAVE', 'RADIOSKAF'
  // ];
  //
  // const russianCubesats = allCubesats.filter(sat =>
  //   russianKeywords.some(kw => sat.name.toUpperCase().includes(kw))
  // );
  //
  // return russianCubesats;

  console.log('[dataFetcher] Запрос каталога российских кубсатов (заглушка)');

  // Возвращаем данные из локального каталога
  return loadLocalCatalog();
}

/**
 * Обновляет локальный каталог российских кубсатов
 *
 * Алгоритм:
 *   1. Загружаем актуальные TLE для каждого спутника из каталога
 *   2. Обновляем орбитальные параметры
 *   3. Проверяем статус (активен / неактивен / сошёл с орбиты)
 *   4. Сохраняем обновлённый каталог в JSON-файл
 *
 * @returns {Promise<object>} результат обновления
 */
async function updateCatalog() {
  console.log('[dataFetcher] Начинаем обновление каталога...');

  const catalog = loadLocalCatalog();
  const results = {
    total: catalog.length,
    updated: 0,
    failed: 0,
    errors: []
  };

  // TODO: Реализовать реальное обновление
  //
  // for (const satellite of catalog) {
  //   try {
  //     const tleData = await fetchFromCelestrak(satellite.noradId);
  //     if (tleData.line1 && tleData.line2) {
  //       // Обновляем орбитальные параметры
  //       const parsed = require('./tleParser').parseTLE(tleData.line1, tleData.line2);
  //       satellite.orbitalParams.altitude = calculateAltitude(parsed);
  //       satellite.lastUpdated = new Date().toISOString();
  //       results.updated++;
  //     }
  //   } catch (err) {
  //     results.failed++;
  //     results.errors.push({ noradId: satellite.noradId, error: err.message });
  //   }
  //
  //   // Пауза между запросами, чтобы не перегружать API
  //   await new Promise(resolve => setTimeout(resolve, 500));
  // }
  //
  // // Сохраняем обновлённый каталог
  // saveCatalog(catalog);

  results.note = 'TODO: реализовать реальное обновление через CelesTrak API';
  results.timestamp = new Date().toISOString();

  console.log(`[dataFetcher] Обновление завершено: ${results.updated}/${results.total}`);
  return results;
}

/**
 * Загружает локальный каталог из JSON-файла
 *
 * @returns {Array} массив объектов спутников
 */
function loadLocalCatalog() {
  try {
    const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[dataFetcher] Ошибка чтения каталога:', err.message);
    return [];
  }
}

/**
 * Сохраняет каталог в JSON-файл
 *
 * @param {Array} catalog — массив объектов спутников
 */
function saveCatalog(catalog) {
  const json = JSON.stringify(catalog, null, 2);
  fs.writeFileSync(CATALOG_PATH, json, 'utf-8');
  console.log(`[dataFetcher] Каталог сохранён: ${catalog.length} записей`);
}

/**
 * Парсит «сырой» TLE-текст (множество спутников) в массив объектов
 * Формат: каждые 3 строки = имя + line1 + line2
 *
 * @param {string} tleText — текст с TLE
 * @returns {Array<{name, line1, line2}>}
 */
function parseTLEBulk(tleText) {
  const lines = tleText.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const satellites = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    satellites.push({
      name: lines[i],
      line1: lines[i + 1],
      line2: lines[i + 2]
    });
  }

  return satellites;
}

module.exports = {
  fetchFromCelestrak,
  fetchRussianCubesats,
  updateCatalog,
  loadLocalCatalog,
  saveCatalog,
  parseTLEBulk
};
