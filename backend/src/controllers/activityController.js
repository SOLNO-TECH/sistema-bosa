const { getDb } = require('../database/init');

const TICKET_HISTORY_LABELS = {
  status_change: 'cambió el estado del ticket',
  assigned: 'asignó el ticket',
  assignment: 'actualizó la asignación del ticket',
  updated: 'actualizó el ticket',
  comment: 'comentó en el ticket',
  attachment: 'adjuntó un archivo al ticket',
  attachment_delete: 'eliminó un archivo del ticket',
};

const MODULE_LABELS = {
  tickets: 'Ticket',
  tasks: 'Tarea',
  calendar: 'Reunión',
  minutas: 'Minuta',
  avisos: 'Aviso',
  foro: 'Foro',
  knowledge: 'Knowledge',
  users: 'Usuario',
};

function actorFromRow(row) {
  if (!row?.user_id && !row?.actor_id && !row?.created_by) return null;
  const id = row.user_id ?? row.actor_id ?? row.created_by;
  const name = row.actor_name ?? row.user_name ?? row.name ?? 'Usuario';
  const apellido = row.actor_apellido ?? row.user_apellido ?? row.apellido ?? '';
  const avatar_url = row.actor_avatar_url ?? row.user_avatar_url ?? row.avatar_url ?? '';
  return { id, name, apellido, avatar_url };
}

function buildItem({
  key,
  module,
  action,
  occurred_at,
  actor,
  reference,
  detail,
  related_id = null,
}) {
  if (!occurred_at) return null;
  const actorName = actor
    ? [actor.name, actor.apellido].filter(Boolean).join(' ').trim() || 'Usuario'
    : 'Sistema';
  return {
    id: key,
    module,
    action,
    category: MODULE_LABELS[module] || 'Actividad',
    actor: actor || { id: null, name: 'Sistema', apellido: '', avatar_url: '' },
    actor_name: actorName,
    reference: String(reference || '').trim(),
    detail: String(detail || '').trim(),
    occurred_at: String(occurred_at),
    related_id,
  };
}

