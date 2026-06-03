/**
 * Capa de precisión: puntúa parseos, elige el mejor candidato y reconcilia memoria vs reglas.
 */
const { enrichParsedResult } = require('./voiceIntentNarration');
const { applyFormDefaults } = require('./voiceFormDefaults');

const CRITICAL_INTENTS = new Set([
  'create_ticket',
  'create_task',
  'create_meeting',
  'assign_ticket',
  'create_aviso',
]);

const GENERIC_TITLES =
  /desde comando de voz|ticket desde|reunion desde|tarea desde|agendada por comando/i;

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slotCompleteness(parsed) {
  const p = parsed?.params || {};
  const intent = parsed?.intent || '';
  let filled = 0;
  let total = 1;

  if (intent === 'create_ticket') {
    total = 3;
    if (p.title && !GENERIC_TITLES.test(p.title)) filled += 1;
    if (p.category) filled += 1;
    if (p.description && p.description !== p.title) filled += 1;
  } else if (intent === 'create_task') {
    total = 4;
    if (p.title && !GENERIC_TITLES.test(p.title)) filled += 1;
    if (p.assigned_to) filled += 1;
    if (p.department) filled += 1;
    if (p.start_date) filled += 1;
  } else if (intent === 'create_meeting') {
    total = 4;
    if (p.title) filled += 1;
    if (p.date) filled += 1;
    if (p.start_time) filled += 1;
    if (p.end_time) filled += 1;
  } else if (intent === 'assign_ticket') {
    total = 2;
    if (p.ticket_id) filled += 1;
    if (p.assigned_to) filled += 1;
  } else if (String(intent).startsWith('query_')) {
    total = 1;
    filled = 1;
  } else if (intent === 'navigate' || intent === 'help' || intent === 'open_minute') {
    total = 1;
    filled = p.module || intent === 'help' ? 1 : 0;
  }

  return total ? filled / total : 0;
}

function confidenceScore(parsed) {
  const c = String(parsed?.confidence || '').toLowerCase();
  if (c === 'high') return 1;
  if (c === 'medium') return 0.65;
  if (c === 'low') return 0.35;
  return 0.5;
}

/** Puntuación 0–100: mayor = parseo más confiable. */
function scoreParseQuality(parsed, transcript = '', ctx = {}) {
  if (!parsed || typeof parsed !== 'object') return 0;

  let score = 0;
  if (parsed.allowed) score += 18;
  if (parsed.intent && parsed.intent !== 'unknown') score += 22;
  if (parsed.canExecute) score += 20;
  else if (!parsed.needsClarification && parsed.allowed) score += 8;
  else if (parsed.needsClarification && CRITICAL_INTENTS.has(parsed.intent)) score += 12;

  score += confidenceScore(parsed) * 12;
  score += slotCompleteness(parsed) * 18;

  if (parsed.semantic) score -= 4;
  if (parsed.correctedIntent) score -= 3;
  if (parsed.repaired) score -= 1;
  if (parsed.learned) score -= 2;

  const missing = parsed.missingFields || parsed.ticketMissing || parsed.taskMissing || parsed.meetingMissing || [];
  score -= Math.min(missing.length * 4, 16);

  if (parsed.pendingVoicePick?.options?.length >= 2 && !parsed.voicePickResolved) score -= 8;

  const title = parsed.params?.title;
  if (title && GENERIC_TITLES.test(title)) score -= 10;

  if (ctx.activeModule && parsed.intent?.startsWith('query_')) {
    const mod = parsed.intent.replace('query_', '');
    const map = { meetings: 'calendar', tickets: 'tickets', tasks: 'tasks', avisos: 'avisos', minutas: 'minutas', notifications: 'notifications' };
    if (map[mod] === ctx.activeModule) score += 4;
  }

  if (parsed.llmRefined) score += 6;
  if (parsed.llmConfidence >= 0.85) score += 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function pickBestParse(candidates = []) {
  const valid = candidates.filter((c) => c?.parsed);
  if (!valid.length) return null;

  valid.sort((a, b) => {
    const sa = scoreParseQuality(a.parsed, a.transcript, a.ctx);
    const sb = scoreParseQuality(b.parsed, b.transcript, b.ctx);
    if (sb !== sa) return sb - sa;
    return String(b.parsed?.summary || '').length - String(a.parsed?.summary || '').length;
  });

  const best = valid[0];
  best.parsed.parseQuality = scoreParseQuality(best.parsed, best.transcript, best.ctx);
  return best;
}

function intentsCompatible(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith('query_') && b.startsWith('query_')) return a === b;
  if (a.startsWith('create_') && b.startsWith('create_')) return a === b;
  return false;
}

