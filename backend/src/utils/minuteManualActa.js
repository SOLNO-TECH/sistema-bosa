function safeJson(s, fallback) {
  try {
    const v = JSON.parse(s || '');
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/** True si el acta tiene tema principal, desarrollo, acuerdos o temas del día con contenido. */
function minuteHasManualActa(row) {
  if (!row) return false;

  const tema = safeJson(row.tema_principal_json, []);
  const acuerdos = safeJson(row.acuerdos_json, []);
  const desarrollo = safeJson(row.desarrollo_json, []);

  if (tema.some((s) => String(s ?? '').trim())) return true;
  if (acuerdos.some((s) => String(s ?? '').trim())) return true;
  if (desarrollo.some((s) => String(s ?? '').trim())) return true;

  const topics = safeJson(row.topics_json, []);
  return topics.some(
    (t) =>
      String(t?.titulo ?? '').trim() ||
      String(t?.descripcion ?? '').trim() ||
      String(t?.comentarios ?? '').trim(),
  );
}

/** Reunión con acta manual (no solo audio/transcripción Saya). */
function meetingHasManualMinute(db, meetingId) {
  if (!db || !meetingId) return false;
  const row = db
    .prepare(
      `SELECT tema_principal_json, desarrollo_json, acuerdos_json, topics_json
       FROM meeting_minutes
       WHERE meeting_id = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(meetingId);
  return minuteHasManualActa(row);
}

module.exports = {
  minuteHasManualActa,
  meetingHasManualMinute,
};
