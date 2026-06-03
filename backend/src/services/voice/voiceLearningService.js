/**
 * Memoria de aprendizaje de Saya: frases confirmadas por usuario y vocabulario personal.
 */
const { getDb } = require('../../database/init');
const { preprocessTranscript } = require('../../utils/voiceTranscriptNormalize');
const { enrichParsedResult } = require('./voiceIntentNarration');
const { matchModuleQuery, matchContextQuery } = require('./voiceQueryParser');

const SIMILARITY_THRESHOLD = Number(process.env.VOICE_LEARN_SIMILARITY || 0.78);
const CRITICAL_LEARN_THRESHOLD = Number(process.env.VOICE_LEARN_CRITICAL_SIMILARITY || 0.88);
const MIN_PHRASE_LEN = 4;

const SYNONYM_GROUPS = [
  ['reunion', 'junta', 'cita', 'agenda'],
  ['ticket', 'incidencia', 'falla', 'soporte', 'problema'],
  ['tarea', 'pendiente', 'actividad'],
  ['aviso', 'comunicado', 'anuncio'],
  ['minuta', 'acta'],
  ['calendario', 'agenda', 'reuniones'],
  ['abrir', 'abre', 'muestra', 'mostrar', 'ver', 'ir'],
  ['crear', 'crea', 'genera', 'nuevo', 'agendar', 'programar'],
  ['hoy', 'dia', 'jornada'],
  ['manana', 'mañana', 'proximo', 'siguiente'],
  ['consultar', 'consulta', 'revisar', 'checar', 'dime', 'saber'],
];

function normalizePhrase(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandToken(token) {
  const out = new Set([token]);
  for (const group of SYNONYM_GROUPS) {
    if (group.includes(token)) group.forEach((w) => out.add(w));
  }
  return out;
}

function tokenSet(text) {
  const base = normalizePhrase(text).split(/\s+/).filter((w) => w.length > 1);
  const expanded = new Set();
  for (const w of base) {
    for (const x of expandToken(w)) expanded.add(x);
  }
  return expanded;
}

function phraseSimilarity(a, b) {
  const na = normalizePhrase(a);
  const nb = normalizePhrase(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.94;

  const sa = tokenSet(na);
  const sb = tokenSet(nb);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const w of sa) {
    if (sb.has(w)) inter += 1;
  }
  const union = new Set([...sa, ...sb]).size;
  const jaccard = inter / Math.max(union, 1);
  const overlap = inter / Math.max(sa.size, sb.size);
  return Math.max(jaccard * 0.85 + overlap * 0.35, overlap * 0.92);
}

function loadUserMemories(userId) {
  if (!userId) return [];
  const db = getDb();
  return db
    .prepare(
      `SELECT id, phrase_norm, intent, params_json, summary, hit_count, success_count
       FROM voice_phrase_memory
       WHERE user_id = ?
       ORDER BY hit_count DESC, last_used_at DESC
       LIMIT 80`,
    )
    .all(Number(userId));
}

function parsedFromMemory(row, raw, users) {
  let params = {};
  try {
    params = JSON.parse(row.params_json || '{}');
  } catch {
    params = {};
  }

  const base = {
    intent: row.intent,
    confidence: 'high',
    params,
    summary: row.summary || `Comando habitual (${row.intent})`,
    allowed: true,
    denyReason: null,
    learned: true,
    memoryId: row.id,
    memoryHits: row.hit_count,
    autoExecute: String(row.intent || '').startsWith('query_'),
  };

  return enrichParsedResult(base, { raw, transcript: raw, users });
}

function findGlobalPatternMatch(transcript, users = []) {
  const raw = preprocessTranscript(transcript);
  const norm = normalizePhrase(raw);
  if (norm.length < 3) return null;

  const direct = matchModuleQuery(raw);
  if (direct) {
    direct.globalPattern = true;
    return enrichParsedResult(direct, { raw, transcript: raw, users });
  }

  const navOnly = norm.match(
    /^(?:abrir?|ir\s+a?|ve\s+a?|muestr(?:a|ame)?|mostrar?|entra(?:r)?\s+a?|llev(?:a|ame)|pasame)\s+(calendario|tickets|ticket|tareas|tarea|avisos|aviso|minutas|minuta|foro|notificaciones|inicio|resumen)$/,
  );
  if (navOnly) {
    const modMap = {
      calendario: 'calendar',
      tickets: 'tickets',
      ticket: 'tickets',
      tareas: 'tasks',
      tarea: 'tasks',
      avisos: 'avisos',
      aviso: 'avisos',
      minutas: 'minutas',
      minuta: 'minutas',
      foro: 'foro',
      notificaciones: 'notifications',
      inicio: 'overview',
      resumen: 'overview',
    };
    const mod = modMap[navOnly[1]];
    if (mod) {
      return enrichParsedResult(
        {
          intent: 'navigate',
          confidence: 'high',
          params: { module: mod },
          summary: `Ir a ${mod}`,
          allowed: true,
          denyReason: null,
          clientOnly: true,
          globalPattern: true,
        },
        { raw, transcript: raw, users },
      );
    }
  }

  for (const mod of ['calendar', 'tickets', 'tasks', 'avisos', 'minutas', 'notifications']) {
    const ctx = matchContextQuery(raw, mod);
    if (ctx) {
      ctx.globalPattern = true;
      return enrichParsedResult(ctx, { raw, transcript: raw, users });
    }
  }

  return null;
}

function findLearnedMatch(userId, transcript, users = []) {
  const global = findGlobalPatternMatch(transcript, users);
  if (global) return global;

  if (!userId) return null;
  const raw = preprocessTranscript(transcript);
  const norm = normalizePhrase(raw);
  if (norm.length < MIN_PHRASE_LEN) return null;

  const memories = loadUserMemories(userId);
  if (!memories.length) return null;

  let best = null;
  let bestScore = 0;

  for (const row of memories) {
    const score = phraseSimilarity(norm, row.phrase_norm);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  if (!best) return null;

  const isCritical =
    ['create_ticket', 'create_task', 'create_meeting', 'assign_ticket', 'create_aviso'].includes(best.intent);
  const threshold = isCritical
    ? Math.max(CRITICAL_LEARN_THRESHOLD, SIMILARITY_THRESHOLD + 0.06)
    : best.hit_count >= 5
      ? SIMILARITY_THRESHOLD - 0.06
      : SIMILARITY_THRESHOLD;
  if (bestScore < threshold) return null;

  const parsed = parsedFromMemory(best, raw, users);
  parsed.learnedSimilarity = Math.round(bestScore * 100);
  return parsed;
}

function logVoiceAttempt(userId, transcript, parsed, meta = {}) {
  if (!userId || !transcript) return;
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO voice_command_log (user_id, transcript, intent, allowed, executed, active_module)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      Number(userId),
      String(transcript).slice(0, 2000),
      parsed?.intent || null,
      parsed?.allowed ? 1 : 0,
      meta.executed ? 1 : 0,
      meta.activeModule || null,
    );
  } catch (err) {
    console.warn('[voiceLearning] log:', err.message);
  }
}

