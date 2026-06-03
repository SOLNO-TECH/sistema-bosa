const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const PLAYABLE_EXT = new Set(['.m4a', '.mp4', '.mp3', '.mpeg', '.wav', '.aac']);

function ffmpegBin() {
  return process.env.FFMPEG_BIN || 'ffmpeg';
}

/**
 * Convierte la grabación a M4A (AAC) para reproducción fiable en navegadores
 * (WebM de MediaRecorder suele mostrar 0:00 sin metadatos de duración).
 * @param {string} inputPath — ruta absoluta al archivo subido
 * @returns {Promise<string>} ruta absoluta del archivo a usar para reproducción
 */
async function ensurePlaybackAudioFile(inputPath) {
  if (!inputPath || !fs.existsSync(inputPath)) return inputPath;

  const ext = path.extname(inputPath).toLowerCase();
  if (PLAYABLE_EXT.has(ext)) {
    const size = fs.statSync(inputPath).size;
    if (size > 64) return inputPath;
  }

  const outPath = inputPath.replace(/\.[^.]+$/, '') + '.m4a';
  if (fs.existsSync(outPath)) {
    const existing = fs.statSync(outPath).size;
    if (existing > 64) {
      if (outPath !== inputPath && ext === '.webm') {
        try {
          fs.unlinkSync(inputPath);
        } catch (_) { /* noop */ }
      }
      return outPath;
    }
  }

  const ffmpeg = ffmpegBin();
  const args = [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outPath,
  ];

  await execFileAsync(ffmpeg, args, { timeout: Number(process.env.AUDIO_CONVERT_TIMEOUT_MS || 120000) });

  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 64) {
    throw new Error('La conversión de audio no generó un archivo válido.');
  }

  if (outPath !== inputPath) {
    try {
      fs.unlinkSync(inputPath);
    } catch (_) { /* noop */ }
  }

  return outPath;
}

module.exports = {
  ensurePlaybackAudioFile,
};
