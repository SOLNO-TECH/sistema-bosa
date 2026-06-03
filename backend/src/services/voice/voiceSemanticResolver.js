/**
 * Capa semántica: puntúa intenciones cuando las reglas estrictas no alcanzan.
 */
const { matchModuleQuery, matchContextQuery, normalizeText } = require('./voiceQueryParser');

const CREATE_BLOCK =
  /\b(crea(?:r|me)?|agenda(?:r|me)?|programa(?:r|me)?|publica(?:r|me)?|genera(?:r|me)?|organiza(?:r|me)?|nuevo|nueva|registra(?:r|me)?|reporta(?:r|me)?|haz(me)?\s+(?:un|una))\b/;

const QUERY_BOOST =
  /\?|\b(hay|habra|habrá|tengo|tiene|cuantas|cuantos|cuál|cual|que\s|qué\s|dime|muestr|mostr|listar|ver\s|consulta|revisa|checa|pendientes|abiertos|sin\s+leer|proxima|próxima|siguiente|activas|urgentes|recientes)\b/;

const NAV_BOOST =
  /\b(abre|abrir|ir|ve|muestr|mostr|entra|entrar|llev|pasar|ver|consulta|dame|ll[eé]vame|p[aá]same|vamos)\b/;

const MODULE_CONTEXT = {
  overview: null,
  calendar: 'query_meetings',
  tickets: 'query_tickets',
  tasks: 'query_tasks',
  avisos: 'query_avisos',
  minutas: 'query_minutas',
  notifications: 'query_notifications',
};

const PROFILES = [
  {
    id: 'query_meetings',
    keywords: ['reunion', 'reuniones', 'junta', 'juntas', 'agenda', 'calendario', 'cita', 'citas'],
    query: true,
    weight: 1.1,
  },
  {
    id: 'query_tickets',
    keywords: ['ticket', 'tickets', 'incidencia', 'incidencias', 'soporte', 'falla', 'fallas'],
    query: true,
    weight: 1,
  },
  {
    id: 'query_tasks',
    keywords: ['tarea', 'tareas', 'operativa', 'operativas', 'pendiente', 'pendientes'],
    query: true,
    weight: 1,
  },
  {
    id: 'query_avisos',
    keywords: ['aviso', 'avisos', 'comunicado', 'comunicados', 'anuncio'],
    query: true,
    weight: 1,
  },
  {
    id: 'query_minutas',
    keywords: ['minuta', 'minutas', 'acta', 'actas'],
    query: true,
    weight: 1,
  },
  {
    id: 'query_notifications',
    keywords: ['notificacion', 'notificaciones', 'alerta', 'alertas'],
    query: true,
    weight: 1,
  },
  {
    id: 'navigate_calendar',
    module: 'calendar',
    keywords: ['calendario', 'reuniones', 'agenda', 'juntas'],
    nav: true,
    weight: 0.95,
  },
  {
    id: 'navigate_tickets',
    module: 'tickets',
    keywords: ['tickets', 'ticket', 'soporte', 'incidencias'],
    nav: true,
    weight: 0.95,
  },
  {
    id: 'navigate_tasks',
    module: 'tasks',
    keywords: ['tareas', 'tarea', 'operativas'],
    nav: true,
    weight: 0.95,
  },
  {
    id: 'navigate_avisos',
    module: 'avisos',
    keywords: ['avisos', 'aviso', 'comunicados'],
    nav: true,
    weight: 0.95,
  },
  {
    id: 'navigate_minutas',
    module: 'minutas',
    keywords: ['minutas', 'minuta', 'actas'],
    nav: true,
    weight: 0.95,
  },
  {
    id: 'create_meeting',
    keywords: ['reunion', 'junta', 'agenda', 'agendar', 'programar'],
    create: true,
    weight: 1.05,
  },
  {
    id: 'create_ticket',
    keywords: ['ticket', 'incidencia', 'falla', 'problema', 'reportar'],
    create: true,
    weight: 1,
  },
  {
    id: 'create_task',
    keywords: ['tarea', 'tareas'],
    create: true,
    weight: 1,
  },
  {
    id: 'create_aviso',
    keywords: ['aviso', 'comunicado', 'anuncio', 'publicar'],
    create: true,
    weight: 0.95,
  },
  {
    id: 'help',
    keywords: ['ayuda', 'ejemplos', 'comandos', 'funciona', 'puedo', 'sabes'],
    weight: 0.7,
  },
];

