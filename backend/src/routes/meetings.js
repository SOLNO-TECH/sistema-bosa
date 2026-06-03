const router = require('express').Router();
const { getMeetings, createMeeting, updateMeeting, deleteMeeting, upsertMeetingRsvp } = require('../controllers/meetingController');
const {
  generateMinuteFromVoice,
  getVoiceStatus,
} = require('../controllers/meetingVoiceController');
const { uploadMeetingVoice } = require('../middleware/audioUpload');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getMeetings);
router.get('/voice/status', authenticate, getVoiceStatus);
router.post('/', authenticate, createMeeting);
router.post(
  '/:id/generate-minute-from-voice',
  authenticate,
  uploadMeetingVoice.single('audio'),
  generateMinuteFromVoice,
);
router.patch('/:id', authenticate, updateMeeting);
router.patch('/:id/rsvp', authenticate, upsertMeetingRsvp);
router.delete('/:id', authenticate, deleteMeeting);

module.exports = router;
