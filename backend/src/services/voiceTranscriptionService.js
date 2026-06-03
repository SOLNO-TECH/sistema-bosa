const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { transcribeViaServer } = require('./whisperServerService');
const { whisperPrompt } = require('../utils/whisperPrompt');
const { getUserWhisperHints } = require('./voice/voiceLearningService');
const { buildCatalogHints, buildWhisperHints } = require('./voice/voiceContextHints');

const execFileAsync = promisify(execFile);

function isConfigured() {
  return Boolean(process.env.WHISPER_BIN && process.env.WHISPER_MODEL);
}

function commandExists(cmd) {
  if (!cmd) return Promise.resolve(false);
  if (path.isAbsolute(cmd) || cmd.includes('\\') || cmd.includes('/')) {
    return Promise.resolve(fs.existsSync(cmd));
  }
  return new Promise((resolve) => {
    const check = process.platform === 'win32' ? 'where' : 'which';
    execFile(check, [cmd], (err) => resolve(!err));
  });
}

async function convertToWav16k(inputPath, outputPath) {
  const ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg';
  const hasFfmpeg = await commandExists(ffmpeg);
  if (!hasFfmpeg) {
    throw new Error(
      'ffmpeg no está instalado. Instálalo o define FFMPEG_BIN en .env para transcribir audio.',
    );
  }

  const maxSec = Number(process.env.WHISPER_MAX_SECONDS || 25);
  const args = ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le'];
  if (maxSec > 0) args.push('-t', String(maxSec));
  args.push(outputPath);

  await execFileAsync(ffmpeg, args, { timeout: 60000 });
}

async function runWhisperCli(wavPath, outDir, userHints = [], catalogHints = '') {
  const whisperBin = process.env.WHISPER_BIN;
  const model = process.env.WHISPER_MODEL;
  const lang = process.env.WHISPER_LANGUAGE || 'es';
  const threads = String(process.env.WHISPER_THREADS || Math.min(8, os.cpus().length || 4));

  const args = [
    '-m',
    model,
    '-f',
    wavPath,
    '-l',
    lang,
    '-otxt',
    '-of',
    path.join(outDir, 'transcript'),
    '-t',
    threads,
    '-nt',
    '-bs',
    '1',
    '-bo',
    '1',
  ];

  const prompt = whisperPrompt(userHints, catalogHints);
  if (prompt) {
    args.push('--prompt', prompt);
  }

  await execFileAsync(whisperBin, args, {
    timeout: Number(process.env.WHISPER_TIMEOUT_MS || 600000),
    cwd: path.dirname(whisperBin),
  });

  const txtPath = path.join(outDir, 'transcript.txt');
  if (!fs.existsSync(txtPath)) {
    throw new Error('Whisper no generó archivo de transcripción.');
  }
  return fs.readFileSync(txtPath, 'utf8').trim();
}

/**
 * Transcribe archivo de audio con whisper.cpp (self-hosted).
 * @param {string} audioPath — ruta absoluta al archivo subido
 * @returns {Promise<string>}
 */
async function transcribeAudioFile(audioPath, options = {}) {
  if (!isConfigured()) {
    const err = new Error(
      'Transcripción local no configurada. Define WHISPER_BIN y WHISPER_MODEL en backend/.env',
    );
    err.code = 'WHISPER_NOT_CONFIGURED';
    throw err;
  }

  const userHints = options.userHints || (options.userId ? getUserWhisperHints(options.userId) : []);
  const catalogHints = options.users?.length ? buildCatalogHints(options.users) : '';
  const mergedHints = options.users?.length ? buildWhisperHints(options.users, userHints) : userHints;

  const workDir = path.join(path.dirname(audioPath), `stt-${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });
  const wavPath = path.join(workDir, 'input.wav');

  try {
    await convertToWav16k(audioPath, wavPath);

    if (process.env.WHISPER_USE_SERVER !== 'false') {
      try {
        const fromServer = await transcribeViaServer(wavPath, { userHints: mergedHints, catalogHints });
        if (fromServer) return fromServer;
      } catch (err) {
        console.warn('[Whisper] Fallback a CLI:', err.message);
      }
    }

    return await runWhisperCli(wavPath, workDir, mergedHints, catalogHints);
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (_) { /* noop */ }
  }
}

module.exports = {
  isConfigured,
  transcribeAudioFile,
};
