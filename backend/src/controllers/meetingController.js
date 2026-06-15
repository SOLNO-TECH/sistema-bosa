const { getDb } = require('../database/init');
const { syncMinutesFromMeetingUpdate } = require('../utils/minuteFollowUpSync');
const { deleteMeetingWithChildren } = require('../utils/purgeUserData');
const { sendMeetingNotification } = require('../services/emailService');
const { notifyUser } = require('../services/notificationService');
const {
  parseMeetingAttendees,
  notifyMeetingParticipants,
} = require('../utils/participantNotify');
const {
  findSalaConflict,
  findAttendeeConflicts,
} = require('../utils/meetingSchedule');
const {
  meetingLocationLabel,
  parseMeetingLocationInput,
} = require('../utils/meetingLocation');
const { meetingHasManualMinute } = require('../utils/minuteManualActa');

const VALID_RSVP_STATUSES = ['going', 'declined', 'late'];

function resolvePermissionLevel(user) {
  if (!user) return 'user';
  if (user.permission_level) return user.permission_level;
  if (user.role === 'superadmin') return 'superadmin';
  if (user.role === 'administrator') return 'administrator';
  if (user.role === 'manager') return 'manager';
  return 'user';
}

function isSuperadminUser(user) {
  return resolvePermissionLevel(user) === 'superadmin';
}

function canDeleteMeeting(user, meeting) {
  if (!user?.id || !meeting) return false;
  if (isSuperadminUser(user)) return true;
  return Number(meeting.created_by) === Number(user.id);
}

function loadMeetingRsvps(db, meetingId) {
  return db
    .prepare(
      `SELECT user_id, status, comment, updated_at
       FROM meeting_rsvps WHERE meeting_id = ? ORDER BY updated_at DESC`,
    )
    .all(meetingId);
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

function rejectAttendeeConflict(res, check, db) {
  if (check?.invalidRange) {
    res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });
    return true;
  }
  if (check?.conflicts?.length) {
    const names = check.conflicts.map((c) => {
      const u = db.prepare('SELECT name, apellido FROM users WHERE id = ?').get(c.userId);
      return u ? [u.name, u.apellido].filter(Boolean).join(' ').trim() : `Usuario #${c.userId}`;
    });
    res.status(409).json({
      error:
        names.length === 1
          ? `${names[0]} ya tiene otra reunión en ese horario.`
          : `${names.join(', ')} ya tienen otra reunión en ese horario.`,
      conflicts: check.conflicts,
    });
    return true;
  }
  return false;
}

