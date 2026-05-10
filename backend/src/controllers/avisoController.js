const { getDb } = require('../database/init');
const { sendAvisoNotification } = require('../services/emailService');
const { notifyAllActive } = require('../services/notificationService');

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
    const { title, content, category } = req.body;
    // created_by siempre desde el token, no del body (evita suplantación)
    const created_by = req.user?.id;
    if (!created_by) return res.status(401).json({ error: 'No autenticado' });
    if (!title || !content) return res.status(400).json({ error: 'Título y contenido son requeridos' });

    const db = getDb();

    const stmt = db.prepare(`
      INSERT INTO avisos (title, content, category, created_by)
      VALUES (?, ?, ?, ?)
    `);

    const info = stmt.run(title, content, category || 'general', created_by);
    const avisoId = info.lastInsertRowid;

    // Notify all active users (correo + notificación interna), excluyendo al autor
    const users = db.prepare('SELECT id, name, email FROM users WHERE is_active = 1').all();
    users.forEach(user => {
      if (user.id !== created_by) {
        sendAvisoNotification(user.name, user.email, { title, content });
      }
    });
    notifyAllActive({
      type: 'aviso',
      title: `Nuevo aviso: ${title}`,
      message: content.length > 140 ? content.slice(0, 137) + '…' : content,
      module: 'avisos',
      related_id: avisoId,
    }, created_by);

    res.status(201).json({ id: avisoId, message: 'Aviso creado exitosamente' });
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
