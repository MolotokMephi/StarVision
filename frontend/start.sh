#!/bin/bash
# StarGrid Frontend — Start Script

echo "⭐ StarGrid Frontend"
echo "===================="

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi

echo ""
echo "🚀 Запуск dev-сервера: http://localhost:3000"
echo "   API proxy → http://localhost:8000"
echo ""

npm run dev
