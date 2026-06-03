const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const net = require('net');
const { whisperPrompt } = require('../utils/whisperPrompt');

let serverProcess = null;
let readyPromise = null;
let ready = false;

function whisperConfigured() {
  return Boolean(process.env.WHISPER_BIN && process.env.WHISPER_MODEL);
}

function serverPort() {
  return Number(process.env.WHISPER_SERVER_PORT || 8091);
}

function whisperBinDir() {
  const bin = process.env.WHISPER_BIN || '';
  return path.dirname(bin.replace(/whisper-cli\.exe$/i, 'whisper-server.exe'));
}

function serverBinPath() {
  const dir = whisperBinDir();
  const explicit = path.join(dir, 'whisper-server.exe');
  if (fs.existsSync(explicit)) return explicit;
  return process.env.WHISPER_BIN?.replace(/whisper-cli\.exe$/i, 'whisper-server.exe');
}

function waitForPort(port, timeoutMs = 45000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.end();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Whisper server no respondió a tiempo.'));
          return;
        }
        setTimeout(tick, 350);
      });
    };
    tick();
  });
}

function startWhisperServer() {
  if (!whisperConfigured()) {
    return Promise.resolve(false);
  }
  if (process.env.WHISPER_USE_SERVER === 'false') {
    return Promise.resolve(false);
  }
  if (ready) return Promise.resolve(true);
  if (readyPromise) return readyPromise;

  const bin = serverBinPath();
  if (!bin || !fs.existsSync(bin)) {
    return Promise.resolve(false);
  }

  const port = serverPort();
  const threads = String(process.env.WHISPER_THREADS || Math.min(8, os.cpus().length || 4));

  readyPromise = new Promise((resolve) => {
    try {
      const spawnEnv = { ...process.env };
      const ffmpegBin = process.env.FFMPEG_BIN;
      if (ffmpegBin) {
        const ffmpegDir = path.dirname(ffmpegBin);
        spawnEnv.PATH = `${ffmpegDir}${path.delimiter}${spawnEnv.PATH || ''}`;
      }

      const prompt = whisperPrompt();
      const serverArgs = [
          '-m',
          process.env.WHISPER_MODEL,
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '-l',
          process.env.WHISPER_LANGUAGE || 'es',
          '-t',
          threads,
          '-nt',
          '-bs',
          '1',
          '-bo',
          '1',
        ];
      if (prompt) {
        serverArgs.push('--prompt', prompt);
      }

      serverProcess = spawn(
        bin,
        serverArgs,
        {
          cwd: path.dirname(bin),
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          env: spawnEnv,
        },
      );

      serverProcess.on('exit', () => {
        ready = false;
        readyPromise = null;
        serverProcess = null;
      });

      waitForPort(port)
        .then(() => {
          ready = true;
          console.log(`[Whisper] Servidor listo en http://127.0.0.1:${port}`);
          resolve(true);
        })
        .catch((err) => {
          console.warn('[Whisper] Servidor no disponible, se usará CLI:', err.message);
          ready = false;
          readyPromise = null;
          resolve(false);
        });
    } catch (err) {
      console.warn('[Whisper] No se pudo iniciar servidor:', err.message);
      readyPromise = null;
      resolve(false);
    }
  });

  return readyPromise;
}

/** @param {string} wavPath — WAV 16 kHz mono (ya convertido con ffmpeg) */
async function transcribeViaServer(wavPath, options = {}) {
  const ok = await startWhisperServer();
  if (!ok) return null;

  const port = serverPort();
  const buffer = fs.readFileSync(wavPath);
  const form = new FormData();
  form.append('file', new Blob([buffer]), path.basename(wavPath));
  form.append('response_format', 'text');
  form.append('temperature', '0');
  const prompt = whisperPrompt(options.userHints || [], options.catalogHints || '');
  if (prompt) form.append('prompt', prompt);

  const res = await fetch(`http://127.0.0.1:${port}/inference`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Whisper server HTTP ${res.status}`);
  }

  const text = (await res.text()).trim();
  return text || null;
}

function warmupWhisper() {
  return startWhisperServer();
}

function shutdownWhisperServer() {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (_) { /* noop */ }
  }
  serverProcess = null;
  ready = false;
  readyPromise = null;
}

module.exports = {
  warmupWhisper,
  transcribeViaServer,
  shutdownWhisperServer,
  isServerEnabled: () => whisperConfigured() && process.env.WHISPER_USE_SERVER !== 'false',
};
