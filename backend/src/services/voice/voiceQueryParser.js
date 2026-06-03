/**
 * Detección de consultas por módulo (preguntas, no acciones de crear/editar).
 */

const { localDateYMD } = require('../../utils/localDate');

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const QUERY_SIGNALS =
  /\?|\b(hay|habra|habrá|tengo|tiene|tienes|existen|quedan|alguna|algun|alguno|cuantas|cuantos|cuál|cual|que\s+|qué\s+|dime|sabes|sabe|consulta|consultar|informacion|información|revisar|revisa|checa|checar|muestr|mostr|listar|ver\s+(?:las|los|mis|el|la|si|qué|que)|pendientes|abiertos|abiertas|activos|activas|cerrados|cerradas|ultim|últim|recientes|nuevos|nuevas|sin\s+leer|no\s+leidos|no\s+leídos|quisiera|podrias|podrías|puedes|me\s+gustaria|me\s+gustaría|necesito\s+saber|quiero\s+saber|saber\s+si|dime\s+si|cuentame|cuéntame|verifica|verificar|busca|buscar|como\s+esta|como\s+está|como\s+estan|como\s+están|algo\s+para|algo\s+hoy|que\s+viene|que\s+sigue|a\s+que\s+hora|cuando\s+es)\b/;

const ARTICLE_F = '(?:una\\s+|un\\s+|1\\s+)?';

const CREATE_SIGNALS =
  /\b(crea(?:r|me)?|creo|criar|agenda(?:r|me)?|programa(?:r|me)?|publica(?:r|me)?|genera(?:r|me)?|organiza(?:r|me)?|aparta(?:r|me)?|reserva(?:r|me)?|nuevo|nueva|manda(?:r|me)?|registra(?:r|me)?|reporta(?:r|me)?|hacer(?:me)?|abre\s+(?:un\s+)?ticket|haz(?:me)?\s+(?:un\s+)?(?:ticket|reunion|junta|tarea|aviso)|pon(?:me)?\s+(?:una\s+)?(?:reunion|junta))\b/;

const CREATE_WISH =
  new RegExp(
    `\\b(quiero|necesito|me\\s+gustaria|me\\s+gustaría|quisiera|dame|ponme|solicito)\\s+${ARTICLE_F}(?:reunion|junta|cita|ticket|tarea|aviso)\\b`,
  );

const CONTEXT_MODULE_MAP = {
  calendar: 'query_meetings',
  tickets: 'query_tickets',
  tasks: 'query_tasks',
  avisos: 'query_avisos',
  minutas: 'query_minutas',
  notifications: 'query_notifications',
};

const MODULES = [
  {
    intent: 'query_meetings',
    keywords: ['reunion', 'reuniones', 'junta', 'juntas', 'cita', 'citas'],
    createBlock: new RegExp(
      `\\b(agenda(?:r|me)?|programa(?:r|me)?|crea(?:r|me)?|creo|criar|organiza(?:r|me)?|aparta(?:r|me)?|reserva(?:r|me)?|hacer(?:me)?|haz(?:me)?|pon(?:me)?)\\s+${ARTICLE_F}(?:reunion|junta|cita)\\b`,
    ),
  },
  {
    intent: 'query_tickets',
    keywords: ['ticket', 'tickets', 'incidencia', 'incidencias', 'soporte', 'falla', 'fallas'],
    createBlock: /\b(crea(?:r|me)?|genera(?:r|me)?|nuevo|abre|reporta(?:r|me)?)\s+(?:un\s+)?(?:ticket|incidencia|falla)\b/,
  },
  {
    intent: 'query_tasks',
    keywords: ['tarea', 'tareas', 'operativa', 'operativas'],
    createBlock: /\b(crea(?:r|me)?|genera(?:r|me)?|nueva)\s+(?:una\s+)?tarea\b/,
  },
  {
    intent: 'query_avisos',
    keywords: ['aviso', 'avisos', 'comunicado', 'comunicados', 'anuncio', 'anuncios'],
    createBlock: /\b(publica(?:r|me)?|crea(?:r|me)?|manda(?:r|me)?|nuevo)\s+(?:un\s+)?(?:aviso|comunicado|anuncio)\b/,
  },
  {
    intent: 'query_minutas',
    keywords: ['minuta', 'minutas', 'acta', 'actas'],
    createBlock: /\b(crea(?:r|me)?|genera(?:r|me)?|nueva)\s+(?:una\s+)?minuta\b/,
  },
  {
    intent: 'query_notifications',
    keywords: ['notificacion', 'notificaciones', 'alerta', 'alertas'],
    createBlock: null,
  },
];

function hasKeyword(t, keywords) {
  return keywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(t));
}

function isModuleQuery(text, mod) {
  const t = normalizeText(text);
  if (!hasKeyword(t, mod.keywords)) return false;
  if (CREATE_WISH.test(t)) return false;
  if (mod.createBlock && mod.createBlock.test(t)) return false;
  if (CREATE_SIGNALS.test(t) && !QUERY_SIGNALS.test(t)) return false;

  if (QUERY_SIGNALS.test(t)) return true;
  if (/\b(mis|mi|mias|mías)\b/.test(t)) return true;
  if (/\b(hoy|manana|mañana|semana|proxima|próxima|siguiente|activa|activas|pendiente|pendientes)\b/.test(t)) {
    return true;
  }
  return false;
}

