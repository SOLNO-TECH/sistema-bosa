const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate } = require('../middleware/auth');
const { fileFilter } = require('../middleware/uploadFilter');
const { notifyUser } = require('../services/notificationService');
const {
  parseAccessList,
  userHasAccessToGroup,
} = require('../utils/forumAccess');
const { notifyForumGroup } = require('../utils/participantNotify');
const {
  markForumMessagesRead,
  enrichMessagesWithReadReceipts,
} = require('../utils/forumMessageReads');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../data/uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Todas las rutas de foros requieren autenticación
router.use(authenticate);

function canManageJoinRequests(db, userId, role, group) {
  if (!group) return false;
  if (role === 'superadmin') return true;
  return Number(group.created_by) === Number(userId);
}

// Listar todos los grupos (comunidad); el cliente usa has_access / pending_join_request
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const groups = db.prepare('SELECT * FROM workgroups ORDER BY created_at DESC').all();
    const pendingStmt = db.prepare(
      'SELECT id FROM forum_join_requests WHERE workgroup_id = ? AND user_id = ? AND status = ?'
    );
    const payload = groups.map((g) => ({
      ...g,
      has_access: userHasAccessToGroup(db, userId, g),
      pending_join_request: !!pendingStmt.get(g.id, userId, 'pending'),
    }));
    res.json(payload);
  } catch (error) {
    console.error('GET /forums error:', error);
    res.status(500).json({ error: 'Error al obtener grupos' });
  }
});

// Crear un nuevo grupo
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, description, access_type, access_list } = req.body;
    const created_by = req.user?.id;
    if (!created_by) return res.status(401).json({ error: 'No autenticado' });
    if (!name) return res.status(400).json({ error: 'Nombre del grupo requerido' });
    const stmt = db.prepare('INSERT INTO workgroups (name, description, created_by, access_type, access_list) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(name, description, created_by, access_type || 'all', JSON.stringify(access_list || []));
    const newGroup = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(info.lastInsertRowid);
    try {
      const creator = db.prepare('SELECT name FROM users WHERE id = ?').get(created_by);
      notifyForumGroup(db, newGroup, created_by, {
        type: 'forum',
        title: 'Nuevo foro de trabajo',
        message: `${creator?.name || 'Un usuario'} creó el foro «${name}».`,
        module: 'foro',
        related_id: newGroup.id,
      });
    } catch (_) { /* noop */ }
    res.json(newGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear grupo' });
  }
});

// Actualizar un grupo (solo creador o superadmin)
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    const isOwner = Number(group.created_by) === Number(userId);
    const isSuperAdmin = req.user.role === 'superadmin';
    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ error: 'Solo el creador del grupo o un Super Admin puede editarlo' });
    }

    const { name, description, access_type, access_list } = req.body;
    const stmt = db.prepare('UPDATE workgroups SET name = ?, description = ?, access_type = ?, access_list = ? WHERE id = ?');
    stmt.run(name, description, access_type || 'all', JSON.stringify(access_list || []), req.params.id);
    const updatedGroup = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    try {
      notifyForumGroup(db, updatedGroup, userId, {
        type: 'forum',
        title: 'Foro actualizado',
        message: `Se actualizó la configuración de «${name || updatedGroup.name}».`,
        module: 'foro',
        related_id: Number(req.params.id),
      });
    } catch (_) { /* noop */ }
    res.json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar grupo' });
  }
});

// Eliminar un grupo (solo creador o superadmin)
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    const isOwner = Number(group.created_by) === Number(userId);
    const isSuperAdmin = req.user.role === 'superadmin';
    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ error: 'Solo el creador del grupo o un Super Admin puede eliminarlo' });
    }

    try {
      notifyForumGroup(db, group, userId, {
        type: 'forum',
        title: 'Foro eliminado',
        message: `El foro «${group.name}» fue eliminado.`,
        module: 'foro',
        related_id: Number(req.params.id),
      });
    } catch (_) { /* noop */ }

    db.prepare('DELETE FROM forum_join_requests WHERE workgroup_id = ?').run(req.params.id);
    db.prepare(
      `DELETE FROM forum_message_reads WHERE message_id IN (SELECT id FROM workgroup_messages WHERE workgroup_id = ?)`
    ).run(req.params.id);
    db.prepare('DELETE FROM workgroup_messages WHERE workgroup_id = ?').run(req.params.id);
    db.prepare('DELETE FROM workgroups WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar grupo' });
  }
});

