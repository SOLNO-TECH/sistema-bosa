const { getForumMemberIds } = require('./forumAccess');

function markForumMessagesRead(db, groupId, viewerId) {
  db.prepare(
    `
    INSERT OR IGNORE INTO forum_message_reads (message_id, user_id, read_at)
    SELECT m.id, ?, datetime('now')
    FROM workgroup_messages m
    WHERE m.workgroup_id = ? AND m.user_id != ?
  `
  ).run(viewerId, groupId, viewerId);
}

function fetchReadsForMessages(db, messageIds) {
  if (!messageIds.length) return {};
  const placeholders = messageIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `
    SELECT r.message_id, r.user_id, r.read_at, u.name AS user_name, u.apellido AS user_apellido
    FROM forum_message_reads r
    JOIN users u ON u.id = r.user_id
    WHERE r.message_id IN (${placeholders})
    ORDER BY r.read_at ASC
  `
    )
    .all(...messageIds);

  const byMessage = {};
  for (const row of rows) {
    if (!byMessage[row.message_id]) byMessage[row.message_id] = [];
    byMessage[row.message_id].push({
      user_id: row.user_id,
      user_name: row.user_name,
      user_apellido: row.user_apellido || '',
      read_at: row.read_at,
    });
  }
  return byMessage;
}

function computeReadStatus(readBy, audienceCount) {
  if (audienceCount <= 0) return 'sent';
  if (!readBy.length) return 'sent';
  if (readBy.length < audienceCount) return 'delivered';
  return 'read';
}

function enrichMessagesWithReadReceipts(db, group, messages) {
  if (!messages.length) return messages;
  const readsByMessage = fetchReadsForMessages(
    db,
    messages.map((m) => m.id)
  );

  return messages.map((m) => {
    const audienceCount = getForumMemberIds(db, group, m.user_id).length;
    const read_by = (readsByMessage[m.id] || []).filter(
      (r) => Number(r.user_id) !== Number(m.user_id)
    );
    const read_status = computeReadStatus(read_by, audienceCount);
    return { ...m, read_by, read_status, audience_count: audienceCount };
  });
}

module.exports = {
  markForumMessagesRead,
  enrichMessagesWithReadReceipts,
};
