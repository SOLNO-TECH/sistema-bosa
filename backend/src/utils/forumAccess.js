/** Acceso a grupos de foro (compartido por rutas y notificaciones). */

function parseAccessList(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function userIdInAccessList(list, userId) {
  const uid = Number(userId);
  return list.some((x) => Number(x) === uid);
}

function userHasAccessToGroup(db, userId, group) {
  if (!group) return false;
  const u = db.prepare('SELECT id, role, departamento FROM users WHERE id = ?').get(userId);
  if (!u) return false;

  if (Number(group.created_by) === Number(u.id)) return true;
  if (u.role === 'superadmin') return true;

  const extraAllowed = parseAccessList(group.extra_allowed_user_ids);
  if (userIdInAccessList(extraAllowed, u.id)) return true;

  const accessType = group.access_type || 'all';
  const list = parseAccessList(group.access_list);

  if (accessType === 'all') return true;
  if (accessType === 'department') return !!u.departamento && list.includes(u.departamento);
  if (accessType === 'users') return userIdInAccessList(list, u.id);
  return false;
}

function getForumMemberIds(db, group, excludeUserId = null) {
  if (!group) return [];
  const active = db.prepare('SELECT id FROM users WHERE is_active = 1').all();
  const ids = active
    .filter((u) => userHasAccessToGroup(db, u.id, group))
    .map((u) => u.id);
  if (excludeUserId != null) {
    const ex = Number(excludeUserId);
    return ids.filter((id) => Number(id) !== ex);
  }
  return ids;
}

module.exports = {
  parseAccessList,
  userIdInAccessList,
  userHasAccessToGroup,
  getForumMemberIds,
};
