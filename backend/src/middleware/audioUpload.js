const multer = require('multer');
const path = require('path');
const fs = require('fs');

const AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
  'audio/m4a',
  'video/webm',
  'video/mp4',
]);

const AUDIO_EXT = new Set(['.webm', '.ogg', '.mp3', '.mpeg', '.wav', '.m4a', '.mp4', '.aac']);

function audioFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  if (AUDIO_EXT.has(ext) || AUDIO_MIMES.has(mime)) {
    return cb(null, true);
  }
  return cb(new Error('Solo se permiten archivos de audio (webm, wav, mp3, ogg).'));
}

const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../data/uploads/voice');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const meetingId = req.params.id || 'meeting';
    const ext = path.extname(file.originalname || '') || '.webm';
    cb(null, `meeting-${meetingId}-${Date.now()}${ext}`);
  },
});

const uploadMeetingVoice = multer({
  storage: voiceStorage,
  fileFilter: audioFilter,
  limits: { fileSize: Number(process.env.VOICE_MAX_MB || 80) * 1024 * 1024 },
});

module.exports = { uploadMeetingVoice };
