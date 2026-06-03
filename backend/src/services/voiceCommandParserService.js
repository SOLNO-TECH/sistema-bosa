/**
 * Intérprete de comandos por voz (reglas en español, sin API de pago).
 */

const { preprocessTranscript } = require('../utils/voiceTranscriptNormalize');
const { localDateYMD } = require('../utils/localDate');
const { matchModuleQuery, matchContextQuery } = require('./voice/voiceQueryParser');
const { enrichParsedResult } = require('./voice/voiceIntentNarration');
const { resolveSemanticIntent } = require('./voice/voiceSemanticResolver');
const {
  resolveAssignee,
  buildVoicePickPrompt,
  findUsersByHint,
  userFullName,
} = require('./voice/voiceAssigneeResolver');
const { applyFormDefaults, buildTicketDescription, buildTaskDescription, buildAvisoContent, knownDepartments } = require('./voice/voiceFormDefaults');

const STATUS_ALIASES = {
  open: ['pendiente', 'abierto', 'abrir', 'nuevo'],
  in_progress: ['en progreso', 'progreso', 'trabajando'],
  resolved: ['resuelto', 'revisión', 'revision', 'en revisión'],
  closed: ['cerrado', 'cerrar', 'completado', 'finalizado', 'terminado'],
};

const PRIORITY_ALIASES = {
  urgent: ['urgente', 'crítico', 'critico'],
  high: ['alta', 'alto', 'importante'],
  low: ['baja', 'bajo'],
  medium: ['media', 'medio', 'normal'],
};

