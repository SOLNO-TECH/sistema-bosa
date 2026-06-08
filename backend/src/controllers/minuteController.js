const { getDb } = require('../database/init');
const { notifyMinutaParticipants } = require('../utils/participantNotify');
const { deleteAudioFileIfExists, resolveAudioFile, streamAudioFile } = require('../utils/minuteAudio');
const { canManageMeetingMinuteById, isSuperadminUser } = require('../utils/meetingMinuteAccess');
const { reconcileMinuteFollowUp } = require('../utils/minuteFollowUpSync');

function safeJson(s, fallback) {
  try {
    const v = JSON.parse(s || '');
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

const defaultTopics = () => [
  { titulo: '', descripcion: '', comentarios: '' },
  { titulo: '', descripcion: '', comentarios: '' },
  { titulo: '', descripcion: '', comentarios: '' },
];

function normalizeBulletList(raw, fallback = []) {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split('\n')
      .map((s) => s.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);
  }
  return Array.isArray(fallback) ? fallback : [];
}

function normalizePayload(body) {
  const {
    lugar = '',
    fecha,
    hora_inicio = '',
    hora_cierre = '',
    tema = '',
    attendees,
    topics,
    meeting_id,
    transcript_text,
    audio_path,
    tema_principal,
    desarrollo,
    acuerdos,
    next_meeting_planned = 'no',
    next_meeting_fecha = '',
    next_meeting_hora = '',
    next_meeting_hora_fin = '',
    next_meeting_lugar = '',
    next_meeting_location_type = 'sala_juntas',
    next_meeting_scheduled_id,
  } = body;
  if (!fecha || String(fecha).trim() === '') {
    return { error: 'La fecha es obligatoria.' };
  }
  let att = Array.isArray(attendees) ? attendees : [];
  att = att.map((a) => ({
    nombre: String(a.nombre ?? '').trim(),
    cargo: String(a.cargo ?? '').trim(),
    asistencia: String(a.asistencia ?? '').trim() || 'Presente',
  }));
  let top = Array.isArray(topics) ? topics.slice(0, 3) : [];
  while (top.length < 3) {
    top.push({ titulo: '', descripcion: '', comentarios: '' });
  }
  top = top.map((t) => ({
    titulo: String(t.titulo ?? '').trim(),
    descripcion: String(t.descripcion ?? '').trim(),
    comentarios: String(t.comentarios ?? '').trim(),
  }));
  let meetingId = null;
  if (meeting_id != null && meeting_id !== '') {
    const n = Number(meeting_id);
    if (!Number.isNaN(n) && n > 0) meetingId = n;
  }

  return {
    lugar: String(lugar).trim(),
    fecha: String(fecha).trim(),
    hora_inicio: String(hora_inicio).trim(),
    hora_cierre: String(hora_cierre).trim(),
    tema: String(tema).trim(),
    attendees: att,
    topics: top,
    meeting_id: meetingId,
    transcript_text: String(transcript_text ?? '').trim(),
    audio_path: audio_path != null && String(audio_path).trim() !== '' ? String(audio_path).trim() : null,
    tema_principal: normalizeBulletList(tema_principal),
    desarrollo: normalizeBulletList(desarrollo),
    acuerdos: normalizeBulletList(acuerdos),
    ...normalizeNextMeetingFields({
      next_meeting_planned,
      next_meeting_fecha,
      next_meeting_hora,
      next_meeting_hora_fin,
      next_meeting_lugar,
      next_meeting_location_type,
      next_meeting_scheduled_id,
    }),
  };
}

function normalizeNextMeetingFields(raw) {
  const planned = String(raw.next_meeting_planned ?? '').trim() === 'yes' ? 'yes' : 'no';
  if (planned === 'no') {
    return {
      next_meeting_planned: 'no',
      next_meeting_fecha: '',
      next_meeting_hora: '',
      next_meeting_hora_fin: '',
      next_meeting_lugar: '',
      next_meeting_location_type: 'sala_juntas',
      next_meeting_scheduled_id: null,
    };
  }

  const locationType = raw.next_meeting_location_type === 'virtual' ? 'virtual' : 'sala_juntas';
  let lugar = String(raw.next_meeting_lugar ?? '').trim();
  if (!lugar) {
    lugar = locationType === 'virtual' ? 'Reunión virtual' : 'Sala de juntas corporativo';
  }

  let scheduledId = null;
  if (raw.next_meeting_scheduled_id != null && raw.next_meeting_scheduled_id !== '') {
    const n = Number(raw.next_meeting_scheduled_id);
    if (!Number.isNaN(n) && n > 0) scheduledId = n;
  }

  return {
    next_meeting_planned: 'yes',
    next_meeting_fecha: String(raw.next_meeting_fecha ?? '').trim(),
    next_meeting_hora: String(raw.next_meeting_hora ?? '').trim(),
    next_meeting_hora_fin: String(raw.next_meeting_hora_fin ?? '').trim(),
    next_meeting_lugar: lugar,
    next_meeting_location_type: locationType,
    next_meeting_scheduled_id: scheduledId,
  };
}

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    lugar: r.lugar,
    fecha: r.fecha,
    hora_inicio: r.hora_inicio,
    hora_cierre: r.hora_cierre,
    tema: r.tema,
    attendees: safeJson(r.attendees_json, []),
    topics: safeJson(r.topics_json, defaultTopics()),
    created_by: r.created_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
    creator_name: r.creator_name,
    creator_apellido: r.creator_apellido,
    meeting_id: r.meeting_id ?? null,
    transcript_text: r.transcript_text || '',
    audio_path: r.audio_path || null,
    audio_url: r.audio_path
      ? `/api/uploads/${String(r.audio_path).replace(/^\/+/, '').replace(/\\/g, '/')}`
      : null,
    tema_principal: safeJson(r.tema_principal_json, []),
    desarrollo: safeJson(r.desarrollo_json, []),
    acuerdos: safeJson(r.acuerdos_json, []),
    next_meeting_planned: r.next_meeting_planned || 'no',
    next_meeting_fecha: r.next_meeting_fecha || '',
    next_meeting_hora: r.next_meeting_hora || '',
    next_meeting_hora_fin: r.next_meeting_hora_fin || '',
    next_meeting_lugar: r.next_meeting_lugar || '',
    next_meeting_location_type: r.next_meeting_location_type || 'sala_juntas',
    next_meeting_scheduled_id: r.next_meeting_scheduled_id ?? null,
  };
}

