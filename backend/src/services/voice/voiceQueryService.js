const { getDb } = require('../../database/init');
const { localDateYMD } = require('../../utils/localDate');

function parseMeetingAttendees(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function formatMeetingClock(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(iso || '').slice(11, 16);
  }
}

function meetingDateKey(iso) {
  return String(iso || '').slice(0, 10);
}

function userParticipatesInMeeting(meeting, userId) {
  if (Number(meeting.created_by) === Number(userId)) return true;
  return parseMeetingAttendees(meeting.attendees).includes(Number(userId));
}

function filterMeetings(meetings, params, user) {
  const now = new Date();
  const scope = params?.scope || 'today';
  const date = params?.date || localDateYMD(now);
  const mine = Boolean(params?.mine);
  let rows = [...meetings];

  if (mine) rows = rows.filter((m) => userParticipatesInMeeting(m, user.id));

  if (scope === 'active') {
    rows = rows.filter((m) => {
      const start = new Date(m.start_time);
      const end = new Date(m.end_time);
      return meetingDateKey(m.start_time) === date && start <= now && end >= now;
    });
  } else if (scope === 'today' || scope === 'tomorrow') {
    rows = rows.filter((m) => meetingDateKey(m.start_time) === date);
    if (scope === 'today') rows = rows.filter((m) => new Date(m.end_time) >= now);
  } else if (scope === 'week') {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    rows = rows.filter((m) => {
      const start = new Date(m.start_time);
      return start >= now && start <= weekEnd;
    });
  } else if (scope === 'next') {
    return rows
      .filter((m) => new Date(m.end_time) >= now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .slice(0, 1);
  } else {
    rows = rows.filter((m) => new Date(m.end_time) >= now);
  }

  return rows.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function messageForMeetings(meetings, params) {
  const scope = params?.scope || 'today';
  const mine = Boolean(params?.mine);

  if (!meetings.length) {
    if (scope === 'active') return 'No hay ninguna reunión activa en este momento.';
    if (scope === 'today') return mine ? 'No tienes reuniones programadas para hoy.' : 'No hay reuniones programadas para hoy.';
    if (scope === 'tomorrow') return 'No hay reuniones programadas para mañana.';
    if (scope === 'next') return mine ? 'No tienes ninguna reunión próxima.' : 'No hay reuniones próximas.';
    if (scope === 'week') return 'No hay reuniones programadas para esta semana.';
    return 'No encontré reuniones con esos criterios.';
  }

  if (scope === 'next' || meetings.length === 1) {
    const m = meetings[0];
    const when = formatMeetingClock(m.start_time);
    if (scope === 'active') {
      return `Sí, hay una reunión activa: "${m.title}", hasta las ${formatMeetingClock(m.end_time)}.`;
    }
    if (scope === 'today') {
      return `Sí, hay ${meetings.length === 1 ? 'una reunión hoy' : `${meetings.length} reuniones hoy`}: "${m.title}" a las ${when}.`;
    }
    return `La próxima reunión${mine ? ' tuya' : ''} es "${m.title}" el ${meetingDateKey(m.start_time)} a las ${when}.`;
  }

  const preview = meetings
    .slice(0, 3)
    .map((m) => `"${m.title}" a las ${formatMeetingClock(m.start_time)}`)
    .join('; ');
  const extra = meetings.length > 3 ? ` y ${meetings.length - 3} más` : '';
  return `Hay ${meetings.length} reuniones: ${preview}${extra}.`;
}

function filterTickets(rows, params, user) {
  const mine = Boolean(params?.mine);
  const scope = params?.scope || 'all';
  let list = [...rows];

  if (mine) {
    list = list.filter(
      (t) => Number(t.created_by) === Number(user.id) || Number(t.assigned_to) === Number(user.id),
    );
  }

  if (scope === 'open') list = list.filter((t) => t.status === 'open' || t.status === 'in_progress');
  else if (scope === 'closed') list = list.filter((t) => t.status === 'closed' || t.status === 'resolved');
  else if (scope === 'urgent') list = list.filter((t) => t.priority === 'urgent' || t.priority === 'high');

  return list.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

function messageForTickets(tickets, params) {
  const scope = params?.scope || 'all';
  const mine = Boolean(params?.mine);

  if (!tickets.length) {
    if (scope === 'open') return mine ? 'No tienes tickets abiertos.' : 'No hay tickets abiertos.';
    if (scope === 'urgent') return 'No hay tickets urgentes.';
    if (scope === 'closed') return 'No hay tickets cerrados con ese criterio.';
    return mine ? 'No encontré tickets tuyos.' : 'No hay tickets registrados.';
  }

  if (tickets.length === 1) {
    const t = tickets[0];
    return `Hay 1 ticket${mine ? ' tuyo' : ''}: #${t.id} "${t.title}", estado ${t.status}.`;
  }

  const preview = tickets
    .slice(0, 3)
    .map((t) => `#${t.id} ${t.title}`)
    .join('; ');
  const extra = tickets.length > 3 ? ` y ${tickets.length - 3} más` : '';
  if (scope === 'open') return `Hay ${tickets.length} tickets abiertos${mine ? ' tuyos' : ''}: ${preview}${extra}.`;
  if (scope === 'urgent') return `Hay ${tickets.length} tickets urgentes: ${preview}${extra}.`;
  return `Encontré ${tickets.length} tickets: ${preview}${extra}.`;
}

function filterTasks(rows, params, user) {
  const mine = Boolean(params?.mine);
  const scope = params?.scope || 'all';
  let list = [...rows];

  if (mine) list = list.filter((t) => Number(t.assigned_to) === Number(user.id) || Number(t.created_by) === Number(user.id));

  if (scope === 'open') list = list.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  else if (scope === 'closed') list = list.filter((t) => t.status === 'done' || t.status === 'cancelled');

  return list.sort((a, b) => String(b.updated_at || b.end_date).localeCompare(String(a.updated_at || a.end_date)));
}

function messageForTasks(tasks, params) {
  const mine = Boolean(params?.mine);
  const scope = params?.scope || 'all';

  if (!tasks.length) {
    if (scope === 'open') return mine ? 'No tienes tareas pendientes.' : 'No hay tareas pendientes.';
    return mine ? 'No encontré tareas tuyas.' : 'No hay tareas operativas.';
  }

  if (tasks.length === 1) {
    const t = tasks[0];
    return `Hay 1 tarea${mine ? ' tuya' : ''}: "${t.title}", estado ${t.status}.`;
  }

  const preview = tasks
    .slice(0, 3)
    .map((t) => `"${t.title}" (${t.status})`)
    .join('; ');
  return `Hay ${tasks.length} tareas${mine ? ' tuyas' : ''}: ${preview}${tasks.length > 3 ? ` y ${tasks.length - 3} más` : ''}.`;
}

function filterAvisos(rows, params) {
  const scope = params?.scope || 'all';
  let list = rows.filter((a) => Number(a.is_active) === 1);
  if (scope === 'urgent') list = list.filter((a) => a.category === 'important' || a.category === 'emergency');
  if (scope === 'recent') list = list.slice(0, 5);
  return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function messageForAvisos(avisos) {
  if (!avisos.length) return 'No hay avisos activos en este momento.';
  if (avisos.length === 1) return `Hay un aviso activo: "${avisos[0].title}".`;
  const preview = avisos
    .slice(0, 3)
    .map((a) => `"${a.title}"`)
    .join('; ');
  return `Hay ${avisos.length} avisos activos: ${preview}${avisos.length > 3 ? ` y ${avisos.length - 3} más` : ''}.`;
}

function filterMinutas(rows, params, user) {
  const mine = Boolean(params?.mine);
  const scope = params?.scope || 'all';
  let list = [...rows];
  if (mine) list = list.filter((m) => Number(m.created_by) === Number(user.id));
  if (params?.date) list = list.filter((m) => String(m.fecha).startsWith(params.date));
  if (scope === 'recent') list = list.slice(0, 5);
  return list.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

function messageForMinutas(minutas, params) {
  const mine = Boolean(params?.mine);
  if (!minutas.length) return mine ? 'No encontré minutas tuyas.' : 'No hay minutas registradas.';
  if (minutas.length === 1) {
    const m = minutas[0];
    return `Hay 1 minuta${mine ? ' tuya' : ''}: "${m.tema || 'Sin tema'}" del ${m.fecha}.`;
  }
  const preview = minutas
    .slice(0, 3)
    .map((m) => `"${m.tema || 'Sin tema'}" (${m.fecha})`)
    .join('; ');
  return `Hay ${minutas.length} minutas: ${preview}${minutas.length > 3 ? ` y ${minutas.length - 3} más` : ''}.`;
}

function filterNotifications(rows, params, user) {
  const scope = params?.scope || 'all';
  let list = rows.filter((n) => Number(n.user_id) === Number(user.id));
  if (scope === 'unread') list = list.filter((n) => Number(n.is_read) === 0);
  if (scope === 'recent') list = list.slice(0, 5);
  return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function messageForNotifications(notifications, params) {
  const scope = params?.scope || 'all';
  if (!notifications.length) {
    return scope === 'unread' ? 'No tienes notificaciones sin leer.' : 'No tienes notificaciones.';
  }
  if (notifications.length === 1) {
    return `Tienes 1 notificación${scope === 'unread' ? ' sin leer' : ''}: "${notifications[0].title}".`;
  }
  const preview = notifications
    .slice(0, 3)
    .map((n) => `"${n.title}"`)
    .join('; ');
  return `Tienes ${notifications.length} notificaciones${scope === 'unread' ? ' sin leer' : ''}: ${preview}${notifications.length > 3 ? ` y ${notifications.length - 3} más` : ''}.`;
}

const MODULE_MAP = {
  query_meetings: 'calendar',
  query_tickets: 'tickets',
  query_tasks: 'tasks',
  query_avisos: 'avisos',
  query_minutas: 'minutas',
  query_notifications: 'notifications',
};

function executeVoiceQuery(intent, params, user) {
  const db = getDb();
  let message = '';
  let items = [];

  switch (intent) {
    case 'query_meetings': {
      const all = db.prepare('SELECT * FROM meetings ORDER BY start_time ASC').all();
      items = filterMeetings(all, params, user);
      message = messageForMeetings(items, params);
      break;
    }
    case 'query_tickets': {
      const all = db.prepare('SELECT * FROM tickets ORDER BY updated_at DESC').all();
      items = filterTickets(all, params, user);
      message = messageForTickets(items, params);
      break;
    }
    case 'query_tasks': {
      const all = db.prepare('SELECT * FROM ticket_tasks ORDER BY end_date DESC, updated_at DESC').all();
      items = filterTasks(all, params, user);
      message = messageForTasks(items, params);
      break;
    }
    case 'query_avisos': {
      const all = db.prepare('SELECT * FROM avisos ORDER BY created_at DESC').all();
      items = filterAvisos(all, params);
      message = messageForAvisos(items);
      break;
    }
    case 'query_minutas': {
      const all = db.prepare('SELECT * FROM meeting_minutes ORDER BY fecha DESC').all();
      items = filterMinutas(all, params, user);
      message = messageForMinutas(items, params);
      break;
    }
    case 'query_notifications': {
      const all = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC').all();
      items = filterNotifications(all, params, user);
      message = messageForNotifications(items, params);
      break;
    }
    default:
      throw new Error('Consulta no soportada.');
  }

  return {
    success: true,
    message,
    module: params?.open_module ? MODULE_MAP[intent] : undefined,
    clientOnly: false,
    data: { count: items.length, items: items.slice(0, 10) },
  };
}

module.exports = { executeVoiceQuery };
