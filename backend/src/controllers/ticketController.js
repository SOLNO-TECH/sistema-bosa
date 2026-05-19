const { getDb } = require('../database/init');
const { sendTicketNotification } = require('../services/emailService');
const { notifyUser, notifyUsers } = require('../services/notificationService');
const {
  getDeptManagerIds,
  notifyTicketStakeholders,
} = require('../utils/participantNotify');
const { canManageDeptTicketAssignments } = require('../utils/ticketPermissions');
const path = require('path');
const fs = require('fs');

function logTicketHistory(db, ticketId, userId, action, details) {
  if (!ticketId || !userId) return;
  try {
    db.prepare(
      `INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)`
    ).run(ticketId, userId, action, details);
  } catch (err) {
    console.warn('ticket_history:', err.message);
  }
}

const getTickets = (req, res) => {
  try {
    const db = getDb();
    const tickets = db.prepare(`
      SELECT t.*, u1.name as assigned_name, u2.name as creator_name 
      FROM tickets t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      ORDER BY t.id DESC
    `).all();
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
};

const getTicketDetails = (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const ticket = db.prepare(`
      SELECT t.*, u1.name as assigned_name, u2.name as creator_name 
      FROM tickets t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `).get(id);

    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const comments = db.prepare(`
      SELECT c.*, u.name as user_name 
      FROM ticket_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC
    `).all(id);

    const history = db.prepare(`
      SELECT h.*, u.name as user_name 
      FROM ticket_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.ticket_id = ?
      ORDER BY h.created_at DESC
    `).all(id);

    const attachments = db.prepare(`
      SELECT * FROM ticket_attachments WHERE ticket_id = ?
    `).all(id);

    res.json({ ...ticket, comments, history, attachments });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener detalles del ticket' });
  }
};