const listMinutes = (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT m.*, u.name AS creator_name, u.apellido AS creator_apellido
         FROM meeting_minutes m
         LEFT JOIN users u ON m.created_by = u.id
         ORDER BY datetime(m.created_at) DESC`
      )
      .all();
    res.json(rows.map(mapRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al listar minutas.' });
  }
};

const getMinuteByMeeting = (req, res) => {
  try {
    const meetingId = Number(req.params.meetingId);
    if (!meetingId) return res.status(400).json({ message: 'Reunión inválida.' });
    const db = getDb();
    const row = db
      .prepare(
        `SELECT m.*, u.name AS creator_name, u.apellido AS creator_apellido
         FROM meeting_minutes m
         LEFT JOIN users u ON m.created_by = u.id
         WHERE m.meeting_id = ?
         ORDER BY m.id DESC
         LIMIT 1`
      )
      .get(meetingId);
    if (!row) return res.status(404).json({ message: 'Sin minuta para esta reunión.' });
    const reconciled = reconcileMinuteFollowUp(db, row);
    res.json(mapRow(reconciled));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener la minuta.' });
  }
};

const getMinute = (req, res) => {
  try {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT m.*, u.name AS creator_name, u.apellido AS creator_apellido
         FROM meeting_minutes m
         LEFT JOIN users u ON m.created_by = u.id
         WHERE m.id = ?`
      )
      .get(req.params.id);
    if (!row) return res.status(404).json({ message: 'Minuta no encontrada.' });
    const reconciled = reconcileMinuteFollowUp(db, row);
    res.json(mapRow(reconciled));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener la minuta.' });
  }
};

