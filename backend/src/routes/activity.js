const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getRecentActivity } = require('../controllers/activityController');

router.use(authenticate);
router.get('/recent', getRecentActivity);

module.exports = router;
