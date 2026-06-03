/**
 * Flujo de creación de tickets por voz — slots, merge inteligente y validación.
 */

const { buildTicketDescription, knownDepartments } = require('./voiceFormDefaults');

function lazyParser() {
  return require('../voiceCommandParserService');
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidTicketTitle(title) {
  const t = String(title || '').trim();
  if (t.length < 3) return false;
  if (/desde comando de voz/i.test(t)) return false;
  if (/^(crea|crear|ticket|nuevo|genera|un ticket|el ticket)$/i.test(t)) return false;
  if (/^(crea|crear|nuevo|genera)\s+(?:un\s+)?ticket$/i.test(t)) return false;
  if (/^(asunto|titulo|título|departamento|depto|partamento|prioridad)\b/i.test(t)) return false;
  return true;
}

function cleanTicketTitle(raw) {
  return String(raw || '')
    .replace(/^(?:el\s+)?(?:asunto|titulo|título)\s*(?:es|:|-)\s*/i, '')
    .replace(/\s+(?:departamento|prioridad|descripcion|descripción)\s+.+$/i, '')
    .replace(/\s+(prioridad|departamento|para|asignar|descripcion|descripción).*$/i, '')
    .trim()
    .slice(0, 200);
}

function matchKnownDepartment(hint, known) {
  const h = normalizeText(hint);
  if (!h) return null;
  let best = null;
  let bestLen = 0;
  for (const d of known) {
    const nd = normalizeText(d);
    if (nd.includes(h) || h.includes(nd)) {
      if (nd.length > bestLen) {
        best = d;
        bestLen = nd.length;
      }
    }
  }
  return best;
}

function isCreateVerbOnly(text) {
  const t = normalizeText(text);
  return /^(?:crea(?:r|me)?|crear|genera(?:r|me)?|nuevo|abre|registra(?:r|me)?|quiero|necesito|pon(?:me)?)\s+(?:crear\s+)?(?:un\s+)?(?:ticket|incidencia)?\s*$/.test(
    t,
  );
}

/** Extrae slots del turno actual (follow-up) sin reparsear todo desde cero. */
function extractFollowUpTicketSlots(raw, text, existingParams = {}, users = []) {
  const slots = {};
  const r = String(raw || '').trim();
  const t = normalizeText(text);

  const asunto = r.match(/^(?:el\s+)?(?:asunto|titulo|título)\s+(?:es\s+)?(.+)/i) || r.match(/(?:el\s+)?(?:asunto|titulo|título)\s*(?:es|:|-)\s*(.+)/i);
  if (asunto?.[1]) {
    slots.title = cleanTicketTitle(asunto[1]);
    return slots;
  }

  const desc = r.match(/(?:el\s+)?(?:descripcion|descripción|detalle|problema)\s*(?:es|:|-)\s*(.+)/i);
  if (desc?.[1]) {
    slots.description = desc[1].trim().slice(0, 4000);
    return slots;
  }

  const deptMatch = r.match(/(?:departamento|depto)\s*(?:es|:|-)?\s*(?:de\s+)?(.+)/i);
  if (deptMatch?.[1]) {
    const matched = matchKnownDepartment(deptMatch[1], knownDepartments(users));
    if (matched) slots.category = matched;
    return slots;
  }

  const pr = lazyParser().matchPriority(t);
  if (pr && pr !== 'medium' && r.split(/\s+/).length <= 4) {
    slots.priority = pr;
    return slots;
  }

  if (isCreateVerbOnly(r)) return slots;

  let bare = r.replace(/^asunto\s+/i, '').trim();
  if (bare.length >= 3 && !/^(crea|crear|ticket|nuevo|genera|reporta|quiero|necesito)/i.test(bare)) {
    bare = cleanTicketTitle(bare);
    if (!isValidTicketTitle(existingParams.title)) {
      slots.title = bare;
    } else if (bare.toLowerCase() !== String(existingParams.title).toLowerCase()) {
      slots.description = bare.slice(0, 4000);
    }
  }

  return slots;
}

function smartMergeTicketParams(base = {}, ...sources) {
  const out = { ...base };
  for (const src of sources) {
    if (!src) continue;
    for (const [key, val] of Object.entries(src)) {
      if (val == null || val === '') continue;
      if (key === 'title') {
        if (isValidTicketTitle(val)) out.title = cleanTicketTitle(val);
        else if (!isValidTicketTitle(out.title)) out.title = cleanTicketTitle(val);
        continue;
      }
      if (key === 'description' && String(val).length >= 3) out.description = val;
      else if (key === 'category' && String(val).trim()) out.category = String(val).trim();
      else if (key === 'priority' && val) out.priority = val;
    }
  }
  return out;
}

function evaluateTicketParams(params, raw = '') {
  const p = { ...params };
  const missing = [];
  if (!isValidTicketTitle(p.title)) {
    missing.push('asunto');
    p.title = null;
  } else {
    if (!p.description || p.description.length < 3) {
      p.description = buildTicketDescription(raw, p.title);
    }
    if (!p.description || p.description === p.title) {
      p.description = p.description || p.title;
    }
  }
  return { params: p, missing, ready: missing.length === 0 };
}

/**
 * Continúa un ticket a medias usando sesión + turno actual.
 */
function continueCreateTicket(raw, text, session, users = [], actor = null) {
  if (!session || session.intent !== 'create_ticket') return null;

  const combinedRaw = `${session.transcript || ''} ${raw}`.replace(/\s+/g, ' ').trim().slice(0, 500);
  const combinedText = normalizeText(combinedRaw);
  const fromCombined = lazyParser().parseCreateTicket(combinedRaw, combinedText, users, actor);
  const followSlots = extractFollowUpTicketSlots(raw, text, session.params, users);
  const params = smartMergeTicketParams(session.params || {}, fromCombined.params, followSlots);
  const { params: finalParams, missing, ready } = evaluateTicketParams(params, combinedRaw);

  return {
    intent: 'create_ticket',
    confidence: ready ? 'high' : 'medium',
    params: finalParams,
    summary: isValidTicketTitle(finalParams.title)
      ? `Crear ticket: "${finalParams.title.slice(0, 80)}"`
      : 'Crear ticket',
    allowed: true,
    denyReason: null,
    sessionMerged: true,
    ticketMissing: missing,
  };
}

module.exports = {
  isValidTicketTitle,
  cleanTicketTitle,
  extractFollowUpTicketSlots,
  smartMergeTicketParams,
  evaluateTicketParams,
  continueCreateTicket,
};
