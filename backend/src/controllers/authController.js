const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');

// Secreto para refresh tokens (separado del access para defensa en profundidad)
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + '-refresh');

const signTokens = (user) => {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    getRefreshSecret(),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  return { accessToken, refreshToken, payload };
};

function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Credenciales incorrectas.' });
  }

  const { accessToken, refreshToken, payload } = signTokens(user);

  const userProfile = buildUserProfile(user);

  return res.json({
    token: accessToken,        // backwards compat
    accessToken,
    refreshToken,
    user: userProfile,
  });
}

function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'refreshToken es requerido.' });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, getRefreshSecret());
  } catch {
    return res.status(401).json({ message: 'Refresh token inválido o expirado.' });
  }

  if (payload.type !== 'refresh') {
    return res.status(401).json({ message: 'Tipo de token incorrecto.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.id);
  if (!user) {
    return res.status(401).json({ message: 'Usuario no encontrado o inactivo.' });
  }

  const { accessToken, refreshToken: newRefresh } = signTokens(user);

  const userProfile = buildUserProfile(user);

  return res.json({
    token: accessToken,
    accessToken,
    refreshToken: newRefresh,
    user: userProfile,
  });
}

function buildUserProfile(user) {
  return {
    id: user.id,
    name: user.name,
    apellido: user.apellido || '',
    email: user.email,
    role: user.role,
    departamento: user.departamento || '',
    puesto: user.puesto || '',
    avatar_url: user.avatar_url || '',
  };
}

function me(req, res) {
  const db = getDb();
  const user = db.prepare(
    `SELECT id, name, apellido, email, role, departamento, puesto, telefono, avatar_url, is_active, created_at FROM users WHERE id = ?`
  ).get(req.user.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
  return res.json({ user: buildUserProfile(user) });
}

function uploadAvatar(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen (JPG, PNG o WebP).' });
    const db = getDb();
    const avatar_url = `/api/uploads/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar_url = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      avatar_url,
      req.user.id
    );
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    return res.json({ message: 'Foto actualizada', user: buildUserProfile(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo guardar la foto de perfil' });
  }
}

function getUsers(req, res) {
  const db = getDb();
  const users = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC').all();
  return res.json({ users });
}

function createUser(req, res) {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Todos los campos son requeridos.' });
  }

  if (!['superadmin', 'administrator', 'manager'].includes(role)) {
    return res.status(400).json({ message: 'Rol inválido.' });
  }

  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (exists) {
    return res.status(409).json({ message: 'El email ya está registrado.' });
  }

  const hashed = bcrypt.hashSync(password, 12);
  const result = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), email.toLowerCase().trim(), hashed, role);

  const newUser = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json({ user: newUser });
}

function toggleUser(req, res) {
  const { id } = req.params;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(user.is_active ? 0 : 1, id);
  return res.json({ message: `Usuario ${user.is_active ? 'desactivado' : 'activado'}.` });
}

module.exports = { login, refresh, me, uploadAvatar, getUsers, createUser, toggleUser };
