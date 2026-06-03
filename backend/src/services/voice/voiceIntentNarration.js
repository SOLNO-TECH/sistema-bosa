/**
 * Narraciones naturales y detalle estructurado para Saya (no plantillas rígidas).
 */

const STATUS_LABELS = {
  open: 'abierto',
  in_progress: 'en progreso',
  resolved: 'en revisión',
  closed: 'cerrado',
  pending: 'pendiente',
  done: 'completada',
  cancelled: 'cancelada',
  medium: 'media',
  high: 'alta',
  low: 'baja',
  urgent: 'urgente',
};

function userFullName(u) {
  return `${u?.name || ''} ${u?.apellido || ''}`.trim() || u?.email || 'Usuario';
}

function formatDisplayDate(iso) {
  if (!iso) return null;
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return iso;
  }
}

function resolveAttendeeLabels(params, users) {
  const ids = Array.isArray(params?.attendees) ? params.attendees : [];
  const names = ids
    .map((id) => users.find((u) => Number(u.id) === Number(id)))
    .filter(Boolean)
    .map(userFullName);
  if (names.length) return names;
  if (params?.departments?.length) {
    return params.departments.map((d) => `equipo de ${d}`);
  }
  if (params?.attendee_hints?.length) return params.attendee_hints;
  return [];
}

function isGenericTitle(title, generic) {
  return !title || title === generic;
}

function joinNatural(parts) {
  return parts.filter(Boolean).join(' ');
}

function buildCreateMeetingBrief(parsed, users, ctx = {}) {
  const { isValidMeetingTitle } = require('./voiceCreateMeeting');
  const p = parsed.params || {};
  const missing = Array.isArray(parsed.meetingMissing) ? [...parsed.meetingMissing] : [];
  const details = [];
  const isFollowUp = Boolean(parsed.sessionMerged || ctx.session?.needsClarification);

  if (isValidMeetingTitle(p.title)) {
    details.push({ label: 'Título', value: p.title });
  } else if (!missing.includes('título')) {
    missing.push('título');
  }

  if (p.date) details.push({ label: 'Fecha', value: formatDisplayDate(p.date) });
  else if (!missing.includes('fecha')) missing.push('fecha');

  if (p.start_time) {
    const horario = p.end_time ? `${p.start_time} a ${p.end_time}` : p.start_time;
    details.push({ label: 'Horario', value: horario });
  } else if (!missing.includes('hora de inicio')) {
    missing.push('hora de inicio');
  }

  const modalidad = p.location_type === 'virtual' ? 'Reunión virtual' : 'Sala de juntas';
  details.push({ label: 'Modalidad', value: modalidad });

  if (p.recurrence && p.recurrence !== 'none') {
    const labels = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' };
    details.push({ label: 'Repetición', value: labels[p.recurrence] || p.recurrence });
    if (p.recurrence_until) details.push({ label: 'Repetir hasta', value: formatDisplayDate(p.recurrence_until) });
  }

  const participants = resolveAttendeeLabels(p, users);
  if (participants.length) {
    details.push({
      label: 'Participantes',
      value: participants.length > 3 ? `${participants.slice(0, 3).join(', ')} y ${participants.length - 3} más` : participants.join(', '),
    });
  }

  if (p.description && !/^agendada por comando/i.test(p.description)) {
    details.push({ label: 'Descripción / agenda', value: String(p.description).slice(0, 160) });
  }

  const spoken = [];
  if (missing.length === 0) {
    spoken.push(`Perfecto. Agendo ${p.title}${p.date ? ` el ${formatDisplayDate(p.date)}` : ''}${p.start_time ? ` a las ${p.start_time}` : ''}.`);
    spoken.push(`Modalidad: ${modalidad}.`);
    if (participants.length) spoken.push(`${participants.length} participante(s).`);
  } else if (isFollowUp && details.length) {
    spoken.push(`Ya tengo ${details.slice(0, 4).map((d) => `${d.label.toLowerCase()} ${d.value}`).join(', ')}.`);
    if (missing.includes('título')) spoken.push('¿Cuál es el título de la reunión?');
    else if (missing.includes('fecha')) spoken.push('¿Qué día? Di por ejemplo mañana o el 15 de junio.');
    else if (missing.includes('hora de inicio')) spoken.push('¿A qué hora? Di por ejemplo a las 10.');
    else if (missing.includes('fecha límite de repetición')) spoken.push('¿Hasta qué fecha se repite?');
  } else {
    spoken.push('Para agendar la reunión dime título, fecha y hora en la misma frase si puedes.');
    spoken.push('Ejemplo: agenda reunión revisión semanal de obra mañana a las 10 virtual.');
  }

  return { narration: joinNatural(spoken), details, missingFields: missing };
}

