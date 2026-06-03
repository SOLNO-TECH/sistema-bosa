/**
 * Flujo de creación de reuniones por voz — alineado al formulario de Calendario.
 */

const { knownDepartments } = require('./voiceFormDefaults');
const { resolveAssignee } = require('./voiceAssigneeResolver');
const { localDateYMD } = require('../../utils/localDate');

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

function userFullName(u) {
  return `${u?.name || ''} ${u?.apellido || ''}`.trim();
}

function isValidMeetingTitle(title) {
  const t = String(title || '').trim();
  if (t.length < 3) return false;
  if (/desde comando de voz|reunion desde/i.test(t)) return false;
  if (/^(crea|crear|agenda|agendar|reunion|junta|nueva|programa)$/i.test(t)) return false;
  if (/^(crea|crear|agenda|agendar|programa)\s+(?:una\s+)?(?:reunion|junta)$/i.test(t)) return false;
  if (/^(virtual|sala|manana|mañana|hoy|departamento|invitar)$/i.test(t)) return false;
  return true;
}

function cleanMeetingTitle(s) {
  return String(s || '')
    .replace(/^(?:el\s+)?(?:titulo|título|tema)\s*(?:es|:|-)?\s*/i, '')
    .replace(/\b(?:con|para|en)\s+(?:los\s+)?departamentos?\b.*$/i, '')
    .replace(/\b(?:descripcion|descripción|agenda|notas?|detalle)\b.*$/i, '')
    .replace(/\b(?:manana|mañana|hoy|pasado\s+manana|pasado\s+mañana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b.*$/i, '')
    .replace(/\b(?:a\s+las|para\s+las|de\s+\d{1,2}|inicio|fin)\b.*$/i, '')
    .replace(/\b(?:invitar|asistentes?|participantes?|virtual|sala)\b.*$/i, '')
    .replace(/^["']|["']$/g, '')
    .trim()
    .slice(0, 200);
}

function parseLocationType(text) {
  const t = normalizeText(text);
  if (/virtual|zoom|teams|meet|en\s+linea|en\s+línea|videollamada|remot[ao]/.test(t)) return 'virtual';
  if (/sala\s+de\s+juntas|presencial|en\s+sala|oficina/.test(t)) return 'sala_juntas';
  return null;
}

function parseRecurrence(text, titleText = '') {
  const t = normalizeText(text);
  if (/sin\s+repeticion|sin\s+repetir|una\s+sola\s+vez/.test(t)) return 'none';

  const titleLikeWeekly = /\b(revision|reporte|informe|seguimiento|control|sync|sincronizacion|reunion|junta)\s+semanal\b/.test(t);
  const titleLikeMonthly = /\b(revision|reporte|informe|seguimiento|control|sync|reunion|junta)\s+mensual\b/.test(t);
  const titleLikeBiweekly = /\b(revision|reporte|informe|reunion|junta)\s+quincenal\b/.test(t);

  if (/quincenal|cada\s+dos\s+semanas|cada\s+15\s+dias/.test(t) && !titleLikeBiweekly) {
    if (/\b(repetir|cada|repeticion|hasta)\b/.test(t) || /\bquincenal\b/.test(t)) return 'biweekly';
  }
  if (/\bmensual\b|cada\s+mes/.test(t) && !titleLikeMonthly) {
    if (/\b(repetir|cada\s+mes|repeticion\s+mensual|mensual\s+hasta)\b/.test(t)) return 'monthly';
    if (/\bmensual\s+hasta\b/.test(t)) return 'monthly';
  }
  if (!titleLikeWeekly) {
    if (/\b(repetir|cada\s+(?:la\s+)?semana|semanalmente|repeticion\s+semanal)\b/.test(t)) return 'weekly';
    if (/\bsemanal\s+hasta\b/.test(t)) return 'weekly';
    if (/\b(?:a las|para las)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s+semanal\b/.test(t)) return 'weekly';
    if (/\bsemanal\s+(?:hasta|hasta el)\b/.test(t)) return 'weekly';
  }
  return null;
}

function parseRecurrenceUntil(raw, text) {
  const parser = lazyParser();
  const m =
    raw.match(/(?:repetir|repeticion|repetición)\s+hasta\s+(?:el\s+)?(.+)/i) ||
    raw.match(/hasta\s+(?:el\s+)?(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i);
  if (m?.[1]) {
    const d = parser.parseRelativeDate(m[1]) || parser.parseRelativeDate(text);
    if (d) return d;
  }
  if (parser.hasDateReference(text) && /hasta|repetir/.test(normalizeText(text))) {
    return parser.parseRelativeDate(text);
  }
  return null;
}

function parseMeetingSchedule(raw, text) {
  const parser = lazyParser();
  const slots = {};
  if (parser.hasDateReference(text)) slots.date = parser.parseRelativeDate(text);
  if (parser.hasTimeReference(text)) {
    slots.start_time = parser.parseTime(text, null);
    if (slots.start_time) slots.end_time = parser.parseEndTime(text, slots.start_time);
  }
  const range = raw.match(/(?:inicio|de)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:a|hasta|fin)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (range) {
    slots.start_time = parser.parseTime(`a las ${range[1]}`, null);
    slots.end_time = parser.parseTime(`a las ${range[2]}`, null);
  }
  return slots;
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

function resolveNamedAttendees(raw, users) {
  const parser = lazyParser();
  const hints = parser.extractNamedAttendeeHints?.(raw) || [];
  const attendees = [];
  let pendingVoicePick = null;

  for (const hint of hints) {
    const resolved = resolveAssignee(users, hint, null);
    if (resolved.assigned_to && !attendees.includes(resolved.assigned_to)) {
      attendees.push(resolved.assigned_to);
    } else if (resolved.needsVoicePick && !pendingVoicePick) {
      pendingVoicePick = { ...resolved.needsVoicePick, field: 'attendees' };
    }
  }
  return { attendees, pendingVoicePick };
}

function buildMeetingDescription(raw, title) {
  const parser = lazyParser();
  const explicit = parser.extractMeetingDescription?.(raw) || '';
  if (explicit) return explicit.slice(0, 4000);
  const t = String(title || '').trim();
  return t || '';
}

function extractFollowUpMeetingSlots(raw, text, existingParams = {}, users = []) {
  const slots = {};
  const parser = lazyParser();
  const r = String(raw || '').trim();

  const loc = parseLocationType(text);
  if (loc) {
    slots.location_type = loc;
    return slots;
  }

  const rec = parseRecurrence(text, existingParams.title);
  if (rec) {
    slots.recurrence = rec;
    const until = parseRecurrenceUntil(r, text);
    if (until) slots.recurrence_until = until;
    return slots;
  }

  const titleM = r.match(/^(?:titulo|título|tema)\s+(?:es\s+)?(.+)/i) || r.match(/(?:titulo|título|tema)\s*(?:es|:|-)\s*(.+)/i);
  if (titleM?.[1]) {
    slots.title = cleanMeetingTitle(titleM[1]);
    return slots;
  }

  const descM = r.match(/(?:descripcion|descripción|agenda)\s*(?:es|:|-)\s*(.+)/i);
  if (descM?.[1]) {
    slots.description = descM[1].trim().slice(0, 4000);
    return slots;
  }

  const schedule = parseMeetingSchedule(r, text);
  if (schedule.date || schedule.start_time) return schedule;

  const deptMatch = r.match(/(?:departamento|depto|participantes?\s+del\s+departamento)\s*(?:de\s+)?(.+)/i);
  if (deptMatch?.[1]) {
    const depts = parser.extractDepartments?.(r, text, users) || [];
    if (depts.length) {
      slots.departments = depts;
      slots.attendees = resolveAttendeesFromDepartments(users, depts);
    }
    return slots;
  }

  const named = resolveNamedAttendees(r, users);
  if (named.attendees.length) {
    slots.attendees = named.attendees;
    if (named.pendingVoicePick) slots.pendingVoicePick = named.pendingVoicePick;
    return slots;
  }
  if (named.pendingVoicePick) {
    slots.pendingVoicePick = named.pendingVoicePick;
    return slots;
  }

  if (!/^(crea|crear|agenda|agendar|reunion|junta|programa|quiero|necesito)/i.test(r)) {
    const bare = cleanMeetingTitle(r);
    if (!isValidMeetingTitle(existingParams.title) && isValidMeetingTitle(bare)) {
      slots.title = bare;
    } else if (parser.hasDateReference(text) || parser.hasTimeReference(text)) {
      Object.assign(slots, parseMeetingSchedule(r, text));
    }
  }

  return slots;
}

function smartMergeMeetingParams(base = {}, ...sources) {
  const out = { ...base };
  for (const src of sources) {
    if (!src) continue;
    for (const [key, val] of Object.entries(src)) {
      if (val == null || val === '') continue;
      if (key === 'pendingVoicePick') {
        if (val?.options?.length) out.pendingVoicePick = val;
        continue;
      }
      if (key === 'title' && isValidMeetingTitle(val)) out.title = cleanMeetingTitle(val);
      else if (key === 'attendees' && Array.isArray(val)) {
        out.attendees = [...new Set([...(out.attendees || []), ...val.map(Number).filter(Boolean)])];
      } else if (key === 'departments' && Array.isArray(val)) out.departments = val;
      else if (['date', 'start_time', 'end_time', 'recurrence_until', 'description'].includes(key)) out[key] = val;
      else if (key === 'location_type' && val) out.location_type = val;
      else if (key === 'recurrence' && val) out.recurrence = val;
    }
  }
  return out;
}

function evaluateMeetingParams(params, raw = '', users = [], pendingVoicePick = null) {
  const p = { ...params };
  delete p.pendingVoicePick;

  if (!p.location_type) p.location_type = 'sala_juntas';
  if (!p.recurrence) p.recurrence = 'none';
  if (p.recurrence === 'none') p.recurrence_until = '';

  if (p.start_time && !p.end_time) {
    p.end_time = lazyParser().parseEndTime(raw || `de ${p.start_time}`, p.start_time);
  }

  if (!p.description) p.description = buildMeetingDescription(raw, p.title);

  const missing = [];
  if (!isValidMeetingTitle(p.title)) {
    missing.push('título');
    p.title = null;
  }
  if (!p.date) missing.push('fecha');
  if (!p.start_time) missing.push('hora de inicio');
  if (!p.end_time && p.start_time) p.end_time = lazyParser().parseEndTime('', p.start_time);
  if (!p.end_time) missing.push('hora de fin');

  if (p.recurrence && p.recurrence !== 'none' && !p.recurrence_until) {
    missing.push('fecha límite de repetición');
  }

  if (Array.isArray(p.departments) && p.departments.length && users.length) {
    const fromDept = resolveAttendeesFromDepartments(users, p.departments);
    p.attendees = [...new Set([...(p.attendees || []), ...fromDept])];
  }
  if (!Array.isArray(p.attendees)) p.attendees = [];

  return {
    params: p,
    missing,
    ready: missing.length === 0 && !pendingVoicePick,
    pendingVoicePick,
  };
}

function buildCreateMeetingFromUtterance(raw, text, users = []) {
  const parser = lazyParser();
  const extractedTitle = parser.extractMeetingTitle?.(raw) || '';
  const title = isValidMeetingTitle(extractedTitle) ? cleanMeetingTitle(extractedTitle) : null;
  const schedule = parseMeetingSchedule(raw, text);
  const departments = parser.extractDepartments?.(raw, text, users) || [];
  const loc = parseLocationType(text);
  const rec = parseRecurrence(text, title) || 'none';
  const recUntil = rec !== 'none' ? parseRecurrenceUntil(raw, text) : '';

  let attendees = resolveAttendeesFromDepartments(users, departments);
  const named = resolveNamedAttendees(raw, users);
  attendees = [...new Set([...attendees, ...named.attendees])];
  let pendingVoicePick = named.pendingVoicePick;

  const params = {
    title,
    description: buildMeetingDescription(raw, title),
    date: schedule.date || (parser.hasDateReference(text) ? parser.parseRelativeDate(text) : null),
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    location_type: loc || 'sala_juntas',
    recurrence: rec,
    recurrence_until: recUntil,
    departments,
    attendees,
    attendee_hints: parser.extractNamedAttendeeHints?.(raw) || [],
  };

  const { params: finalParams, missing, ready, pendingVoicePick: pick } = evaluateMeetingParams(
    params,
    raw,
    users,
    pendingVoicePick,
  );

  return {
    intent: 'create_meeting',
    confidence: ready ? 'high' : 'medium',
    params: finalParams,
    pendingVoicePick: pick,
    meetingMissing: missing,
    summary: isValidMeetingTitle(finalParams.title)
      ? `Agendar reunión "${finalParams.title.slice(0, 55)}"`
      : 'Agendar reunión',
    allowed: true,
    denyReason: null,
  };
}

function continueCreateMeeting(raw, text, session, users = []) {
  if (!session || session.intent !== 'create_meeting') return null;

  const combinedRaw = `${session.transcript || ''} ${raw}`.replace(/\s+/g, ' ').trim().slice(0, 500);
  const combinedText = normalizeText(combinedRaw);
  const fromCombined = buildCreateMeetingFromUtterance(combinedRaw, combinedText, users);
  const followSlots = extractFollowUpMeetingSlots(raw, text, session.params, users);

  let pendingVoicePick = followSlots.pendingVoicePick || session.pendingVoicePick || fromCombined.pendingVoicePick;
  delete followSlots.pendingVoicePick;

  const merged = smartMergeMeetingParams(session.params || {}, fromCombined.params, followSlots);
  const { params: finalParams, missing, ready, pendingVoicePick: pick } = evaluateMeetingParams(
    merged,
    combinedRaw,
    users,
    pendingVoicePick,
  );

  return {
    intent: 'create_meeting',
    confidence: ready ? 'high' : 'medium',
    params: finalParams,
    pendingVoicePick: pick,
    meetingMissing: missing,
    summary: isValidMeetingTitle(finalParams.title)
      ? `Agendar reunión "${finalParams.title.slice(0, 55)}"`
      : 'Agendar reunión',
    allowed: true,
    denyReason: null,
    sessionMerged: true,
  };
}

function generateMeetingOccurrences(params) {
  const date = params.date;
  const start = params.start_time;
  const end = params.end_time;
  if (!date || !start || !end) return [];

  if (!params.recurrence || params.recurrence === 'none' || !params.recurrence_until) {
    return [{ date, start_time: start, end_time: end }];
  }

  const fmt = (d) => localDateYMD(d);
  const occurrences = [];
  const current = new Date(`${date}T00:00:00`);
  const limit = new Date(`${params.recurrence_until}T23:59:59`);
  let n = 0;

  while (current <= limit && n < 200) {
    occurrences.push({
      date: fmt(current),
      start_time: start,
      end_time: end,
    });
    if (params.recurrence === 'weekly') current.setDate(current.getDate() + 7);
    else if (params.recurrence === 'biweekly') current.setDate(current.getDate() + 14);
    else if (params.recurrence === 'monthly') current.setMonth(current.getMonth() + 1);
    else break;
    n += 1;
  }
  return occurrences;
}

module.exports = {
  isValidMeetingTitle,
  cleanMeetingTitle,
  buildCreateMeetingFromUtterance,
  continueCreateMeeting,
  evaluateMeetingParams,
  extractFollowUpMeetingSlots,
  generateMeetingOccurrences,
  parseLocationType,
  parseRecurrence,
};
