/**
 * StarVision — Сервер визуализации цифрового двойника
 * российской группировки кубсатов
 *
 * Основной сервер Express: раздаёт статику фронтенда
 * и монтирует API-маршруты.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Загружаем переменные окружения из .env (если есть)
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const apiRoutes = require('./api/index');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---

// Разрешаем кросс-доменные запросы (CORS)
app.use(cors());

// Парсинг JSON-тела запросов
app.use(express.json());

// --- Статические файлы фронтенда ---
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- API-маршруты ---
app.use('/api', apiRoutes);

// --- Фолбэк: отдаём index.html для SPA-навигации ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Запуск сервера ---
app.listen(PORT, () => {
  console.log(`🛰️  StarVision сервер запущен на http://localhost:${PORT}`);
  console.log(`   API доступен по адресу http://localhost:${PORT}/api`);
});

module.exports = app;
