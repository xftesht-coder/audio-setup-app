# Этап 1: Сборка
FROM node:18-alpine AS builder

WORKDIR /app

# Скопировать package файлы
COPY package*.json ./

# Установить зависимости
RUN npm ci --only=production=false

# Скопировать исходный код
COPY . .

# Собрать приложение
RUN npm run build

# Этап 2: Runtime (лёгкий образ)
FROM node:18-alpine

WORKDIR /app

# Установить serve для раздачи статики
RUN npm install -g serve

# Скопировать собранное приложение из builder
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Открыть порт
EXPOSE 3000

# Запустить приложение
CMD ["serve", "-s", "dist", "-l", "3000"]
