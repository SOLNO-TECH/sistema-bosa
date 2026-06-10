export const BULLET_ROWS = 6;

function hasBulletItems(arr) {
  return Array.isArray(arr) && arr.some((s) => String(s ?? '').trim());
}

/** True si el acta manual tiene tema principal, desarrollo o acuerdos (no solo audio/transcripción). */
export function minuteHasManualActa(minute) {
  if (!minute) return false;

  if (hasBulletItems(minute.tema_principal) || hasBulletItems(minute.acuerdos)) {
    return true;
  }
  if (typeof minute.desarrollo === 'string' ? minute.desarrollo.trim() : hasBulletItems(minute.desarrollo)) {
    return true;
  }

  const topics = Array.isArray(minute.topics) ? minute.topics : [];
  return topics.some(
    (t) =>
      String(t?.titulo ?? '').trim() ||
      String(t?.descripcion ?? '').trim() ||
      String(t?.comentarios ?? '').trim(),
  );
}

/** True si la minuta tiene contenido capturado por el usuario (no solo metadatos de la reunión). */
export function minuteHasUserContent(minute) {
  if (!minute) return false;

  if (hasBulletItems(minute.tema_principal) || hasBulletItems(minute.acuerdos)) {
    return true;
  }
  if (typeof minute.desarrollo === 'string' ? minute.desarrollo.trim() : hasBulletItems(minute.desarrollo)) {
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

/** Formato Synerteam (manual): tema_principal, desarrollo, acuerdos. */
export function hasSynerteamFields(record) {
  if (!record) return false;
  const tp = Array.isArray(record.tema_principal) ? record.tema_principal.filter((s) => String(s).trim()) : [];
  const dev = Array.isArray(record.desarrollo)
    ? record.desarrollo.filter((s) => String(s).trim())
    : (String(record.desarrollo ?? '').trim() ? [String(record.desarrollo).trim()] : []);
  const ac = Array.isArray(record.acuerdos) ? record.acuerdos.filter((s) => String(s).trim()) : [];
  return tp.length > 0 || dev.length > 0 || ac.length > 0;
}

export function desarrolloFromRecord(list) {
  if (!Array.isArray(list)) return '';
  const items = list.map((s) => String(s ?? '').trim()).filter(Boolean);
  if (!items.length) return '';
  return items.length === 1 ? items[0] : items.join('\n\n');
}

export function bulletsFromRecord(list, count = BULLET_ROWS) {
  const items = Array.isArray(list) ? list.filter((s) => String(s).trim()) : [];
  const rows = [...items];
  while (rows.length < count) rows.push('');
  return rows;
}

export function cleanBullets(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((s) => String(s).trim())
    .filter(Boolean);
}

export function desarrolloToPayload(text) {
  const trimmed = String(text ?? '').trim();
  return trimmed ? [trimmed] : [];
}

function splitBulletLines(text) {
  return String(text || '')
    .split(/\n+/)
    .map((s) => s.replace(/^\d+\.\s*/, '').replace(/^•\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Convierte minutas antiguas (3 temas del día / voz) al formato manual Synerteam.
 */
export function ensureSynerteamFormat(record) {
  if (!record) return record;
  if (hasSynerteamFields(record)) {
    return {
      ...record,
      desarrollo: Array.isArray(record.desarrollo)
        ? desarrolloFromRecord(record.desarrollo)
        : String(record.desarrollo ?? ''),
    };
  }

  const topics = Array.isArray(record.topics) ? record.topics : [];
  const hasLegacy = topics.some(
    (t) => String(t?.descripcion ?? '').trim() || String(t?.titulo ?? '').trim(),
  );
  if (!hasLegacy) return record;

  const t0 = topics[0] || {};
  const t1 = topics[1] || {};
  const t2 = topics[2] || {};

  let tema_principal = [];
  let desarrollo = '';
  let acuerdos = [];

  const desc0 = String(t0.descripcion || '');
  if (desc0.includes('Puntos tratados:')) {
    const [summaryPart, pointsPart] = desc0.split(/\n\nPuntos tratados:\n?/);
    desarrollo = (summaryPart || '').trim();
    tema_principal = splitBulletLines(pointsPart);
  } else {
    desarrollo = desc0.trim();
    if (t0.titulo && !/resumen/i.test(t0.titulo)) {
      tema_principal = [String(t0.titulo).trim()];
    }
  }

  const comments0 = String(t0.comentarios || '').trim();
  if (comments0 && !comments0.startsWith('Tip:')) {
    desarrollo = [desarrollo, comments0].filter(Boolean).join('\n\n');
  }

  acuerdos = [...splitBulletLines(t1.descripcion), ...splitBulletLines(t2.descripcion)];

  return {
    ...record,
    tema_principal,
    desarrollo,
    acuerdos,
  };
}

export function emptyLegacyTopics() {
  return [
    { titulo: '', descripcion: '', comentarios: '' },
    { titulo: '', descripcion: '', comentarios: '' },
    { titulo: '', descripcion: '', comentarios: '' },
  ];
}

/**
 * Payload al guardar desde minuta Saya (sin Pro): solo metadatos, audio y transcripción.
 * El análisis IA no se persiste; el backend refuerza esto con save_source.
 */
/** Audio Saya guardado y aún disponible (no expirado). */
export function minuteHasPlayableAudio(minute) {
  return Boolean(minute?.audio_available && (minute?.audio_url || minute?.audio_path));
}

export function formatAudioExpiryHint(minute) {
  if (!minuteHasPlayableAudio(minute)) return null;
  if (minute.audio_permanent) return null;
  if (minute.audio_expires_at) {
    try {
      const exp = new Date(String(minute.audio_expires_at).replace(' ', 'T'));
      if (!Number.isNaN(exp.getTime())) {
        return `Disponible hasta ${exp.toLocaleString('es-MX', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })} · se elimina automáticamente (Plan Pro: permanente)`;
      }
    } catch (_) {
      /* noop */
    }
  }
  if (minute.audio_retention_hours) {
    return `Se elimina en ${minute.audio_retention_hours} horas (Plan Pro: permanente)`;
  }
  return null;
}

export function buildSayaVoiceMinutePayload(form, { meetingId, transcript, recordingAudioPath } = {}) {
  const payload = {
    lugar: form.lugar,
    fecha: form.fecha,
    hora_inicio: form.hora_inicio,
    hora_cierre: form.hora_cierre,
    tema: form.tema,
    attendees: form.attendees,
    meeting_id: meetingId,
    transcript_text: form.transcript_text || transcript || '',
    save_source: 'saya_voice',
    tema_principal: [],
    desarrollo: [],
    acuerdos: [],
    topics: emptyLegacyTopics(),
    next_meeting_planned: 'no',
  };
  if (recordingAudioPath) {
    payload.audio_path = recordingAudioPath;
  }
  return payload;
}

/** Espejo legacy para compatibilidad con registros que aún lean topics_json. */
export function synerteamToLegacyTopics(tema_principal, desarrollo, acuerdos) {
  return [
    {
      titulo: 'Tema principal',
      descripcion: cleanBullets(tema_principal).join('\n'),
      comentarios: '',
    },
    {
      titulo: 'Desarrollo',
      descripcion: desarrolloToPayload(desarrollo).join('\n'),
      comentarios: '',
    },
    {
      titulo: 'Acuerdos',
      descripcion: cleanBullets(acuerdos).join('\n'),
      comentarios: '',
    },
  ];
}
