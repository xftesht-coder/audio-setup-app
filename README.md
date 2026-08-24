# Audio Setup Configurator

Интерактивный конфигуратор Hi-Fi аудиосистемы с визуализацией деревянной стойки, двумя видами (спереди/сзади) и рекомендациями по оптимизации.

## Особенности

- **Интерактивная визуализация** деревянной стойки с 3D-эффектом
- **Два вида**: спередние панели и задняя часть с разъёмами
- **Три предустановленных конфигурации**: Винил, FiiO WARMER R2R, Cayin RU7
- **Рекомендации по оптимизации** для каждого сетапа
- **Параметры системы** и спецификации
- **Выбор компонентов** с информацией о каждом

## Структура проекта

```
audio-setup-app/
├── src/
│   ├── components/
│   │   ├── App.jsx               # Главный компонент
│   │   ├── Sidebar.jsx           # Боковая панель с тректами
│   │   ├── RackViewer.jsx        # Переключатель вид спереди/сзади
│   │   ├── RackFront.jsx         # Передняя панель стойки
│   │   ├── RackBack.jsx          # Задняя панель стойки
│   │   ├── InfoPanel.jsx         # Информационная панель
│   │   ├── RecommendationsBox.jsx # Рекомендации
│   │   ├── SettingsBox.jsx       # Параметры
│   │   └── SpecsBox.jsx          # Спецификации
│   ├── store/
│   │   └── setupStore.js         # Zustand store состояния
│   ├── index.css                 # Глобальные стили
│   └── main.jsx                  # Точка входа
├── index.html                    # HTML шаблон
├── vite.config.js               # Конфиг Vite
├── tailwind.config.js           # Конфиг Tailwind
├── postcss.config.js            # PostCSS конфиг
├── package.json                 # Зависимости
└── README.md                    # Этот файл
```

## Установка

### Требования
- Node.js 16+ 
- npm или yarn

### Локальная разработка

```bash
# Клонировать репозиторий
git clone <repo-url>
cd audio-setup-app

# Установить зависимости
npm install

# Запустить dev сервер
npm run dev

# Приложение откроется на http://localhost:3000
```

## Сборка и деплой

### Сборка для продакшна

```bash
npm run build
```

Результат будет в папке `dist/` — готов к развертыванию.

### Развертывание на Vercel

1. Экспортировать репозиторий на GitHub
2. Подключить на [Vercel](https://vercel.com)
3. Настройки по умолчанию:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

### Развертывание на VPS/выделенный сервер

```bash
# На сервере
cd /var/www/audio-setup-app

# Установить зависимости
npm install --production=false

# Собрать
npm run build

# Сконфигурировать Nginx
sudo nano /etc/nginx/sites-available/default
```

Пример Nginx конфига:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/audio-setup-app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Перезапустить Nginx:
```bash
sudo systemctl restart nginx
```

### Docker деплой

Создать `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:18-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=0 /app/dist ./dist

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

Собрать и запустить:
```bash
docker build -t audio-setup-app .
docker run -p 3000:3000 audio-setup-app
```

## Использование

1. **Выбрать тракт** — слева выберите одну из трёх конфигураций
2. **Переключить вид** — нажмите "Спереди" или "Сзади"
3. **Выбрать компонент** — кликните на компонент в стойке
4. **Прочитать рекомендации** — справа показаны подсказки по оптимизации

## Технологический стек

- **React 18** — UI фреймворк
- **Vite** — быстрая сборка
- **Tailwind CSS** — стили
- **Zustand** — управление состоянием
- **SVG** — векторная графика для стойки

## Возможные улучшения

- [ ] Перетаскивание компонентов
- [ ] Интерактивные кабели между компонентами
- [ ] Сохранение собственных конфигураций
- [ ] Расширенный калькулятор акустики
- [ ] Экспорт конфигурации в PDF
- [ ] Тёмный режим

## Лицензия

MIT
