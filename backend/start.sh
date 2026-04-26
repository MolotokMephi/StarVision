#!/bin/bash
# StarVision Backend — Start Script

echo "⭐ StarVision Backend"
echo "==================="

cd "$(dirname "$0")"

# Virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Создание виртуального окружения..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "📦 Установка зависимостей..."
pip install -r requirements.txt --quiet

# .env
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "⚠️  Создан .env файл — пропишите OPENROUTER_API_KEY для StarAI"
fi

echo ""
echo "🚀 Запуск сервера: http://localhost:8000"
echo "📖 Swagger docs:   http://localhost:8000/docs"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000
