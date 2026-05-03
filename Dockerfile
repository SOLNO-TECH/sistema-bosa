# --- STAGE 1: Build Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# --- STAGE 2: Backend Runtime ---
FROM node:20-alpine
WORKDIR /app

# Instalar dependencias necesarias para compilar módulos nativos (sqlite3)
RUN apk add --no-cache python3 make g++

# Instalar dependencias del backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copiar el código del backend
COPY backend ./backend

# Copiar el build del frontend a la carpeta public del backend
COPY --from=frontend-builder /app/frontend/dist ./public

# Configuración de variables de entorno
ENV NODE_ENV=production
ENV PORT=4000

# Exponer el puerto
EXPOSE 4000

# Comando para arrancar la aplicación
CMD ["node", "backend/src/server.js"]
