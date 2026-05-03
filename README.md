# BOSA Hospitality – Sistema de Gestión

## Inicio rápido

### 1. Instalar dependencias

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Iniciar servidores

**Terminal 1 – Backend:**
```bash
cd backend
npm run dev
# → http://localhost:4000
```

**Terminal 2 – Frontend:**
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

---

## Credenciales por defecto

| Rol            | Email                              | Contraseña           |
|----------------|------------------------------------|----------------------|
| SuperAdmin     | superadmin@bosahospitality.com     | Bosa@SuperAdmin2024! |
| Administrador  | admin@bosahospitality.com          | Bosa@Admin2024!      |

> Los usuarios se crean automáticamente al iniciar el backend (seed en `bosa.db`).

---

## Estructura

```
sistema-bosa/
├── backend/
│   ├── src/
│   │   ├── database/init.js     ← SQLite + seed automático
│   │   ├── controllers/         ← authController
│   │   ├── middleware/          ← JWT auth + roles
│   │   └── routes/              ← /api/auth/*
│   ├── bosa.db                  ← generado automáticamente
│   └── .env
└── frontend/
    └── src/
        ├── context/AuthContext.jsx
        ├── components/ProtectedRoute.jsx
        ├── pages/Login.jsx
        └── pages/Dashboard.jsx
```

## Roles

- **superadmin** — acceso total, gestión de usuarios
- **administrator** — acceso operativo al sistema
