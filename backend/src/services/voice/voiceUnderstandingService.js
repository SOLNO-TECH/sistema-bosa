/**
 * Capa de comprensión: intención + parámetros + acción ejecutable.
 * Refina el parser de reglas y completa turnos de conversación.
 */
const { matchModuleQuery, matchContextQuery, normalizeText: normQuery } = require('./voiceQueryParser');

const CREATE_VERBS =
  /\b(crea(?:r|me)?|creo|criar|agenda(?:r|me)?|programa(?:r|me)?|organiza(?:r|me)?|aparta(?:r|me)?|reserva(?:r|me)?|genera(?:r|me)?|registra(?:r|me)?|publica(?:r|me)?|reporta(?:r|me)?|haz(?:me)?|pon(?:me)?|hacer(?:me)?|manda(?:r|me)?|abre|nuevo|nueva)\b/;

const QUERY_VERBS =
  /\?|\b(hay|habra|habrá|cuantas|cuántas|cuantos|cuántos|cuál|cual|que hay|qué hay|dime si|dime cu|muestr|mostr|listar|consulta|revisa|checa|verifica|busca|pendientes|abiertos|sin leer|proxima|próxima|siguiente)\b/;

const NAV_VERBS =
  /\b(abre|abrir|ir a|ir al|ve a|entra|entrar|llevame|llévame|pásame|pasame|mostrar|muestra|ver el|ver la|ver mis)\b/;

const UPDATE_VERBS =
  /\b(cerrar|cerrado|cerrada|completar|completado|terminar|terminada|asignar|asignado|editar|modificar|actualizar|cambiar|reagendar|reprogramar|mover)\b/;

const ACTION_LABELS = {
  create_meeting: 'Agendar reunión en el calendario',
  create_ticket: 'Crear ticket de soporte',
  create_task: 'Crear tarea operativa',
  create_aviso: 'Publicar aviso/comunicado',
  update_ticket_status: 'Cambiar estado del ticket',
  update_ticket: 'Editar ticket',
  assign_ticket: 'Asignar ticket a una persona',
  update_task_status: 'Cambiar estado de la tarea',
  update_task: 'Editar tarea',
  update_meeting: 'Reagendar reunión',
  append_minute_note: 'Agregar nota a minuta',
  open_minute: 'Abrir minuta',
  query_meetings: 'Consultar reuniones',
  query_tickets: 'Consultar tickets',
  query_tasks: 'Consultar tareas',
  query_avisos: 'Consultar avisos',
  query_minutas: 'Consultar minutas',
  query_notifications: 'Consultar notificaciones',
  navigate: 'Abrir módulo en la aplicación',
  help: 'Mostrar ayuda de comandos',
  unknown: 'Acción no identificada',
};

const TITLE_STOP =
  /\s+(?:prioridad|departamento|departamentos|asignar|asignado|asignada|responsable|para el|para la|manana|mañana|hoy|pasado|a las|para las|con departamento|virtual|sala|invitar|asistentes|participantes|descripcion|descripción)\b.*$/i;

const PRIORITY_INLINE =
  /\b(?:prioridad\s+)?(urgente|crítico|critico|alta|alto|importante|media|medio|normal|baja|bajo)\b/i;

function normalizeText(text) {
  return normQuery(text);
}

function lazyParser() {
  return require('../voiceCommandParserService');
}

function countMatches(re, text) {
  const m = text.match(re);
  return m ? m.length : 0;
}

function scoreCreateMeeting(t) {
  let s = 0;
  if (CREATE_VERBS.test(t)) s += 5;
  if (/\b(reunion|reuniones|junta|juntas|cita|citas)\b/.test(t)) s += 3;
  if (/\b(quiero|necesito|me gustaria|me gustaría|quisiera|dame|ponme)\s+(?:una\s+)?(?:reunion|junta|cita)\b/.test(t)) s += 4;
  if (QUERY_VERBS.test(t) && !CREATE_VERBS.test(t)) s -= 5;
  if (/\b(titulo|título|a las|manana|mañana|hoy|departamento)\b/.test(t)) s += 1;
  return s;
}

