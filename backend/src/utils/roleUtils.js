const { getDb } = require('../database/init');

const LEGACY_LEVEL = {
  superadmin: 'superadmin',
  administrator: 'administrator',
  manager: 'manager',
};

function getRoleMeta(db, slug) {
  const s = String(slug || '').trim();
  if (!s) return { slug: '', label: '', permission_level: 'user', is_system: 0 };
  const row = db.prepare(`
    SELECT slug, label, permission_level, is_system
    FROM catalog_roles
    WHERE slug = ? AND (is_active IS NULL OR is_active = 1)
  `).get(s);
  if (row) return row;
  if (LEGACY_LEVEL[s]) {
    return {
      slug: s,
      label: s === 'superadmin' ? 'Super Administrador' : s === 'manager' ? 'Gerente' : 'Administrador',
      permission_level: LEGACY_LEVEL[s],
      is_system: 1,
    };
  }
  return { slug: s, label: s, permission_level: 'user', is_system: 0 };
}

function getPermissionLevel(db, slug) {
  return getRoleMeta(db, slug).permission_level;
}

function isSuperadminLevel(level) {
  return level === 'superadmin';
}

function isAdminLevel(level) {
  return level === 'superadmin' || level === 'administrator';
}

function isManagerLevel(level) {
  return level === 'manager';
}

function roleRequiresDepartment(db, slug) {
  return isManagerLevel(getPermissionLevel(db, slug));
}

function userIsSuperadmin(user, db = null) {
  const level = user?.permission_level || (db ? getPermissionLevel(db, user?.role) : LEGACY_LEVEL[user?.role]);
  return isSuperadminLevel(level);
}

function userIsAdmin(user, db = null) {
  const level = user?.permission_level || (db ? getPermissionLevel(db, user?.role) : LEGACY_LEVEL[user?.role]);
  return isAdminLevel(level);
}

function userIsManager(user, db = null) {
  const level = user?.permission_level || (db ? getPermissionLevel(db, user?.role) : LEGACY_LEVEL[user?.role]);
  return isManagerLevel(level);
}

function enrichUserWithPermissionLevel(db, userRow) {
  if (!userRow) return userRow;
  return {
    ...userRow,
    permission_level: getPermissionLevel(db, userRow.role),
  };
}

function roleSlugExists(db, slug) {
  const s = String(slug || '').trim();
  if (!s) return false;
  const inCatalog = db.prepare('SELECT 1 FROM catalog_roles WHERE slug = ? AND (is_active IS NULL OR is_active = 1)').get(s);
  if (inCatalog) return true;
  return Object.prototype.hasOwnProperty.call(LEGACY_LEVEL, s);
}

module.exports = {
  getRoleMeta,
  getPermissionLevel,
  isSuperadminLevel,
  isAdminLevel,
  isManagerLevel,
  roleRequiresDepartment,
  userIsSuperadmin,
  userIsAdmin,
  userIsManager,
  enrichUserWithPermissionLevel,
  roleSlugExists,
};
