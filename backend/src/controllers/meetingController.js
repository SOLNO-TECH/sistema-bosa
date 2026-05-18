const { getDb } = require('../database/init');
const { sendMeetingNotification } = require('../services/emailService');
const { notifyUser } = require('../services/notificationService');
const {
  parseMeetingAttendees,
  notifyMeetingParticipants,
} = require('../utils/participantNotify');

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
    const meetingId = info.lastInsertRowid;

    // Notificar a los asistentes (correo + notificación interna)
    if (attendees && Array.isArray(attendees)) {
      const when = (() => {
        try {
          const d = new Date(start_time);
          return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' · ' +
                 d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch { return start_time; }
      })();
      attendees.forEach(userId => {
        if (userId === created_by) return;
        const attendee = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId);
        if (attendee) {
          sendMeetingNotification(attendee.name, attendee.email, { title, start_time, end_time });
          notifyUser(userId, {
            type: 'meeting',
            title: 'Te invitaron a una reunión',
            message: `"${title}" — ${when}`,
            module: 'calendar',
            related_id: meetingId,
          });
        }
      });
    }

    res.status(201).json({ id: meetingId, message: 'Reunión creada exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear reunión' });
  }
};

const updateMeeting = (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, start_time, end_time, attendees } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Reunión no encontrada' });

    const uid = req.user.id;
    const role = req.user.role;
    if (existing.created_by !== uid && role !== 'superadmin' && role !== 'administrator') {
      return res.status(403).json({ error: 'Solo el organizador o un administrador puede editar esta reunión.' });
    }

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: 'Título, hora de inicio y fin son obligatorios' });
    }

    const newAttendeeIds = Array.isArray(attendees) ? attendees.map(Number).filter((n) => !Number.isNaN(n)) : [];
    const oldAttendeeIds = parseMeetingAttendees(existing.attendees).map(Number);
    const attendeesJson = JSON.stringify(newAttendeeIds);

    db.prepare(`
      UPDATE meetings
      SET title = ?, description = ?, start_time = ?, end_time = ?, attendees = ?
      WHERE id = ?
    `).run(title, description || '', start_time, end_time, attendeesJson, id);

    const when = (() => {
      try {
        const d = new Date(start_time);
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' · ' +
          d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return start_time;
      }
    })();

    try {
      const newlyAdded = newAttendeeIds.filter((aid) => !oldAttendeeIds.includes(aid));
      for (const userId of newlyAdded) {
        if (userId === uid) continue;
        notifyUser(userId, {
          type: 'meeting',
          title: 'Te invitaron a una reunión',
          message: `"${title}" — ${when}`,
          module: 'calendar',
          related_id: Number(id),
        });
      }
      const updatedMeeting = { ...existing, title, start_time, end_time, attendees: attendeesJson };
      notifyMeetingParticipants(
        db,
        updatedMeeting,
        uid,
        {
          type: 'meeting',
          title: 'Reunión actualizada',
          message: `"${title}" fue modificada (${when}).`,
          module: 'calendar',
          related_id: Number(id),
        },
        newlyAdded
      );
    } catch (_) { /* noop */ }

    res.json({ message: 'Reunión actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar reunión' });
  }
};

const deleteMeeting = (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
    if (existing) {
      try {
        notifyMeetingParticipants(db, existing, req.user?.id, {
          type: 'meeting',
          title: 'Reunión cancelada',
          message: `La reunión "${existing.title}" fue eliminada del calendario.`,
          module: 'calendar',
          related_id: Number(id),
        });
      } catch (_) { /* noop */ }
    }
    db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
    res.json({ message: 'Reunión eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar reunión' });
  }
};

module.exports = {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting
};
