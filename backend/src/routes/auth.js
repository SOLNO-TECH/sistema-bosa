const router = require('express').Router();
const { login, me, getUsers, createUser, toggleUser } = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', authenticate, me);

// Solo superadmin puede gestionar usuarios
router.get('/users', authenticate, requireRole('superadmin'), getUsers);
router.post('/users', authenticate, requireRole('superadmin'), createUser);
router.patch('/users/:id/toggle', authenticate, requireRole('superadmin'), toggleUser);

module.exports = router;
