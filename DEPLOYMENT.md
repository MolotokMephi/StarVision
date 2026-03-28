# Развёртывание StarVision

## Требования

- **Node.js** >= 18.0 (рекомендуется LTS)
- **npm** >= 9.0
- **Nginx** >= 1.18 (для reverse-proxy и HTTPS)
- Современный браузер с поддержкой WebGL 2.0 и ES Modules

---

## Локальная установка (разработка)

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

### Режимы запуска

| Команда | Описание |
|---------|----------|
| `npm run dev` | Полный стек: Express + статика фронтенда |
| `npm run frontend` | Только фронтенд (без API, AI в офлайн-режиме) |
| `npm run backend` | Только API-сервер на порту 3000 |

---

## Развёртывание на Linux-сервере (без Docker)

### 1. Подготовка сервера

```bash
# Обновить пакеты
sudo apt update && sudo apt upgrade -y

# Установить необходимые утилиты
sudo apt install -y git curl nginx
```

### 2. Установка Node.js через nvm (рекомендуется)

```bash
# Скачать и запустить установщик nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Применить изменения в текущей сессии
source ~/.bashrc

# Установить Node.js LTS
nvm install --lts
nvm use --lts

# Проверить версии
node -v   # ожидается v20.x.x или v22.x.x
npm -v    # ожидается v10.x.x
```

Альтернатива — установка через apt (менее актуальная версия):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Клонирование проекта

```bash
# Создать директорию для приложений (если ещё нет)
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www

# Клонировать репозиторий
cd /var/www
git clone https://github.com/pmixay/starvision.git
cd starvision
```

### 4. Установка зависимостей и настройка окружения

```bash
# Установить зависимости (только production)
npm ci --omit=dev

# Создать файл переменных окружения
cp .env.example .env 2>/dev/null || touch .env
nano .env
```

Содержимое `.env`:

```env
PORT=3000
NODE_ENV=production
AI_API_KEY=your_api_key_here
CELESTRAK_CACHE_TTL=3600
```

### 5. Проверка работоспособности вручную

```bash
# Запустить сервер вручную — убедиться что всё работает
node backend/server.js

# В другом терминале проверить ответ
curl http://localhost:3000
# Остановить Ctrl+C
```

### 6. Настройка systemd-сервиса (автозапуск)

Создать unit-файл:

```bash
sudo nano /etc/systemd/system/starvision.service
```

Содержимое файла:

```ini
[Unit]
Description=StarVision Node.js App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/starvision
ExecStart=/usr/bin/node backend/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=starvision
EnvironmentFile=/var/www/starvision/.env

[Install]
WantedBy=multi-user.target
```

> **Важно:** Если Node.js установлен через nvm, замените `/usr/bin/node` на полный путь:
> ```bash
> which node   # например: /home/youruser/.nvm/versions/node/v20.19.0/bin/node
> ```

Права на директорию и запуск сервиса:

```bash
# Передать права на директорию пользователю www-data
sudo chown -R www-data:www-data /var/www/starvision

# Перечитать конфигурацию systemd
sudo systemctl daemon-reload

# Включить автозапуск при старте системы
sudo systemctl enable starvision

# Запустить сервис
sudo systemctl start starvision

# Проверить статус
sudo systemctl status starvision
```

Полезные команды для управления сервисом:

```bash
sudo systemctl stop starvision      # остановить
sudo systemctl restart starvision   # перезапустить
sudo journalctl -u starvision -f    # смотреть логи в реальном времени
sudo journalctl -u starvision -n 100  # последние 100 строк логов
```

### 7. Настройка Nginx как reverse-proxy

```bash
# Создать конфиг сайта
sudo nano /etc/nginx/sites-available/starvision
```

**Вариант A — HTTP (без SSL):**

```nginx
server {
    listen 80;
    server_name your-domain.com;   # или IP-адрес сервера

    # Логи
    access_log /var/log/nginx/starvision.access.log;
    error_log  /var/log/nginx/starvision.error.log;

    # Проксирование запросов к Node.js
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # Кэширование статических ресурсов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host $host;
        expires            7d;
        add_header         Cache-Control "public, immutable";
    }
}
```

**Вариант B — HTTPS с Let's Encrypt (рекомендуется для production):**

```bash
# Установить certbot
sudo apt install -y certbot python3-certbot-nginx

# Получить сертификат (замените your-domain.com на ваш домен)
sudo certbot --nginx -d your-domain.com
```

Certbot автоматически обновит конфиг Nginx. Итоговый вид:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    access_log /var/log/nginx/starvision.access.log;
    error_log  /var/log/nginx/starvision.error.log;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активировать конфиг и перезапустить Nginx:

```bash
# Создать символическую ссылку (активировать сайт)
sudo ln -s /etc/nginx/sites-available/starvision /etc/nginx/sites-enabled/

# Проверить синтаксис конфига
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx
```

### 8. Настройка файрвола

```bash
# UFW (Uncomplicated Firewall)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # открывает 80 и 443

# Если используете только HTTP
# sudo ufw allow 'Nginx HTTP'

sudo ufw enable
sudo ufw status
```

### 9. Обновление приложения

```bash
cd /var/www/starvision

# Получить последние изменения
git pull origin main

# Обновить зависимости (если изменился package.json)
npm ci --omit=dev

# Перезапустить сервис
sudo systemctl restart starvision
```

---

## Переменные окружения

Создайте файл `.env` в корне проекта:

```env
PORT=3000
NODE_ENV=production
AI_API_KEY=your_api_key_here
CELESTRAK_CACHE_TTL=3600
```

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `PORT` | 3000 | Порт Node.js сервера |
| `NODE_ENV` | development | Режим: `development` / `production` |
| `AI_API_KEY` | — | Ключ API для AI-ассистента |
| `CELESTRAK_CACHE_TTL` | 3600 | Время кэша TLE-данных (секунды) |

---

## Статический режим (без Node.js)

Фронтенд полностью работоспособен без бэкенда. Достаточно открыть `frontend/index.html` через любой HTTP-сервер:

```bash
# Python
cd frontend && python3 -m http.server 8080

# npx
npx serve frontend
```

> **Важно:** ES-модули требуют HTTP-сервер. Открытие через `file://` не поддерживается браузерами.

---

## Решение проблем

### Сервис не запускается

```bash
# Смотреть подробные логи
sudo journalctl -u starvision -n 50 --no-pager

# Проверить, слушает ли Node.js нужный порт
ss -tlnp | grep 3000
```

### Nginx возвращает 502 Bad Gateway

- Убедитесь, что Node.js запущен: `sudo systemctl status starvision`
- Проверьте порт в конфиге Nginx — должен совпадать с `PORT` в `.env`

### Ошибка прав доступа

```bash
# Проверить владельца файлов
ls -la /var/www/starvision

# Исправить права
sudo chown -R www-data:www-data /var/www/starvision
```

### WebGL не работает

- Убедитесь, что GPU-ускорение включено в браузере
- Проверьте: `chrome://gpu` (Chrome) или `about:support` (Firefox)

### Текстуры не загружаются

- Текстуры загружаются с CDN (unpkg.com). Проверьте интернет-соединение на сервере
- При необходимости скачайте текстуры локально в `frontend/assets/textures/`

### Порт занят

```bash
# Найти процесс на порту
sudo ss -tlnp | grep :3000
# или
sudo lsof -i :3000

# Использовать другой порт
PORT=8080 node backend/server.js
```

### Let's Encrypt — ошибка обновления сертификата

```bash
# Проверить автообновление
sudo certbot renew --dry-run

# Принудительное обновление
sudo certbot renew --force-renewal
```
