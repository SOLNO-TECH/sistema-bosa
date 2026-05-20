const VALID_LOCATION_TYPES = ['virtual', 'sala_juntas'];

function normalizeLocationType(value) {
  return VALID_LOCATION_TYPES.includes(value) ? value : 'sala_juntas';
}

function parseTime(iso) {
  return new Date(iso).getTime();
}

function rangesOverlap(startA, endA, startB, endB) {
  return parseTime(startA) < parseTime(endB) && parseTime(startB) < parseTime(endA);
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

module.exports = {
  VALID_LOCATION_TYPES,
  normalizeLocationType,
  rangesOverlap,
  findSalaConflict,
};
