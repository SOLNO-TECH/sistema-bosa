const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { BLOCKED_EXTENSIONS } = require('./uploadFilter');

const KNOWLEDGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
]);

function knowledgeFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Tipo de archivo no permitido: ${ext}`));
  }
  const mime = String(file.mimetype || '').toLowerCase();
  if (mime && !KNOWLEDGE_MIME_TYPES.has(mime)) {
    return cb(new Error(`Formato no permitido: ${file.mimetype}`));
  }
  cb(null, true);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../data/uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `knowledge-${unique}${ext}`);
  },
});

const uploadKnowledgeMedia = multer({
  storage,
  fileFilter: knowledgeFileFilter,
  limits: { fileSize: 80 * 1024 * 1024 },
});

module.exports = { uploadKnowledgeMedia, KNOWLEDGE_MIME_TYPES };