const getMeetings = (req, res) => {
  try {
    const db = getDb();
    const meetings = db
      .prepare(
        `SELECT m.*,
                (SELECT mm.id FROM meeting_minutes mm WHERE mm.meeting_id = m.id ORDER BY mm.id DESC LIMIT 1) AS minute_id
         FROM meetings m
         ORDER BY m.start_time ASC`,
      )
      .all();

    const parsedMeetings = meetings.map((m) => ({
      ...m,
      attendees: m.attendees ? JSON.parse(m.attendees) : [],
      rsvps: loadMeetingRsvps(db, m.id),
      has_minute: meetingHasManualMinute(db, m.id),
      minute_id: m.minute_id ?? null,
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
    const created_by = req.user?.id;
    if (!created_by) return res.status(401).json({ error: 'No autenticado' });

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: 'Título, hora de inicio y fin son obligatorios' });
    }

    const locationFields = parseMeetingLocationInput(req.body);
    if (locationFields.error) return res.status(400).json({ error: locationFields.error });
    const { location_type, location_custom, department } = locationFields;
    const db = getDb();

    if (location_type === 'sala_juntas') {
      const check = findSalaConflict(db, start_time, end_time);
      if (rejectSalaConflict(res, check)) return;
    }

    const attendeeIds = Array.isArray(attendees)
      ? attendees.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    const attendeeCheck = findAttendeeConflicts(db, start_time, end_time, attendeeIds, null, created_by);
    if (rejectAttendeeConflict(res, attendeeCheck, db)) return;

    const stmt = db.prepare(`
      INSERT INTO meetings (title, description, start_time, end_time, created_by, attendees, location_type, location_custom, department, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const info = stmt.run(
      title,
      description || '',
      start_time,
      end_time,
      created_by,
      JSON.stringify(attendees || []),
      location_type,
      location_custom,
      department,
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
                location_label: meetingLocationLabel({ location_type, location_custom }),
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
    const { title, description, start_time, end_time, attendees } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Reunión no encontrada' });

    const uid = req.user.id;
    if (existing.created_by !== uid && !isSuperadminUser(req.user)) {
      return res.status(403).json({ error: 'Solo el organizador o superadmin puede editar esta reunión.' });
    }

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: 'Título, hora de inicio y fin son obligatorios' });
    }

    const locationFields = parseMeetingLocationInput(req.body, existing);
    if (locationFields.error) return res.status(400).json({ error: locationFields.error });
    const { location_type, location_custom, department } = locationFields;

    if (location_type === 'sala_juntas') {
      const check = findSalaConflict(db, start_time, end_time, Number(id));
      if (rejectSalaConflict(res, check)) return;
    }

    const newAttendeeIds = Array.isArray(attendees) ? attendees.map(Number).filter((n) => !Number.isNaN(n)) : [];
    const attendeeCheck = findAttendeeConflicts(
      db,
      start_time,
      end_time,
      newAttendeeIds,
      Number(id),
      existing.created_by,
    );
    if (rejectAttendeeConflict(res, attendeeCheck, db)) return;

    const oldAttendeeIds = parseMeetingAttendees(existing.attendees).map(Number);
    const attendeesJson = JSON.stringify(newAttendeeIds);

    db.prepare(`
      UPDATE meetings
      SET title = ?, description = ?, start_time = ?, end_time = ?, attendees = ?,
          location_type = ?, location_custom = ?, department = ?
      WHERE id = ?
    `).run(
      title,
      description || '',
      start_time,
      end_time,
      attendeesJson,
      location_type,
      location_custom,
      department,
      id,
    );

    try {
      syncMinutesFromMeetingUpdate(db, {
        id: Number(id),
        title,
        start_time,
        end_time,
        location_type,
        location_custom,
        department,
      });
    } catch (_) { /* noop */ }

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

function canProxyMeetingRsvp(user, meeting) {
  if (!user?.id || !meeting) return false;
  return Number(meeting.created_by) === Number(user.id);
}

const upsertMeetingRsvp = (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment, user_id: targetUserIdRaw } = req.body;
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'No autenticado' });

    if (!VALID_RSVP_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Elige Asistiré, No asistiré o Llegaré tarde.' });
    }

    const db = getDb();
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
    if (!meeting) return res.status(404).json({ error: 'Reunión no encontrada' });

    const attendeeIds = parseMeetingAttendees(meeting.attendees).map(Number);
    const targetUserId =
      targetUserIdRaw != null && targetUserIdRaw !== '' ? Number(targetUserIdRaw) : Number(uid);
    const isSelf = targetUserId === Number(uid);

    if (!attendeeIds.includes(targetUserId)) {
      return res.status(400).json({ error: 'Esa persona no está invitada a la reunión.' });
    }

    if (isSelf) {
      if (!attendeeIds.includes(Number(uid))) {
        return res.status(403).json({ error: 'Solo los invitados pueden confirmar asistencia.' });
      }
    } else {
      if (!canProxyMeetingRsvp(req.user, meeting)) {
        return res.status(403).json({
          error: 'Solo el organizador puede registrar la asistencia de otros participantes.',
        });
      }
      const existing = db
        .prepare('SELECT status FROM meeting_rsvps WHERE meeting_id = ? AND user_id = ?')
        .get(id, targetUserId);
      if (existing) {
        return res.status(403).json({
          error: 'Esa persona ya confirmó su asistencia. Solo puede actualizarla ella misma.',
        });
      }
    }

    const commentText = String(comment || '').trim().slice(0, 500) || null;

    db.prepare(
      `INSERT INTO meeting_rsvps (meeting_id, user_id, status, comment, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(meeting_id, user_id) DO UPDATE SET
         status = excluded.status,
         comment = excluded.comment,
         updated_at = datetime('now')`,
    ).run(id, targetUserId, status, commentText);

    res.json({
      message: isSelf ? 'Respuesta guardada' : 'Asistencia registrada',
      rsvp: {
        user_id: targetUserId,
        status,
        comment: commentText,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo guardar la respuesta' });
  }
};

const deleteMeeting = (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Reunión no encontrada' });
    if (!canDeleteMeeting(req.user, existing)) {
      return res.status(403).json({
        error: 'Solo el organizador de la reunión o un superadministrador puede eliminarla.',
      });
    }
    try {
      notifyMeetingParticipants(db, existing, req.user?.id, {
        type: 'meeting',
        title: 'Reunión cancelada',
        message: `La reunión "${existing.title}" fue eliminada del calendario.`,
        module: 'calendar',
        related_id: Number(id),
      });
    } catch (_) { /* noop */ }
    deleteMeetingWithChildren(db, Number(id));
    res.json({ message: 'Reunión eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar reunión' });
  }
};

module.exports = {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  upsertMeetingRsvp,
};
