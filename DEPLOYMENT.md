# Инструкции по развертыванию

Выбери способ развертывания в зависимости от твоих предпочтений.

## Быстро и просто (Vercel)

Самый простой способ — на Vercel (создатели Next.js).

1. **Создать GitHub репозиторий**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/audio-setup-app.git
   git push -u origin main
   ```

2. **Подключить на Vercel**
   - Перейти на https://vercel.com
   - Нажать "New Project"
   - Выбрать твой GitHub репозиторий
   - Vercel автоматически подберёт настройки
   - Нажать Deploy

3. **Результат**
   - Сайт доступен на `audio-setup-app.vercel.app`
   - Можно подключить собственный домен
   - Автоматический деплой при push в main

---

## На своём домене + VPS

Если у тебя уже есть VPS или выделенный сервер.

### Шаг 1: Подготовка сервера

```bash
# SSH на сервер
ssh root@your-server-ip

# Обновить систему
apt update && apt upgrade -y

# Установить Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверить версию
node --version
npm --version

# Установить Nginx
sudo apt install -y nginx

# Установить PM2 (для запуска приложения в фоне)
sudo npm install -g pm2
```

### Шаг 2: Развернуть приложение

```bash
# Перейти в рабочую директорию
cd /var/www

# Клонировать репозиторий
git clone https://github.com/yourusername/audio-setup-app.git
cd audio-setup-app

# Установить зависимости
npm install --production=false

# Собрать приложение
npm run build

# Проверить что всё собралось
ls -la dist/
```

### Шаг 3: Настроить Nginx

```bash
# Создать конфиг Nginx
sudo nano /etc/nginx/sites-available/audio-setup

# Вставить конфиг ниже
```

Содержимое `/etc/nginx/sites-available/audio-setup`:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/audio-setup-app/dist;
    index index.html index.htm;

    # Кешировать статические файлы на 1 год
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA routing - всё отправлять в index.html
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Запретить доступ к скрытым файлам
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

Включить конфиг:
```bash
# Создать симссылку
sudo ln -s /etc/nginx/sites-available/audio-setup /etc/nginx/sites-enabled/audio-setup

# Удалить default конфиг если нужно
sudo rm /etc/nginx/sites-enabled/default

# Проверить синтаксис
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx

# Включить автозапуск
sudo systemctl enable nginx
```

### Шаг 4: HTTPS с Let's Encrypt

```bash
# Установить Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получить сертификат
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Разрешить автоматическое обновление
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Проверить
sudo systemctl status certbot.timer
```

### Шаг 5: Настроить автоматические обновления

```bash
# Создать скрипт обновления
sudo nano /usr/local/bin/update-audio-setup.sh

# Содержимое скрипта:
```

```bash
#!/bin/bash

cd /var/www/audio-setup-app
git pull origin main
npm install --production=false
npm run build

echo "✅ Обновление завершено"
echo "⚠️ Перезагрузи браузер для обновления"
```

```bash
# Сделать исполняемым
sudo chmod +x /usr/local/bin/update-audio-setup.sh

# Можно запускать вручную:
update-audio-setup.sh

# Или через cron (раз в день в 2 часа ночи):
crontab -e
# 0 2 * * * /usr/local/bin/update-audio-setup.sh >> /var/log/audio-setup-update.log 2>&1
```

### Настройка безопасности

```bash
# Добавить HTTP Security Headers к Nginx конфигу
sudo nano /etc/nginx/sites-available/audio-setup

# Добавить в блок server:
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;

# Проверить и перезагрузить
sudo nginx -t
sudo systemctl reload nginx
```

---

## Docker (на любом хосте)

Если у тебя есть Docker.

### Вариант 1: Docker Hub

```bash
# Собрать образ локально
docker build -t yourusername/audio-setup:latest .

# Залить на Docker Hub
docker login
docker push yourusername/audio-setup:latest

# На сервере:
docker pull yourusername/audio-setup:latest
docker run -d -p 3000:3000 --name audio-setup yourusername/audio-setup:latest

# Останавливать/перезапускать:
docker stop audio-setup
docker start audio-setup
```

### Вариант 2: Docker Compose

Создать `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    restart: always
    environment:
      NODE_ENV: production

  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: always
```

```bash
# Запустить
docker-compose up -d

# Остановить
docker-compose down

# Логи
docker-compose logs -f app
```

---

## Мониторинг и поддержка

### Проверить статус на VPS

```bash
# Проверить место на диске
df -h

# Проверить использование памяти
free -h

# Проверить логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Проверить статус
sudo systemctl status nginx
sudo systemctl status certbot.timer
```

### Резервная копия

```bash
# Создать резервную копию
tar -czf ~/audio-setup-backup-$(date +%Y%m%d).tar.gz /var/www/audio-setup-app

# Восстановить из резервной копии
tar -xzf audio-setup-backup-20240101.tar.gz -C /
```

---

## Что выбрать?

| Платформа | Сложность | Стоимость | Масштабируемость |
|-----------|-----------|----------|------------------|
| **Vercel** | Очень просто | Бесплатно | Отличная |
| **VPS + Nginx** | Средне | ~5-10$/мес | Хорошая |
| **Docker** | Средне | Зависит от хоста | Отличная |

**Рекомендация**: Начни с Vercel, это займёт 10 минут. Если нужно больше контроля — переходи на VPS.
