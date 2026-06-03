const express = require('express');
const router = express.Router();
const minuteController = require('../controllers/minuteController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', minuteController.listMinutes);
router.get('/:id/audio', minuteController.streamMinuteAudio);
router.get('/:id', minuteController.getMinute);
router.post('/', minuteController.createMinute);
router.put('/:id', minuteController.updateMinute);
router.delete('/:id', minuteController.deleteMinute);

module.exports = router;