function scoreCreateTicket(t) {
  let s = 0;
  if (CREATE_VERBS.test(t)) s += 4;
  if (/\b(ticket|tickets|incidencia|incidencias|falla|fallas|problema|soporte)\b/.test(t)) s += 3;
  if (/\b(reporta|reportame|registra)\b/.test(t)) s += 3;
  if (QUERY_VERBS.test(t) && !CREATE_VERBS.test(t)) s -= 4;
  return s;
}

function scoreCreateTask(t) {
  let s = 0;
  if (CREATE_VERBS.test(t)) s += 4;
  if (/\b(tarea|tareas|operativa)\b/.test(t)) s += 3;
  if (QUERY_VERBS.test(t) && !CREATE_VERBS.test(t)) s -= 4;
  return s;
}

function scoreQuery(t, moduleKeywords) {
  let s = 0;
  if (moduleKeywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(t))) s += 2;
  if (QUERY_VERBS.test(t)) s += 5;
  if (CREATE_VERBS.test(t)) s -= 4;
  if (/\b(mis|mi|mias|mías)\b/.test(t)) s += 2;
  return s;
}

function scoreNavigate(t) {
  let s = 0;
  if (NAV_VERBS.test(t)) s += 5;
  if (CREATE_VERBS.test(t)) s -= 3;
  if (QUERY_VERBS.test(t)) s += 1;
  return s;
}

