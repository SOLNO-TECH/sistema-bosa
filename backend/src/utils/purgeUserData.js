const fs = require('fs');
const path = require('path');
const { deleteAudioFileIfExists } = require('./minuteAudio');
const { clearMinuteFollowUpLink } = require('./minuteFollowUpSync');

const UPLOADS_ROOT = path.join(__dirname, '../../data/uploads');

function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) { /* noop */ }
}

function safeUnlinkStoredFile(storedPath) {
  if (!storedPath || typeof storedPath !== 'string') return;
  if (storedPath.includes('/api/uploads/')) {
    const filename = storedPath.split('/api/uploads/').pop();
    safeUnlink(path.join(UPLOADS_ROOT, filename));
    return;
  }
  safeUnlink(storedPath);
}

function parseJsonArray(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function removeUserIdFromJsonArrays(db, table, column, userId) {
  const uid = Number(userId);
  const rows = db.prepare(`SELECT id, ${column} AS payload FROM ${table}`).all();
  for (const row of rows) {
    const items = parseJsonArray(row.payload);
    if (!items.map(Number).includes(uid)) continue;
    const next = items.filter((item) => Number(item) !== uid);
    db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`).run(JSON.stringify(next), row.id);
  }
}

function removeUserFromWorkgroupAccess(db, userId) {
  const uid = Number(userId);
  const groups = db.prepare('SELECT id, access_list, extra_allowed_user_ids FROM workgroups').all();
  for (const group of groups) {
    const accessList = parseJsonArray(group.access_list);
    const extraIds = parseJsonArray(group.extra_allowed_user_ids);
    const nextAccess = accessList.filter((item) => Number(item) !== uid);
    const nextExtra = extraIds.filter((item) => Number(item) !== uid);
    if (nextAccess.length === accessList.length && nextExtra.length === extraIds.length) continue;
    db.prepare(
      'UPDATE workgroups SET access_list = ?, extra_allowed_user_ids = ? WHERE id = ?',
    ).run(JSON.stringify(nextAccess), JSON.stringify(nextExtra), group.id);
  }
}

function deleteTaskWithChildren(db, taskId) {
  const attachments = db.prepare('SELECT path FROM task_attachments WHERE task_id = ?').all(taskId);
  for (const att of attachments) safeUnlink(att.path);
  db.prepare('DELETE FROM task_attachments WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM task_comments WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM ticket_tasks WHERE id = ?').run(taskId);
}

function deleteTicketWithChildren(db, ticketId) {
  const tasks = db.prepare('SELECT id FROM ticket_tasks WHERE ticket_id = ?').all(ticketId);
  for (const task of tasks) deleteTaskWithChildren(db, task.id);

  const attachments = db.prepare('SELECT path FROM ticket_attachments WHERE ticket_id = ?').all(ticketId);
  for (const att of attachments) safeUnlink(att.path);

  db.prepare('DELETE FROM ticket_attachments WHERE ticket_id = ?').run(ticketId);
  db.prepare('DELETE FROM ticket_comments WHERE ticket_id = ?').run(ticketId);
  db.prepare('DELETE FROM ticket_history WHERE ticket_id = ?').run(ticketId);
  db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId);
}

function deleteWorkgroupWithChildren(db, groupId) {
  const messages = db.prepare('SELECT id, file_url FROM workgroup_messages WHERE workgroup_id = ?').all(groupId);
  for (const message of messages) {
    safeUnlinkStoredFile(message.file_url);
    db.prepare('DELETE FROM forum_message_reads WHERE message_id = ?').run(message.id);
  }
  db.prepare('DELETE FROM workgroup_messages WHERE workgroup_id = ?').run(groupId);
  db.prepare('DELETE FROM forum_join_requests WHERE workgroup_id = ?').run(groupId);
  db.prepare('DELETE FROM workgroups WHERE id = ?').run(groupId);
}

function deleteMinuteWithAudio(db, minuteId) {
  const row = db.prepare('SELECT audio_path FROM meeting_minutes WHERE id = ?').get(minuteId);
  if (row?.audio_path) deleteAudioFileIfExists(row.audio_path);
  db.prepare('DELETE FROM meeting_minutes WHERE id = ?').run(minuteId);
}

function deleteMeetingWithChildren(db, meetingId) {
  const minutes = db.prepare('SELECT id FROM meeting_minutes WHERE meeting_id = ?').all(meetingId);
  for (const minute of minutes) deleteMinuteWithAudio(db, minute.id);

  try {
    clearMinuteFollowUpLink(db, meetingId);
  } catch (_) { /* noop */ }

  db.prepare('DELETE FROM meeting_rsvps WHERE meeting_id = ?').run(meetingId);
  db.prepare('DELETE FROM meetings WHERE id = ?').run(meetingId);
}

/** Minutas vinculadas a reuniones que ya no existen (p. ej. borradas antes del cascade). */
function cleanupOrphanedMeetingMinutes(db) {
  const orphans = db
    .prepare(
      `SELECT m.id
       FROM meeting_minutes m
       WHERE m.meeting_id IS NOT NULL
         AND m.meeting_id > 0
         AND NOT EXISTS (SELECT 1 FROM meetings mt WHERE mt.id = m.meeting_id)`,
    )
    .all();

  for (const row of orphans) {
    deleteMinuteWithAudio(db, row.id);
  }

  if (orphans.length > 0) {
    console.log(`[DB] Minutas huérfanas eliminadas: ${orphans.length}`);
  }

  return orphans.length;
}

/**
 * Elimina un usuario y todo el contenido vinculado a él.
 * Los registros de otros usuarios se conservan; solo se quitan referencias mínimas
 * (asignación de tickets, listas de asistentes, listas de acceso a foros).
 */
function purgeUserData(db, userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new Error('ID de usuario inválido');
  }

  const ownTickets = db.prepare('SELECT id FROM tickets WHERE created_by = ?').all(uid);
  for (const ticket of ownTickets) deleteTicketWithChildren(db, ticket.id);

  const linkedTasks = db.prepare(
    'SELECT id FROM ticket_tasks WHERE created_by = ? OR assigned_to = ?',
  ).all(uid, uid);
  for (const task of linkedTasks) deleteTaskWithChildren(db, task.id);

  const ticketAttachments = db.prepare('SELECT id, path FROM ticket_attachments WHERE uploaded_by = ?').all(uid);
  for (const att of ticketAttachments) {
    safeUnlink(att.path);
    db.prepare('DELETE FROM ticket_attachments WHERE id = ?').run(att.id);
  }

  db.prepare('DELETE FROM ticket_comments WHERE user_id = ?').run(uid);
  db.prepare('DELETE FROM ticket_history WHERE user_id = ?').run(uid);
  db.prepare('UPDATE tickets SET assigned_to = NULL WHERE assigned_to = ?').run(uid);

  const ownGroups = db.prepare('SELECT id FROM workgroups WHERE created_by = ?').all(uid);
  for (const group of ownGroups) deleteWorkgroupWithChildren(db, group.id);

  const userMessages = db.prepare('SELECT id, file_url FROM workgroup_messages WHERE user_id = ?').all(uid);
  for (const message of userMessages) {
    safeUnlinkStoredFile(message.file_url);
    db.prepare('DELETE FROM forum_message_reads WHERE message_id = ?').run(message.id);
    db.prepare('DELETE FROM workgroup_messages WHERE id = ?').run(message.id);
  }

  db.prepare('DELETE FROM forum_message_reads WHERE user_id = ?').run(uid);
  db.prepare('DELETE FROM forum_join_requests WHERE user_id = ?').run(uid);

  const ownMeetings = db.prepare('SELECT id FROM meetings WHERE created_by = ?').all(uid);
  for (const meeting of ownMeetings) deleteMeetingWithChildren(db, meeting.id);

  const ownMinutes = db.prepare('SELECT id FROM meeting_minutes WHERE created_by = ?').all(uid);
  for (const minute of ownMinutes) deleteMinuteWithAudio(db, minute.id);

  db.prepare('DELETE FROM meeting_rsvps WHERE user_id = ?').run(uid);
  removeUserIdFromJsonArrays(db, 'meetings', 'attendees', uid);
  removeUserIdFromJsonArrays(db, 'meeting_minutes', 'attendees_json', uid);

  db.prepare('DELETE FROM avisos WHERE created_by = ? OR target_user_id = ?').run(uid, uid);
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(uid);
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(uid);
  db.prepare('DELETE FROM voice_phrase_memory WHERE user_id = ?').run(uid);
  db.prepare('DELETE FROM voice_command_log WHERE user_id = ?').run(uid);

  removeUserFromWorkgroupAccess(db, uid);

  const deleted = db.prepare('DELETE FROM users WHERE id = ?').run(uid);
  if (!deleted.changes) {
    throw new Error('Usuario no encontrado');
  }

  return { deletedUserId: uid };
}

function createPurgeUserTransaction(db) {
  return db.transaction((userId) => purgeUserData(db, userId));
}

module.exports = {
  purgeUserData,
  createPurgeUserTransaction,
  deleteMeetingWithChildren,
  cleanupOrphanedMeetingMinutes,
};
