# Развёртывание StarVision

## Требования

- **Node.js** >= 16.0
- **npm** >= 8.0
- Современный браузер с поддержкой WebGL 2.0 и ES Modules

## Локальная установка

```bash
# 1. Клонирование репозитория
git clone https://github.com/pmixay/starvision.git
cd starvision

# 2. Установка зависимостей
npm install

# 3. Запуск в режиме разработки
npm run dev
```

Приложение доступно: `http://localhost:3000`

## Режимы запуска

### Полный стек (Backend + Frontend)
```bash
npm run dev
```
Запускает Express-сервер, который обслуживает статические файлы фронтенда и API.

### Только Frontend (без сервера)
```bash
npm run frontend
```
Запускает простой HTTP-сервер для фронтенда. Работает без API — AI-ассистент переходит в локальный режим.

### Только Backend
```bash
npm run backend
```
Запускает API-сервер на порту 3000.

## Переменные окружения

Создайте файл `.env` в корне проекта (опционально):

```env
PORT=3000
NODE_ENV=development
AI_API_KEY=your_api_key_here
CELESTRAK_CACHE_TTL=3600
```

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `PORT` | 3000 | Порт сервера |
| `NODE_ENV` | development | Режим работы |
| `AI_API_KEY` | — | Ключ API для внешней нейросети |
| `CELESTRAK_CACHE_TTL` | 3600 | Время кэширования TLE данных (сек) |

## Деплой на VPS / облако

### Docker (опционально)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "backend/server.js"]
```

```bash
docker build -t starvision .
docker run -p 3000:3000 starvision
```

### Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name starvision.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### GitHub Pages (только Frontend)

Для статического хостинга без бэкенда:

```bash
# Деплой папки frontend/ на GitHub Pages
# AI-ассистент будет работать в офлайн-режиме (только локальные команды)
```

## Статический режим (без Node.js)

Фронтенд полностью работоспособен без бэкенда. Достаточно открыть `frontend/index.html` через любой HTTP-сервер:

```bash
# Python
cd frontend && python3 -m http.server 8080

# npx
npx serve frontend

# VS Code Live Server
# Откройте frontend/index.html → Go Live
```

> **Важно:** ES модули требуют HTTP-сервер. Открытие через `file://` не поддерживается браузерами.

## Решение проблем

### WebGL не работает
- Убедитесь, что GPU-ускорение включено в браузере
- Проверьте: `chrome://gpu` (Chrome) или `about:support` (Firefox)

### Текстуры не загружаются
- Текстуры загружаются с CDN (unpkg.com). Проверьте интернет-соединение
- При необходимости скачайте текстуры локально в `frontend/assets/textures/`

### ES модули не загружаются
- Файлы должны обслуживаться через HTTP-сервер, не через `file://`
- Проверьте MIME-тип: файлы `.js` должны отдаваться как `application/javascript`

### Порт занят
```bash
# Найти процесс на порту
lsof -i :3000
# Или использовать другой порт
PORT=8080 npm run dev
```
