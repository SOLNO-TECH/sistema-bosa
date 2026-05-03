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
    const { title, description, priority, category, assigned_to, created_by, due_date } = req.body;
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
    const { status, user_id } = req.body; // user_id of who is changing it
    const db = getDb();
    
    const oldStatus = db.prepare('SELECT status FROM tickets WHERE id = ?').get(id)?.status;
    
    db.prepare('UPDATE tickets SET status = ?, updated_at = datetime("now") WHERE id = ?').run(status, id);
    
    // Log history
    db.prepare(`INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)` )
      .run(id, user_id || 1, 'status_change', `Estado cambiado de ${oldStatus} a ${status}`);

    res.json({ message: 'Estado del ticket actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
};

const addComment = (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, content } = req.body;
    const db = getDb();
    
    db.prepare(`INSERT INTO ticket_comments (ticket_id, user_id, content) VALUES (?, ?, ?)` )
      .run(id, user_id, content);
      
    db.prepare(`INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)` )
      .run(id, user_id, 'comment', 'Se añadió un comentario');

    res.status(201).json({ message: 'Comentario añadido' });
  } catch (err) {
    res.status(500).json({ error: 'Error al añadir comentario' });
  }
};

const uploadAttachment = (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    const db = getDb();
    db.prepare(`
      INSERT INTO ticket_attachments (ticket_id, filename, mimetype, path, uploaded_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, file.originalname, file.mimetype, file.path, user_id || 1);

    db.prepare(`INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)` )
      .run(id, user_id || 1, 'attachment', `Archivo subido: ${file.originalname}`);

    res.status(201).json({ message: 'Archivo subido correctamente', file: file.originalname });
  } catch (err) {
    res.status(500).json({ error: 'Error al subir archivo' });
  }
};

module.exports = {
  getTickets,
  getTicketDetails,
  createTicket,
  updateTicketStatus,
  addComment,
  uploadAttachment
};
