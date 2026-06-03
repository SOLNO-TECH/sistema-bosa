/**
 * Valores por defecto y etiquetas alineadas con los formularios manuales del frontend.
 */

const { localDateYMD } = require('../../utils/localDate');

function knownDepartments(users) {
  return [...new Set((users || []).map((u) => u.departamento).filter(Boolean))];
}

function extractExplicitDescription(raw) {
  const m =
    String(raw || '').match(
      /(?:descripcion|descripción|detalle|problema)\s*(?:del\s+problema|es)?\s*[:\-]?\s*(.+)/i,
    ) || String(raw || '').match(/(?:contenido|mensaje)\s*[:\-]?\s*(.+)/i);
  return m?.[1]?.trim().slice(0, 4000) || '';
}

function stripCommandPrefix(raw, patterns) {
  let s = String(raw || '').trim();
  for (const re of patterns) {
    s = s.replace(re, '').trim();
  }
  return s;
}

function buildTicketDescription(raw, title) {
  const explicit = extractExplicitDescription(raw);
  if (explicit) return explicit;

  let body = stripCommandPrefix(raw, [
    /^(?:crea(?:r|me)?|genera(?:r|me)?|nuevo|abre|registra(?:r|me)?)\s+(?:un\s+)?ticket\s+(?:de|sobre|para)?\s*[:\-]?\s*/i,
    /^(?:reporta(?:r|me)?|reportame|registra(?:r|me)?)\s+(?:un\s+)?(?:problema|falla|incidencia)\s+(?:de|con|sobre)?\s*/i,
    /^(?:hay|tengo)\s+(?:un\s+)?problema\s+con\s+/i,
  ]);
  body = body
    .replace(/\s+departamento\s+(?:de\s+)?[^,]+/gi, '')
    .replace(/\s+prioridad\s+(?:alta|baja|media|urgente|normal|importante)/gi, '')
    .replace(/\s+asignar\s+a\s+[^,]+/gi, '')
    .trim();

  const nt = (title || '').trim();
  if (body && body.toLowerCase() !== nt.toLowerCase()) return body.slice(0, 4000);
  return nt || body || '';
}

function buildTaskDescription(raw, title) {
  const explicit = extractExplicitDescription(raw);
  if (explicit) return explicit;
  const nt = (title || '').trim();
  return nt ? nt.slice(0, 4000) : '';
}

function buildAvisoContent(raw, title) {
  const explicit = extractExplicitDescription(raw);
  if (explicit) return explicit;
  let body = stripCommandPrefix(raw, [
    /^(?:publica(?:r|me)?|nuevo|crea(?:r|me)?|manda(?:r)?)\s+(?:un\s+)?aviso\s+(?:de|sobre)?\s*[:\-]?\s*/i,
  ]);
  body = body.replace(/\s+prioridad\s+(?:urgente|importante|normal)/gi, '').trim();
  const nt = (title || '').trim();
  if (body && body.toLowerCase() !== nt.toLowerCase()) return body.slice(0, 4000);
  return nt || body || '';
}

