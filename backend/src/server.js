require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database/init');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// Inicializar BD y seed al arrancar
initDatabase();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/avisos', require('./routes/avisos'));
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
  console.log(`\n🏨  BOSA Hospitality API corriendo en http://localhost:${PORT}`);
  console.log(`    Credenciales por defecto:`);
  console.log(`    SuperAdmin → superadmin@bosa.mx / Bosa@SuperAdmin2024!`);
  console.log(`    Admin     → admin@bosa.mx / Bosa@Admin2024!\n`);
});
