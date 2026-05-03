const router = require('express').Router();
const { getMeetings, createMeeting, deleteMeeting } = require('../controllers/meetingController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getMeetings);
router.post('/', authenticate, createMeeting);
router.delete('/:id', authenticate, deleteMeeting);

module.exports = router;
