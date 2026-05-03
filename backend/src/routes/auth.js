const router = require('express').Router();
const authController = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/login', authController.login);
router.get('/me', authenticate, authController.me);

// Solo superadmin puede gestionar usuarios
router.get('/users', authenticate, requireRole('superadmin'), authController.getUsers);
router.post('/users', authenticate, requireRole('superadmin'), authController.createUser);
router.patch('/users/:id/toggle', authenticate, requireRole('superadmin'), authController.toggleUser);

module.exports = router;
