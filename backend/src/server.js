require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initDatabase } = require('./database/init');
const { initPushService } = require('./services/pushService');
const path = require('path');
const fs = require('fs');

// ── Validación de secretos en arranque ─────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('\n❌ FATAL: la variable de entorno JWT_SECRET es obligatoria y debe tener al menos 16 caracteres.');
  console.error('   Define JWT_SECRET en tu archivo .env antes de iniciar el servidor.\n');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// ── Helmet con CSP compatible con el frontend React/Vite ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Scripts: solo del propio dominio. Vite hace bundling, no inyecta inline scripts.
      scriptSrc: ["'self'"],
      // Estilos: permitimos inline para Tailwind (style attribute) y emotion-style libs
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      // Imágenes: permitimos blob/data para previews y https para placeholders externos
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      // Fuentes
      fontSrc: ["'self'", "data:", "https:"],
      // Conexiones (fetch/xhr/websocket)
      connectSrc: ["'self'"],
      // Evita embedding en iframes externos
      frameAncestors: ["'none'"],
      // Sin objetos plugin obsoletos
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  // Algunas políticas COEP/COOP rompen imágenes externas, las desactivamos
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — en producción debería ser una lista blanca; en desarrollo se permite cualquier origen
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// Inicializar BD y seed al arrancar
initDatabase();
initPushService();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/ticket-tasks', require('./routes/ticketTasks'));
app.use('/api/avisos', require('./routes/avisos'));
app.use('/api/minutes', require('./routes/minutes'));
app.use('/api/forums', require('./routes/forums'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/push', require('./routes/push'));

// Archivos subidos — servir con headers de seguridad para evitar ejecución de HTML/SVG malicioso
app.use('/api/uploads', express.static(path.join(__dirname, '../data/uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Imágenes y PDFs se ven inline; el resto se descarga forzosamente
    const ext = path.extname(filePath).toLowerCase();
    const inlineExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.pdf'];
    if (!inlineExts.includes(ext)) {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    }
  },
}));

app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'BOSA Hospitality API' }));

// Servir frontend estático solo si existe el build (p. ej. tras copiar frontend/dist → backend/public)
const publicPath = path.join(__dirname, '../public');
const indexHtmlPath = path.join(publicPath, 'index.html');
const hasStaticFrontend = fs.existsSync(indexHtmlPath);

if (hasStaticFrontend) {
  app.use(express.static(publicPath));
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'Ruta API no encontrada.' });
  if (!hasStaticFrontend) {
    return res.status(404).type('text').send(
      'API BOSA: el front en desarrollo corre en Vite (http://localhost:5173). Para servir la SPA desde este puerto, genere el build y coloque index.html en backend/public.'
    );
  }
  res.sendFile(indexHtmlPath);
});

if (!hasStaticFrontend && process.env.NODE_ENV !== 'production') {
  console.log('\nℹ️  Sin backend/public/index.html — use la UI en Vite o haga build para producción.\n');
}

// Manejador de errores
app.use((err, req, res, next) => {
  // Errores de Multer / filtro de uploads → 400 con mensaje claro
  if (err && (err.name === 'MulterError' || (err.message && /Tipo de archivo|Mime type/.test(err.message)))) {
    return res.status(400).json({ message: err.message || 'Archivo inválido.' });
  }
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`\n🏨  BOSA Hospitality API corriendo en http://localhost:${PORT}\n`);
});
