/**
 * Маршруты для работы с каталогом спутников
 *
 * Предоставляет доступ к каталогу российских кубсатов,
 * информации об отдельных аппаратах и конфигурации созвездия.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Путь к файлу каталога российских кубсатов
const CATALOG_PATH = path.join(__dirname, '..', '..', 'data', 'russian-cubesats.json');

/**
 * Загружает каталог кубсатов из JSON-файла
 * @returns {Array} массив объектов спутников
 */
function loadCatalog() {
  const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * GET /api/satellites
 * Возвращает полный каталог российских кубсатов
 */
router.get('/', (req, res) => {
  try {
    const catalog = loadCatalog();

    // Поддержка фильтрации по статусу (?status=active)
    const { status, type, operator } = req.query;
    let results = catalog;

    if (status) {
      results = results.filter(s => s.status === status);
    }
    if (type) {
      results = results.filter(s => s.type === type);
    }
    if (operator) {
      results = results.filter(s =>
        s.operator.toLowerCase().includes(operator.toLowerCase()) ||
        s.operatorRu.toLowerCase().includes(operator.toLowerCase())
      );
    }

    res.json({
      count: results.length,
      satellites: results
    });
  } catch (err) {
    console.error('Ошибка загрузки каталога:', err.message);
    res.status(500).json({ error: 'Не удалось загрузить каталог спутников' });
  }
});

/**
 * GET /api/satellites/constellation/default
 * Возвращает конфигурацию созвездия Walker-Delta по умолчанию
 * (используется для демонстрации орбитальной группировки)
 */
router.get('/constellation/default', (req, res) => {
  // Конфигурация Walker-Delta: t/p/f
  // t — общее число спутников, p — число орбитальных плоскостей,
  // f — фазовый параметр (относительное смещение)
  const walkerDelta = {
    name: 'Российская демо-группировка',
    type: 'Walker-Delta',
    totalSatellites: 12,
    planes: 4,
    phasingParameter: 1,
    altitude: 550,            // км
    inclination: 97.6,        // градусы (солнечно-синхронная)
    raan0: 0,                 // RAAN первой плоскости, градусы
    description: 'Демонстрационная конфигурация Walker-Delta 12/4/1 для солнечно-синхронной орбиты',
    orbitParams: {
      semiMajorAxis: 6928.14, // км (R_Earth + 550)
      eccentricity: 0.0,
      period: 5760             // секунды (~96 минут)
    }
  };

  res.json(walkerDelta);
});

/**
 * GET /api/satellites/:id
 * Возвращает информацию о конкретном спутнике по id или NORAD ID
 */
router.get('/:id', (req, res) => {
  try {
    const catalog = loadCatalog();
    const { id } = req.params;

    // Ищем по внутреннему id или по NORAD ID
    const satellite = catalog.find(s =>
      s.id === id ||
      s.noradId === parseInt(id, 10) ||
      s.noradId === id
    );

    if (!satellite) {
      return res.status(404).json({
        error: `Спутник с идентификатором "${id}" не найден`
      });
    }

    res.json(satellite);
  } catch (err) {
    console.error('Ошибка поиска спутника:', err.message);
    res.status(500).json({ error: 'Ошибка при поиске спутника' });
  }
});

module.exports = router;
