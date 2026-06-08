const { getForumMemberIds } = require('./forumAccess');

const VALID_TIPOS = new Set(['departamento', 'foro', 'individual']);

function parseDepartments(raw) {
  if (Array.isArray(raw)) return raw.map((d) => String(d).trim()).filter(Boolean);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((d) => String(d).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function isAvisoManager(role) {
  return role === 'superadmin' || role === 'administrator' || role === 'manager';
}

function canCreateAviso(user) {
  if (!user) return false;
  const level =
    user.permission_level ||
    (user.role === 'superadmin'
      ? 'superadmin'
      : user.role === 'administrator'
        ? 'administrator'
        : user.role === 'manager'
          ? 'manager'
          : 'user');
  return level === 'superadmin' || level === 'administrator' || level === 'manager';
}

function resolveAvisoRecipientIds(db, aviso) {
  const tipo = aviso.tipo || null;
  let ids = [];

  if (tipo === 'individual' && aviso.target_user_id) {
    ids = [Number(aviso.target_user_id)];
  } else if (tipo === 'departamento') {
    const depts = parseDepartments(aviso.target_departments);
    if (depts.length) {
      const placeholders = depts.map(() => '?').join(',');
      ids = db
        .prepare(
          `SELECT id FROM users WHERE is_active = 1 AND trim(departamento) IN (${placeholders})`
        )
        .all(...depts)
        .map((r) => r.id);
    }
  } else if (tipo === 'foro' && aviso.target_forum_id) {
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(aviso.target_forum_id);
    ids = getForumMemberIds(db, group, null);
  }

  return [...new Set(ids.filter((id) => id && !Number.isNaN(id)))];
}

function userCanSeeAviso(db, userId, aviso) {
  const u = db.prepare('SELECT id, role FROM users WHERE id = ? AND is_active = 1').get(userId);
  if (!u) return false;
  if (Number(aviso.created_by) === Number(userId)) return true;
  if (isAvisoManager(u.role)) return true;

  const tipo = aviso.tipo || null;
  if (!tipo || !VALID_TIPOS.has(tipo)) return false;

  return resolveAvisoRecipientIds(db, aviso).some((id) => Number(id) === Number(userId));
}

function formatAvisoDestinatarios(db, aviso) {
  const tipo = aviso.tipo || null;
  if (tipo === 'individual' && aviso.target_user_id) {
    const u = db.prepare('SELECT name, apellido FROM users WHERE id = ?').get(aviso.target_user_id);
    return [u ? `${u.name} ${u.apellido || ''}`.trim() : 'Usuario'];
  }
  if (tipo === 'foro' && aviso.target_forum_id) {
    const g = db.prepare('SELECT name FROM workgroups WHERE id = ?').get(aviso.target_forum_id);
    return [`Foro: ${g?.name || 'desconocido'}`];
  }
  if (tipo === 'departamento') {
    const depts = parseDepartments(aviso.target_departments);
    return depts.length ? depts : [];
  }
  return [];
}

function normalizeAvisoInput(body) {
  const tipo = String(body.tipo || 'departamento').trim();
  if (!VALID_TIPOS.has(tipo)) {
    return { error: 'Tipo de destinatario inválido' };
  }

  if (tipo === 'foro') {
    const target_forum_id = Number(body.foroId || body.target_forum_id);
    if (!target_forum_id) return { error: 'Selecciona un foro' };
    return { tipo, target_forum_id, target_user_id: null, target_departments: '[]' };
  }

  if (tipo === 'individual') {
    const target_user_id = Number(body.usuarioId || body.target_user_id);
    if (!target_user_id) return { error: 'Selecciona un usuario' };
    return { tipo, target_forum_id: null, target_user_id, target_departments: '[]' };
  }

  const depts = Array.isArray(body.departamentos)
    ? body.departamentos
    : Array.isArray(body.target_departments)
      ? body.target_departments
      : [];
  const cleaned = depts.map((d) => String(d).trim()).filter(Boolean);
  if (!cleaned.length) return { error: 'Selecciona al menos un departamento' };
  return {
    tipo,
    target_forum_id: null,
    target_user_id: null,
    target_departments: JSON.stringify(cleaned),
  };
}

module.exports = {
  VALID_TIPOS,
  parseDepartments,
  isAvisoManager,
  canCreateAviso,
  resolveAvisoRecipientIds,
  userCanSeeAviso,
  formatAvisoDestinatarios,
  normalizeAvisoInput,
};
