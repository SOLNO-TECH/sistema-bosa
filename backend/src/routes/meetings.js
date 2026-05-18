const router = require('express').Router();
const { getMeetings, createMeeting, updateMeeting, deleteMeeting } = require('../controllers/meetingController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getMeetings);
router.post('/', authenticate, createMeeting);
router.patch('/:id', authenticate, updateMeeting);
router.delete('/:id', authenticate, deleteMeeting);

module.exports = router;
