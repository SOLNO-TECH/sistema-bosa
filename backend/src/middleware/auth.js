const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');
const { getPermissionLevel } = require('../utils/roleUtils');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token de acceso requerido.' });
  }

  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }

  // Solo aceptar tokens de acceso (no de refresh)
  if (payload.type === 'refresh') {
    return res.status(401).json({ message: 'Tipo de token incorrecto.' });
  }

  // Verificar que el usuario sigue existiendo y activo
  try {
    const db = getDb();
    const dbUser = db.prepare('SELECT id, name, apellido, email, role, departamento, puesto, avatar_url, is_active FROM users WHERE id = ?').get(payload.id);
    if (!dbUser || !dbUser.is_active) {
      return res.status(401).json({ message: 'Cuenta inactiva o eliminada.' });
    }
    // Usar datos frescos (rol / departamento pueden haber cambiado)
    req.user = {
      id: dbUser.id,
      name: dbUser.name,
      apellido: dbUser.apellido || '',
      email: dbUser.email,
      role: dbUser.role,
      permission_level: getPermissionLevel(db, dbUser.role),
      departamento: dbUser.departamento || '',
      puesto: dbUser.puesto || '',
      avatar_url: dbUser.avatar_url || '',
    };
  } catch (err) {
    console.error('authenticate DB error:', err);
    return res.status(500).json({ message: 'Error interno al validar sesión.' });
  }

  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'No tienes permisos para esta acción.' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
