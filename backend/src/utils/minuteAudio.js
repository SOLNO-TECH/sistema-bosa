const path = require('path');
const fs = require('fs');

const UPLOADS_ROOT = path.join(__dirname, '../../data/uploads');

function uploadsRoot() {
  return UPLOADS_ROOT;
}

function relativeAudioPath(absolutePath) {
  if (!absolutePath) return null;
  const rel = path.relative(UPLOADS_ROOT, absolutePath).replace(/\\/g, '/');
  if (rel.startsWith('..')) return null;
  return rel;
}

function resolveAudioFile(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return null;
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  const full = path.join(UPLOADS_ROOT, normalized);
  if (!full.startsWith(UPLOADS_ROOT)) return null;
  if (!fs.existsSync(full)) return null;
  return full;
}

function mimeForAudio(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.mpeg': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.aac': 'audio/aac',
  };
  return map[ext] || 'application/octet-stream';
}

function deleteAudioFileIfExists(relativePath) {
  const full = resolveAudioFile(relativePath);
  if (!full) return;
  try {
    fs.unlinkSync(full);
  } catch (_) { /* noop */ }
}

/** Envía audio con soporte Range (necesario para duración y seek en <audio>). */
function streamAudioFile(req, res, fullPath) {
  if (!fullPath || !fs.existsSync(fullPath)) {
    if (!res.headersSent) res.status(404).json({ message: 'Archivo de audio no encontrado.' });
    return;
  }

  const stat = fs.statSync(fullPath);
  const fileSize = stat.size;
  const mime = mimeForAudio(fullPath);

  res.setHeader('Content-Type', mime);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader).trim());
    if (match) {
      let start = match[1] !== '' ? parseInt(match[1], 10) : 0;
      let end = match[2] !== '' ? parseInt(match[2], 10) : fileSize - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= fileSize) end = fileSize - 1;
      if (start > end || start >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        res.end();
        return;
      }
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', String(chunkSize));
      const stream = fs.createReadStream(fullPath, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).json({ message: 'Error al leer el audio.' });
      });
      stream.pipe(res);
      return;
    }
  }

  res.setHeader('Content-Length', String(fileSize));
  const stream = fs.createReadStream(fullPath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).json({ message: 'Error al leer el audio.' });
  });
  stream.pipe(res);
}

module.exports = {
  uploadsRoot,
  relativeAudioPath,
  resolveAudioFile,
  mimeForAudio,
  deleteAudioFileIfExists,
  streamAudioFile,
};