const MODULE_ALIASES = {
  overview: ['inicio', 'resumen', 'dashboard', 'principal', 'home', 'panel'],
  calendar: ['calendario', 'reuniones', 'agenda', 'juntas', 'citas', 'horario'],
  tickets: ['tickets', 'ticket', 'soporte', 'incidencias', 'incidencia', 'fallas', 'mesa de ayuda'],
  tasks: ['tareas', 'tarea operativa', 'operativas', 'pendientes operativos'],
  avisos: ['avisos', 'aviso', 'comunicados', 'anuncios', 'boletin', 'boletín'],
  minutas: ['minutas', 'minuta', 'actas', 'acta'],
  foro: ['foro', 'chat', 'grupos', 'conversacion', 'conversación'],
  notifications: ['notificaciones', 'alertas', 'campana', 'campana de notificaciones'],
  settings: ['configuración', 'configuracion', 'ajustes', 'preferencias', 'cuenta'],
  users: ['usuarios', 'personal', 'equipo', 'colaboradores'],
};

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTicketId(text) {
  const m =
    text.match(/ticket\s*#?\s*(\d+)/i) ||
    text.match(/#\s*(\d+)/) ||
    text.match(/\bnumero\s+(\d+)\b/i) ||
    text.match(/\bnúmero\s+(\d+)\b/i);
  return m ? Number(m[1]) : null;
}

function extractTaskId(text) {
  const m = text.match(/tarea\s*#?\s*(\d+)/i) || text.match(/tarea\s+numero\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

function extractMeetingId(text) {
  const m =
    text.match(/reunion\s*#?\s*(\d+)/i) ||
    text.match(/reunión\s*#?\s*(\d+)/i) ||
    text.match(/reunion\s+numero\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

function extractMinuteId(text) {
  const m = text.match(/minuta\s*#?\s*(\d+)/i) || text.match(/minuta\s+numero\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

function matchStatus(text) {
  const t = normalizeText(text);
  for (const [status, words] of Object.entries(STATUS_ALIASES)) {
    if (words.some((w) => t.includes(w))) return status;
  }
  return null;
}

function matchPriority(text) {
  const t = normalizeText(text);
  const explicit = t.match(/\bprioridad\s+(urgente|critico|crítico|alta|alto|importante|media|medio|normal|baja|bajo)\b/);
  if (explicit) {
    const w = explicit[1];
    if (/urgente|critico|crítico/.test(w)) return 'urgent';
    if (/alta|alto|importante/.test(w)) return 'high';
    if (/baja|bajo/.test(w)) return 'low';
    return 'medium';
  }
  for (const [p, words] of Object.entries(PRIORITY_ALIASES)) {
    if (words.some((w) => new RegExp(`\\b${w}\\b`).test(t))) return p;
  }
  return null;
}

function matchModule(text) {
  const t = normalizeText(text);
  for (const [mod, words] of Object.entries(MODULE_ALIASES)) {
    if (words.some((w) => t.includes(w))) return mod;
  }
  return null;
}

function parseRelativeDate(text) {
  const t = normalizeText(text);
  const now = new Date();
  const toIsoDate = (d) => localDateYMD(d);

  const MONTHS = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    setiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
  };

  if (/\bfin\s+de\s+mes\b/.test(t)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return toIsoDate(d);
  }

  for (const [name, monthIdx] of Object.entries(MONTHS)) {
    const dm = t.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+${name}(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`));
    if (dm) {
      const day = Number(dm[1]);
      const year = dm[2] ? Number(dm[2]) : now.getFullYear();
      return toIsoDate(new Date(year, monthIdx, day));
    }
    if (new RegExp(`\\b(?:el\\s+)?${name}\\b`).test(t) && !/\b(\d{1,2})\s+de\b/.test(t)) {
      const d = new Date(now.getFullYear(), monthIdx, 15);
      if (d < now && !/\b(proximo|próximo|siguiente)\b/.test(t)) {
        d.setFullYear(d.getFullYear() + 1);
      }
      return toIsoDate(d);
    }
  }

  const WEEKDAYS = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
  };

  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b(?:el|este|proximo|próximo)?\\s*${name}\\b`).test(t)) {
      const d = new Date(now);
      let diff = (dow - d.getDay() + 7) % 7;
      if (diff === 0 && /\b(proximo|próximo|siguiente)\b/.test(t)) diff = 7;
      d.setDate(d.getDate() + diff);
      return toIsoDate(d);
    }
  }

  if (/\bmañana\b|\bmanana\b/.test(t)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
  }
  if (/\bpasado\s+mañana\b|\bpasado\s+manana\b/.test(t)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return toIsoDate(d);
  }
  if (/\bhoy\b/.test(t)) return toIsoDate(now);

  const dm = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]) - 1;
    const year = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : now.getFullYear();
    return toIsoDate(new Date(year, month, day));
  }
  return null;
}

function parseTime(text, fallback = '10:00') {
  const t = normalizeText(text);
  if (/\bmedio dia\b|\bmedio día\b/.test(t)) return '12:00';

  const patterns = [
    /\b(?:a\s+las|las|para\s+las|a)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|hrs?|horas?)?\b/,
    /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/,
    /\b(\d{1,2})\s*(am|pm)\b/,
    /\b(?:a|para)\s+(\d{1,2})\b(?!\s*(?:%|horas?\b))/,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    const ap = m[3];
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (!ap && h >= 1 && h <= 7) h += 12;
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  return fallback;
}

function hasDateReference(text) {
  const t = normalizeText(text);
  return (
    /\b(hoy|manana|mañana|pasado|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(t) ||
    /\b\d{1,2}[\/\-]\d{1,2}/.test(t)
  );
}

function hasTimeReference(text) {
  const t = normalizeText(text);
  return /\b(a\s+las|para\s+las|medio dia|medio día|\d{1,2}(:|\s*(am|pm|hrs?)))\b/.test(t);
}

function parseEndTime(text, startTime) {
  const t = normalizeText(text);
  const range = t.match(/\bde\s+(\d{1,2})(?::(\d{2}))?\s+a(?:\s+las)?\s+(\d{1,2})(?::(\d{2}))?/);
  if (range) {
    const h = Number(range[3]);
    const min = range[4] ? Number(range[4]) : 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  const dur = t.match(/\b(?:por|duracion|duracion de|duración de)\s+(\d+)\s+horas?\b/);
  const [sh, sm] = startTime.split(':').map(Number);
  if (dur) {
    const endH = sh + Number(dur[1]);
    return `${String(endH).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
  }
  return `${String(sh + 1).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
}

const ARTICLE_F = '(?:una\\s+|un\\s+|1\\s+)?';

function isCreateTicketCommand(text) {
  return (
    new RegExp(`crea(?:r|me)?\\s+${ARTICLE_F}ticket`).test(text) ||
    new RegExp(`crear\\s+${ARTICLE_F}ticket`).test(text) ||
    new RegExp(`genera(?:r|me)?\\s+${ARTICLE_F}ticket`).test(text) ||
    /nuevo\s+ticket/.test(text) ||
    new RegExp(`haz(?:me)?\\s+${ARTICLE_F}ticket`).test(text) ||
    new RegExp(`abre\\s+${ARTICLE_F}ticket`).test(text) ||
    new RegExp(`registra(?:r|me)?\\s+${ARTICLE_F}(?:ticket|incidencia|falla)`).test(text) ||
    new RegExp(`quiero\\s+(?:crear\\s+)?${ARTICLE_F}ticket`).test(text) ||
    new RegExp(`necesito\\s+(?:crear\\s+)?${ARTICLE_F}ticket`).test(text) ||
    new RegExp(`pon(?:me)?\\s+${ARTICLE_F}ticket`).test(text) ||
    /reporta(?:r|me)?\s+(?:un\s+)?(?:problema|falla|incidencia)/.test(text) ||
    /reportame\s+(?:un\s+)?problema/.test(text) ||
    /(?:hay|tengo)\s+(?:un\s+)?problema\s+con/.test(text) ||
    /(?:no funciona|no enciende|no prende|esta rota|está rota|esta dañada|está dañada|se descompuso)/.test(text)
  );
}

function extractTicketTitle(raw) {
  const extracted =
    extractAfterKeywords(raw, [
      /(?:el\s+)?(?:asunto|titulo|título)\s*(?:es|:|-)\s*(.+)/i,
      /(?:crea(?:r|me)?|genera(?:r|me)?|nuevo|abre|registra(?:r|me)?|quiero|necesito)\s+(?:crear\s+)?(?:un\s+)?ticket\s+(?:de|sobre|para|por)?\s*[:\-]?\s*(.+)/i,
      /(?:reporta(?:r|me)?|reportame|registra(?:r|me)?)\s+(?:un\s+)?(?:problema|falla|incidencia)\s+(?:de|con|sobre|por)?\s*(.+)/i,
      /(?:hay|tengo)\s+(?:un\s+)?problema\s+con\s+(.+)/i,
      /ticket\s*[:\-]\s*(.+)/i,
    ]) || '';
  const t = normalizeText(extracted);
  if (/^(departamento|depto|prioridad)\b/.test(t)) return '';
  return extracted;
}

function extractAssigneeHint(text) {
  const patterns = [
    /(?:asignar(?:le|la|lo|me)?|asignado|asignada|delegar(?:le|la|lo)?|delegado|encargar(?:le|la|lo)?|responsable(?:\s+de|\s+es)?)\s+(?:a\s+)?([a-záéíóúñ][a-záéíóúñ\s.'-]{2,}?)(?=\s+(?:con|para|en|el|la|los|las|hasta|inicio|fin|desde|prioridad|departamento|manana|mañana|hoy|titulo|título|tarea|ticket|$)|$)/i,
    /(?:tarea|ticket)\s+.+\s+(?:asignar(?:le)?\s+a|para)\s+([a-záéíóúñ][a-záéíóúñ\s.'-]{2,})/i,
    /\bpara\s+([a-záéíóúñ]{2,}(?:\s+[a-záéíóúñ]{2,}){1,2})\s*$/i,
  ];
  for (const re of patterns) {
    const m = String(text || '').match(re);
    if (m?.[1]) {
      const hint = m[1]
        .trim()
        .replace(/\s+(prioridad|departamento|inicio|fin|desde|manana|mañana|hoy|titulo|título).*$/i, '')
        .trim();
      if (isValidPersonHint(hint)) return hint;
    }
  }
  return '';
}

function extractTaskTitle(raw) {
  const patterns = [
    /(?:titulo|título)\s+(?:es\s+)?[:\-]?\s*(.+?)(?=\s*,?\s*(?:asignar|asignado|responsable|para|departamento|manana|mañana|hoy|$))/i,
    /(?:crea(?:r|me)?|crear|genera(?:r|me)?|nueva|quiero|necesito|hacer|haz)\s+(?:una\s+)?tarea\s+(?:de|sobre|para)?\s*[:\-]?\s*(.+)/i,
    /tarea\s+(?:de|sobre|para)\s+(.+)/i,
  ];
  for (const re of patterns) {
    const m = String(raw || '').match(re);
    if (m?.[1]) {
      const t = m[1]
        .trim()
        .replace(/\s*,?\s*(?:asignar(?:le)?\s+a|asignado\s+a|responsable|para)\s+.+$/i, '')
        .replace(/\s+(prioridad|departamento|manana|mañana|hoy).*$/i, '')
        .trim();
      if (t.length > 2) return t.slice(0, 200);
    }
  }
  return '';
}

function actorPermissionLevel(actor) {
  if (!actor) return 'user';
  return (
    actor.permission_level ||
    (actor.role === 'superadmin'
      ? 'superadmin'
      : actor.role === 'administrator'
        ? 'administrator'
        : actor.role === 'manager'
          ? 'manager'
          : 'user')
  );
}

function resolveTaskDepartment(users, assigneeId, actor, explicitDept) {
  if (explicitDept) return String(explicitDept).trim();
  const level = actorPermissionLevel(actor);
  if (level === 'manager' && actor?.departamento) return String(actor.departamento).trim();
  if (assigneeId) {
    const u = users.find((x) => Number(x.id) === Number(assigneeId));
    if (u?.departamento) return String(u.departamento).trim();
  }
  return actor?.departamento ? String(actor.departamento).trim() : '';
}

function isCreateTaskCommand(text) {
  const t = normalizeText(text);
  if (!/\b(tarea|tareas)\b/.test(t) && !/tarea\s+operativa/.test(t)) return false;

  return (
    new RegExp(
      `(?:crea(?:r|me)?|crear|creo|criar|genera(?:r|me)?|hacer(?:me)?|haz(?:me)?|pon(?:me)?)\\s+${ARTICLE_F}tarea`,
    ).test(t) ||
    new RegExp(`(?:quiero|necesito|solicito|me\\s+gustaria|quisiera)\\s+(?:crear\\s+)?${ARTICLE_F}tarea`).test(t) ||
    /nueva\s+tarea/.test(t) ||
    /tarea\s+operativa/.test(t) ||
    (/\b(asignar|asignado|responsable|delegar)\b/.test(t) && /\btarea\b/.test(t))
  );
}

function parseCreateTask(raw, text, users = [], actor = null) {
  const { buildCreateTaskFromUtterance } = require('./voice/voiceCreateTask');
  return buildCreateTaskFromUtterance(raw, text, users, actor);
}

function parseCreateTicket(raw, text, users = [], actor = null) {
  const { cleanTicketTitle, isValidTicketTitle, evaluateTicketParams } = require('./voice/voiceCreateTicket');

  const titleRaw = extractTicketTitle(raw) || '';
  const priority = matchPriority(text) || 'medium';
  const departments = extractDepartments(raw, text, users);
  const deptMatch = text.match(/departamento\s+([a-z0-9\sáéíóúñ]+)/i);
  const category =
    departments[0] ||
    (deptMatch?.[1] ? matchKnownDepartment(deptMatch[1], knownDepartments(users)) : null) ||
    (actor?.departamento || '').trim() ||
    knownDepartments(users)[0] ||
    '';

  let cleanTitle = null;
  if (isValidTicketTitle(titleRaw)) {
    cleanTitle = cleanTicketTitle(titleRaw);
  } else {
    const stripped = cleanTicketTitle(
      titleRaw.replace(/\s+(prioridad|departamento|para|asignar|descripcion|descripción).*$/i, '').trim(),
    );
    if (isValidTicketTitle(stripped)) cleanTitle = stripped;
  }

  const { params: finalParams, missing, ready } = evaluateTicketParams(
    { title: cleanTitle, priority, category },
    raw,
  );

  return {
    intent: 'create_ticket',
    confidence: ready ? 'high' : 'medium',
    params: finalParams,
    ticketMissing: missing,
    summary: isValidTicketTitle(finalParams.title)
      ? `Crear ticket: "${finalParams.title.slice(0, 80)}"${category ? ` (${category})` : ''}`
      : 'Crear ticket',
    allowed: true,
    denyReason: null,
  };
}

const MEETING_NOUN = '(?:reunion|reuniones|junta|juntas|cita|citas)';

function isMeetingCreateCommand(text) {
  const t = normalizeText(text);
  if (!new RegExp(`\\b${MEETING_NOUN}\\b`).test(t)) return false;

  return (
    new RegExp(
      `\\b(agenda(?:r|me)?|programa(?:r|me)?|crea(?:r|me)?|creo|criar|hacer(?:me)?|organiza(?:r|me)?|aparta(?:r|me)?|reserva(?:r|me)?|genera(?:r|me)?|registra(?:r|me)?|haz(?:me)?|pon(?:me)?)\\s+${ARTICLE_F}(?:reunion|junta|cita)\\b`,
    ).test(t) ||
    new RegExp(`\\bnueva\\s+${MEETING_NOUN}\\b`).test(t) ||
    new RegExp(`\\b(?:reunion|junta|cita)\\s+nueva\\b`).test(t) ||
    new RegExp(
      `\\b(quiero|necesito|solicito|pide|quisiera|me\\s+gustaria|dame|ponme)\\s+${ARTICLE_F}(?:reunion|junta|cita)\\b`,
    ).test(t) ||
    new RegExp(`\\bpon(?:me)?\\s+${ARTICLE_F}(?:reunion|junta|cita)\\b`).test(t) ||
    /\b(?:reunion|junta|cita)\s+para\b/.test(t) ||
    (/\b(titulo|departamento|descripcion|invitar|asistentes)\b/.test(t) &&
      /\b(agenda|programa|crea|organiza|reserva|aparta|quiero|necesito)\b/.test(t)) ||
    (/\b(manana|hoy|pasado)\b/.test(t) &&
      /\b(agenda|programa|crea|organiza|reserva|aparta|quiero|necesito|solicito|agendar|programar)\b/.test(t)) ||
    /\bagendar\s+(?:lo\s+de|sobre)\b/.test(t) ||
    /\bprogramar\s+(?:lo\s+de|sobre)\b/.test(t) ||
    /\b(?:reunion|junta)\s+invitar\b/.test(t) ||
    /\bcrear\s+reunion\s+invitar\b/.test(t) ||
    (t.split(/\s+/).length <= 3 &&
      /\b(?:reunion|junta|cita)\b/.test(t) &&
      /\b(agenda|programa|crea|crear|organiza|organizar|quiero|necesito|nueva|nuevo|pon|ponme|haz|hazme)\b/.test(t) &&
      !/\b(hay|cuant|cuál|cual|mis|proxima|siguiente|hoy|manana|mañana|activa|pendiente|dime|consulta|cuantas|cuantos)\b/.test(t))
  );
}

function isActionCommand(text) {
  const t = normalizeText(text);
  return (
    isMeetingCreateCommand(t) ||
    isCreateTicketCommand(t) ||
    isCreateTaskCommand(t) ||
    /publica(?:r|me)?\s+(?:un\s+)?aviso|nuevo\s+aviso|comunicado/.test(t) ||
    /(reagendar|reprogramar|mover|cambiar\s+fecha)/.test(t)
  );
}

function splitDeptList(s) {
  return String(s || '')
    .replace(/\s+y\s+el\s+departamento\s+/gi, ' y ')
    .split(/\s+y\s+|\s*,\s*|\s+e\s+el\s+|\s+e\s+/i)
    .map((x) => x.replace(/^de\s+/i, '').trim())
    .filter((x) => x.length > 1 && !/^(el|la|los|las)$/i.test(x));
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

function extractDepartments(raw, text, users) {
  const found = new Set();
  const known = [...new Set(users.map((u) => u.departamento).filter(Boolean))];

  const blockMatch =
    raw.match(
      /departamentos?\s+(?:de\s+)?(.+?)(?=\s+(?:con\s+)?(?:titulo|titulo|descripcion|descripcion|manana|mañana|hoy|a\s+las|para\s+las|invitar|asistentes|virtual|sala|$))/i,
    ) ||
    raw.match(
      /(?:invitar|incluir|con)\s+(?:a\s+)?(?:los\s+)?departamentos?\s+(?:de\s+)?(.+?)(?=\s+(?:titulo|titulo|manana|mañana|hoy|a\s+las|descripcion|$))/i,
    );
  if (blockMatch?.[1]) {
    splitDeptList(blockMatch[1]).forEach((p) => {
      const matched = matchKnownDepartment(p, known);
      if (matched) found.add(matched);
      else if (p.length > 2) found.add(p.trim());
    });
  }

  const singleRe =
    /departamento\s+(?:de\s+)?([a-záéíóúñ0-9\s]+?)(?=\s*(?:,|\s+y\s+departamento|\s+con\s+titulo|\s+titulo|manana|mañana|hoy|a\s+las|descripcion|$))/gi;
  let sm;
  while ((sm = singleRe.exec(raw)) !== null) {
    const matched = matchKnownDepartment(sm[1], known);
    if (matched) found.add(matched);
  }

  const normText = normalizeText(text);
  for (const d of known) {
    const nd = normalizeText(d);
    if (nd.length < 2) continue;
    const re = new RegExp(`(^|\\s)${nd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
    if (re.test(normText) || (nd.length > 2 && normText.includes(nd))) found.add(d);
  }

  return [...found];
}

function resolveAttendeesFromDepartments(users, departments) {
  if (!departments?.length) return [];
  const ids = [];
  for (const u of users) {
    const ud = normalizeText(u.departamento || '');
    if (!ud) continue;
    if (
      departments.some((d) => {
        const nd = normalizeText(d);
        return ud === nd || ud.includes(nd) || nd.includes(ud);
      })
    ) {
      ids.push(u.id);
    }
  }
  return [...new Set(ids)];
}

function cleanMeetingTitle(s) {
  return String(s || '')
    .replace(/\b(?:con|para|en)\s+(?:los\s+)?departamentos?\b.*$/i, '')
    .replace(/\b(?:descripcion|descripción|notas?|detalle)\b.*$/i, '')
    .replace(/\b(?:manana|mañana|hoy|pasado\s+manana|pasado\s+mañana)\b.*$/i, '')
    .replace(/\b(?:a\s+las|para\s+las|de\s+\d{1,2})\b.*$/i, '')
    .replace(/\b(?:invitar|asistentes?|participantes?)\b.*$/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function extractMeetingTitle(raw) {
  const patterns = [
    /(?:titulo|título)\s+(?:es\s+|ser[aá]?\s+)?(?:de\s+)?[:\-]?\s*["']?([^"'.]+?)["']?(?=\s+(?:departamento|descripcion|descripción|manana|mañana|hoy|a\s+las|para\s+las|invitar|con\s+los|virtual|sala|$)|$)/i,
    /(?:organiza(?:r|me)?|reserva(?:r|me)?|aparta(?:r|me)?)\s+(?:una\s+)?(?:junta|reunion)\s+(?:.+?\s+)?(?:titulo|título)\s*(.+)/i,
    /(?:llamada|nombrada?)\s+["']?([^"'.]+?)["']?(?=\s+(?:departamento|manana|mañana|hoy|a\s+las|$))/i,
    /reunion\s+(?:de|sobre|para)\s+(?:el\s+)?(?:tema\s+)?[:\-]?\s*(.+?)(?=\s+(?:para\s+(?:el\s+)?(?:dia\s+de\s+)?(?:manana|mañana|hoy)|(?:el\s+)?(?:manana|mañana|hoy)|a\s+las|departamento|descripcion|descripción|invitar|con\s+los|$))/i,
    /(?:agenda(?:r|me)?|programa(?:r|me)?|crea(?:r|me)?|quiero|necesito|solicito)\s+(?:una\s+)?(?:reunion|junta)\s+(?:de|sobre|para)?\s*(.+?)(?=\s+(?:para\s+(?:el\s+)?(?:dia\s+de\s+)?(?:manana|mañana|hoy)|(?:el\s+)?(?:manana|mañana|hoy)|a\s+las|departamento|descripcion|descripción|invitar|virtual|sala|semanal\s+hasta|quincenal\s+hasta|mensual\s+hasta|$))/i,
    /reunion\s+para\s+(?:el\s+)?(?:dia\s+de\s+)?(?:manana|mañana|hoy)\s+(?:con\s+)?(?:titulo|título)?\s*(.+?)(?=\s+(?:departamento|descripcion|a\s+las|invitar|$))/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      const cleaned = cleanMeetingTitle(m[1]);
      if (cleaned.length > 2) return cleaned;
    }
  }
  return '';
}

function extractMeetingDescription(raw) {
  const m = raw.match(/(?:descripcion|descripción|notas?|detalle)\s+(?:es\s+)?[:\-]?\s*(.+)/i);
  return m?.[1]?.trim().slice(0, 4000) || '';
}

function extractNamedAttendeeHints(raw) {
  const hints = [];
  const inv = raw.match(
    /(?:invitar|invitados?|asistentes?|participantes?)\s+(?:a\s+)?([a-záéíóúñ\s, y]+?)(?=\s+(?:del\s+)?departamento|titulo|título|manana|mañana|hoy|a\s+las|descripcion|$)/i,
  );
  if (inv?.[1] && !/departamentos?/i.test(inv[1])) {
    inv[1].split(/\s+y\s+|,/).forEach((name) => {
      const n = name.trim();
      if (isValidPersonHint(n)) hints.push(n);
    });
  }
  const assignee = extractAssigneeHint(raw);
  if (assignee && !/departamento/i.test(assignee) && isValidPersonHint(assignee)) hints.push(assignee);
  return [...new Set(hints)];
}

function parseCreateMeeting(raw, text, users) {
  const { buildCreateMeetingFromUtterance } = require('./voice/voiceCreateMeeting');
  return buildCreateMeetingFromUtterance(raw, text, users);
}

function extractAfterKeywords(text, patterns) {
  const raw = String(text || '');
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) return m[1].trim().replace(/\s+(prioridad|para|asignar|departamento|categoria).*$/i, '').trim();
  }
  return '';
}

function isValidPersonHint(hint) {
  const h = normalizeText(hint);
  if (!h || h.length < 3) return false;
  if (/\b(manana|mañana|hoy|pasado|dia|día|reunion|departamento|titulo|titulo|inventario|virtual|sala)\b/.test(h)) {
    return false;
  }
  if (/^\d/.test(h)) return false;
  return true;
}

/**
 * @param {string} transcript
 * @param {object} ctx — { users, actor }
 */
function inferLooseIntent(raw, text, users, actor = null) {
  const t = normalizeText(text);

  if (/\b(reunion|reuniones|junta|juntas|agenda|calendario|cita)\b/.test(t)) {
    if (
      QUERY_LIKE.test(t) ||
      /\b(hay|tengo|alguna|algun|cuant|proxima|siguiente|hoy|manana|mañana|activa)\b/.test(t)
    ) {
      const q = matchModuleQuery(text);
      if (q) return q;
      return matchContextQuery(text, 'calendar');
    }
    if (isMeetingCreateCommand(t)) return parseCreateMeeting(raw, text, users);
  }

  if (/\b(ticket|tickets|incidencia|soporte|falla)\b/.test(t)) {
    if (QUERY_LIKE.test(t) || /\b(hay|tengo|cuant|abiert|pendient|urgent)\b/.test(t)) {
      return matchModuleQuery(text);
    }
    if (isCreateTicketCommand(t)) return parseCreateTicket(raw, text, users, actor);
  }

  if (/\b(tarea|tareas)\b/.test(t)) {
    if (QUERY_LIKE.test(t) || /\b(hay|tengo|cuant|pendient)\b/.test(t)) {
      return matchModuleQuery(text);
    }
    if (isCreateTaskCommand(t)) return parseCreateTask(raw, text, users, actor);
  }

  if (/\b(aviso|avisos|comunicado)\b/.test(t) && QUERY_LIKE.test(t)) {
    return matchModuleQuery(text);
  }

  return null;
}

const QUERY_LIKE =
  /\?|\b(hay|qué|que|cuant|cual|cuál|dime|saber|quisiera|muestr|mostr|consulta|revisa|checa)\b/;

function mapSpokenStatus(fragment) {
  const f = normalizeText(fragment);
  if (/cerrad|complet|termin|finaliz/.test(f)) return 'closed';
  if (/progres|trabaj|curso/.test(f)) return 'in_progress';
  if (/resuelt|revision/.test(f)) return 'resolved';
  if (/pendient|abiert|nuev/.test(f)) return 'open';
  if (/urgent|crit/.test(f)) return 'urgent';
  if (/completad|terminad|hech/.test(f)) return 'done';
  if (/cancel/.test(f)) return 'cancelled';
  return null;
}

/** Comandos cortos: "ticket 5 cerrado", "cerrar ticket 12", "tarea 3 completada" */
function parseShorthandCommands(raw, text, users = [], ctx = {}) {
  const t = normalizeText(text);

  let m = t.match(/\b(?:cerrar|cierra|completar|completa|finalizar)\s+(?:el\s+)?ticket\s*#?\s*(\d+)\b/);
  if (m) {
    return {
      intent: 'update_ticket_status',
      confidence: 'high',
      params: { ticket_id: Number(m[1]), status: 'closed' },
      summary: `Cerrar ticket #${m[1]}`,
      allowed: true,
      denyReason: null,
    };
  }

  m = t.match(/\bticket\s*#?\s*(\d+)\s+(?:en\s+|a\s+|como\s+)?(\w+)/);
  if (m) {
    const status = mapSpokenStatus(m[2]);
    if (status && status !== 'urgent') {
      return {
        intent: 'update_ticket_status',
        confidence: 'high',
        params: { ticket_id: Number(m[1]), status },
        summary: `Ticket #${m[1]} → ${status}`,
        allowed: true,
        denyReason: null,
      };
    }
    if (status === 'urgent') {
      return {
        intent: 'update_ticket',
        confidence: 'medium',
        params: { ticket_id: Number(m[1]), priority: 'urgent' },
        summary: `Marcar ticket #${m[1]} como urgente`,
        allowed: true,
        denyReason: null,
      };
    }
  }

  m = t.match(/\b(?:completar|completa|terminar|termina|cerrar|cierra)\s+(?:la\s+)?tarea\s*#?\s*(\d+)\b/);
  if (m) {
    return {
      intent: 'update_task_status',
      confidence: 'high',
      params: { task_id: Number(m[1]), status: 'done' },
      summary: `Completar tarea #${m[1]}`,
      allowed: true,
      denyReason: null,
    };
  }

  m = t.match(/\btarea\s*#?\s*(\d+)\s+(?:en\s+|a\s+)?(\w+)/);
  if (m) {
    const f = normalizeText(m[2]);
    let status = null;
    if (/completad|terminad|hech|cerrad|finaliz/.test(f)) status = 'done';
    else if (/progres|curso|trabaj/.test(f)) status = 'in_progress';
    else if (/pendient|abiert/.test(f)) status = 'pending';
    else if (/cancel/.test(f)) status = 'cancelled';
    if (status) {
      return {
        intent: 'update_task_status',
        confidence: 'high',
        params: { task_id: Number(m[1]), status },
        summary: `Tarea #${m[1]} → ${status}`,
        allowed: true,
        denyReason: null,
      };
    }
  }

  if (/\b(?:asignar|asigna)\s+(?:el\s+)?ticket\b/.test(t) || (/\basignar\b/.test(t) && ctx.postExecute?.ticket_id)) {
    const { buildAssignTicketFromUtterance } = require('./voice/voiceAssignTicket');
    return buildAssignTicketFromUtterance(raw, text, users, ctx.actor, ctx.postExecute || null);
  }

  return null;
}

function parseVoiceCommandInternal(transcript, ctx = {}) {
  const raw = preprocessTranscript(String(transcript || '').trim());
  const text = normalizeText(raw);
  const users = Array.isArray(ctx.users) ? ctx.users : [];
  const activeModule = String(ctx.activeModule || '').trim();

  if (!text) {
    return {
      intent: 'unknown',
      confidence: 'low',
      params: {},
      summary: 'No se recibió texto del comando.',
      allowed: false,
      denyReason: 'Comando vacío.',
    };
  }

  const navMod = matchModule(text);

  // Navegación explícita a módulo (antes de consultas ambiguas con “ver calendario”, etc.)
  if (
    navMod &&
    !isActionCommand(text) &&
    /\b(ver|abrir|ir|muestr|mostr|entra|llev|pasar|consultar?)\b/.test(text) &&
    !/\b(reunion|junta|cita)\b/.test(text)
  ) {
    return {
      intent: 'navigate',
      confidence: 'high',
      params: { module: navMod },
      summary: `Ir a ${navMod}`,
      allowed: true,
      denyReason: null,
      clientOnly: true,
    };
  }

  // Crear reunión — antes que consultas ambiguas con “reunion” / “agenda”
  if (isMeetingCreateCommand(text)) {
    return parseCreateMeeting(raw, text, users);
  }

  // Crear ticket / tarea — antes que consultas de tickets o tareas
  if (isCreateTicketCommand(text)) {
    return parseCreateTicket(raw, text, users, ctx.actor);
  }
  if (isCreateTaskCommand(text)) {
    return parseCreateTask(raw, text, users, ctx.actor);
  }

  // Consultas en cualquier módulo — antes que crear o navegar
  const moduleQuery = matchModuleQuery(text) || matchContextQuery(text, activeModule);
  if (moduleQuery) return moduleQuery;

  const shorthand = parseShorthandCommands(raw, text, users, ctx);
  if (shorthand) return shorthand;

  // Navegación (solo frontend) — verbos flexibles y nombre del módulo solo
  if (navMod && !isActionCommand(text)) {
    const shortNav =
      (text.split(/\s+/).length <= 3 && navMod && !/\d/.test(text)) ||
      (text.split(/\s+/).length <= 5 &&
        /^(abre|abrir|ir|ve|mostrar|muestra|entra|entrar|dame|ll[eé]vame|lleva|pasar|ver|irme|vamos|p[aá]same)\b/.test(text)) ||
      /^(quiero|necesito)\s+(ir|ver|abrir|consultar|revisar)\b/.test(text) ||
      /\b(abre|abrir|ir a|ve a|mostrar|muestra|entra a|entrar a|ir al|ir a la|ver el|ver la|llevame|ll[eé]vame|p[aá]same)\b/.test(text);
    if (shortNav) {
      return {
        intent: 'navigate',
        confidence: text.split(/\s+/).length <= 2 ? 'medium' : 'high',
        params: { module: navMod },
        summary: `Ir a ${navMod}`,
        allowed: true,
        denyReason: null,
        clientOnly: true,
      };
    }
  }

  // Cerrar / cambiar estado ticket
  if (/ticket/.test(text) && (matchStatus(text) || /cerrar|cerrado|completar/.test(text))) {
    const ticketId = extractTicketId(raw);
    const status = matchStatus(text) || (/cerrar|cerrado|completar/.test(text) ? 'closed' : null);
    if (ticketId && status) {
      return {
        intent: 'update_ticket_status',
        confidence: 'high',
        params: { ticket_id: ticketId, status },
        summary: `Cambiar ticket #${ticketId} a estado "${status}"`,
        allowed: true,
        denyReason: null,
      };
    }
  }

  // Crear ticket (respaldo si no coincidió arriba)
  if (isCreateTicketCommand(text)) {
    return parseCreateTicket(raw, text, users, ctx.actor);
  }

  // Crear tarea operativa (respaldo)
  if (isCreateTaskCommand(text)) {
    return parseCreateTask(raw, text, users, ctx.actor);
  }

  // Crear aviso
  if (
    /publica(r|me)?\s+(un\s+)?aviso|nuevo\s+aviso|crea(r|me)?\s+(un\s+)?aviso|comunicado|manda(r)?\s+(un\s+)?aviso/.test(
      text,
    )
  ) {
    const title =
      extractAfterKeywords(raw, [
        /(?:publica(?:r|me)?|nuevo|crea(?:r|me)?)\s+(?:un\s+)?aviso\s+(?:de|sobre|acerca de)?\s*[:\-]?\s*(.+)/i,
      ]) || extractAfterKeywords(raw, [/comunicado\s+(?:de|sobre)?\s*(.+)/i]) || '';
    const cleanTitle = String(title || '')
      .replace(/\s+(?:el|para el|este|próximo|proximo)\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo|fin de semana)\b.*$/i, '')
      .replace(/\s+(?:manana|mañana|hoy|pasado manana|pasado mañana)\b.*$/i, '')
      .trim()
      .slice(0, 200);
    const finalTitle = cleanTitle.length >= 3 ? cleanTitle : 'Aviso desde comando de voz';
    const category = /urgente|emergencia|importante/.test(text) ? 'important' : 'general';
    const content = buildAvisoContent(raw, finalTitle);
    return {
      intent: 'create_aviso',
      confidence: finalTitle !== 'Aviso desde comando de voz' ? 'high' : 'medium',
      params: {
        title: finalTitle,
        content: content || finalTitle,
        category,
      },
      summary: `Publicar aviso: "${finalTitle.slice(0, 80)}"`,
      allowed: true,
      denyReason: null,
    };
  }

  // Editar / abrir minuta
  if (/minuta/.test(text) && /(editar|modificar|abrir|ver|actualizar)/.test(text)) {
    const minuteId = extractMinuteId(raw);
    if (minuteId) {
      return {
        intent: 'open_minute',
        confidence: 'high',
        params: { minute_id: minuteId },
        summary: `Abrir minuta #${minuteId} para editar`,
        allowed: true,
        denyReason: null,
        clientOnly: true,
      };
    }
  }

  if (/minuta/.test(text) && /(agregar|añadir|anadir|apunta|registra)/.test(text)) {
    const minuteId = extractMinuteId(raw);
    const note =
      extractAfterKeywords(raw, [
        /(?:agregar|añadir|anadir|apunta|registra)\s+(?:en\s+)?(?:la\s+)?minuta\s*#?\s*\d+\s+(?:acuerdo|nota|que)\s*[:\-]?\s*(.+)/i,
        /minuta\s*#?\s*\d+\s+(?:acuerdo|nota)\s*[:\-]?\s*(.+)/i,
        /(?:agregar|añadir)\s+(?:acuerdo|nota)\s+(?:a\s+)?(?:la\s+)?minuta\s*#?\s*\d+\s*[:\-]?\s*(.+)/i,
      ]) || extractAfterKeywords(raw, [/(?:agregar|añadir|anadir)\s+(.+)/i]);
    if (minuteId && note) {
      return {
        intent: 'append_minute_note',
        confidence: 'medium',
        params: { minute_id: minuteId, note: note.slice(0, 2000), section: 'acuerdos' },
        summary: `Agregar nota a minuta #${minuteId}`,
        allowed: true,
        denyReason: null,
      };
    }
  }

  // Reagendar reunión
  if (
    /(reagendar|reprogramar|mover|cambiar\s+fecha)/.test(text) &&
    /reunion|reunión/.test(text)
  ) {
    const meetingId = extractMeetingId(raw);
    const titleHint =
      extractAfterKeywords(raw, [
        /reunion\s+(.+?)\s+(?:para|el|mañana|hoy)/i,
      ]) || '';
    if (meetingId || titleHint) {
      const date = parseRelativeDate(text);
      const start = parseTime(text, '10:00');
      const [sh, sm] = start.split(':').map(Number);
      const end = `${String(sh + 1).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
      return {
        intent: 'update_meeting',
        confidence: meetingId ? 'high' : 'low',
        params: {
          meeting_id: meetingId,
          title_hint: titleHint,
          date,
          start_time: start,
          end_time: end,
        },
        summary: meetingId
          ? `Reagendar reunión #${meetingId} el ${date} ${start}`
          : `Reagendar reunión "${titleHint.slice(0, 40)}" el ${date}`,
        allowed: Boolean(meetingId),
        denyReason: meetingId ? null : 'Di el número de reunión, por ejemplo "reagendar reunión 8 mañana a las 11".',
      };
    }
  }

  // Asignar ticket
  if (
    /\basignar\b/.test(text) &&
    (/ticket/.test(text) || ctx.postExecute?.ticket_id || extractTicketId(raw))
  ) {
    const { buildAssignTicketFromUtterance } = require('./voice/voiceAssignTicket');
    return buildAssignTicketFromUtterance(raw, text, users, ctx.actor, ctx.postExecute || null);
  }

  // Editar ticket
  if (/(editar|modificar|actualizar|cambiar)/.test(text) && /ticket/.test(text)) {
    const ticketId = extractTicketId(raw);
    if (ticketId) {
      const patch = { ticket_id: ticketId };
      let summaryParts = [`Editar ticket #${ticketId}`];
      if (/titulo|título/.test(text)) {
        const t = extractAfterKeywords(raw, [
          /(?:titulo|título)\s+(?:a|por|del\s+ticket)\s*[:\-]?\s*(.+)/i,
          /ticket\s*#?\s*\d+\s+(?:titulo|título)\s*[:\-]?\s*(.+)/i,
        ]);
        if (t) {
          patch.title = t.slice(0, 200);
          summaryParts.push(`título "${t.slice(0, 50)}"`);
        }
      }
      if (/descripcion|descripción|detalle/.test(text)) {
        const d = extractAfterKeywords(raw, [
          /(?:descripcion|descripción|detalle)\s*[:\-]?\s*(.+)/i,
        ]);
        if (d) {
          patch.description = d.slice(0, 4000);
          summaryParts.push('descripción');
        }
      }
      if (/prioridad/.test(text)) {
        patch.priority = matchPriority(text);
        summaryParts.push(`prioridad ${patch.priority}`);
      }
      if (Object.keys(patch).length > 1) {
        return {
          intent: 'update_ticket',
          confidence: 'high',
          params: patch,
          summary: summaryParts.join(', '),
          allowed: true,
          denyReason: null,
        };
      }
    }
  }

  // Estado tarea
  if (/tarea/.test(text) && (matchStatus(text) || /completar|terminar|cerrar/.test(text))) {
    const taskId = extractTaskId(raw);
    const status = matchStatus(text) || (/completar|terminar|cerrar/.test(text) ? 'done' : null);
    if (taskId && status) {
      const taskStatus = status === 'closed' ? 'done' : status === 'open' ? 'pending' : status === 'in_progress' ? 'in_progress' : status;
      return {
        intent: 'update_task_status',
        confidence: 'high',
        params: { task_id: taskId, status: taskStatus },
        summary: `Cambiar tarea #${taskId} a "${taskStatus}"`,
        allowed: true,
        denyReason: null,
      };
    }
  }

  // Editar tarea
  if (/(editar|modificar|actualizar)/.test(text) && /tarea/.test(text)) {
    const taskId = extractTaskId(raw);
    if (taskId) {
      const patch = { task_id: taskId };
      const title = extractAfterKeywords(raw, [
        /(?:editar|modificar|actualizar)\s+(?:la\s+)?tarea\s*#?\s*\d+\s+(?:titulo|título)?\s*[:\-]?\s*(.+)/i,
        /tarea\s*#?\s*\d+\s+(?:titulo|título)\s*[:\-]?\s*(.+)/i,
      ]);
      if (title) {
        patch.title = title.slice(0, 200);
        return {
          intent: 'update_task',
          confidence: 'high',
          params: patch,
          summary: `Editar tarea #${taskId}: "${title.slice(0, 50)}"`,
          allowed: true,
          denyReason: null,
        };
      }
    }
  }

  // Ayuda
  if (/ayuda|que\s+puedo|comandos|que\s+sabes|ejemplos|que\s+haces|como\s+funciona|como\s+te\s+uso|que\s+entendiste/.test(text)) {
    return {
      intent: 'help',
      confidence: 'high',
      params: {},
      summary: 'Saya AI está listo. Di tu siguiente comando.',
      allowed: true,
      denyReason: null,
      clientOnly: true,
    };
  }

  if (navMod) {
    return {
      intent: 'navigate',
      confidence: 'low',
      params: { module: navMod },
      summary: `¿Quieres ir a ${navMod}? Confirma para abrir.`,
      allowed: true,
      denyReason: null,
      clientOnly: true,
    };
  }

  if (isMeetingCreateCommand(text)) {
    return parseCreateMeeting(raw, text, users);
  }
  if (isCreateTicketCommand(text)) {
    return parseCreateTicket(raw, text, users, ctx.actor);
  }

  const loose = inferLooseIntent(raw, text, users, ctx.actor);
  if (loose) return loose;

  const semantic = resolveSemanticIntent(raw, text, { activeModule, users }, {
    parseCreateMeeting,
    parseCreateTicket,
    isMeetingCreateCommand,
    isCreateTicketCommand,
    users,
    actor: ctx.actor,
  });
  if (semantic?.allowed && semantic.intent !== 'unknown') return semantic;

  return {
    intent: 'unknown',
    confidence: 'low',
    params: { raw },
    summary: `Escuché: “${raw.slice(0, 120)}${raw.length > 120 ? '…' : ''}”`,
    allowed: false,
    denyReason: `No reconocí «${raw.slice(0, 80)}». Prueba más directo: «¿hay reuniones hoy?», «crear ticket impresora rota», «abrir calendario».`,
  };
}

function parseVoiceCommand(transcript, ctx = {}) {
  const { repairTranscript } = require('../utils/voiceTranscriptRepair');
  let raw = repairTranscript(preprocessTranscript(String(transcript || '').trim()));
  const text = normalizeText(raw);
  const users = Array.isArray(ctx.users) ? ctx.users : [];
  const { refineVoiceUnderstanding, applySessionParams } = require('./voice/voiceUnderstandingService');
  const { tryResolvePendingVoicePick } = require('./voice/voiceSessionContext');

  const voicePickResolved = tryResolvePendingVoicePick(raw, ctx.actor?.id, users);
  let parsed;
  if (voicePickResolved) {
    raw = voicePickResolved.transcript;
    parsed = {
      intent: voicePickResolved.intent,
      confidence: 'high',
      params: voicePickResolved.params,
      summary: '',
      allowed: true,
      denyReason: null,
      voicePickResolved: true,
    };
  } else {
    parsed = parseVoiceCommandInternal(raw, ctx);
    parsed = refineVoiceUnderstanding(parsed, raw, text, ctx);
    parsed = applySessionParams(parsed, ctx.session);
  }

  if (parsed?.intent === 'create_task' && ctx.actor) {
    parsed.params = parsed.params || {};
    if (!parsed.params.department) {
      parsed.params.department = resolveTaskDepartment(
        users,
        parsed.params.assigned_to,
        ctx.actor,
        parsed.params.department,
      );
    }
    if (parsed.params.assigned_to && !parsed.params.assignee_label) {
      const u = users.find((x) => Number(x.id) === Number(parsed.params.assigned_to));
      if (u) parsed.params.assignee_label = userFullName(u);
    }
  }

  const { finalizeVoiceParse } = require('./voice/voicePrecision');
  return finalizeVoiceParse(parsed, { ...ctx, raw, transcript: raw, users });
}

module.exports = {
  parseVoiceCommand,
  findUsersByHint,
  userFullName,
  normalizeText,
  parseCreateMeeting,
  parseCreateTicket,
  parseCreateTask,
  isMeetingCreateCommand,
  isCreateTicketCommand,
  isCreateTaskCommand,
  hasDateReference,
  hasTimeReference,
  parseRelativeDate,
  parseTime,
  matchPriority,
  matchStatus,
  extractTicketId,
  extractAssigneeHint,
  extractTaskTitle,
  extractMeetingTitle,
  extractMeetingDescription,
  extractNamedAttendeeHints,
  extractDepartments,
  parseEndTime,
};
