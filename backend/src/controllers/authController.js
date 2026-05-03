const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');

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

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const secret = process.env.JWT_SECRET || 'bosa-default-secret-key-change-me-in-prod';
  const expires = process.env.JWT_EXPIRES_IN || '24h';

  const token = jwt.sign(payload, secret, {
    expiresIn: expires,
  });

  return res.json({
    token,
    user: payload,
  });
}

function me(req, res) {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
  return res.json({ user });
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

  if (!['superadmin', 'administrator'].includes(role)) {
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

module.exports = { login, me, getUsers, createUser, toggleUser };
