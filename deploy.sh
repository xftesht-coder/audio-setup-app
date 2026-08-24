#!/bin/bash

set -e

echo "🚀 Audio Setup Configurator - Deploy Script"
echo ""

if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi

echo "🔨 Сборка приложения..."
npm run build

echo ""
echo "✅ Сборка завершена!"
echo "📁 Результаты в папке: ./dist"
echo ""
echo "Команды:"
echo "  npm run dev      - Запуск локального сервера (разработка)"
echo "  npm run build    - Сборка для продакшна"
echo "  npm run preview  - Просмотр собранной версии"
echo ""
echo "Развертывание:"
echo "  Vercel: git push (автоматически подберёт конфиг)"
echo "  Nginx:  скопировать dist/* в /var/www/html"
echo "  Docker: docker build -t app . && docker run -p 3000:3000 app"
echo ""
