// Filtro de tipos de archivo permitidos para uploads
// Bloquea ejecutables, scripts y formatos riesgosos (SVG, HTML, etc.)

const ALLOWED_MIME_TYPES = new Set([
  // Imágenes (sin SVG por seguridad XSS)
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',

  // Documentos Office
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // Texto plano
  'text/plain',
  'text/csv',

  // Comprimidos
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.vbs', '.js',
  '.jse', '.ps1', '.sh', '.app', '.dmg', '.deb', '.rpm', '.apk',
  '.html', '.htm', '.svg', '.xhtml', '.jar', '.dll', '.so',
]);

const path = require('path');

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Tipo de archivo no permitido: ${ext}`));
  }

  // Si tiene mime type, validamos contra la lista
  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    return cb(new Error(`Mime type no permitido: ${file.mimetype}`));
  }

  cb(null, true);
}

module.exports = { fileFilter, ALLOWED_MIME_TYPES, BLOCKED_EXTENSIONS };
