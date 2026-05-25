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
