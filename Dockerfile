# --- STAGE 1: Build Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# --- STAGE 2: Backend Runtime ---
FROM node:20-alpine
WORKDIR /app/backend

# Instalar dependencias necesarias para módulos nativos (sqlite3)
RUN apk add --no-cache python3 make g++

# Instalar dependencias del backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copiar el código del backend
COPY backend ./

# Crear carpeta public y copiar el build del frontend ahí
RUN mkdir -p public
COPY --from=frontend-builder /app/frontend/dist ./public

# Configuración de variables de entorno
ENV NODE_ENV=production
ENV PORT=4000

# Exponer el puerto
EXPOSE 4000

# Comando para arrancar la aplicación
CMD ["node", "src/server.js"]
