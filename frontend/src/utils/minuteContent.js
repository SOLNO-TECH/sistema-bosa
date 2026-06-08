function hasBulletItems(arr) {
  return Array.isArray(arr) && arr.some((s) => String(s ?? '').trim());
}

/** True si la minuta tiene contenido capturado por el usuario (no solo metadatos de la reunión). */
export function minuteHasUserContent(minute) {
  if (!minute) return false;

  if (hasBulletItems(minute.tema_principal) || hasBulletItems(minute.desarrollo) || hasBulletItems(minute.acuerdos)) {
    return true;
  }

  if (minute.next_meeting_planned === 'yes' && String(minute.next_meeting_fecha ?? '').trim()) return true;
  if (String(minute.transcript_text ?? '').trim()) return true;
  if (minute.audio_path) return true;

  const topics = Array.isArray(minute.topics) ? minute.topics : [];
  return topics.some(
    (t) =>
      String(t?.titulo ?? '').trim() ||
      String(t?.descripcion ?? '').trim() ||
      String(t?.comentarios ?? '').trim(),
  );
}
