require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database/init');
const path = require('path');

// ── Validación de secretos en arranque ─────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('\n❌ FATAL: la variable de entorno JWT_SECRET es obligatoria y debe tener al menos 16 caracteres.');
  console.error('   Define JWT_SECRET en tu archivo .env antes de iniciar el servidor.\n');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// CORS — en producción debería ser una lista blanca; en desarrollo se permite cualquier origen
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// Inicializar BD y seed al arrancar
initDatabase();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/avisos', require('./routes/avisos'));
app.use('/api/forums', require('./routes/forums'));
app.use('/api/uploads', express.static(path.join(__dirname, '../data/uploads')));

app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'BOSA Hospitality API' }));

// Servir Frontend en Producción
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'Ruta API no encontrada.' });
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`\n🏨  BOSA Hospitality API corriendo en http://localhost:${PORT}\n`);
});