/**
 * Evita que la memoria pise un parseo fresco más fiable en intents críticos.
 */
function reconcileLearnedWithFresh(learned, fresh, transcript = '') {
  if (!learned?.learned || !fresh) return fresh || learned;

  const learnedScore = scoreParseQuality(learned, transcript);
  const freshScore = scoreParseQuality(fresh, transcript);
  const sim = learned.learnedSimilarity || 0;

  if (!intentsCompatible(learned.intent, fresh.intent)) {
    if (freshScore >= learnedScore - 5 && fresh.intent !== 'unknown') return fresh;
    if (sim < 92) return fresh;
    if (CRITICAL_INTENTS.has(learned.intent)) return fresh;
  }

  if (CRITICAL_INTENTS.has(learned.intent) && sim < 88) {
    return freshScore >= learnedScore - 8 ? fresh : learned;
  }

  if (learnedScore > freshScore + 12 && sim >= 90) return learned;
  if (freshScore > learnedScore + 5) return fresh;
  if (fresh.canExecute && !learned.canExecute) return fresh;

  return learnedScore >= freshScore ? learned : fresh;
}

function mergeParseParams(base = {}, incoming = {}) {
  const out = { ...(base || {}) };
  for (const [key, val] of Object.entries(incoming || {})) {
    if (val == null || val === '') continue;
    if (Array.isArray(val) && !val.length) continue;
    if (key === 'title' && GENERIC_TITLES.test(String(val))) continue;
    if (!out[key] || out[key] === '' || GENERIC_TITLES.test(String(out[key]))) {
      out[key] = val;
    }
  }
  return out;
}

function mergeBetterParse(primary, secondary) {
  if (!secondary?.allowed || secondary.intent === 'unknown') return primary;
  if (!primary?.allowed || primary.intent === 'unknown') return secondary;

  const pScore = scoreParseQuality(primary);
  const sScore = scoreParseQuality(secondary);

  if (primary.intent === secondary.intent) {
    return {
      ...primary,
      params: mergeParseParams(primary.params, secondary.params),
      confidence: pScore >= sScore ? primary.confidence : secondary.confidence,
      llmRefined: primary.llmRefined || secondary.llmRefined,
    };
  }

  return pScore >= sScore ? primary : secondary;
}

function shouldUseLlmRefinement(parsed, transcript = '') {
  if (!parsed) return true;
  const q = scoreParseQuality(parsed, transcript);
  if (parsed.intent === 'unknown' || !parsed.allowed) return true;
  if (q < 55) return true;
  if (parsed.needsClarification && q < 72) return true;
  if (parsed.semantic && q < 65) return true;
  return false;
}

function finalizeVoiceParse(parsed, ctx = {}) {
  if (!parsed || typeof parsed !== 'object') return parsed;

  const users = Array.isArray(ctx.users) ? ctx.users : [];
  const raw = ctx.raw || ctx.transcript || '';

  parsed = applyFormDefaults(parsed, { ...ctx, raw, transcript: raw, users, session: ctx.session });
  parsed = enrichParsedResult(parsed, { ...ctx, raw, transcript: raw, users, session: ctx.session, actor: ctx.actor, postExecute: ctx.postExecute });

  if (parsed.pendingVoicePick?.options?.length >= 2) {
    const { buildVoicePickPrompt } = require('./voiceAssigneeResolver');
    const awaitingAssignee =
      ['create_task', 'assign_ticket'].includes(parsed.intent) && !parsed.params?.assigned_to;
    const awaitingAttendee =
      parsed.intent === 'create_meeting' && parsed.pendingVoicePick?.field === 'attendees';
    if (awaitingAssignee || awaitingAttendee) {
      const prompt = buildVoicePickPrompt(parsed.pendingVoicePick);
      if (prompt) {
        parsed.narration = `${parsed.narration || ''} ${prompt}`.trim();
        parsed.needsClarification = true;
        parsed.canExecute = false;
      }
    }
  }

  parsed.parseQuality = scoreParseQuality(parsed, raw, ctx);
  return parsed;
}

module.exports = {
  scoreParseQuality,
  pickBestParse,
  reconcileLearnedWithFresh,
  mergeBetterParse,
  mergeParseParams,
  shouldUseLlmRefinement,
  finalizeVoiceParse,
  CRITICAL_INTENTS,
};
