function resolvePermissionLevel(user) {
  if (!user) return 'user';
  if (user.permission_level) return user.permission_level;
  if (user.role === 'superadmin') return 'superadmin';
  if (user.role === 'administrator') return 'administrator';
  if (user.role === 'manager') return 'manager';
  return 'user';
}

function isSuperadminUser(user) {
  return resolvePermissionLevel(user) === 'superadmin';
}

function canManageMeetingMinute(user, meeting) {
  if (!user || !meeting) return false;
  if (isSuperadminUser(user)) return true;
  return Number(meeting.created_by) === Number(user.id);
}

function canManageMeetingMinuteById(db, user, meetingId) {
  if (!user) return false;
  if (isSuperadminUser(user)) return true;
  const id = Number(meetingId);
  if (!id) return false;
  const meeting = db.prepare('SELECT id, created_by FROM meetings WHERE id = ?').get(id);
  return canManageMeetingMinute(user, meeting);
}

module.exports = {
  canManageMeetingMinute,
  canManageMeetingMinuteById,
  isSuperadminUser,
};
