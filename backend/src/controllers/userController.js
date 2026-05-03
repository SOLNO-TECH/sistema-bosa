const { getDb } = require('../database/init');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../services/emailService');

const getUsers = (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT id, name, apellido, email, telefono, departamento, puesto, role, is_active, created_at, updated_at FROM users ORDER BY id DESC').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

const createUser = (req, res) => {
  try {
    const { name, apellido, email, telefono, departamento, puesto, role, password } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Campos requeridos faltantes (nombre, correo, rol, contraseña)' });
    }

    const db = getDb();
    
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) return res.status(400).json({ error: 'El correo ya está en uso' });

    const hashed = bcrypt.hashSync(password, 12);
    const stmt = db.prepare(`
      INSERT INTO users (name, apellido, email, telefono, departamento, puesto, role, password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(name, apellido || '', email, telefono || '', departamento || '', puesto || '', role, hashed);
    
    // Send welcome email in background (no await so it doesn't block response, or await it if preferred. Let's not block)
    sendWelcomeEmail(name, email, password, role);

    res.status(201).json({ id: info.lastInsertRowid, message: 'Usuario creado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

const updateUser = (req, res) => {
  try {
    const { id } = req.params;
    const { name, apellido, email, telefono, departamento, puesto, role, is_active } = req.body;
    const db = getDb();

    if (email) {
      const exists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
      if (exists) return res.status(400).json({ error: 'El correo ya está en uso por otro usuario' });
    }

    const stmt = db.prepare(`
      UPDATE users SET 
        name = COALESCE(?, name),
        apellido = COALESCE(?, apellido),
        email = COALESCE(?, email),
        telefono = COALESCE(?, telefono),
        departamento = COALESCE(?, departamento),
        puesto = COALESCE(?, puesto),
        role = COALESCE(?, role),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `);
    
    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : null;
    stmt.run(name, apellido, email, telefono, departamento, puesto, role, activeVal, id);
    res.json({ message: 'Usuario actualizado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

const deleteUser = (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

const changePassword = (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password) return res.status(400).json({ error: 'Nueva contraseña es requerida' });

    const db = getDb();
    const hashed = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, id);
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  changePassword
};
