const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');

// Todas las rutas de usuarios requieren autenticación
router.use(authenticate);

// Listar usuarios — disponible para cualquier autenticado (lo usan varios módulos)
router.get('/', userController.getUsers);

// Operaciones administrativas — solo superadmin
router.post('/', requireRole('superadmin'), userController.createUser);
router.put('/:id', requireRole('superadmin'), userController.updateUser);
router.delete('/:id', requireRole('superadmin'), userController.deleteUser);

// Cambio de contraseña — el propio usuario o superadmin (la lógica está en el controller)
router.put('/:id/password', userController.changePassword);

module.exports = router;