function parseRelativeDate(text) {
  const t = normalizeText(text);
  const now = new Date();
  const toIsoDate = (d) => localDateYMD(d);

  if (/\bmañana\b|\bmanana\b/.test(t)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
  }
  if (/\bhoy\b/.test(t)) return toIsoDate(now);
  if (/\b(esta\s+semana|semana)\b/.test(t)) return toIsoDate(now);
  return null;
}

function parseScope(text) {
  const t = normalizeText(text);
  if (/\b(activa|activas|en\s+curso|ahora)\b/.test(t) && /\b(reunion|junta)\b/.test(t)) {
    if (/\b(hoy|manana|mañana)\b/.test(t)) return /\bhoy\b/.test(t) ? 'today' : 'tomorrow';
    return 'active';
  }
  if (/\b(proxima|próxima|siguiente)\b/.test(t)) return 'next';
  if (/\b(manana|mañana)\b/.test(t)) return 'tomorrow';
  if (/\b(hoy)\b/.test(t)) return 'today';
  if (/\b(esta\s+semana|semana)\b/.test(t)) return 'week';
  if (/\b(abiertos|abiertas|pendientes|sin\s+cerrar)\b/.test(t)) return 'open';
  if (/\b(cerrados|cerradas|resueltos|resueltas|completados|completadas|terminados|terminadas)\b/.test(t)) {
    return 'closed';
  }
  if (/\b(urgentes|urgente|criticos|críticos|importantes)\b/.test(t)) return 'urgent';
  if (/\b(recientes|ultimos|últimos|nuevos|nuevas)\b/.test(t)) return 'recent';
  if (/\b(sin\s+leer|no\s+leidos|no\s+leídos)\b/.test(t)) return 'unread';
  return 'all';
}

function parseMine(text) {
  const t = normalizeText(text);
  return /\b(mis|mi|mias|mías|tengo|me\s+asignaron|asignados?\s+a\s+mi|soy\s+responsable)\b/.test(t);
}

function parseOpenCalendar(text) {
  const t = normalizeText(text);
  return /\b(muestr|mostr|abre|abrir|ver\s+en|ir\s+al|ir\s+a\s+la|consulta\s+el)\b/.test(t);
}

function moduleLabel(intent) {
  const map = {
    query_meetings: 'reuniones',
    query_tickets: 'tickets',
    query_tasks: 'tareas',
    query_avisos: 'avisos',
    query_minutas: 'minutas',
    query_notifications: 'notificaciones',
  };
  return map[intent] || 'registros';
}

function buildQuerySummary(intent, params) {
  const label = moduleLabel(intent);
  const parts = [`Consulta de ${label}`];
  if (params.scope === 'today') parts.push('de hoy');
  else if (params.scope === 'tomorrow') parts.push('de mañana');
  else if (params.scope === 'week') parts.push('de la semana');
  else if (params.scope === 'next') parts.push('próxima');
  else if (params.scope === 'active') parts.push('activas');
  else if (params.scope === 'open') {
    parts.push(intent === 'query_tasks' ? 'pendientes' : 'abiertos');
  } else if (params.scope === 'closed') parts.push('cerrados');
  else if (params.scope === 'urgent') parts.push('urgentes');
  else if (params.scope === 'recent') parts.push('recientes');
  else if (params.scope === 'unread') parts.push('sin leer');
  if (params.mine) parts.push('(tuyas)');
  return parts.join(' ');
}

function parseModuleQuery(text, mod) {
  if (!isModuleQuery(text, mod)) return null;

  const scope = parseScope(text);
  const mine = parseMine(text);
  const date = parseRelativeDate(text);

  return {
    intent: mod.intent,
    confidence: 'high',
    params: {
      scope,
      date,
      mine,
      open_module: parseOpenCalendar(text),
    },
    summary: buildQuerySummary(mod.intent, { scope, mine }),
    allowed: true,
    denyReason: null,
    autoExecute: true,
  };
}

function matchModuleQuery(text) {
  for (const mod of MODULES) {
    const parsed = parseModuleQuery(text, mod);
    if (parsed) return parsed;
  }
  return null;
}

/** Consultas implícitas según la pantalla activa («¿qué hay hoy?» en calendario). */
function matchContextQuery(text, activeModule) {
  const intent = CONTEXT_MODULE_MAP[activeModule];
  if (!intent) return null;

  const t = normalizeText(text);
  const mod = MODULES.find((m) => m.intent === intent);
  if (!mod) return null;

  if (hasKeyword(t, mod.keywords)) return null;

  const questionLike =
    QUERY_SIGNALS.test(t) ||
    /\b(hoy|manana|mañana|semana|pendiente|pendientes|proxima|siguiente|algo|ahora|activa|activas)\b/.test(t);
  if (!questionLike) return null;
  if (CREATE_SIGNALS.test(t) && !QUERY_SIGNALS.test(t)) return null;
  if (t.split(/\s+/).length > 22) return null;

  for (const other of MODULES) {
    if (other.intent === intent) continue;
    if (hasKeyword(t, other.keywords) && isModuleQuery(text, other)) return null;
  }

  const scope = parseScope(text);
  const mine = parseMine(text);

  return {
    intent,
    confidence: 'medium',
    params: {
      scope,
      date: parseRelativeDate(text),
      mine,
      open_module: parseOpenCalendar(text),
      contextual: true,
    },
    summary: buildQuerySummary(intent, { scope, mine }),
    allowed: true,
    denyReason: null,
    autoExecute: true,
  };
}

module.exports = {
  matchModuleQuery,
  matchContextQuery,
  isModuleQuery,
  parseScope,
  parseMine,
  normalizeText,
};
