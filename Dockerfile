FROM node:22-alpine

WORKDIR /app

# Устанавливаем необходимые зависимости для работы Prisma на Alpine
RUN apk add --no-cache openssl curl

# Копируем файлы зависимостей
COPY package.json package-lock.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем весь проект
COPY . .

# Генерируем Prisma-клиент и собираем проект
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Запускаем скрипт start, который включает миграции, Next.js и cron
CMD ["npm", "run", "start"]