// Solicitar ingreso a un foro restringido (visible en la lista pero sin acceso)
router.post('/:id/join-request', (req, res) => {
  try {
    const db = getDb();
    const workgroupId = req.params.id;
    const userId = req.user.id;
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(workgroupId);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    const accessType = group.access_type || 'all';
    if (accessType === 'all') {
      return res.status(400).json({ error: 'Este foro es abierto; ya tienes acceso.' });
    }
    if (userHasAccessToGroup(db, userId, group)) {
      return res.status(400).json({ error: 'Ya eres parte de este foro.' });
    }

    const existing = db
      .prepare('SELECT * FROM forum_join_requests WHERE workgroup_id = ? AND user_id = ?')
      .get(workgroupId, userId);

    if (existing) {
      if (existing.status === 'pending') {
        return res.status(400).json({ error: 'Ya enviaste una solicitud pendiente.' });
      }
      db.prepare(
        `UPDATE forum_join_requests SET status = 'pending', created_at = datetime('now') WHERE id = ?`
      ).run(existing.id);
    } else {
      db.prepare(
        `INSERT INTO forum_join_requests (workgroup_id, user_id, status) VALUES (?, ?, 'pending')`
      ).run(workgroupId, userId);
    }

    const requester = db.prepare('SELECT name, apellido FROM users WHERE id = ?').get(userId);
    const who = requester ? `${requester.name} ${requester.apellido || ''}`.trim() : 'Un usuario';
    notifyUser(group.created_by, {
      type: 'forum',
      title: 'Solicitud para unirse al foro',
      message: `${who} quiere entrar a «${group.name}».`,
      module: 'foro',
      related_id: Number(workgroupId),
    });

    res.json({ ok: true, message: 'Solicitud enviada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar solicitud' });
  }
});

// Listar solicitudes pendientes (creador del foro o superadmin)
router.get('/:id/join-requests', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!canManageJoinRequests(db, req.user.id, req.user.role, group)) {
      return res.status(403).json({ error: 'No puedes gestionar solicitudes de este foro' });
    }

    const rows = db
      .prepare(`
        SELECT r.id, r.user_id, r.created_at, u.name, u.apellido, u.email, u.departamento, u.puesto
        FROM forum_join_requests r
        JOIN users u ON u.id = r.user_id
        WHERE r.workgroup_id = ? AND r.status = 'pending'
        ORDER BY r.created_at ASC
      `)
      .all(req.params.id);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar solicitudes' });
  }
});

router.post('/:id/join-requests/:requestId/approve', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!canManageJoinRequests(db, req.user.id, req.user.role, group)) {
      return res.status(403).json({ error: 'No puedes gestionar solicitudes de este foro' });
    }

    const reqRow = db
      .prepare(
        'SELECT * FROM forum_join_requests WHERE id = ? AND workgroup_id = ? AND status = ?'
      )
      .get(req.params.requestId, req.params.id, 'pending');
    if (!reqRow) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const extra = parseAccessList(group.extra_allowed_user_ids);
    const newId = Number(reqRow.user_id);
    if (!extra.some((x) => Number(x) === newId)) extra.push(newId);

    db.prepare('UPDATE workgroups SET extra_allowed_user_ids = ? WHERE id = ?').run(
      JSON.stringify(extra),
      req.params.id
    );
    db.prepare('DELETE FROM forum_join_requests WHERE id = ?').run(reqRow.id);

    notifyUser(newId, {
      type: 'forum',
      title: 'Acceso aceptado',
      message: `Te aceptaron en el foro «${group.name}».`,
      module: 'foro',
      related_id: Number(req.params.id),
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al aprobar solicitud' });
  }
});

router.post('/:id/join-requests/:requestId/reject', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!canManageJoinRequests(db, req.user.id, req.user.role, group)) {
      return res.status(403).json({ error: 'No puedes gestionar solicitudes de este foro' });
    }

    const reqRow = db
      .prepare(
        'SELECT * FROM forum_join_requests WHERE id = ? AND workgroup_id = ? AND status = ?'
      )
      .get(req.params.requestId, req.params.id, 'pending');
    if (!reqRow) return res.status(404).json({ error: 'Solicitud no encontrada' });

    db.prepare(`UPDATE forum_join_requests SET status = 'rejected' WHERE id = ?`).run(reqRow.id);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