function learnFromSuccess(userId, transcript, parsed) {
  if (!userId || !transcript || !parsed?.intent || parsed.intent === 'unknown') return null;
  if (parsed.needsClarification) return null;

  const raw = preprocessTranscript(transcript);
  const phrase_norm = normalizePhrase(raw);
  if (phrase_norm.length < MIN_PHRASE_LEN) return null;

  const db = getDb();
  const intent = parsed.intent;
  const paramsJson = JSON.stringify(parsed.params || {});
  const summary = String(parsed.summary || '').slice(0, 500);

  const existing = db
    .prepare(`SELECT id, hit_count FROM voice_phrase_memory WHERE user_id = ? AND phrase_norm = ? AND intent = ?`)
    .get(Number(userId), phrase_norm, intent);

  if (existing) {
    db.prepare(
      `UPDATE voice_phrase_memory
       SET hit_count = hit_count + 1, success_count = success_count + 1,
           params_json = ?, summary = ?, last_used_at = datetime('now')
       WHERE id = ?`,
    ).run(paramsJson, summary, existing.id);
    return { updated: true, hit_count: existing.hit_count + 1 };
  }

  db.prepare(
    `INSERT INTO voice_phrase_memory (user_id, phrase_norm, intent, params_json, summary)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(Number(userId), phrase_norm, intent, paramsJson, summary);

  return { created: true, hit_count: 1 };
}

function getUserWhisperHints(userId, limit = 10) {
  if (!userId) return [];
  try {
    const db = getDb();
    return db
      .prepare(
        `SELECT phrase_norm FROM voice_phrase_memory
         WHERE user_id = ? AND success_count >= 1
         ORDER BY hit_count DESC, last_used_at DESC
         LIMIT ?`,
      )
      .all(Number(userId), limit)
      .map((r) => r.phrase_norm)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getLearningStats(userId) {
  if (!userId) return { phrases: 0, commands: 0 };
  try {
    const db = getDb();
    const phrases = db
      .prepare(`SELECT COUNT(*) AS n FROM voice_phrase_memory WHERE user_id = ?`)
      .get(Number(userId))?.n;
    const commands = db
      .prepare(`SELECT COUNT(*) AS n FROM voice_command_log WHERE user_id = ? AND executed = 1`)
      .get(Number(userId))?.n;
    return { phrases: phrases || 0, commands: commands || 0 };
  } catch {
    return { phrases: 0, commands: 0 };
  }
}

module.exports = {
  findLearnedMatch,
  findGlobalPatternMatch,
  logVoiceAttempt,
  learnFromSuccess,
  getUserWhisperHints,
  getLearningStats,
  normalizePhrase,
};
