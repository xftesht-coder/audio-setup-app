# Быстрый старт

## 3 минуты на локальной машине

```bash
git clone <repo-url>
cd audio-setup-app
npm install
npm run dev
```

Приложение откроется на **http://localhost:3000**

---

## 10 минут на Vercel

1. Создать GitHub репозиторий с этим кодом
2. Открыть https://vercel.com
3. Нажать "New Project"
4. Выбрать репозиторий
5. Нажать Deploy
6. Готово! Сайт живёт на `*.vercel.app`

Подключение собственного домена:
- Vercel → Settings → Domains
- Добавить домен
- Скопировать DNS записи
- Добавить на хостинг домена

---

## 30 минут на VPS

Что понадобится:
- VPS с Ubuntu 20+
- Собственный домен
- SSH доступ

```bash
# На сервере

# 1. Установить Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Установить Nginx
sudo apt install -y nginx

# 3. Клонировать приложение
cd /var/www
git clone https://github.com/yourusername/audio-setup-app.git
cd audio-setup-app

# 4. Собрать
npm install
npm run build

# 5. Скопировать конфиг Nginx
sudo cp nginx.conf.example /etc/nginx/sites-available/audio-setup
sudo ln -s /etc/nginx/sites-available/audio-setup /etc/nginx/sites-enabled/

# 6. Включить SSL (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com

# 7. Запустить
sudo systemctl restart nginx

# Готово!
```

Файл `nginx.conf.example`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/audio-setup-app/dist;
    
    location / {
        try_files $uri /index.html;
    }
    
    location ~* \.(js|css|png|jpg)$ {
        expires 1y;
    }
}
```

---

## Docker (5 минут если Docker уже установлен)

```bash
# Собрать
docker build -t audio-setup .

# Запустить
docker run -p 3000:3000 audio-setup

# На сервере (за Nginx)
docker run -d -p 3000:3000 --restart always --name audio-setup audio-setup
```

---

## Структура файлов

```
audio-setup-app/
├── src/
│   ├── components/        # React компоненты
│   ├── store/            # Zustand store
│   ├── index.css         # Глобальные стили
│   └── main.jsx          # Точка входа
├── dist/                 # Собранное приложение (создаётся после npm run build)
├── package.json          # Зависимости
├── vite.config.js        # Конфиг сборки
├── tailwind.config.js    # Конфиг стилей
├── index.html            # HTML шаблон
├── Dockerfile            # Docker конфиг
├── vercel.json           # Vercel конфиг
└── README.md             # Полная документация
```

---

## Команды

```bash
npm run dev      # Разработка (localhost:3000)
npm run build    # Сборка для продакшна
npm run preview  # Просмотр собранной версии
```

---

## Технический стек

- **React 18** + Hooks
- **Vite** — сборка (очень быстрая)
- **Tailwind CSS** — стили
- **Zustand** — состояние
- **SVG** — графика

---

## Что дальше?

1. **Разработка**: Добавляй компоненты в `src/components/`
2. **Данные**: Редактируй `src/store/setupStore.js`
3. **Стили**: Используй Tailwind классы или `src/index.css`
4. **Деплой**: Следуй инструкциям в `DEPLOYMENT.md`

---

## Проблемы?

```bash
# Очистить кеш
rm -rf node_modules package-lock.json
npm install

# Проверить версии
node --version   # должен быть 16+
npm --version

# Полная переустановка
npm ci
npm run build
```

Или посмотри подробные инструкции в `DEPLOYMENT.md`