const createMinute = (req, res) => {
  try {
    const created_by = req.user?.id;
    if (!created_by) return res.status(401).json({ message: 'No autenticado.' });
    const n = normalizePayload(req.body);
    if (n.error) return res.status(400).json({ message: n.error });

    const db = getDb();
    if (n.meeting_id && !canManageMeetingMinuteById(db, req.user, n.meeting_id)) {
      return res.status(403).json({
        message: 'Solo el organizador de la reunión o un superadministrador puede crear la minuta.',
      });
    }
    const info = db
      .prepare(
        `INSERT INTO meeting_minutes
         (lugar, fecha, hora_inicio, hora_cierre, tema, attendees_json, topics_json, created_by, meeting_id, transcript_text, audio_path,
          tema_principal_json, desarrollo_json, acuerdos_json,
          next_meeting_planned, next_meeting_fecha, next_meeting_hora, next_meeting_hora_fin,
          next_meeting_lugar, next_meeting_location_type, next_meeting_scheduled_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        n.lugar,
        n.fecha,
        n.hora_inicio,
        n.hora_cierre,
        n.tema,
        JSON.stringify(n.attendees),
        JSON.stringify(n.topics),
        created_by,
        n.meeting_id,
        n.transcript_text,
        n.audio_path,
        JSON.stringify(n.tema_principal),
        JSON.stringify(n.desarrollo),
        JSON.stringify(n.acuerdos),
        n.next_meeting_planned,
        n.next_meeting_fecha,
        n.next_meeting_hora,
        n.next_meeting_hora_fin,
        n.next_meeting_lugar,
        n.next_meeting_location_type,
        n.next_meeting_scheduled_id,
      );
    const minuteId = info.lastInsertRowid;
    try {
      const row = db.prepare('SELECT * FROM meeting_minutes WHERE id = ?').get(minuteId);
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(created_by);
      notifyMinutaParticipants(db, row, created_by, {
        type: 'meeting',
        title: 'Nueva minuta',
        message: `${actor?.name || 'Alguien'} registró la minuta "${n.tema || 'sin tema'}" (${n.fecha}).`,
        module: 'minutas',
        related_id: Number(minuteId),
      });
    } catch (_) { /* noop */ }
    res.status(201).json({ id: minuteId, message: 'Minuta creada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al crear la minuta.' });
  }
};

const updateMinute = (req, res) => {
  try {
    const n = normalizePayload(req.body);
    if (n.error) return res.status(400).json({ message: n.error });
    const db = getDb();
    const exists = db.prepare('SELECT * FROM meeting_minutes WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ message: 'Minuta no encontrada.' });

    const meetingId = n.meeting_id ?? exists.meeting_id;
    if (meetingId && !canManageMeetingMinuteById(db, req.user, meetingId)) {
      return res.status(403).json({
        message: 'Solo el organizador de la reunión o un superadministrador puede editar la minuta.',
      });
    }

    const audioPathProvided = Object.prototype.hasOwnProperty.call(req.body, 'audio_path');
    const audioPathToSave = audioPathProvided ? n.audio_path : exists.audio_path;

    if (audioPathProvided && n.audio_path && exists.audio_path && n.audio_path !== exists.audio_path) {
      deleteAudioFileIfExists(exists.audio_path);
    }

    db.prepare(
      `UPDATE meeting_minutes SET
        lugar = ?, fecha = ?, hora_inicio = ?, hora_cierre = ?, tema = ?,
        attendees_json = ?, topics_json = ?, meeting_id = ?, transcript_text = ?, audio_path = ?,
        tema_principal_json = ?, desarrollo_json = ?, acuerdos_json = ?,
        next_meeting_planned = ?, next_meeting_fecha = ?, next_meeting_hora = ?, next_meeting_hora_fin = ?,
        next_meeting_lugar = ?, next_meeting_location_type = ?, next_meeting_scheduled_id = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      n.lugar,
      n.fecha,
      n.hora_inicio,
      n.hora_cierre,
      n.tema,
      JSON.stringify(n.attendees),
      JSON.stringify(n.topics),
      n.meeting_id,
      n.transcript_text,
      audioPathToSave,
      JSON.stringify(n.tema_principal),
      JSON.stringify(n.desarrollo),
      JSON.stringify(n.acuerdos),
      n.next_meeting_planned,
      n.next_meeting_fecha,
      n.next_meeting_hora,
      n.next_meeting_hora_fin,
      n.next_meeting_lugar,
      n.next_meeting_location_type,
      n.next_meeting_scheduled_id,
      req.params.id
    );
    try {
      const row = db.prepare('SELECT * FROM meeting_minutes WHERE id = ?').get(req.params.id);
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user?.id);
      notifyMinutaParticipants(db, row, req.user?.id, {
        type: 'meeting',
        title: 'Minuta actualizada',
        message: `${actor?.name || 'Alguien'} actualizó la minuta "${n.tema || exists.tema || 'sin tema'}".`,
        module: 'minutas',
        related_id: Number(req.params.id),
      });
    } catch (_) { /* noop */ }
    res.json({ message: 'Minuta actualizada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar la minuta.' });
  }
};

const deleteMinute = (req, res) => {
  try {
    if (!isSuperadminUser(req.user)) {
      return res.status(403).json({ message: 'Solo el superadministrador puede eliminar minutas.' });
    }
    const db = getDb();
    const row = db.prepare('SELECT * FROM meeting_minutes WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ message: 'Minuta no encontrada.' });
    try {
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user?.id);
      notifyMinutaParticipants(db, row, req.user?.id, {
        type: 'meeting',
        title: 'Minuta eliminada',
        message: `${actor?.name || 'Alguien'} eliminó la minuta "${row.tema || 'sin tema'}".`,
        module: 'minutas',
        related_id: Number(req.params.id),
      });
    } catch (_) { /* noop */ }
    if (row.audio_path) deleteAudioFileIfExists(row.audio_path);
    db.prepare('DELETE FROM meeting_minutes WHERE id = ?').run(req.params.id);
    res.json({ message: 'Minuta eliminada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar la minuta.' });
  }
};

const streamMinuteAudio = (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT id, audio_path FROM meeting_minutes WHERE id = ?').get(req.params.id);
    if (!row?.audio_path) {
      return res.status(404).json({ message: 'Esta minuta no tiene grabación de audio.' });
    }
    const fullPath = resolveAudioFile(row.audio_path);
    streamAudioFile(req, res, fullPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al reproducir el audio.' });
  }
};

module.exports = {
  listMinutes,
  getMinuteByMeeting,
  getMinute,
  createMinute,
  updateMinute,
  deleteMinute,
  streamMinuteAudio,
};
