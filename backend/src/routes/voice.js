const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { uploadMeetingVoice } = require('../middleware/audioUpload');
const voiceCommandController = require('../controllers/voiceCommandController');

router.use(authenticate);

router.post('/commands/reinforce', voiceCommandController.postReinforce);
router.get('/commands/help', voiceCommandController.getCommandHelp);
router.post('/warmup', voiceCommandController.postWarmup);
router.post('/commands/parse', uploadMeetingVoice.single('audio'), voiceCommandController.parseCommand);
router.post('/commands/execute', voiceCommandController.executeCommand);
router.post('/tts', voiceCommandController.postTts);

module.exports = router;