function scoreUpdate(t) {
  let s = 0;
  if (UPDATE_VERBS.test(t)) s += 4;
  if (/\b(ticket|tarea|reunion|minuta)\s*#?\s*\d+\b/.test(t)) s += 4;
  if (CREATE_VERBS.test(t) && !UPDATE_VERBS.test(t)) s -= 2;
  return s;
}

/** Clasificador multi-intención con puntuación explícita. */
function classifyIntent(text, ctx = {}) {
  const t = normalizeText(text);
  if (!t || t.length < 2) return { intent: 'unknown', score: 0, confidence: 'low' };

  const activeModule = String(ctx.activeModule || '').trim();
  const sessionIntent = ctx.session?.intent;

  const candidates = [
    { intent: 'create_meeting', score: scoreCreateMeeting(t) },
    { intent: 'create_ticket', score: scoreCreateTicket(t) },
    { intent: 'create_task', score: scoreCreateTask(t) },
    {
      intent: 'query_meetings',
      score: scoreQuery(t, ['reunion', 'reuniones', 'junta', 'cita', 'agenda', 'calendario']),
    },
    {
      intent: 'query_tickets',
      score: scoreQuery(t, ['ticket', 'tickets', 'incidencia', 'soporte', 'falla']),
    },
    { intent: 'query_tasks', score: scoreQuery(t, ['tarea', 'tareas', 'operativa']) },
    { intent: 'navigate', score: scoreNavigate(t) },
    { intent: 'update_ticket_status', score: scoreUpdate(t) + (/\bticket\b/.test(t) ? 2 : 0) },
    { intent: 'update_task_status', score: scoreUpdate(t) + (/\btarea\b/.test(t) ? 2 : 0) },
  ];

  if (sessionIntent && ctx.session?.needsClarification) {
    const idx = candidates.findIndex((c) => c.intent === sessionIntent);
    if (idx >= 0) candidates[idx].score += 3;
  }

  if (activeModule === 'calendar') {
    const qm = candidates.find((c) => c.intent === 'query_meetings');
    if (qm) qm.score += 0.5;
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  const second = candidates[1];

  if (!top || top.score < 3) {
    return { intent: 'unknown', score: top?.score || 0, confidence: 'low', candidates: candidates.slice(0, 4) };
  }

  let confidence = 'medium';
  if (top.score >= 7 && (!second || top.score - second.score >= 2)) confidence = 'high';
  if (second && second.score >= top.score * 0.9) confidence = 'low';

  return { intent: top.intent, score: top.score, confidence, candidates: candidates.slice(0, 4) };
}

function isSlotFollowUp(text) {
  const t = normalizeText(text);
  if (!t || t.split(/\s+/).length > 12) return false;
  if (CREATE_VERBS.test(t)) return false;
  if (QUERY_VERBS.test(t)) return false;
  if (NAV_VERBS.test(t)) return false;
  return (
    /\b(manana|mañana|hoy|pasado|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(t) ||
    /\b(a las|para las|medio dia|medio día|\d{1,2}(:\d{2})?\s*(am|pm)?)\b/.test(t) ||
    /\b(titulo|título|departamento|prioridad|virtual|sala|invitar|asignar|asignado|responsable|inicio|fin|semanal|quincenal|mensual|participantes)\b/.test(t)
  );
}

function stripPriorityFromTitle(title) {
  return String(title || '')
    .replace(/\b(?:prioridad\s+)?(urgente|crítico|critico|alta|alto|importante|media|medio|normal|baja|bajo)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEntityTitle(raw, entities) {
  const patterns = [
    /(?:titulo|título)\s+(?:es\s+|ser[aá]?\s+)?[:\-]?\s*["']?([^"'.]+?)["']?(?=\s+(?:prioridad|departamento|manana|mañana|hoy|a las|invitar|$)|$)/i,
    /(?:llamada|nombrada?)\s+["']?([^"'.]+?)["']?(?=\s+(?:prioridad|departamento|manana|mañana|hoy|a las|$))/i,
  ];

  for (const entity of entities) {
    patterns.push(
      new RegExp(
        `(?:crea|crear|genera|nuevo|reporta|abre|registra|publica|agenda|programa|organiza|haz|pon)\\s+(?:un[a]?\\s+)?${entity}\\s+(?:de|sobre|para)?\\s*[:\-]?\\s*(.+)$`,
        'i',
      ),
      new RegExp(`${entity}\\s+(?:de|sobre|para)\\s+(.+)$`, 'i'),
    );
  }

  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      const cleaned = stripPriorityFromTitle(m[1].replace(TITLE_STOP, '').trim());
      if (cleaned.length > 2) return cleaned.slice(0, 200);
    }
  }
  return null;
}

function extractInlinePriority(text) {
  const t = normalizeText(text);
  const m = t.match(PRIORITY_INLINE);
  if (!m) return null;
  const word = m[1];
  if (/urgente|critico|crítico/.test(word)) return 'urgent';
  if (/alta|alto|importante/.test(word)) return 'high';
  if (/baja|bajo/.test(word)) return 'low';
  if (/media|medio|normal/.test(word)) return 'medium';
  return null;
}

function mergeParams(base = {}, incoming = {}) {
  const { isValidTicketTitle } = require('./voiceCreateTicket');
  const out = { ...base };
  for (const [key, val] of Object.entries(incoming)) {
    if (val == null || val === '') continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (key === 'title') {
      if (isValidTicketTitle(val)) out.title = val;
      else if (!isValidTicketTitle(out.title)) out.title = val;
      continue;
    }
    if (key === 'description' && /creado por comando de voz/i.test(String(val)) && out.description && !/creado por comando/i.test(String(out.description))) {
      continue;
    }
    out[key] = val;
  }
  return out;
}

function buildSlotMeta(parsed) {
  const p = parsed?.params || {};
  const meta = {};
  const add = (key, value, confidence = 'medium') => {
    if (value == null || value === '') return;
    meta[key] = { value, confidence };
  };

  add('title', p.title, p.title ? 'high' : 'low');
  add('date', p.date, p.date ? 'high' : 'low');
  add('start_time', p.start_time, p.start_time ? 'high' : 'low');
  add('end_time', p.end_time, p.end_time ? 'medium' : 'low');
  add('priority', p.priority, p.priority ? 'high' : 'low');
  add('status', p.status, p.status ? 'high' : 'low');
  add('ticket_id', p.ticket_id, p.ticket_id ? 'high' : 'low');
  add('task_id', p.task_id, p.task_id ? 'high' : 'low');
  add('assigned_to', p.assigned_to, p.assigned_to ? 'high' : 'low');
  add('assignee_hint', p.assignee_hint, p.assignee_hint ? 'medium' : 'low');
  add('module', p.module, p.module ? 'high' : 'low');
  if (Array.isArray(p.departments) && p.departments.length) {
    add('departments', p.departments.join(', '), 'high');
  }
  if (Array.isArray(p.attendees) && p.attendees.length) {
    add('attendees', `${p.attendees.length} persona(s)`, 'high');
  }

  return meta;
}

function rebuildFromIntent(intent, raw, text, users, actor = null) {
  const parser = lazyParser();
  switch (intent) {
    case 'create_meeting':
      if (parser.isMeetingCreateCommand?.(text) || scoreCreateMeeting(text) >= 3) {
        return parser.parseCreateMeeting(raw, text, users);
      }
      return null;
    case 'create_ticket':
      if (parser.isCreateTicketCommand?.(text) || scoreCreateTicket(text) >= 3) {
        return parser.parseCreateTicket(raw, text, users, actor);
      }
      return null;
    case 'create_task':
      if (parser.isCreateTaskCommand?.(text) || scoreCreateTask(text) >= 3) {
        return parser.parseCreateTask(raw, text, users, actor);
      }
      return null;
    default:
      return null;
  }
}

function improveCreateParams(parsed, raw, text) {
  const p = parsed.params || {};
  const intent = parsed.intent;

  if (intent === 'create_ticket') {
    const { isValidTicketTitle } = require('./voiceCreateTicket');
    const better = extractEntityTitle(raw, ['ticket', 'incidencia', 'falla', 'problema']);
    if (better && isValidTicketTitle(better) && (!p.title || !isValidTicketTitle(p.title))) {
      p.title = better;
    } else if (p.title && !isValidTicketTitle(p.title)) {
      p.title = null;
    }
    const pr = extractInlinePriority(text);
    if (pr) p.priority = pr;
  }

  if (intent === 'create_meeting') {
    const { isValidMeetingTitle } = require('./voiceCreateMeeting');
    const better = extractEntityTitle(raw, ['reunion', 'reunión', 'junta', 'cita']);
    if (better && isValidMeetingTitle(better) && (!p.title || !isValidMeetingTitle(p.title))) {
      p.title = better;
    } else if (p.title && !isValidMeetingTitle(p.title)) {
      p.title = null;
    }
  }

  if (intent === 'create_task') {
    const better = extractEntityTitle(raw, ['tarea']);
    if (better && /desde comando de voz/i.test(p.title || '')) {
      p.title = better;
    }
  }

  parsed.params = p;
  return parsed;
}

function shouldOverrideIntent(parsed, classified, text) {
  if (!parsed || !classified || classified.intent === 'unknown') return false;
  if (parsed.intent === classified.intent) return false;

  const t = normalizeText(text);
  const protectedCreates = ['create_ticket', 'create_task', 'create_meeting', 'assign_ticket'];
  if (
    protectedCreates.includes(parsed.intent) &&
    parsed.confidence === 'high' &&
    !parsed.needsClarification &&
    parsed.canExecute
  ) {
    return false;
  }

  const weak = parsed.intent === 'unknown' || parsed.confidence === 'low';
  const queryMisread =
    String(parsed.intent).startsWith('query_') &&
    String(classified.intent).startsWith('create_') &&
    CREATE_VERBS.test(t);
  const navigateMisread =
    parsed.intent === 'navigate' && String(classified.intent).startsWith('create_') && classified.score >= 6;

  if (protectedCreates.includes(parsed.intent) && parsed.confidence === 'medium' && !queryMisread && !navigateMisread) {
    return false;
  }

  return (weak && classified.score >= 5) || queryMisread || navigateMisread;
}

/**
 * Refina intención, parámetros y acción a partir del parseo de reglas.
 */
function refineVoiceUnderstanding(parsed, raw, text, ctx = {}) {
  if (!parsed) return parsed;

  const users = Array.isArray(ctx.users) ? ctx.users : [];
  const session = ctx.session || null;
  let result = { ...parsed, params: { ...(parsed.params || {}) } };

  if (session?.needsClarification && session.intent === 'create_ticket') {
    const { continueCreateTicket } = require('./voiceCreateTicket');
    const continued = continueCreateTicket(raw, text, session, users, ctx.actor);
    if (continued) {
      continued.action = ACTION_LABELS.create_ticket;
      continued.slotMeta = buildSlotMeta(continued);
      return continued;
    }
  }

  if (session?.needsClarification && session.intent === 'create_task') {
    const { continueCreateTask } = require('./voiceCreateTask');
    const continued = continueCreateTask(raw, text, session, users, ctx.actor);
    if (continued) {
      continued.action = ACTION_LABELS.create_task;
      continued.slotMeta = buildSlotMeta(continued);
      return continued;
    }
  }

  if (session?.needsClarification && session.intent === 'assign_ticket') {
    const { continueAssignTicket } = require('./voiceAssignTicket');
    const continued = continueAssignTicket(raw, text, session, users, ctx.actor, ctx.postExecute || null);
    if (continued) {
      continued.action = ACTION_LABELS.assign_ticket;
      continued.slotMeta = buildSlotMeta(continued);
      return continued;
    }
  }

  if (session?.needsClarification && session.intent === 'create_meeting') {
    const { continueCreateMeeting } = require('./voiceCreateMeeting');
    const continued = continueCreateMeeting(raw, text, session, users);
    if (continued) {
      continued.action = ACTION_LABELS.create_meeting;
      continued.slotMeta = buildSlotMeta(continued);
      return continued;
    }
  }

  const classified = classifyIntent(text, { ...ctx, session });
  classified.text = text;

  // Completar turno anterior (ej. "mañana a las 10" tras "crear reunión")
  if (
    session?.needsClarification &&
    session.intent &&
    (result.intent === 'unknown' || isSlotFollowUp(text) || String(result.intent).startsWith('query_'))
  ) {
    const combinedRaw = `${session.transcript || ''} ${raw}`.replace(/\s+/g, ' ').trim();
    const combinedText = normalizeText(combinedRaw);
    const rebuilt = rebuildFromIntent(session.intent, combinedRaw, combinedText, users, ctx.actor);
    if (rebuilt) {
      result = mergeParamsIntoParse(rebuilt, session.params);
      result.sessionMerged = true;
      result.confidence = 'high';
    }
  }

  // Corregir intención mal clasificada por orden de reglas
  if (shouldOverrideIntent(result, classified, text)) {
    const rebuilt = rebuildFromIntent(classified.intent, raw, text, users, ctx.actor);
    if (rebuilt?.allowed) {
      result = { ...rebuilt, correctedIntent: true, classifierScore: classified.score };
    } else if (classified.intent.startsWith('query_')) {
      const q = matchModuleQuery(text) || matchContextQuery(text, ctx.activeModule);
      if (q) result = q;
    }
  }

  // Mejorar extracción de slots en creates
  if (String(result.intent || '').startsWith('create_')) {
    result = improveCreateParams(result, raw, text);
  }

  result.action = ACTION_LABELS[result.intent] || ACTION_LABELS.unknown;
  result.intentConfidence = classified.confidence;
  result.classifierScore = classified.score;
  result.slotMeta = buildSlotMeta(result);

  return result;
}

function mergeParamsIntoParse(parsed, sessionParams) {
  if (!sessionParams) return parsed;
  parsed.params = mergeParams(sessionParams, parsed.params || {});
  return parsed;
}

function applySessionParams(parsed, session) {
  if (!session?.params || !parsed) return parsed;
  if (session.needsClarification && parsed.intent === session.intent) {
    parsed.params = mergeParams(session.params, parsed.params || {});
  }
  return parsed;
}

module.exports = {
  classifyIntent,
  refineVoiceUnderstanding,
  applySessionParams,
  mergeParamsIntoParse,
  isSlotFollowUp,
  extractEntityTitle,
  extractInlinePriority,
  ACTION_LABELS,
  buildSlotMeta,
};