function parseOccurredAt(value) {
  if (!value) return 0;
  const ms = new Date(String(value).replace(' ', 'T')).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function collectTicketEvents(db, perSource) {
  const items = [];

  const created = db
    .prepare(
      `SELECT t.id, t.title, t.created_at AS occurred_at,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM tickets t
       LEFT JOIN users u ON u.id = t.created_by
       ORDER BY datetime(t.created_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  for (const row of created) {
    items.push(
      buildItem({
        key: `ticket:${row.id}:created`,
        module: 'tickets',
        action: 'created',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.title,
        detail: 'creó un ticket',
        related_id: row.id,
      }),
    );
  }

  const history = db
    .prepare(
      `SELECT h.id, h.ticket_id, h.action, h.details, h.created_at AS occurred_at,
              t.title AS ticket_title,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM ticket_history h
       JOIN tickets t ON t.id = h.ticket_id
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.action != 'created'
       ORDER BY datetime(h.created_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  for (const row of history) {
    const detail = TICKET_HISTORY_LABELS[row.action] || row.details || 'actualizó el ticket';
    items.push(
      buildItem({
        key: `ticket_history:${row.id}`,
        module: 'tickets',
        action: row.action,
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.ticket_title,
        detail,
        related_id: row.ticket_id,
      }),
    );
  }

  return items.filter(Boolean);
}

function collectTaskEvents(db, perSource) {
  const items = [];

  const tasks = db
    .prepare(
      `SELECT tt.id, tt.title, tt.created_at AS occurred_at, tt.updated_at,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM ticket_tasks tt
       LEFT JOIN users u ON u.id = tt.created_by
       ORDER BY datetime(tt.created_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  for (const row of tasks) {
    items.push(
      buildItem({
        key: `task:${row.id}:created`,
        module: 'tasks',
        action: 'created',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.title,
        detail: 'creó una tarea operativa',
        related_id: row.id,
      }),
    );
  }

  const updates = db
    .prepare(
      `SELECT tt.id, tt.title, tt.updated_at AS occurred_at,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM ticket_tasks tt
       LEFT JOIN users u ON u.id = tt.created_by
       WHERE datetime(tt.updated_at) > datetime(tt.created_at, '+2 seconds')
       ORDER BY datetime(tt.updated_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  for (const row of updates) {
    items.push(
      buildItem({
        key: `task:${row.id}:updated`,
        module: 'tasks',
        action: 'updated',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.title,
        detail: 'actualizó una tarea operativa',
        related_id: row.id,
      }),
    );
  }

  const comments = db
    .prepare(
      `SELECT c.id, c.task_id, c.created_at AS occurred_at,
              tt.title AS task_title,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM task_comments c
       JOIN ticket_tasks tt ON tt.id = c.task_id
       LEFT JOIN users u ON u.id = c.user_id
       ORDER BY datetime(c.created_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  for (const row of comments) {
    items.push(
      buildItem({
        key: `task_comment:${row.id}`,
        module: 'tasks',
        action: 'comment',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.task_title,
        detail: 'comentó en una tarea',
        related_id: row.task_id,
      }),
    );
  }

  return items.filter(Boolean);
}

function collectMeetingEvents(db, perSource) {
  const items = [];
  const cols = db.prepare('PRAGMA table_info(meetings)').all().map((c) => c.name);
  const hasCreatedAt = cols.includes('created_at');
  const timeExpr = hasCreatedAt
    ? "COALESCE(NULLIF(m.created_at, ''), m.start_time)"
    : 'm.start_time';

  const meetings = db
    .prepare(
      `SELECT m.id, m.title, ${timeExpr} AS occurred_at,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM meetings m
       LEFT JOIN users u ON u.id = m.created_by
       ORDER BY datetime(${timeExpr}) DESC
       LIMIT ?`,
    )
    .all(perSource);

  for (const row of meetings) {
    items.push(
      buildItem({
        key: `meeting:${row.id}:created`,
        module: 'calendar',
        action: 'created',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.title,
        detail: 'programó una reunión',
        related_id: row.id,
      }),
    );
  }

  const rsvps = db
    .prepare(
      `SELECT r.meeting_id, r.status, r.updated_at AS occurred_at,
              m.title AS meeting_title,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM meeting_rsvps r
       JOIN meetings m ON m.id = r.meeting_id
       LEFT JOIN users u ON u.id = r.user_id
       ORDER BY datetime(r.updated_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  const rsvpLabels = {
    going: 'confirmó asistencia a la reunión',
    declined: 'declinó asistencia a la reunión',
    late: 'marcó llegada tarde a la reunión',
  };

  for (const row of rsvps) {
    items.push(
      buildItem({
        key: `rsvp:${row.meeting_id}:${row.user_id}:${row.occurred_at}`,
        module: 'calendar',
        action: 'rsvp',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.meeting_title,
        detail: rsvpLabels[row.status] || 'actualizó su asistencia',
        related_id: row.meeting_id,
      }),
    );
  }

  return items.filter(Boolean);
}

function collectMinuteEvents(db, perSource) {
  const items = [];

  const created = db
    .prepare(
      `SELECT m.id, m.tema, m.created_at AS occurred_at,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM meeting_minutes m
       LEFT JOIN users u ON u.id = m.created_by
       ORDER BY datetime(m.created_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  for (const row of created) {
    items.push(
      buildItem({
        key: `minute:${row.id}:created`,
        module: 'minutas',
        action: 'created',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.tema || 'Minuta sin tema',
        detail: 'registró una minuta',
        related_id: row.id,
      }),
    );
  }

  const updated = db
    .prepare(
      `SELECT m.id, m.tema, m.updated_at AS occurred_at,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM meeting_minutes m
       LEFT JOIN users u ON u.id = m.created_by
       WHERE datetime(m.updated_at) > datetime(m.created_at, '+2 seconds')
       ORDER BY datetime(m.updated_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  for (const row of updated) {
    items.push(
      buildItem({
        key: `minute:${row.id}:updated`,
        module: 'minutas',
        action: 'updated',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.tema || 'Minuta sin tema',
        detail: 'actualizó una minuta',
        related_id: row.id,
      }),
    );
  }

  return items.filter(Boolean);
}

function collectAvisoEvents(db, perSource) {
  const rows = db
    .prepare(
      `SELECT a.id, a.title, a.created_at AS occurred_at,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM avisos a
       LEFT JOIN users u ON u.id = a.created_by
       ORDER BY datetime(a.created_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  return rows
    .map((row) =>
      buildItem({
        key: `aviso:${row.id}:created`,
        module: 'avisos',
        action: 'created',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.title,
        detail: 'publicó un aviso',
        related_id: row.id,
      }),
    )
    .filter(Boolean);
}

function collectForumEvents(db, perSource) {
  const items = [];

  const groups = db
    .prepare(
      `SELECT w.id, w.name, w.created_at AS occurred_at,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM workgroups w
       LEFT JOIN users u ON u.id = w.created_by
       ORDER BY datetime(w.created_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  for (const row of groups) {
    items.push(
      buildItem({
        key: `forum:${row.id}:created`,
        module: 'foro',
        action: 'created',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.name,
        detail: 'creó un grupo del foro',
        related_id: row.id,
      }),
    );
  }

  const messages = db
    .prepare(
      `SELECT wm.id, wm.workgroup_id, wm.created_at AS occurred_at,
              w.name AS group_name,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM workgroup_messages wm
       JOIN workgroups w ON w.id = wm.workgroup_id
       LEFT JOIN users u ON u.id = wm.user_id
       ORDER BY datetime(wm.created_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  for (const row of messages) {
    items.push(
      buildItem({
        key: `forum_msg:${row.id}`,
        module: 'foro',
        action: 'message',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.group_name,
        detail: 'envió un mensaje en el foro',
        related_id: row.workgroup_id,
      }),
    );
  }

  return items.filter(Boolean);
}

function collectKnowledgeEvents(db, perSource) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_links'").get();
  if (!table) return [];

  const rows = db
    .prepare(
      `SELECT k.id, k.title, k.created_at AS occurred_at,
              u.id AS user_id, u.name, u.apellido, u.avatar_url
       FROM knowledge_links k
       LEFT JOIN users u ON u.id = k.created_by
       WHERE k.created_by IS NOT NULL
       ORDER BY datetime(k.created_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  return rows
    .map((row) =>
      buildItem({
        key: `knowledge:${row.id}:created`,
        module: 'knowledge',
        action: 'created',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.title,
        detail: 'agregó contenido a Knowledge',
        related_id: row.id,
      }),
    )
    .filter(Boolean);
}

function collectUserEvents(db, perSource) {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.apellido, u.email, u.created_at AS occurred_at, u.avatar_url
       FROM users u
       ORDER BY datetime(u.created_at) DESC
       LIMIT ?`,
    )
    .all(perSource);

  return rows
    .map((row) =>
      buildItem({
        key: `user:${row.id}:created`,
        module: 'users',
        action: 'created',
        occurred_at: row.occurred_at,
        actor: actorFromRow(row),
        reference: row.email,
        detail: 'se unió al sistema',
        related_id: row.id,
      }),
    )
    .filter(Boolean);
}

const getRecentActivity = (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 5), 60);
    const perSource = Math.min(limit * 2, 40);
    const db = getDb();

    const merged = [
      ...collectTicketEvents(db, perSource),
      ...collectTaskEvents(db, perSource),
      ...collectMeetingEvents(db, perSource),
      ...collectMinuteEvents(db, perSource),
      ...collectAvisoEvents(db, perSource),
      ...collectForumEvents(db, perSource),
      ...collectKnowledgeEvents(db, perSource),
      ...collectUserEvents(db, perSource),
    ];

    const seen = new Set();
    const sorted = merged
      .filter((item) => {
        if (!item?.occurred_at || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => parseOccurredAt(b.occurred_at) - parseOccurredAt(a.occurred_at))
      .slice(0, limit);

    res.json(sorted);
  } catch (err) {
    console.error('getRecentActivity error:', err);
    res.status(500).json({ message: 'Error al obtener actividad reciente.' });
  }
};

module.exports = { getRecentActivity };