// Obtener mensajes de un grupo (solo si el usuario tiene acceso)
router.get('/:id/messages', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!userHasAccessToGroup(db, req.user.id, group)) {
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    markForumMessagesRead(db, req.params.id, req.user.id);

    const messages = db.prepare(`
      SELECT m.*, u.name as user_name, u.role as user_role
      FROM workgroup_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.workgroup_id = ?
      ORDER BY m.created_at ASC
    `).all(req.params.id);

    res.json(enrichMessagesWithReadReceipts(db, group, messages));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Enviar un mensaje (solo si el usuario tiene acceso al grupo)
router.post('/:id/messages', upload.single('file'), (req, res) => {
  try {
    const db = getDb();
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });

    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!userHasAccessToGroup(db, user_id, group)) {
      // Si subió archivo pero no tiene acceso, intentar borrarlo del disco
      try {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch (_) {}
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    const { content } = req.body;
    let file_url = null;
    let file_name = null;
    if (req.file) {
      file_url = '/api/uploads/' + req.file.filename;
      file_name = req.file.originalname;
    }

    const stmt = db.prepare('INSERT INTO workgroup_messages (workgroup_id, user_id, content, file_url, file_name) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(req.params.id, user_id, content || '', file_url, file_name);

    const newMessage = db.prepare(`
      SELECT m.*, u.name as user_name, u.role as user_role
      FROM workgroup_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `).get(info.lastInsertRowid);

    try {
      const author = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      const preview = (content || file_name || 'Archivo adjunto').toString();
      const body = preview.length > 120 ? `${preview.slice(0, 117)}…` : preview;
      notifyForumGroup(db, group, user_id, {
        type: 'forum',
        title: `Mensaje en «${group.name}»`,
        message: `${author?.name || 'Alguien'}: ${body}`,
        module: 'foro',
        related_id: Number(req.params.id),
      });
    } catch (_) { /* noop */ }

    const [enriched] = enrichMessagesWithReadReceipts(db, group, [newMessage]);
    res.json(enriched || newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

const FORUM_MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

function stripForumRefTags(content) {
  return (content || '').replace(/\[\[BOSA-REF:(TICKET|MEETING):\d+\]\]/g, '').trim();
}

// Editar mensaje propio (ventana 15 min, como WhatsApp)
router.patch('/:id/messages/:messageId', (req, res) => {
  try {
    const db = getDb();
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });

    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!userHasAccessToGroup(db, user_id, group)) {
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    const message = db
      .prepare('SELECT * FROM workgroup_messages WHERE id = ? AND workgroup_id = ?')
      .get(req.params.messageId, req.params.id);
    if (!message) return res.status(404).json({ error: 'Mensaje no encontrado' });
    if (Number(message.user_id) !== Number(user_id)) {
      return res.status(403).json({ error: 'Solo puedes editar tus propios mensajes' });
    }

    const createdMs = new Date(message.created_at).getTime();
    if (Number.isNaN(createdMs) || Date.now() - createdMs > FORUM_MESSAGE_EDIT_WINDOW_MS) {
      return res.status(400).json({
        error: 'El tiempo para editar este mensaje ha expirado (15 minutos).',
      });
    }

    if (message.file_url && !stripForumRefTags(message.content)) {
      return res.status(400).json({ error: 'No se puede editar un mensaje que solo contiene un archivo.' });
    }

    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    if (!stripForumRefTags(content)) {
      return res.status(400).json({ error: 'El mensaje no puede quedar vacío.' });
    }

    db.prepare(
      `UPDATE workgroup_messages SET content = ?, edited_at = datetime('now') WHERE id = ?`
    ).run(content, message.id);

    const updated = db
      .prepare(
        `
      SELECT m.*, u.name as user_name, u.role as user_role
      FROM workgroup_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `
      )
      .get(message.id);

    const [enriched] = enrichMessagesWithReadReceipts(db, group, [updated]);
    res.json(enriched || updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al editar mensaje' });
  }
});

module.exports = router;
