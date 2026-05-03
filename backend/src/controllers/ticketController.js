const { getDb } = require('../database/init');
const { sendTicketNotification } = require('../services/emailService');

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

const createTicket = (req, res) => {
  try {
    const { title, description, priority, category, assigned_to, created_by } = req.body;
    const db = getDb();
    
    const stmt = db.prepare(`
      INSERT INTO tickets (title, description, priority, category, assigned_to, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(title, description, priority || 'medium', category, assigned_to, created_by);
    
    // Notify assigned user
    if (assigned_to) {
      const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(assigned_to);
      if (user) {
        sendTicketNotification(user.name, user.email, { title, description, priority: priority || 'medium' });
      }
    }

    res.status(201).json({ id: info.lastInsertRowid, message: 'Ticket creado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
};

const updateTicketStatus = (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const db = getDb();
    db.prepare('UPDATE tickets SET status = ?, updated_at = datetime("now") WHERE id = ?').run(status, id);
    res.json({ message: 'Estado del ticket actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
};

module.exports = {
  getTickets,
  createTicket,
  updateTicketStatus
};
