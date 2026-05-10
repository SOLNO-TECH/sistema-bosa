// Helper para crear notificaciones internas del sistema
const { getDb } = require('../database/init');

/**
 * Crea una notificación para un usuario individual.
 * Falla silenciosamente si el usuario no existe (no rompe el flujo principal).
 */
function notifyUser(userId, { type = 'system', title, message, module = null, related_id = null }) {
  if (!userId || !title || !message) return null;
  try {
    const db = getDb();
    // Validar que el usuario exista y esté activo
    const u = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(userId);
    if (!u) return null;

    const info = db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, module, related_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, type, title, message, module, related_id);
    return info.lastInsertRowid;
  } catch (err) {
    console.warn('notifyUser falló:', err.message);
    return null;
  }
}

/**
 * Notifica a múltiples usuarios. Útil para avisos generales y reuniones.
 * Permite excluir IDs (ej. al propio creador del aviso).
 */
function notifyUsers(userIds, payload, excludeId = null) {
  if (!Array.isArray(userIds) || userIds.length === 0) return 0;
  let count = 0;
  for (const uid of userIds) {
    if (excludeId && uid === excludeId) continue;
    if (notifyUser(uid, payload)) count++;
  }
  return count;
}

/**
 * Notifica a TODOS los usuarios activos del sistema (excluyendo el id dado).
 */
function notifyAllActive(payload, excludeId = null) {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT id FROM users WHERE is_active = 1').all();
    return notifyUsers(rows.map(r => r.id), payload, excludeId);
  } catch (err) {
    console.warn('notifyAllActive falló:', err.message);
    return 0;
  }
}

module.exports = { notifyUser, notifyUsers, notifyAllActive };