const createTicket = (req, res) => {
  try {
    const { title, description, priority, category, due_date } = req.body;
    const created_by = req.user?.id;
    if (!created_by) return res.status(401).json({ error: 'No autenticado' });
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'El título es obligatorio' });
    }

    const db = getDb();

    const stmt = db.prepare(`
      INSERT INTO tickets (title, description, priority, category, assigned_to, created_by, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      String(title).trim(),
      description,
      priority || 'medium',
      category,
      null,
      created_by,
      due_date || null
    );
    const ticketId = info.lastInsertRowid;

    logTicketHistory(
      db,
      ticketId,
      created_by,
      'created',
      'Ticket creado (asignación a persona la realiza el gerente del departamento)'
    );

    try {
      const mgrIds = getDeptManagerIds(db, category).filter((id) => id !== created_by);
      if (mgrIds.length) {
        notifyUsers(mgrIds, {
          type: 'ticket',
          title: 'Nuevo ticket en tu departamento',
          message: `"${title}" fue registrado en ${category || 'sin departamento'}.`,
          module: 'tickets',
          related_id: Number(ticketId),
        });
      }
    } catch (_) { /* noop */ }

    res.status(201).json({ id: ticketId, message: 'Ticket creado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
};

const updateTicket = (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });

    const patch = req.body || {};
    if (patch.title !== undefined && !String(patch.title).trim()) {
      return res.status(400).json({ error: 'El título no puede estar vacío' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Ticket no encontrado' });

    let normalizedAssign;
    const assignsInPatch = Object.prototype.hasOwnProperty.call(patch, 'assigned_to');
    if (assignsInPatch) {
      if (!canManageDeptTicketAssignments(req.user, existing)) {
        return res.status(403).json({
          error: 'Solo un usuario con rol Gerente del mismo departamento del ticket o un administrador puede asignar responsables.',
        });
      }
      const targetCategory = Object.prototype.hasOwnProperty.call(patch, 'category')
        ? patch.category
        : existing.category;
      let v = patch.assigned_to;
      if (v === null || v === '') {
        normalizedAssign = null;
      } else {
        const n = Number(v);
        normalizedAssign = Number.isNaN(n) ? null : n;
      }
      if (normalizedAssign != null) {
        const assignee = db.prepare(
          'SELECT id, name, email, departamento, is_active FROM users WHERE id = ?'
        ).get(normalizedAssign);
        if (!assignee || !assignee.is_active) {
          return res.status(400).json({ error: 'Usuario asignado no válido o inactivo.' });
        }
        if ((assignee.departamento || '').trim() !== (targetCategory || '').trim()) {
          return res.status(400).json({ error: 'El responsable debe pertenecer al departamento del ticket.' });
        }
      }
    }

    const allowed = ['title', 'description', 'priority', 'category', 'assigned_to'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      let v = patch[key];
      if (key === 'assigned_to') v = normalizedAssign;
      updates.push(`${key} = ?`);
      values.push(v);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const prevAssigned = existing.assigned_to;

    values.push(id);
    db.prepare(`UPDATE tickets SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);

    const otherUpdate = ['title', 'description', 'priority', 'category'].some((k) =>
      Object.prototype.hasOwnProperty.call(patch, k)
    );

    if (assignsInPatch) {
      const prevN = prevAssigned == null ? null : Number(prevAssigned);
      const nextN = normalizedAssign == null ? null : Number(normalizedAssign);
      const changed = prevN !== nextN;
      if (changed) {
        if (normalizedAssign == null) {
          logTicketHistory(db, id, user_id, 'assignment', 'Responsable retirado del ticket');
        } else {
          const u = db.prepare('SELECT name FROM users WHERE id = ?').get(normalizedAssign);
          logTicketHistory(db, id, user_id, 'assigned', `Asignado a ${u?.name || 'Usuario'}`);
          if (normalizedAssign != null && normalizedAssign !== user_id) {
            notifyUser(normalizedAssign, {
              type: 'ticket',
              title: 'Nueva tarea asignada',
              message: `Se te asignó el ticket "${existing.title}".`,
              module: 'tickets',
              related_id: parseInt(id, 10),
            });
            const userRow = db.prepare('SELECT name, email FROM users WHERE id = ?').get(normalizedAssign);
            if (userRow?.email) {
              sendTicketNotification(userRow.name, userRow.email, {
                title: existing.title,
                description: existing.description || '',
                priority: existing.priority || 'medium',
              });
            }
          }
          const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
          const assignName = normalizedAssign
            ? db.prepare('SELECT name FROM users WHERE id = ?').get(normalizedAssign)?.name
            : null;
          notifyTicketStakeholders(
            db,
            id,
            user_id,
            {
              type: 'ticket',
              title: 'Cambio de responsable',
              message: assignName
                ? `${actor?.name || 'Alguien'} asignó a ${assignName} en "${existing.title}".`
                : `${actor?.name || 'Alguien'} retiró el responsable de "${existing.title}".`,
              module: 'tickets',
              related_id: parseInt(id, 10),
            },
            normalizedAssign != null ? [normalizedAssign] : []
          );
        }
      }
    }
    if (otherUpdate) {
      logTicketHistory(db, id, user_id, 'updated', 'Datos del ticket actualizados');
      try {
        const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
        notifyTicketStakeholders(db, id, user_id, {
          type: 'ticket',
          title: 'Ticket actualizado',
          message: `${actor?.name || 'Alguien'} modificó "${existing.title}".`,
          module: 'tickets',
          related_id: parseInt(id, 10),
        });
      } catch (_) { /* noop */ }
    }

    res.json({ message: 'Ticket actualizado' });
  } catch (err) {
    console.error('updateTicket error:', err);
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
};

