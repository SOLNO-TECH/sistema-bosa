const express = require('express');
const router = express.Router();
const avisoController = require('../controllers/avisoController');

router.get('/', avisoController.getAvisos);
router.post('/', avisoController.createAviso);
router.delete('/:id', avisoController.deleteAviso);

module.exports = router;
