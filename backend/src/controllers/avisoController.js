const { getDb } = require('../database/init');
const { sendAvisoNotification } = require('../services/emailService');
const { notifyUsers } = require('../services/notificationService');
const {
  canCreateAviso,
  resolveAvisoRecipientIds,
  userCanSeeAviso,
  formatAvisoDestinatarios,
  normalizeAvisoInput,
} = require('../utils/avisoTargeting');

const getAvisos = (req, res) => {
  try {
    const db = getDb();
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const avisos = db
      .prepare(
        'SELECT a.*, u.name as creator_name, u.apellido as creator_apellido, u.avatar_url as creator_avatar_url, u.puesto as creator_puesto FROM avisos a LEFT JOIN users u ON a.created_by = u.id ORDER BY a.id DESC'
      )
      .all()
      .filter((aviso) => userCanSeeAviso(db, userId, aviso))
      .map((aviso) => ({
        ...aviso,
        destinatarios: formatAvisoDestinatarios(db, aviso),
      }));

    res.json(avisos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener avisos' });
  }
};

const createAviso = (req, res) => {
  try {
    if (!canCreateAviso(req.user)) {
      return res.status(403).json({ error: 'No tienes permiso para publicar avisos' });
    }

    const { title, content, category } = req.body;
    const created_by = req.user?.id;
    if (!created_by) return res.status(401).json({ error: 'No autenticado' });
    if (!title || !content) return res.status(400).json({ error: 'Título y contenido son requeridos' });

    const targeting = normalizeAvisoInput(req.body);
    if (targeting.error) return res.status(400).json({ error: targeting.error });

    const db = getDb();

    if (targeting.tipo === 'foro') {
      const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(targeting.target_forum_id);
      if (!group) return res.status(400).json({ error: 'Foro no encontrado' });
    }

    if (targeting.tipo === 'individual') {
      const target = db
        .prepare('SELECT id FROM users WHERE id = ? AND is_active = 1')
        .get(targeting.target_user_id);
      if (!target) return res.status(400).json({ error: 'Usuario destinatario no encontrado' });
    }

    const info = db
      .prepare(
        `
      INSERT INTO avisos (
        title, content, category, created_by,
        tipo, target_forum_id, target_user_id, target_departments
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        title,
        content,
        category || 'normal',
        created_by,
        targeting.tipo,
        targeting.target_forum_id,
        targeting.target_user_id,
        targeting.target_departments
      );

    const avisoId = info.lastInsertRowid;
    const aviso = db.prepare('SELECT * FROM avisos WHERE id = ?').get(avisoId);
    const recipientIds = resolveAvisoRecipientIds(db, aviso);

    if (recipientIds.length) {
      const users = db
        .prepare(
          `SELECT id, name, email FROM users WHERE is_active = 1 AND id IN (${recipientIds.map(() => '?').join(',')})`
        )
        .all(...recipientIds);

      users.forEach((user) => {
        if (user.id !== created_by) {
          sendAvisoNotification(user.name, user.email, { title, content });
        }
      });
    }

    notifyUsers(
      recipientIds,
      {
        type: 'aviso',
        title: `Nuevo aviso: ${title}`,
        message: content.length > 140 ? `${content.slice(0, 137)}…` : content,
        module: 'avisos',
        related_id: avisoId,
      },
      created_by
    );

    res.status(201).json({
      id: avisoId,
      message: 'Aviso creado exitosamente',
      tipo: targeting.tipo,
      destinatarios: formatAvisoDestinatarios(db, aviso),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear aviso' });
  }
};

const deleteAviso = (req, res) => {
  try {
    if (!canCreateAviso(req.user)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar avisos' });
    }

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
  deleteAviso,
};
