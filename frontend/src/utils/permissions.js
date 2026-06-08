/** Permisos en frontend según permission_level (compatible con sesiones antiguas). */
function resolveLevel(user) {
  if (!user) return 'user';
  if (user.permission_level) return user.permission_level;
  if (user.role === 'superadmin') return 'superadmin';
  if (user.role === 'administrator') return 'administrator';
  if (user.role === 'manager') return 'manager';
  return 'user';
}

export function isSuperadminUser(user) {
  return resolveLevel(user) === 'superadmin';
}

export function isAdminUser(user) {
  const l = resolveLevel(user);
  return l === 'superadmin' || l === 'administrator';
}

export function isManagerUser(user) {
  return resolveLevel(user) === 'manager';
}

export function canManageDeptAsManager(user, department) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (!isManagerUser(user)) return false;
  const dept = String(department || '').trim();
  const userDept = (user.departamento || '').trim();
  return Boolean(dept && userDept === dept);
}

export function canCreateStandaloneTask(user) {
  if (!user) return false;
  const l = resolveLevel(user);
  return l === 'superadmin' || l === 'administrator' || l === 'manager';
}

/** Crear o editar minuta de una reunión: solo organizador o superadmin. */
export function canManageMeetingMinute(user, meeting) {
  if (!user || !meeting) return false;
  if (isSuperadminUser(user)) return true;
  return Number(meeting.created_by) === Number(user.id);
}
