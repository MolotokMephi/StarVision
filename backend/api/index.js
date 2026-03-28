/**
 * Агрегатор API-маршрутов
 *
 * Собирает все маршруты в единый роутер
 * и монтирует их по соответствующим префиксам.
 */

const express = require('express');
const router = express.Router();

const satellitesRoutes = require('./routes/satellites');
const tleRoutes = require('./routes/tle');
const aiRoutes = require('./routes/ai');

// Монтируем маршруты
router.use('/satellites', satellitesRoutes);
router.use('/tle', tleRoutes);
router.use('/ai', aiRoutes);

// Корневой маршрут API — информация о сервисе
router.get('/', (req, res) => {
  res.json({
    service: 'StarVision API',
    version: '1.0.0',
    description: 'API цифрового двойника российской группировки кубсатов',
    endpoints: {
      satellites: '/api/satellites',
      tle: '/api/tle',
      ai: '/api/ai'
    }
  });
});

module.exports = router;