function buildCreateTicketBrief(parsed, ctx = {}) {
  const { isValidTicketTitle } = require('./voiceCreateTicket');
  const p = parsed.params || {};
  const missing = Array.isArray(parsed.ticketMissing) ? [...parsed.ticketMissing] : [];
  const details = [];
  const isFollowUp = Boolean(parsed.sessionMerged || ctx.session?.needsClarification);

  if (!isValidTicketTitle(p.title) && !missing.includes('asunto')) {
    missing.push('asunto');
  }

  if (isValidTicketTitle(p.title)) {
    details.push({ label: 'Asunto', value: p.title });
  }

  if (p.description && p.description !== p.title && isValidTicketTitle(p.description)) {
    details.push({ label: 'Descripción del problema', value: String(p.description).slice(0, 160) });
  }

  if (p.priority && p.priority !== 'medium') {
    details.push({ label: 'Prioridad', value: STATUS_LABELS[p.priority] || p.priority });
  }

  if (p.category) {
    details.push({ label: 'Departamento responsable', value: p.category });
  }

  const spoken = [];
  if (missing.length === 0) {
    spoken.push(`Perfecto. Creo el ticket: ${p.title}.`);
    if (p.category) spoken.push(`Departamento ${p.category}.`);
  } else if (isFollowUp) {
    if (details.length) {
      spoken.push(`Ya tengo ${details.map((d) => `${d.label.toLowerCase()} ${d.value}`).join(', ')}.`);
    }
    spoken.push('Solo me falta el asunto. Di el problema en pocas palabras, por ejemplo: impresora rota o falla de acceso.');
  } else {
    spoken.push('Para el ticket, dime el asunto o problema en la misma frase.');
    spoken.push('Por ejemplo: crea un ticket impresora rota, o crea ticket falla de acceso al sistema.');
  }

  return { narration: joinNatural(spoken), details, missingFields: missing };
}

function buildCreateTaskBrief(parsed, users, ctx = {}) {
  const p = parsed.params || {};
  const missing = Array.isArray(parsed.taskMissing) ? [...parsed.taskMissing] : [];
  const details = [];
  const isFollowUp = Boolean(parsed.sessionMerged || ctx.session?.needsClarification);

  if (!missing.includes('título') && p.title && !/desde comando de voz/i.test(p.title)) {
    details.push({ label: 'Título', value: p.title });
  } else if (!p.title || /desde comando de voz/i.test(p.title)) {
    if (!missing.includes('título')) missing.push('título');
  }

  if (p.description && p.description !== p.title) {
    details.push({ label: 'Descripción', value: String(p.description).slice(0, 160) });
  }
  if (p.department) details.push({ label: 'Departamento', value: p.department });
  if (p.start_date) details.push({ label: 'Inicio', value: formatDisplayDate(p.start_date) });
  if (p.end_date) details.push({ label: 'Fin', value: formatDisplayDate(p.end_date) });

  if (p.assigned_to) {
    const u = users.find((x) => Number(x.id) === Number(p.assigned_to));
    const label = u ? userFullName(u) : p.assignee_label || '';
    if (label) details.push({ label: 'Responsable', value: label });
  } else if (!missing.includes('responsable')) {
    missing.push('responsable');
  }

  const spoken = [];
  if (missing.length === 0) {
    spoken.push(`Perfecto. Creo la tarea ${p.title}.`);
    if (p.assignee_label) spoken.push(`Responsable: ${p.assignee_label}.`);
  } else if (isFollowUp && details.length) {
    spoken.push(`Ya tengo ${details.map((d) => `${d.label.toLowerCase()} ${d.value}`).join(', ')}.`);
    if (missing.includes('responsable')) {
      spoken.push('¿A quién asigno la tarea? Di asignar a nombre y apellido.');
    } else if (missing.includes('título')) {
      spoken.push('¿Cuál es el título de la tarea?');
    } else if (missing.includes('departamento')) {
      spoken.push('¿De qué departamento?');
    }
  } else {
    spoken.push('Para la tarea operativa dime título y responsable en la misma frase.');
    spoken.push('Ejemplo: crea tarea revisar inventario asignar a María López.');
  }

  return { narration: joinNatural(spoken), details, missingFields: missing };
}

