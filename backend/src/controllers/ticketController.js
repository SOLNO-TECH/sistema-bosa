const { getDb } = require('../database/init');
const { sendTicketNotification } = require('../services/emailService');
const path = require('path');
const fs = require('fs');

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
    const { title, description, priority, category, assigned_to, due_date } = req.body;
    // El creador siempre se toma del token, NO del body (evita suplantación)
    const created_by = req.user?.id;
    if (!created_by) return res.status(401).json({ error: 'No autenticado' });

    const db = getDb();

    const stmt = db.prepare(`
      INSERT INTO tickets (title, description, priority, category, assigned_to, created_by, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(title, description, priority || 'medium', category, assigned_to, created_by, due_date);
    const ticketId = info.lastInsertRowid;

    // Log history
    db.prepare(`INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)` )
      .run(ticketId, created_by, 'created', 'Ticket creado inicialmente');

    // Notify assigned user
    if (assigned_to) {
      const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(assigned_to);
      if (user) {
        sendTicketNotification(user.name, user.email, { title, description, priority: priority || 'medium' });
      }
      db.prepare(`INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)` )
        .run(ticketId, created_by, 'assigned', `Asignado a ${user?.name || 'Usuario'}`);
    }

    res.status(201).json({ id: ticketId, message: 'Ticket creado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear ticket' });
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
      try {
        db.prepare(`INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)`)
          .run(id, user_id, 'status_change', `Estado cambiado de ${oldStatus} a ${status}`);
      } catch (histErr) {
        console.warn('No se pudo registrar el historial:', histErr.message);
      }
    }

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

    db.prepare(`INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)` )
      .run(id, user_id, 'comment', 'Se añadió un comentario');

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

    db.prepare(`INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)` )
      .run(id, user_id, 'attachment', `Archivo subido: ${file.originalname}`);

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

    db.prepare(`INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)`)
      .run(id, user_id, 'attachment_delete', `Archivo eliminado: ${att.filename}`);

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
  updateTicketStatus,
  addComment,
  uploadAttachment,
  deleteAttachment
};
