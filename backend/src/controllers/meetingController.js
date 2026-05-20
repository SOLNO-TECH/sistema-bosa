const { getDb } = require('../database/init');
const { sendMeetingNotification } = require('../services/emailService');
const { notifyUser } = require('../services/notificationService');
const {
  parseMeetingAttendees,
  notifyMeetingParticipants,
} = require('../utils/participantNotify');
const {
  normalizeLocationType,
  findSalaConflict,
} = require('../utils/meetingSchedule');

const LOCATION_LABELS = {
  virtual: 'Reunión virtual',
  sala_juntas: 'Sala de juntas',
};

function locationLabel(type) {
  return LOCATION_LABELS[type] || LOCATION_LABELS.sala_juntas;
}

function rejectSalaConflict(res, check) {
  if (check?.invalidRange) {
    res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });
    return true;
  }
  if (check?.conflict) {
    const c = check.conflict;
    res.status(409).json({
      error: 'La sala de juntas ya está reservada en ese horario.',
      conflict: {
        id: c.id,
        title: c.title,
        start_time: c.start_time,
        end_time: c.end_time,
      },
    });
    return true;
  }
  return false;
}

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
    const { title, description, start_time, end_time, attendees, location_type: locRaw } = req.body;
    const created_by = req.user?.id;
    if (!created_by) return res.status(401).json({ error: 'No autenticado' });

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: 'Título, hora de inicio y fin son obligatorios' });
    }

    const location_type = normalizeLocationType(locRaw);
    const db = getDb();

    if (location_type === 'sala_juntas') {
      const check = findSalaConflict(db, start_time, end_time);
      if (rejectSalaConflict(res, check)) return;
    }

    const stmt = db.prepare(`
      INSERT INTO meetings (title, description, start_time, end_time, created_by, attendees, location_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      title,
      description || '',
      start_time,
      end_time,
      created_by,
      JSON.stringify(attendees || []),
      location_type
    );
    const meetingId = info.lastInsertRowid;
    const createdByName = [req.user.name, req.user.apellido].filter(Boolean).join(' ').trim() || req.user.name;

    try {
      if (attendees && Array.isArray(attendees)) {
        const when = (() => {
          try {
            const d = new Date(start_time);
            return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' · ' +
                   d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch { return start_time; }
        })();
        for (const userId of attendees) {
          if (userId === created_by) continue;
          try {
            const attendee = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId);
            if (attendee) {
              sendMeetingNotification(attendee.name, attendee.email, {
                title,
                start_time,
                end_time,
                created_by_name: createdByName,
                location_label: locationLabel(location_type),
              }).catch(() => {});
              notifyUser(userId, {
                type: 'meeting',
                title: 'Te invitaron a una reunión',
                message: `"${title}" — ${when}`,
                module: 'calendar',
                related_id: meetingId,
              });
            }
          } catch (notifyErr) {
            console.warn('notify meeting attendee:', notifyErr.message);
          }
        }
      }
    } catch (sideErr) {
      console.warn('meeting side effects:', sideErr.message);
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
    const { title, description, start_time, end_time, attendees, location_type: locRaw } = req.body;
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

    const location_type = normalizeLocationType(locRaw ?? existing.location_type);

    if (location_type === 'sala_juntas') {
      const check = findSalaConflict(db, start_time, end_time, Number(id));
      if (rejectSalaConflict(res, check)) return;
    }

    const newAttendeeIds = Array.isArray(attendees) ? attendees.map(Number).filter((n) => !Number.isNaN(n)) : [];
    const oldAttendeeIds = parseMeetingAttendees(existing.attendees).map(Number);
    const attendeesJson = JSON.stringify(newAttendeeIds);

    db.prepare(`
      UPDATE meetings
      SET title = ?, description = ?, start_time = ?, end_time = ?, attendees = ?, location_type = ?
      WHERE id = ?
    `).run(title, description || '', start_time, end_time, attendeesJson, location_type, id);

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
