const { getDb } = require('../database/init');

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

function normalizePayload(body) {
  const {
    lugar = '',
    fecha,
    hora_inicio = '',
    hora_cierre = '',
    tema = '',
    attendees,
    topics,
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
  return {
    lugar: String(lugar).trim(),
    fecha: String(fecha).trim(),
    hora_inicio: String(hora_inicio).trim(),
    hora_cierre: String(hora_cierre).trim(),
    tema: String(tema).trim(),
    attendees: att,
    topics: top,
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
    const out = mapRow(row);
    if (!out) return res.status(404).json({ message: 'Minuta no encontrada.' });
    res.json(out);
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
    const info = db
      .prepare(
        `INSERT INTO meeting_minutes
         (lugar, fecha, hora_inicio, hora_cierre, tema, attendees_json, topics_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        n.lugar,
        n.fecha,
        n.hora_inicio,
        n.hora_cierre,
        n.tema,
        JSON.stringify(n.attendees),
        JSON.stringify(n.topics),
        created_by
      );
    res.status(201).json({ id: info.lastInsertRowid, message: 'Minuta creada.' });
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
    const exists = db.prepare('SELECT id FROM meeting_minutes WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ message: 'Minuta no encontrada.' });

    db.prepare(
      `UPDATE meeting_minutes SET
        lugar = ?, fecha = ?, hora_inicio = ?, hora_cierre = ?, tema = ?,
        attendees_json = ?, topics_json = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      n.lugar,
      n.fecha,
      n.hora_inicio,
      n.hora_cierre,
      n.tema,
      JSON.stringify(n.attendees),
      JSON.stringify(n.topics),
      req.params.id
    );
    res.json({ message: 'Minuta actualizada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar la minuta.' });
  }
};

const deleteMinute = (req, res) => {
  try {
    const db = getDb();
    const r = db.prepare('DELETE FROM meeting_minutes WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ message: 'Minuta no encontrada.' });
    res.json({ message: 'Minuta eliminada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar la minuta.' });
  }
};

module.exports = {
  listMinutes,
  getMinute,
  createMinute,
  updateMinute,
  deleteMinute,
};