function buildAssignTicketBrief(parsed, users, ctx = {}) {
  const p = parsed.params || {};
  const missing = Array.isArray(parsed.assignMissing) ? [...parsed.assignMissing] : [];
  const details = [];
  const isFollowUp = Boolean(parsed.sessionMerged || ctx.session?.needsClarification);

  if (p.ticket_id) details.push({ label: 'Ticket', value: `#${p.ticket_id}` });
  else if (!missing.includes('número de ticket')) missing.push('número de ticket');

  if (p.assigned_to) {
    const u = users.find((x) => Number(x.id) === Number(p.assigned_to));
    details.push({ label: 'Responsable', value: u ? userFullName(u) : p.assignee_label || '' });
  } else if (!missing.includes('responsable')) {
    missing.push('responsable');
  }

  const spoken = [];
  if (missing.length === 0) {
    spoken.push(`Listo. Asigno el ticket #${p.ticket_id} a ${p.assignee_label || 'el responsable'}.`);
  } else if (isFollowUp && p.ticket_id && missing.includes('responsable')) {
    spoken.push(`Tengo el ticket #${p.ticket_id}. Di a quién asignarlo, por ejemplo: asignar a Juan Pérez.`);
  } else if (ctx.postExecute?.ticket_id && missing.includes('número de ticket')) {
    spoken.push(`¿Asigno el ticket #${ctx.postExecute.ticket_id} que acabas de crear? Di el responsable.`);
  } else {
    spoken.push('Di el número de ticket y el responsable. Ejemplo: asignar ticket 12 a María López.');
  }

  return { narration: joinNatural(spoken), details, missingFields: missing };
}

function buildCreateAvisoBrief(parsed) {
  const p = parsed.params || {};
  const missing = [];
  const details = [];
  const spoken = ['Entendí que quieres publicar un aviso.'];

  if (!isGenericTitle(p.title, 'Aviso desde comando de voz')) {
    details.push({ label: 'Título', value: p.title });
    spoken.push(`Título: ${p.title}.`);
  } else {
    missing.push('título del aviso');
  }

  if (p.content && String(p.content).trim().length >= 3) {
    details.push({
      label: 'Contenido',
      value: String(p.content).slice(0, 160),
    });
    spoken.push('Ya tengo el contenido del mensaje.');
  } else if (p.title && !isGenericTitle(p.title, 'Aviso desde comando de voz') && String(p.title).length >= 5) {
    details.push({ label: 'Contenido', value: String(p.title).slice(0, 160) });
    spoken.push('Usaré el título como mensaje del aviso.');
  } else {
    missing.push('contenido del aviso');
  }

  if (p.category && p.category !== 'general') {
    details.push({ label: 'Tipo', value: p.category });
  }

  if (missing.length) {
    spoken.push(`Indica ${missing.join(' y ')} y pulsa Listo.`);
  } else {
    spoken.push('Lo publico enseguida.');
  }

  return { narration: joinNatural(spoken), details, missingFields: missing };
}

function buildUpdateBrief(parsed) {
  const details = [];
  const spoken = [`Voy a ${parsed.summary?.toLowerCase() || 'aplicar el cambio'}.`];
  if (parsed.params?.ticket_id) details.push({ label: 'Ticket', value: `#${parsed.params.ticket_id}` });
  if (parsed.params?.task_id) details.push({ label: 'Tarea', value: `#${parsed.params.task_id}` });
  if (parsed.params?.meeting_id) details.push({ label: 'Reunión', value: `#${parsed.params.meeting_id}` });
  if (parsed.params?.status) {
    details.push({ label: 'Estado', value: STATUS_LABELS[parsed.params.status] || parsed.params.status });
  }
  spoken.push('¿Confirmas?');
  return { narration: joinNatural(spoken), details, missingFields: [] };
}

