const { notifyUsers } = require('../services/notificationService');
const { getForumMemberIds } = require('./forumAccess');

function excludeActor(ids, actorUserId) {
  if (actorUserId == null) return ids;
  const ex = Number(actorUserId);
  return ids.filter((id) => Number(id) !== ex);
}

function uniqueActiveIds(db, idList) {
  const set = new Set();
  for (const raw of idList) {
    const id = Number(raw);
    if (!id || Number.isNaN(id)) continue;
    const u = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(id);
    if (u) set.add(u.id);
  }
  return [...set];
}

/** Integrantes de un ticket: creador, responsable, comentaristas y responsables de tareas. */
function getTicketStakeholderIds(db, ticketId) {
  const ticket = db.prepare('SELECT created_by, assigned_to, category FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return [];

  const ids = [];
  if (ticket.created_by) ids.push(ticket.created_by);
  if (ticket.assigned_to) ids.push(ticket.assigned_to);
  getDeptManagerIds(db, ticket.category).forEach((id) => ids.push(id));

  db.prepare('SELECT DISTINCT assigned_to AS uid FROM ticket_tasks WHERE ticket_id = ? AND assigned_to IS NOT NULL')
    .all(ticketId)
    .forEach((r) => ids.push(r.uid));

  db.prepare('SELECT DISTINCT user_id AS uid FROM ticket_comments WHERE ticket_id = ?')
    .all(ticketId)
    .forEach((r) => ids.push(r.uid));

  db.prepare('SELECT DISTINCT uploaded_by AS uid FROM ticket_attachments WHERE ticket_id = ?')
    .all(ticketId)
    .forEach((r) => ids.push(r.uid));

  return uniqueActiveIds(db, ids);
}

function getDeptManagerIds(db, department) {
  const dept = String(department || '').trim();
  if (!dept) return [];
  return db
    .prepare(
      `SELECT id FROM users WHERE is_active = 1 AND role = 'manager' AND trim(departamento) = trim(?)`
    )
    .all(dept)
    .map((r) => r.id);
}

function notifyTicketStakeholders(db, ticketId, actorUserId, payload, alsoExcludeIds = []) {
  let ids = excludeActor(getTicketStakeholderIds(db, ticketId), actorUserId);
  for (const ex of alsoExcludeIds) {
    const n = Number(ex);
    if (!Number.isNaN(n)) ids = ids.filter((id) => Number(id) !== n);
  }
  return notifyUsers(ids, payload);
}

function parseMeetingAttendees(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function getMeetingParticipantIds(meeting) {
  const ids = [];
  if (meeting?.created_by) ids.push(meeting.created_by);
  parseMeetingAttendees(meeting?.attendees).forEach((uid) => ids.push(uid));
  return ids;
}

function notifyMeetingParticipants(db, meeting, actorUserId, payload, alsoExcludeIds = []) {
  let ids = excludeActor(uniqueActiveIds(db, getMeetingParticipantIds(meeting)), actorUserId);
  for (const ex of alsoExcludeIds) {
    const n = Number(ex);
    if (!Number.isNaN(n)) ids = ids.filter((id) => Number(id) !== n);
  }
  return notifyUsers(ids, payload);
}

/** Coincidencia de nombres en minutas con usuarios del sistema. */
function resolveMinutaUserIds(db, attendeesJson, createdBy) {
  const attendees = parseMeetingAttendees(attendeesJson);
  const ids = [];
  if (createdBy) ids.push(createdBy);

  const users = db.prepare('SELECT id, name, apellido FROM users WHERE is_active = 1').all();
  for (const a of attendees) {
    const nom = String(a?.nombre || '').trim().toLowerCase();
    if (!nom) continue;
    for (const u of users) {
      const full = `${u.name || ''} ${u.apellido || ''}`.trim().toLowerCase();
      if (full === nom || String(u.name || '').trim().toLowerCase() === nom) {
        ids.push(u.id);
      }
    }
  }
  return uniqueActiveIds(db, ids);
}

function notifyMinutaParticipants(db, minute, actorUserId, payload) {
  const ids = excludeActor(
    resolveMinutaUserIds(db, minute.attendees_json, minute.created_by),
    actorUserId
  );
  return notifyUsers(ids, payload);
}

function notifyForumGroup(db, group, actorUserId, payload) {
  const ids = getForumMemberIds(db, group, actorUserId);
  return notifyUsers(ids, payload);
}

module.exports = {
  getTicketStakeholderIds,
  getDeptManagerIds,
  notifyTicketStakeholders,
  parseMeetingAttendees,
  getMeetingParticipantIds,
  notifyMeetingParticipants,
  resolveMinutaUserIds,
  notifyMinutaParticipants,
  notifyForumGroup,
};
