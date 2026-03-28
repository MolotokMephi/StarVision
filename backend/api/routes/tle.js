/**
 * Маршруты для работы с TLE (Two-Line Element)
 *
 * Получение TLE-данных с CelesTrak, парсинг и
 * распространение орбит по модели SGP4.
 */

const express = require('express');
const router = express.Router();

// URL API CelesTrak для получения TLE по NORAD ID:
// https://celestrak.org/NORAD/elements/gp.php?CATNR=ID&FORMAT=TLE
//
// Альтернативные источники:
// https://celestrak.org/NORAD/elements/gp.php?GROUP=cubesat&FORMAT=tle
// https://www.space-track.org/ (требует регистрацию)
// https://www.n2yo.com/rest/v1/satellite/tle/NORAD_ID&apiKey=KEY

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';

/**
 * GET /api/tle/fetch/:noradId
 * Получает TLE-данные для указанного NORAD ID с CelesTrak
 */
router.get('/fetch/:noradId', async (req, res) => {
  const { noradId } = req.params;

  // TODO: Реализовать реальный запрос к CelesTrak
  // const url = `${CELESTRAK_BASE}?CATNR=${noradId}&FORMAT=TLE`;
  // const response = await fetch(url);
  // const tleText = await response.text();

  // Заглушка: возвращаем пример TLE для МКС (NORAD 25544)
  // В реальной реализации здесь будет запрос к CelesTrak API
  const exampleTLE = {
    noradId: parseInt(noradId, 10),
    name: `Спутник NORAD ${noradId}`,
    line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002',
    line2: '2 25544  51.6400 208.9163 0006703 352.5648   7.5509 15.49560532999999',
    source: 'заглушка',
    fetchedAt: new Date().toISOString(),
    note: 'TODO: подключить реальный запрос к CelesTrak'
  };

  res.json(exampleTLE);
});

/**
 * GET /api/tle/parse
 * Парсит переданные TLE-строки в орбитальные элементы
 */
router.get('/parse', (req, res) => {
  const { line1, line2 } = req.query;

  if (!line1 || !line2) {
    return res.status(400).json({
      error: 'Необходимо передать параметры line1 и line2'
    });
  }

  // TODO: Реализовать полный парсинг TLE
  // Использовать сервис tleParser для разбора строк

  const parsedStub = {
    catalogNumber: line1.substring(2, 7).trim(),
    epochYear: line1.substring(18, 20).trim(),
    epochDay: parseFloat(line1.substring(20, 32).trim()),
    inclination: parseFloat(line2.substring(8, 16).trim()),
    raan: parseFloat(line2.substring(17, 25).trim()),
    eccentricity: parseFloat('0.' + line2.substring(26, 33).trim()),
    argumentOfPerigee: parseFloat(line2.substring(34, 42).trim()),
    meanAnomaly: parseFloat(line2.substring(43, 51).trim()),
    meanMotion: parseFloat(line2.substring(52, 63).trim()),
    note: 'TODO: использовать tleParser для полного разбора'
  };

  res.json(parsedStub);
});

/**
 * POST /api/tle/propagate
 * Выполняет распространение орбиты по модели SGP4
 *
 * Тело запроса:
 * {
 *   line1: "...",
 *   line2: "...",
 *   startTime: "ISO timestamp",
 *   duration: секунды,
 *   step: секунды
 * }
 */
router.post('/propagate', (req, res) => {
  const { line1, line2, startTime, duration = 5400, step = 60 } = req.body;

  if (!line1 || !line2) {
    return res.status(400).json({
      error: 'Необходимо передать TLE-строки (line1, line2)'
    });
  }

  // TODO: Реализовать SGP4-пропагацию
  // Использовать сервис orbitalMechanics для расчёта позиций
  //
  // Алгоритм:
  // 1. Распарсить TLE → орбитальные элементы
  // 2. Для каждого шага времени (от startTime, шаг step, всего duration):
  //    a. Вычислить позицию в ECI (SGP4)
  //    b. Преобразовать ECI → ECEF → LLA
  // 3. Вернуть массив точек [{time, eci: {x,y,z}, lla: {lat,lon,alt}}]

  const start = startTime ? new Date(startTime) : new Date();
  const steps = Math.floor(duration / step);

  // Заглушка: генерируем примерные точки по круговой орбите
  const positions = [];
  for (let i = 0; i <= steps; i++) {
    const t = i * step;
    const angle = (2 * Math.PI * t) / 5400; // ~90 мин период
    positions.push({
      time: new Date(start.getTime() + t * 1000).toISOString(),
      eci: {
        x: 6778 * Math.cos(angle),
        y: 6778 * Math.sin(angle),
        z: 0
      },
      lla: {
        lat: 0,
        lon: ((angle * 180) / Math.PI) % 360 - 180,
        alt: 400
      },
      note: 'заглушка — круговая орбита'
    });
  }

  res.json({
    noradId: line1.substring(2, 7).trim(),
    startTime: start.toISOString(),
    duration,
    step,
    pointCount: positions.length,
    positions,
    note: 'TODO: заменить заглушку на реальную SGP4-пропагацию'
  });
});

module.exports = router;
