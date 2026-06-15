const { normalizeLocationType, VALID_LOCATION_TYPES } = require('./meetingLocation');

function parseTime(iso) {
  return new Date(iso).getTime();
}

function rangesOverlap(startA, endA, startB, endB) {
  return parseTime(startA) < parseTime(endB) && parseTime(startB) < parseTime(endA);
}

function parseAttendeeIds(attendeesRaw) {
  if (!attendeesRaw) return [];
  if (Array.isArray(attendeesRaw)) {
    return attendeesRaw.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  }
  try {
    const parsed = JSON.parse(attendeesRaw);
    return Array.isArray(parsed)
      ? parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];
  } catch {
    return [];
  }
}

function meetingParticipantIds(meeting) {
  const ids = new Set(parseAttendeeIds(meeting.attendees));
  if (meeting.created_by) ids.add(Number(meeting.created_by));
  return ids;
}

function getRsvpStatus(db, meetingId, userId) {
  const row = db
    .prepare('SELECT status FROM meeting_rsvps WHERE meeting_id = ? AND user_id = ?')
    .get(meetingId, userId);
  return row?.status || null;
}

/** Convierte confirmación de reunión a etiqueta de asistencia en minuta/PDF. */
function rsvpStatusToAsistencia(status) {
  if (status === 'declined') return 'Ausente';
  return 'Presente';
}

function getRsvpStatusFromList(rsvps, userId) {
  const row = (rsvps || []).find((r) => Number(r.user_id) === Number(userId));
  return row?.status || null;
}

/** Organizador/invitado cuenta como ocupado salvo que haya declinado explícitamente. */
function userCountsAsBusyInMeeting(db, meeting, userId) {
  if (!meetingParticipantIds(meeting).has(Number(userId))) return false;
  return getRsvpStatus(db, meeting.id, userId) !== 'declined';
}

/** Conflicto solo para reservas de sala de juntas (reuniones virtuales no bloquean la sala). */
function findSalaConflict(db, start_time, end_time, excludeId = null) {
  if (!start_time || !end_time || parseTime(start_time) >= parseTime(end_time)) {
    return { invalidRange: true };
  }

  const params = [end_time, start_time];
  let sql = `
    SELECT id, title, start_time, end_time, location_type
    FROM meetings
    WHERE location_type = 'sala_juntas'
      AND start_time < ?
      AND end_time > ?
  `;
  if (excludeId != null) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';

  const row = db.prepare(sql).get(...params);
  return row ? { conflict: row } : null;
}

/** Usuario ocupado si organiza o asiste a otra reunión que se traslapa en el horario. */
function findAttendeeConflicts(db, start_time, end_time, userIds, excludeId = null, organizerId = null) {
  if (!start_time || !end_time || parseTime(start_time) >= parseTime(end_time)) {
    return { invalidRange: true };
  }

  const checkIds = new Set(
    (userIds || []).map(Number).filter((n) => Number.isFinite(n) && n > 0),
  );
  if (organizerId) checkIds.add(Number(organizerId));
  if (checkIds.size === 0) return null;

  const params = [end_time, start_time];
  let sql = `
    SELECT id, title, start_time, end_time, created_by, attendees
    FROM meetings
    WHERE start_time < ?
      AND end_time > ?
  `;
  if (excludeId != null) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }

  const overlapping = db.prepare(sql).all(...params);
  const conflicts = [];

  for (const uid of checkIds) {
    for (const meeting of overlapping) {
      if (userCountsAsBusyInMeeting(db, meeting, uid)) {
        conflicts.push({
          userId: uid,
          meeting: {
            id: meeting.id,
            title: meeting.title,
            start_time: meeting.start_time,
            end_time: meeting.end_time,
          },
        });
        break;
      }
    }
  }

  return conflicts.length ? { conflicts } : null;
}

module.exports = {
  VALID_LOCATION_TYPES,
  normalizeLocationType,
  rangesOverlap,
  findSalaConflict,
  findAttendeeConflicts,
  parseAttendeeIds,
  meetingParticipantIds,
  userCountsAsBusyInMeeting,
  rsvpStatusToAsistencia,
  getRsvpStatusFromList,
};
