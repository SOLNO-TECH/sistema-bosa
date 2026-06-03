/**
 * Sugerencias cuando Saya no entiende o hay ambigüedad.
 */
const { scoreProfile, PROFILES_FOR_SCORING } = require('./voiceSemanticResolver');
const { normalizeText, matchModuleQuery } = require('./voiceQueryParser');

const SUGGESTION_LABELS = {
  query_meetings: 'Consultar reuniones',
  query_tickets: 'Consultar tickets',
  query_tasks: 'Consultar tareas',
  query_avisos: 'Consultar avisos',
  query_minutas: 'Consultar minutas',
  query_notifications: 'Ver notificaciones',
  navigate_calendar: 'Abrir calendario',
  navigate_tickets: 'Ir a tickets',
  navigate_tasks: 'Ir a tareas',
  navigate_avisos: 'Ir a avisos',
  navigate_minutas: 'Ir a minutas',
  create_meeting: 'Agendar reunión',
  create_ticket: 'Crear ticket',
  create_task: 'Crear tarea',
  create_aviso: 'Publicar aviso',
  help: 'Ver ejemplos',
};

const EXAMPLE_BY_INTENT = {
  query_meetings: '¿Hay reuniones hoy?',
  query_tickets: 'Mis tickets abiertos',
  query_tasks: '¿Qué tareas tengo pendientes?',
  query_avisos: '¿Hay avisos activos?',
  query_notifications: 'Notificaciones sin leer',
  navigate_calendar: 'Abrir calendario',
  navigate_tickets: 'Ir a tickets',
  navigate_tasks: 'Ir a tareas',
  create_meeting: 'Agendar reunión mañana a las 10',
  create_ticket: 'Crear ticket impresora dañada',
  create_task: 'Crear tarea revisar inventario',
  help: 'Ayuda',
};

function rankIntentCandidates(text, activeModule = '') {
  const t = normalizeText(text);
  if (!t) return [];

  return PROFILES_FOR_SCORING.map((profile) => ({
    id: profile.id,
    score: scoreProfile(t, profile, activeModule),
    label: SUGGESTION_LABELS[profile.id] || profile.id,
    example: EXAMPLE_BY_INTENT[profile.id] || EXAMPLE_BY_INTENT[profile.id.replace('navigate_', 'navigate_')] || '',
  }))
    .filter((r) => r.score >= 2.5)
    .sort((a, b) => b.score - a.score);
}

function buildSuggestions(transcript, parsed, activeModule = '') {
  if (parsed?.allowed && parsed?.intent !== 'unknown' && parsed?.intent !== 'help') {
    return [];
  }

  const suggestions = [];
  const ranked = rankIntentCandidates(transcript, activeModule);

  for (const item of ranked.slice(0, 3)) {
    if (item.id === parsed?.intent) continue;
    suggestions.push({
      intent: item.id.startsWith('navigate_') ? 'navigate' : item.id,
      module: item.id.startsWith('navigate_') ? item.id.replace('navigate_', '') : undefined,
      label: item.label,
      example: item.example,
      score: item.score,
    });
  }

  const directQuery = matchModuleQuery(transcript);
  if (!parsed?.allowed && directQuery && !suggestions.some((s) => s.intent === directQuery.intent)) {
    suggestions.unshift({
      intent: directQuery.intent,
      label: SUGGESTION_LABELS[directQuery.intent] || directQuery.summary,
      example: EXAMPLE_BY_INTENT[directQuery.intent] || '',
      score: 99,
    });
  }

  return suggestions.slice(0, 3);
}

function suggestionHintMessage(suggestions) {
  if (!suggestions?.length) {
    return 'Prueba más directo: abrir calendario, hay reuniones hoy, o crear ticket.';
  }
  const examples = suggestions.map((s) => s.example).filter(Boolean).slice(0, 2);
  if (examples.length === 1) return `¿Quisiste decir: ${examples[0]}?`;
  return `¿Quisiste decir algo como: ${examples.join(' o ')}?`;
}

module.exports = {
  buildSuggestions,
  suggestionHintMessage,
  rankIntentCandidates,
};
