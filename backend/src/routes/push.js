const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pushController');
const { authenticate } = require('../middleware/auth');

router.get('/vapid-public-key', ctrl.getPublicKey);

router.use(authenticate);
router.post('/subscribe', ctrl.subscribe);
router.post('/unsubscribe', ctrl.unsubscribe);

module.exports = router;
