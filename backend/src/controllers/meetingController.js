const { getDb } = require('../database/init');

const getMeetings = (req, res) => {
  try {
    const db = getDb();
    const meetings = db.prepare('SELECT * FROM meetings ORDER BY start_time ASC').all();
    
    // Parse attendees if they are stored as JSON strings
    const parsedMeetings = meetings.map(m => ({
      ...m,
      attendees: m.attendees ? JSON.parse(m.attendees) : []
    }));
    
    res.json(parsedMeetings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener reuniones' });
  }
};

const createMeeting = (req, res) => {
  try {
    const { title, description, start_time, end_time, attendees } = req.body;
    const created_by = req.user.id; // From auth middleware

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: 'Título, hora de inicio y fin son obligatorios' });
    }

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO meetings (title, description, start_time, end_time, created_by, attendees)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(title, description || '', start_time, end_time, created_by, JSON.stringify(attendees || []));
    res.status(201).json({ id: info.lastInsertRowid, message: 'Reunión creada exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear reunión' });
  }
};

const deleteMeeting = (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
    res.json({ message: 'Reunión eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar reunión' });
  }
};

module.exports = {
  getMeetings,
  createMeeting,
  deleteMeeting
};
