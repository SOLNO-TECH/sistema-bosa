/**
 * TTS del servidor (Windows SAPI) para reproducir con amplificación en móvil.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function isServerTtsAvailable() {
  return process.platform === 'win32';
}

function escapePs(text) {
  return String(text || '')
    .replace(/`/g, '``')
    .replace(/'/g, "''")
    .slice(0, 340);
}

async function synthesizeSpeechWav(text) {
  if (!isServerTtsAvailable()) return null;

  const clean = String(text || '').trim();
  if (!clean) return null;

  const workDir = path.join(os.tmpdir(), 'saya-tts');
  fs.mkdirSync(workDir, { recursive: true });
  const outPath = path.join(workDir, `saya-${Date.now()}.wav`);
  const safeText = escapePs(clean);
  const safePath = outPath.replace(/\\/g, '\\\\');

  const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Volume = 100
$s.Rate = 0
try {
  $voices = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'es*' }
  if ($voices) { $s.SelectVoice($voices[0].VoiceInfo.Name) }
} catch {}
$s.SetOutputToWaveFile('${safePath}')
$s.Speak('${safeText}')
$s.Dispose()
`;

  try {
    await execFileAsync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 45000, windowsHide: true },
    );
    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 128) {
      try {
        fs.unlinkSync(outPath);
      } catch (_) { /* noop */ }
      return null;
    }
    return outPath;
  } catch (err) {
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch (_) { /* noop */ }
    console.warn('[TTS] Windows SAPI falló:', err.message);
    return null;
  }
}

module.exports = {
  isServerTtsAvailable,
  synthesizeSpeechWav,
};
