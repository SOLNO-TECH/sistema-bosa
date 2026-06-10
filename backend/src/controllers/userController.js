const { getDb } = require('../database/init');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../services/emailService');
const { roleSlugExists, roleRequiresDepartment } = require('../utils/roleUtils');
const { createPurgeUserTransaction } = require('../utils/purgeUserData');

const getUsers = (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT id, name, apellido, email, telefono, departamento, puesto, role, avatar_url, is_active, created_at, updated_at FROM users ORDER BY id DESC').all();
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

    if (roleRequiresDepartment(db, role) && !(departamento && String(departamento).trim())) {
      return res.status(400).json({ error: 'Este rol debe tener un departamento asignado.' });
    }

    if (!roleSlugExists(db, role)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }

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

    const current = db.prepare('SELECT role, departamento FROM users WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Usuario no encontrado' });

    const newRole = role != null && role !== '' ? role : current.role;
    const newDept =
      departamento !== undefined && departamento !== null
        ? String(departamento)
        : current.departamento || '';
    if (roleRequiresDepartment(db, newRole) && !newDept.trim()) {
      return res.status(400).json({ error: 'Este rol debe tener un departamento asignado.' });
    }

    if (email) {
      const exists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
      if (exists) return res.status(400).json({ error: 'El correo ya está en uso por otro usuario' });
    }

    if (role != null && role !== '' && !roleSlugExists(db, role)) {
      return res.status(400).json({ error: 'Rol no válido' });
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
    const targetId = parseInt(req.params.id, 10);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    const actorId = Number(req.user?.id);
    if (actorId === targetId) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde aquí.' });
    }

    const db = getDb();
    const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(targetId);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (target.role === 'superadmin') {
      const superadminCount = db.prepare(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'superadmin'",
      ).get().count;
      if (superadminCount <= 1) {
        return res.status(400).json({ error: 'No puedes eliminar el último superadministrador.' });
      }
    }

    const purgeUser = createPurgeUserTransaction(db);
    purgeUser(targetId);

    res.json({
      message: 'Usuario eliminado exitosamente junto con su información vinculada.',
    });
  } catch (err) {
    console.error('deleteUser:', err);
    if (err?.message === 'Usuario no encontrado') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

const changePassword = (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const targetId = parseInt(id, 10);

    if (!password) return res.status(400).json({ error: 'Nueva contraseña es requerida' });
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Solo el propio usuario o un superadmin pueden cambiar la contraseña
    const isOwner    = req.user?.id === targetId;
    const isSuperAdm = req.user?.role === 'superadmin';
    if (!isOwner && !isSuperAdm) {
      return res.status(403).json({ error: 'No tienes permisos para cambiar esta contraseña' });
    }

    const db = getDb();
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
    if (!exists) return res.status(404).json({ error: 'Usuario no encontrado' });

    const hashed = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, targetId);
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (err) {
    console.error(err);
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