function countKeywordHits(t, keywords) {
  let hits = 0;
  for (const kw of keywords) {
    if (new RegExp(`\\b${kw}\\b`).test(t)) hits += 1;
  }
  return hits;
}

function scoreProfile(t, profile, activeModule) {
  const kwHits = countKeywordHits(t, profile.keywords);
  if (kwHits === 0) return 0;

  let score = kwHits * 2.2 * (profile.weight || 1);

  if (profile.query && QUERY_BOOST.test(t)) score += 4;
  if (profile.nav && NAV_BOOST.test(t)) score += 3.5;
  if (profile.create && CREATE_BLOCK.test(t)) score += 4.5;
  if (profile.create && QUERY_BOOST.test(t) && !CREATE_BLOCK.test(t)) score -= 3;

  if (profile.query && profile.id === MODULE_CONTEXT[activeModule]) score += 2.5;
  if (profile.nav && profile.module === activeModule) score += 1.5;

  if (profile.id === 'help' && t.split(/\s+/).length <= 6) score += 1;

  const words = t.split(/\s+/).length;
  if (profile.nav && words <= 4 && kwHits >= 1) score += 2;
  if (profile.query && words <= 8 && QUERY_BOOST.test(t)) score += 1.5;

  return score;
}

function buildFromProfile(profile, raw, text, activeModule, parsers) {
  const { parseCreateMeeting, parseCreateTicket } = parsers;

  if (profile.query) {
    const direct = matchModuleQuery(text);
    if (direct?.intent === profile.id) return direct;
    const mod = profile.id.replace('query_', '');
    const ctxMod = mod === 'meetings' ? 'calendar' : mod;
    const ctx = matchContextQuery(text, ctxMod);
    if (ctx?.intent === profile.id) return ctx;
    return matchModuleQuery(text);
  }

  if (profile.nav && profile.module) {
    return {
      intent: 'navigate',
      confidence: 'medium',
      params: { module: profile.module },
      summary: `Ir a ${profile.module}`,
      allowed: true,
      denyReason: null,
      clientOnly: true,
      semantic: true,
    };
  }

  if (profile.id === 'create_meeting' && parsers.isMeetingCreateCommand?.(text)) {
    return parseCreateMeeting(raw, text, parsers.users);
  }
  if (profile.id === 'create_ticket' && parsers.isCreateTicketCommand?.(text)) {
    return parseCreateTicket(raw, text, parsers.users, parsers.actor);
  }

  if (profile.id === 'help') {
    return {
      intent: 'help',
      confidence: 'medium',
      params: {},
      summary: 'Saya AI está listo. Dime tu comando.',
      allowed: true,
      denyReason: null,
      clientOnly: true,
      semantic: true,
    };
  }

  return null;
}

/**
 * Resuelve intención por puntuación semántica cuando el parser estricto falla.
 */
function resolveSemanticIntent(raw, text, ctx = {}, parsers = {}) {
  const t = normalizeText(text);
  if (!t || t.length < 3) return null;

  const activeModule = String(ctx.activeModule || '').trim();
  const ranked = PROFILES.map((p) => ({
    profile: p,
    score: scoreProfile(t, p, activeModule),
  }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return null;

  const top = ranked[0];
  const second = ranked[1];
  const minScore = 3.5;
  if (top.score < minScore) return null;

  if (second && second.score >= top.score * 0.88 && top.profile.query && second.profile.query) {
    return null;
  }

  const built = buildFromProfile(top.profile, raw, text, activeModule, {
    ...parsers,
    users: ctx.users || [],
  });

  if (built) {
    built.confidence = built.confidence || 'medium';
    built.semanticScore = Math.round(top.score * 10);
    return built;
  }

  if (top.profile.query) {
    const fallback = matchModuleQuery(text) || matchContextQuery(text, activeModule);
    if (fallback) {
      fallback.semantic = true;
      fallback.semanticScore = Math.round(top.score * 10);
      return fallback;
    }
  }

  if (top.profile.nav && top.profile.module) {
    return {
      intent: 'navigate',
      confidence: 'low',
      params: { module: top.profile.module },
      summary: `¿Quieres ir a ${top.profile.module}?`,
      allowed: true,
      denyReason: null,
      clientOnly: true,
      semantic: true,
      semanticScore: Math.round(top.score * 10),
    };
  }

  return null;
}

module.exports = {
  resolveSemanticIntent,
  scoreProfile,
  PROFILES_FOR_SCORING: PROFILES,
};
