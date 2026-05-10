const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');

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

// Solo superadmin puede gestionar usuarios
router.get('/users', authenticate, requireRole('superadmin'), authController.getUsers);
router.post('/users', authenticate, requireRole('superadmin'), authController.createUser);
router.patch('/users/:id/toggle', authenticate, requireRole('superadmin'), authController.toggleUser);

module.exports = router;
