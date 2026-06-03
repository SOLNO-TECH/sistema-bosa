/**
 * Fusión inteligente de palabras entre Whisper y navegador.
 */
const { preprocessTranscript } = require('./voiceTranscriptNormalize');

const STOP = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'y', 'a', 'o', 'que', 'qué',
  'me', 'mi', 'mis', 'tu', 'su', 'sus', 'por', 'para', 'con', 'al', 'es', 'si', 'sí',
]);

function normalizeSimilar(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\sáéíóúñ]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const WHISPER_JUNK =
  /^(gracias|thank you|subtitul|subtitle|música|musica|music|\.*|\s*|suscr|amara|www\.|http)/i;

const ACTION_VERB =
  /^(?:crea|crear|creo|criar|agenda|agendar|programa|programar|organiza|organizar|genera|generar|haz|hazme|hacer|pon|ponme|quiero|necesito|solicito|registra|registrar)$/i;

const ENTITY_PHRASE =
  /\b(?:reunion|reuniones|junta|juntas|cita|citas|ticket|tickets|tarea|tareas|aviso|avisos|comunicado)\b/;

/** Whisper y navegador a veces parten el comando: "crear" + "una reunion". */
function combineSplitCommand(a, b) {
  const an = normalizeSimilar(a);
  const bn = normalizeSimilar(b);
  if (!an || !bn || an === bn) return null;

  const aWords = an.split(/\s+/).filter(Boolean);
  const bWords = bn.split(/\s+/).filter(Boolean);
  const aIsAction =
    (aWords.length <= 3 && ACTION_VERB.test(aWords[0])) ||
    (aWords.length === 1 && ACTION_VERB.test(aWords[0]));
  const bIsAction =
    (bWords.length <= 3 && ACTION_VERB.test(bWords[0])) ||
    (bWords.length === 1 && ACTION_VERB.test(bWords[0]));

  if (aIsAction && ENTITY_PHRASE.test(bn) && !ENTITY_PHRASE.test(an)) {
    return `${a.trim()} ${b.trim()}`.replace(/\s+/g, ' ').trim();
  }
  if (bIsAction && ENTITY_PHRASE.test(an) && !ENTITY_PHRASE.test(bn)) {
    return `${b.trim()} ${a.trim()}`.replace(/\s+/g, ' ').trim();
  }
  return null;
}

function tokenize(text) {
  return normalizeSimilar(text)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

function mergeWordLists(a, b) {
  const out = [];
  const seen = new Set();
  for (const w of [...a, ...b]) {
    const key = normalizeSimilar(w);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out.join(' ');
}

/**
 * Elige la mejor transcripción entre Whisper (servidor) y navegador (cliente).
 */
function mergeTranscripts(whisperText, clientText) {
  const w = preprocessTranscript(whisperText || '').trim();
  const c = preprocessTranscript(clientText || '').trim();

  if (!w && !c) return '';
  if (!w) return c;
  if (!c) return w;

  const combined = combineSplitCommand(w, c) || combineSplitCommand(c, w);
  if (combined) return combined;

  const wNorm = normalizeSimilar(w);
  const cNorm = normalizeSimilar(c);

  if (wNorm === cNorm) return w.length >= c.length ? w : c;
  if (wNorm.includes(cNorm) || cNorm.includes(wNorm)) {
    return w.length >= c.length ? w : c;
  }

  if (WHISPER_JUNK.test(w) && c.length >= 4) return c;
  if (w.length <= 2 && c.length >= 5) return c;
  if (c.length <= 2 && w.length >= 5) return w;

  const wWords = tokenize(w);
  const cWords = tokenize(c);
  const setW = new Set(wWords.map(normalizeSimilar));
  const setC = new Set(cWords.map(normalizeSimilar));
  const overlap = cWords.filter((word) => setW.has(normalizeSimilar(word))).length;
  const ratio = overlap / Math.max(wWords.length, cWords.length, 1);

  if (ratio >= 0.55) {
    const merged = mergeWordLists(wWords, cWords);
    if (merged.length >= Math.max(wNorm.length, cNorm.length) * 0.7) return merged;
    return w.length >= c.length * 0.65 ? w : c;
  }

  if (ratio >= 0.25 && wWords.length >= 2 && cWords.length >= 2) {
    const onlyClient = cWords.filter((word) => !setW.has(normalizeSimilar(word)));
    const onlyWhisper = wWords.filter((word) => !setC.has(normalizeSimilar(word)));
    if (onlyClient.length >= 2 && onlyWhisper.length >= 2) {
      return mergeWordLists(wWords, onlyClient);
    }
  }

  if (ratio >= 0.45) return w.length >= c.length * 0.6 ? w : c;
  if (c.length >= w.length * 1.35 && ratio >= 0.2) return c;
  if (w.length >= c.length * 1.2) return w;

  return w.length >= c.length ? w : c;
}

module.exports = { mergeTranscripts };