/** Etiquetas iguales a los formularios del frontend */
function buildFormFields(intent, params) {
  const p = params || {};
  switch (intent) {
    case 'create_ticket':
      return [
        { key: 'title', label: 'Asunto', value: p.title || '' },
        { key: 'category', label: 'Departamento responsable', value: p.category || '' },
        { key: 'description', label: 'Descripción del problema', value: p.description || '' },
      ].filter((f) => f.value);
    case 'create_task':
      return [
        { key: 'title', label: 'Título', value: p.title || '' },
        { key: 'description', label: 'Descripción', value: p.description || '' },
        { key: 'department', label: 'Departamento', value: p.department || '' },
        { key: 'assigned_to', label: 'Responsable', value: p.assignee_label || '' },
        { key: 'start_date', label: 'Inicio', value: p.start_date || '' },
        { key: 'end_date', label: 'Fin', value: p.end_date || '' },
      ].filter((f) => f.value);
    case 'create_meeting':
      return [
        { key: 'title', label: 'Título', value: p.title || '' },
        { key: 'location_type', label: 'Modalidad', value: p.location_type === 'virtual' ? 'Reunión virtual' : 'Sala de juntas' },
        { key: 'date', label: 'Fecha', value: p.date || '' },
        { key: 'start_time', label: 'Inicio', value: p.start_time || '' },
        { key: 'end_time', label: 'Fin', value: p.end_time || '' },
        {
          key: 'recurrence',
          label: 'Repetición',
          value:
            p.recurrence === 'weekly'
              ? 'Semanal'
              : p.recurrence === 'biweekly'
                ? 'Quincenal'
                : p.recurrence === 'monthly'
                  ? 'Mensual'
                  : p.recurrence === 'none'
                    ? 'Sin repetición'
                    : p.recurrence || '',
        },
        { key: 'recurrence_until', label: 'Repetir hasta', value: p.recurrence_until || '' },
        {
          key: 'attendees',
          label: 'Participantes',
          value: Array.isArray(p.attendees) && p.attendees.length ? `${p.attendees.length} persona(s)` : '',
        },
        { key: 'description', label: 'Descripción / agenda', value: p.description || '' },
      ].filter((f) => f.value);
    case 'create_aviso':
      return [
        { key: 'title', label: 'Título', value: p.title || '' },
        { key: 'content', label: 'Mensaje', value: p.content || '' },
        { key: 'category', label: 'Prioridad', value: p.category || '' },
      ].filter((f) => f.value);
    default:
      return [];
  }
}

function applyFormDefaults(parsed, ctx = {}) {
  if (!parsed?.params) return parsed;
  const users = Array.isArray(ctx.users) ? ctx.users : [];
  const actor = ctx.actor || null;
  const raw = ctx.raw || ctx.transcript || '';
  const p = parsed.params;
  const today = localDateYMD();
  const depts = knownDepartments(users);

  switch (parsed.intent) {
    case 'create_ticket': {
      if (!p.category) {
        p.category = (actor?.departamento || '').trim() || depts[0] || '';
      }
      const { evaluateTicketParams } = require('./voiceCreateTicket');
      const ev = evaluateTicketParams(p, raw);
      Object.assign(p, ev.params);
      parsed.ticketMissing = ev.missing;
      break;
    }
    case 'create_task': {
      if (!p.start_date || !p.end_date) {
        const { defaultTaskDates } = require('./voiceCreateTask');
        const d = defaultTaskDates();
        if (!p.start_date) p.start_date = d.start_date;
        if (!p.end_date) p.end_date = d.end_date;
      }
      if (!p.description || /creada por comando de voz/i.test(p.description)) {
        p.description = buildTaskDescription(raw, p.title);
      }
      break;
    }
    case 'create_aviso': {
      if (!p.content || p.content === raw) {
        p.content = buildAvisoContent(raw, p.title);
      }
      break;
    }
    case 'create_meeting': {
      if (!p.location_type) p.location_type = 'sala_juntas';
      if (!p.recurrence) p.recurrence = 'none';
      if (p.start_time && !p.end_time) {
        p.end_time = require('../voiceCommandParserService').parseEndTime('', p.start_time);
      }
      const { evaluateMeetingParams } = require('./voiceCreateMeeting');
      const ev = evaluateMeetingParams(p, raw, users, parsed.pendingVoicePick);
      Object.assign(p, ev.params);
      parsed.meetingMissing = ev.missing;
      if (ev.pendingVoicePick) parsed.pendingVoicePick = ev.pendingVoicePick;
      break;
    }
    default:
      break;
  }

  parsed.formFields = buildFormFields(parsed.intent, p);
  return parsed;
}

module.exports = {
  applyFormDefaults,
  buildFormFields,
  buildTicketDescription,
  buildTaskDescription,
  buildAvisoContent,
  knownDepartments,
};
