/**
 * Organiza transcripciones por hablante (sin API de pago).
 * - Sala física: detecta "Nombre Apellido:" o "soy Nombre" contra participantes de la reunión.
 * - Virtual: mismas reglas + texto continuo si no hay etiquetas.
 * Diarización automática real (pyannote) queda para cuando DIARIZATION_BIN esté en .env.
 */

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function userFullName(u) {
  return `${u.name || ''} ${u.apellido || ''}`.trim();
}

function matchAttendeeByHint(hint, attendees) {
  const q = normalizeText(hint);
  if (!q || q.length < 2) return null;
  const hits = attendees.filter((u) => {
    const hay = normalizeText([userFullName(u), u.name, u.apellido].filter(Boolean).join(' '));
    return hay.includes(q) || q.split(' ').every((w) => w.length > 2 && hay.includes(w));
  });
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    const exact = hits.find((u) => normalizeText(userFullName(u)) === q);
    return exact || hits[0];
  }
  return null;
}

/**
 * @param {string} rawTranscript
 * @param {object[]} attendeeUsers — usuarios participantes
 * @param {'virtual'|'sala_juntas'} locationType
 */
function structureTranscript(rawTranscript, attendeeUsers = [], locationType = 'sala_juntas') {
  const raw = String(rawTranscript || '').trim();
  if (!raw) {
    return { formattedText: '', segments: [], speakerCount: 0, method: 'empty' };
  }

  const attendees = Array.isArray(attendeeUsers) ? attendeeUsers : [];
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const segments = [];
  let currentSpeaker = null;
  let currentText = [];

  const flush = () => {
    if (currentText.length) {
      segments.push({
        speaker: currentSpeaker || 'Participante',
        text: currentText.join(' ').trim(),
      });
      currentText = [];
    }
  };

  const labeledLine = (line) => {
    const m1 = line.match(/^([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{2,40})\s*:\s*(.+)$/);
    if (m1) return { hint: m1[1].trim(), text: m1[2].trim() };
    const m2 = line.match(/^(?:soy|habla)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{2,40})\s*[,.]?\s*(.*)$/i);
    if (m2) return { hint: m2[1].trim(), text: m2[2].trim() };
    return null;
  };

  for (const line of lines.length ? lines : [raw]) {
    const labeled = labeledLine(line);
    if (labeled) {
      flush();
      const user = matchAttendeeByHint(labeled.hint, attendees);
      currentSpeaker = user ? userFullName(user) : labeled.hint;
      if (labeled.text) currentText.push(labeled.text);
      continue;
    }
    currentText.push(line);
  }
  flush();

  if (segments.length <= 1 && attendees.length > 0 && locationType === 'sala_juntas') {
    const sentences = raw.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
    const reSeg = [];
    let sp = null;
    let buf = [];
    const flushSent = () => {
      if (buf.length) {
        reSeg.push({ speaker: sp || 'Participante', text: buf.join(' ').trim() });
        buf = [];
      }
    };
    for (const sent of sentences) {
      const labeled = labeledLine(sent.trim());
      if (labeled) {
        flushSent();
        const user = matchAttendeeByHint(labeled.hint, attendees);
        sp = user ? userFullName(user) : labeled.hint;
        if (labeled.text) buf.push(labeled.text);
      } else {
        buf.push(sent.trim());
      }
    }
    flushSent();
    if (reSeg.length > 1) {
      return finalizeSegments(reSeg, locationType, 'labeled_parse');
    }
  }

  if (segments.length === 0) {
    segments.push({ speaker: locationType === 'virtual' ? 'Reunión virtual' : 'Grabación grupal', text: raw });
  }

  return finalizeSegments(segments, locationType, segments.length > 1 ? 'labeled_parse' : 'single_block');
}

function finalizeSegments(segments, locationType, method) {
  const formattedText = segments
    .map((s) => `[${s.speaker}] ${s.text}`)
    .join('\n\n');
  const uniqueSpeakers = new Set(segments.map((s) => s.speaker));
  return {
    formattedText,
    segments,
    speakerCount: uniqueSpeakers.size,
    method,
    locationType,
  };
}

module.exports = {
  structureTranscript,
  matchAttendeeByHint,
  userFullName,
};
