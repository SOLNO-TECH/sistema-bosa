const express = require('express');
const router = express.Router();
const avisoController = require('../controllers/avisoController');
const { authenticate } = require('../middleware/auth');

// Todas las rutas de avisos requieren autenticación
router.use(authenticate);

router.get('/', avisoController.getAvisos);
router.post('/', avisoController.createAviso);
router.delete('/:id', avisoController.deleteAviso);

module.exports = router;