function buildNavigateBrief(parsed) {
  return {
    narration: parsed.summary || 'Te llevo allí.',
    details: [{ label: 'Destino', value: parsed.params?.module || 'módulo' }],
    missingFields: [],
  };
}

function buildQueryBrief(parsed) {
  const label = {
    query_meetings: 'tu agenda de reuniones',
    query_tickets: 'los tickets',
    query_tasks: 'tus tareas',
    query_avisos: 'los avisos',
    query_minutas: 'las minutas',
    query_notifications: 'tus notificaciones',
  }[parsed.intent] || 'la información';

  return {
    narration: `Voy a revisar ${label}. Un momento.`,
    details: [],
    missingFields: [],
  };
}

function buildIntentBrief(parsed, users = [], raw = '', ctx = {}) {
  if (!parsed?.intent) {
    return { narration: parsed?.summary || '', details: [], missingFields: [] };
  }

  switch (parsed.intent) {
    case 'create_meeting':
      return buildCreateMeetingBrief(parsed, users, ctx);
    case 'create_ticket':
      return buildCreateTicketBrief(parsed, ctx);
    case 'create_task':
      return buildCreateTaskBrief(parsed, users, ctx);
    case 'create_aviso':
      return buildCreateAvisoBrief(parsed);
    case 'assign_ticket':
      return buildAssignTicketBrief(parsed, users, ctx);
    case 'navigate':
    case 'open_minute':
    case 'help':
      return buildNavigateBrief(parsed);
    default:
      if (String(parsed.intent).startsWith('query_')) return buildQueryBrief(parsed);
      if (parsed.allowed) return buildUpdateBrief(parsed);
      return {
        narration: parsed.denyReason || parsed.summary || 'No pude interpretar eso.',
        details: [],
        missingFields: [],
      };
  }
}

function enrichParsedResult(parsed, ctx = {}) {
  if (!parsed || typeof parsed !== 'object') return parsed;

  const users = Array.isArray(ctx.users) ? ctx.users : [];
  const raw = ctx.raw || ctx.transcript || '';
  const brief = buildIntentBrief(parsed, users, raw, ctx);

  const needsVoicePick = Boolean(parsed.pendingVoicePick?.options?.length >= 2 && !parsed.voicePickResolved);
  const missingFromIntent =
    parsed.taskMissing ||
    parsed.assignMissing ||
    parsed.meetingMissing ||
    parsed.ticketMissing ||
    brief.missingFields ||
    [];
  const needsClarification =
    (missingFromIntent.length > 0 || needsVoicePick) &&
    ['create_meeting', 'create_ticket', 'create_task', 'create_aviso', 'assign_ticket'].includes(parsed.intent);

  const canExecute =
    parsed.allowed !== false &&
    !needsClarification &&
    !(parsed.needsDisambiguation?.length > 1 && !parsed.params?.assigned_to && !parsed.voicePickResolved);

  let narration = brief.narration;
  if (parsed.action) {
    narration = `${parsed.action}. ${narration}`;
  }
  if (parsed.learned) {
    narration = `Ya aprendí esta forma de pedirlo${parsed.memoryHits > 2 ? ` (la usas seguido)` : ''}. ${brief.narration}`;
  } else if (parsed.semantic) {
    narration = `Interpreté tu pedido. ${brief.narration}`;
  }

  const details =
    Array.isArray(parsed.formFields) && parsed.formFields.length
      ? parsed.formFields.map((f) => ({ label: f.label, value: f.value }))
      : brief.details;

  return {
    ...parsed,
    narration,
    details,
    missingFields: missingFromIntent,
    needsClarification,
    canExecute,
    autoExecute:
      parsed.autoExecute ||
      (canExecute &&
        ['create_ticket', 'create_task', 'create_meeting', 'create_aviso', 'assign_ticket'].includes(parsed.intent)) ||
      String(parsed.intent || '').startsWith('query_'),
    action: parsed.action || null,
    slotMeta: parsed.slotMeta || {},
    intentConfidence: parsed.intentConfidence || parsed.confidence || null,
  };
}

module.exports = {
  enrichParsedResult,
  buildIntentBrief,
  formatDisplayDate,
  userFullName,
};
