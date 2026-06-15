const { meetingPlaceLabelForMinute } = require('./meetingLocation');

function isoToDateInput(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function isoToTimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function followUpFieldsFromMeeting(meeting) {
  const locationType = meeting.location_type === 'virtual' ? 'virtual' : 'sala_juntas';
  return {
    next_meeting_fecha: isoToDateInput(meeting.start_time),
    next_meeting_hora: isoToTimeInput(meeting.start_time),
    next_meeting_hora_fin: isoToTimeInput(meeting.end_time),
    next_meeting_location_type: locationType,
    next_meeting_lugar: meetingPlaceLabelForMinute(meeting),
  };
}

function linkedMinuteFieldsFromMeeting(meeting) {
  return {
    lugar: meetingPlaceLabelForMinute(meeting),
    fecha: isoToDateInput(meeting.start_time),
    hora_inicio: isoToTimeInput(meeting.start_time),
    hora_cierre: isoToTimeInput(meeting.end_time),
    tema: String(meeting.title || '').trim(),
    department: meeting.department || null,
  };
}

/** Si la minuta apunta a una reunión de seguimiento, valida el vínculo y sincroniza campos. */
function reconcileMinuteFollowUp(db, minuteRow) {
  if (!minuteRow?.id) return minuteRow;
  const scheduledId = Number(minuteRow.next_meeting_scheduled_id);
  if (!Number.isFinite(scheduledId) || scheduledId <= 0) return minuteRow;

  const meeting = db
    .prepare('SELECT id, title, start_time, end_time, location_type, location_custom, department FROM meetings WHERE id = ?')
    .get(scheduledId);
  if (!meeting) {
    db.prepare(
      `UPDATE meeting_minutes SET next_meeting_scheduled_id = NULL, updated_at = datetime('now') WHERE id = ?`,
    ).run(minuteRow.id);
    return { ...minuteRow, next_meeting_scheduled_id: null };
  }

  const synced = followUpFieldsFromMeeting(meeting);
  db.prepare(
    `UPDATE meeting_minutes SET
      next_meeting_fecha = ?,
      next_meeting_hora = ?,
      next_meeting_hora_fin = ?,
      next_meeting_location_type = ?,
      next_meeting_lugar = ?,
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    synced.next_meeting_fecha,
    synced.next_meeting_hora,
    synced.next_meeting_hora_fin,
    synced.next_meeting_location_type,
    synced.next_meeting_lugar,
    minuteRow.id,
  );

  return { ...minuteRow, ...synced, next_meeting_scheduled_id: scheduledId };
}

function clearMinuteFollowUpLink(db, meetingId) {
  const id = Number(meetingId);
  if (!Number.isFinite(id) || id <= 0) return;
  db.prepare(
    `UPDATE meeting_minutes SET next_meeting_scheduled_id = NULL, updated_at = datetime('now')
     WHERE next_meeting_scheduled_id = ?`,
  ).run(id);
}

function syncMinutesFromMeetingUpdate(db, meeting) {
  if (!meeting?.id) return;

  const followUp = followUpFieldsFromMeeting(meeting);
  db.prepare(
    `UPDATE meeting_minutes SET
      next_meeting_fecha = ?,
      next_meeting_hora = ?,
      next_meeting_hora_fin = ?,
      next_meeting_location_type = ?,
      next_meeting_lugar = ?,
      updated_at = datetime('now')
     WHERE next_meeting_scheduled_id = ?`,
  ).run(
    followUp.next_meeting_fecha,
    followUp.next_meeting_hora,
    followUp.next_meeting_hora_fin,
    followUp.next_meeting_location_type,
    followUp.next_meeting_lugar,
    meeting.id,
  );

  const linked = linkedMinuteFieldsFromMeeting(meeting);
  db.prepare(
    `UPDATE meeting_minutes SET
      lugar = ?,
      fecha = ?,
      hora_inicio = ?,
      hora_cierre = ?,
      tema = ?,
      department = ?,
      updated_at = datetime('now')
     WHERE meeting_id = ?`,
  ).run(
    linked.lugar,
    linked.fecha,
    linked.hora_inicio,
    linked.hora_cierre,
    linked.tema,
    linked.department,
    meeting.id,
  );
}

module.exports = {
  reconcileMinuteFollowUp,
  clearMinuteFollowUpLink,
  syncMinutesFromMeetingUpdate,
};
