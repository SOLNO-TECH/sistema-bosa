const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const authController = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');

const imageFilter = (req, file, cb) => {
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((file.mimetype || '').toLowerCase());
  if (!ok) return cb(new Error('Solo imágenes JPG, PNG o WebP'));
  cb(null, true);
};

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../data/uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: imageFilter,
});

// Rate limit estricto en login: 8 intentos / 15 min por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.' },
});

// Rate limit moderado en refresh: 30 / 15 min por IP
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes de refresh.' },
});

router.post('/login', loginLimiter, authController.login);
router.post('/refresh', refreshLimiter, authController.refresh);
router.get('/me', authenticate, authController.me);
router.post('/me/avatar', authenticate, uploadAvatar.single('avatar'), authController.uploadAvatar);

// Solo superadmin puede gestionar usuarios
router.get('/users', authenticate, requireRole('superadmin'), authController.getUsers);
router.post('/users', authenticate, requireRole('superadmin'), authController.createUser);
router.patch('/users/:id/toggle', authenticate, requireRole('superadmin'), authController.toggleUser);

module.exports = router;
