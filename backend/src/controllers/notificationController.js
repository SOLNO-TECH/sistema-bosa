const { getDb } = require('../database/init');

const getNotifications = (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const onlyUnread = req.query.unread === '1';

    const db = getDb();
    const where = onlyUnread ? 'WHERE user_id = ? AND is_read = 0' : 'WHERE user_id = ?';
    const rows = db.prepare(`
      SELECT id, type, title, message, module, related_id, is_read, created_at
      FROM notifications
      ${where}
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit);

    res.json(rows);
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
};

const getUnreadCount = (req, res) => {
  try {
    const userId = req.user.id;
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0').get(userId);
    res.json({ count: row?.c || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Error al contar notificaciones' });
  }
};

const markAsRead = (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const db = getDb();
    const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ message: 'Marcada como leída' });
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
};

const markAllAsRead = (req, res) => {
  try {
    const userId = req.user.id;
    const db = getDb();
    const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(userId);
    res.json({ message: 'Todas marcadas como leídas', updated: result.changes });
  } catch (err) {
    res.status(500).json({ error: 'Error al marcar todas' });
  }
};

const deleteNotification = (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const db = getDb();
    const result = db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(id, userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ message: 'Eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
};

const deleteAllRead = (req, res) => {
  try {
    const userId = req.user.id;
    const db = getDb();
    const result = db.prepare('DELETE FROM notifications WHERE user_id = ? AND is_read = 1').run(userId);
    res.json({ message: 'Notificaciones leídas eliminadas', deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
};