const updateTicketStatus = (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    // user_id siempre desde el token, no del body
    const user_id = req.user?.id;
    const db = getDb();

    if (!status) return res.status(400).json({ error: 'Falta el campo status' });

    const ticket = db.prepare('SELECT status FROM tickets WHERE id = ?').get(id);
    if (!ticket) return res.status(404).json({ error: `Ticket ${id} no encontrado` });
    const oldStatus = ticket.status;

    db.prepare(`UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);

    if (user_id) {
      logTicketHistory(
        db,
        id,
        user_id,
        'status_change',
        `Estado cambiado de ${oldStatus} a ${status}`
      );
    }

    try {
      const full = db.prepare('SELECT title FROM tickets WHERE id = ?').get(id);
      const statusLabels = { open: 'Pendiente', in_progress: 'En Progreso', resolved: 'En Revisión', closed: 'Completado' };
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      notifyTicketStakeholders(db, id, user_id, {
        type: 'ticket',
        title: 'Cambio de estado en ticket',
        message: `${actor?.name || 'Alguien'} movió "${full?.title || 'Ticket'}" a ${statusLabels[status] || status}.`,
        module: 'tickets',
        related_id: parseInt(id, 10),
      });
    } catch (_) { /* no romper el endpoint si la notificación falla */ }

    res.json({ message: 'Estado del ticket actualizado', oldStatus, newStatus: status });
  } catch (err) {
    console.error('updateTicketStatus error:', err);
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
};

const addComment = (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });
    if (!content || !String(content).trim()) return res.status(400).json({ error: 'Contenido vacío' });

    const db = getDb();
    db.prepare(`INSERT INTO ticket_comments (ticket_id, user_id, content) VALUES (?, ?, ?)` )
      .run(id, user_id, content);

    logTicketHistory(db, id, user_id, 'comment', 'Se añadió un comentario');

    try {
      const full = db.prepare('SELECT title FROM tickets WHERE id = ?').get(id);
      const author = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      notifyTicketStakeholders(db, id, user_id, {
        type: 'comment',
        title: 'Nuevo comentario en ticket',
        message: `${author?.name || 'Alguien'} comentó en "${full?.title || 'Ticket'}".`,
        module: 'tickets',
        related_id: parseInt(id, 10),
      });
    } catch (_) {}

    res.status(201).json({ message: 'Comentario añadido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al añadir comentario' });
  }
};

const uploadAttachment = (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    const db = getDb();
    db.prepare(`
      INSERT INTO ticket_attachments (ticket_id, filename, mimetype, path, uploaded_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, file.originalname, file.mimetype, file.path, user_id);

    logTicketHistory(db, id, user_id, 'attachment', `Archivo subido: ${file.originalname}`);

    try {
      const full = db.prepare('SELECT title FROM tickets WHERE id = ?').get(id);
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      notifyTicketStakeholders(db, id, user_id, {
        type: 'ticket',
        title: 'Archivo en ticket',
        message: `${actor?.name || 'Alguien'} subió "${file.originalname}" en "${full?.title || 'Ticket'}".`,
        module: 'tickets',
        related_id: parseInt(id, 10),
      });
    } catch (_) {}

    res.status(201).json({ message: 'Archivo subido correctamente', file: file.originalname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
};

const deleteAttachment = (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });

    const db = getDb();
    const att = db.prepare('SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ?').get(attachmentId, id);
    if (!att) return res.status(404).json({ error: 'Archivo no encontrado' });

    try {
      if (att.path && fs.existsSync(att.path)) fs.unlinkSync(att.path);
    } catch (_) { /* ignorar errores de disco */ }

    db.prepare('DELETE FROM ticket_attachments WHERE id = ?').run(attachmentId);

    logTicketHistory(db, id, user_id, 'attachment_delete', `Archivo eliminado: ${att.filename}`);

    try {
      const full = db.prepare('SELECT title FROM tickets WHERE id = ?').get(id);
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      notifyTicketStakeholders(db, id, user_id, {
        type: 'ticket',
        title: 'Archivo eliminado',
        message: `${actor?.name || 'Alguien'} quitó "${att.filename}" de "${full?.title || 'Ticket'}".`,
        module: 'tickets',
        related_id: parseInt(id, 10),
      });
    } catch (_) {}

    res.json({ message: 'Archivo eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar archivo' });
  }
};

module.exports = {
  getTickets,
  getTicketDetails,
  createTicket,
  updateTicket,
  updateTicketStatus,
  addComment,
  uploadAttachment,
  deleteAttachment
};
