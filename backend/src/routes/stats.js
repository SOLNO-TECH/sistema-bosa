const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

router.get('/performance', statsController.getPerformanceStats);

module.exports = router;
