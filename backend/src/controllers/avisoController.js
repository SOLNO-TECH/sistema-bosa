const { getDb } = require('../database/init');
const { sendAvisoNotification } = require('../services/emailService');

const getAvisos = (req, res) => {
  try {
    const db = getDb();
    const avisos = db.prepare('SELECT a.*, u.name as creator_name FROM avisos a LEFT JOIN users u ON a.created_by = u.id ORDER BY a.id DESC').all();
    res.json(avisos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener avisos' });
  }
};

const createAviso = (req, res) => {
  try {
    const { title, content, category, created_by } = req.body;
    const db = getDb();
    
    const stmt = db.prepare(`
      INSERT INTO avisos (title, content, category, created_by)
      VALUES (?, ?, ?, ?)
    `);
    
    const info = stmt.run(title, content, category || 'general', created_by);

    // Notify all active users (or a specific group if needed, here we notify all)
    const users = db.prepare('SELECT name, email FROM users WHERE is_active = 1').all();
    users.forEach(user => {
      sendAvisoNotification(user.name, user.email, { title, content });
    });

    res.status(201).json({ id: info.lastInsertRowid, message: 'Aviso creado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear aviso' });
  }
};

const deleteAviso = (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    db.prepare('DELETE FROM avisos WHERE id = ?').run(id);
    res.json({ message: 'Aviso eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar aviso' });
  }
};

module.exports = {
  getAvisos,
  createAviso,
  deleteAviso
};
