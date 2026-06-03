/**
 * Genera borrador de minuta desde transcripción (reglas, sin API de pago).
 * Produce 3 temas del día (compatible con PDF) + minute_brief para vista previa en UI.
 */

const AGREEMENT_MARKERS = [
  'se acuerda',
  'acordamos',
  'quedó acordado',
  'quedó',
  'queda acordado',
  'queda',
  'decidimos',
  'decidió',
  'aprobamos',
  'aprobó',
  'aprobado',
  'resolvió',
  'resolvimos',
  'se autoriza',
  'autorizamos',
  'confirmamos',
  'confirmó',
  'unánime',
  'por mayoría',
];

const TASK_MARKERS = [
  'pendiente',
  'tarea',
  'asignar',
  'asignado',
  'asignada',
  'responsable',
  'entregar',
  'deadline',
  'para el',
  'debe',
  'hay que',
  'compromiso',
  'seguimiento',
  'dar seguimiento',
  'hacer',
  'realizar',
  'enviar',
  'revisar',
  'preparar',
  'completar',
  'antes de',
  'para la próxima',
  'para la proxima',
];

const DISCUSSION_MARKERS = [
  'se habló',
  'se hablo',
  'se discutió',
  'se discutio',
  'se presentó',
  'se presento',
  'se revisó',
  'se reviso',
  'se analizó',
  'se analizo',
  'se comentó',
  'se comento',
  'se mencionó',
  'se menciono',
  'propuso',
  'propusieron',
  'explicó',
  'explico',
  'informó',
  'informo',
  'reportó',
  'reporto',
  'punto',
  'tema',
  'asunto',
  'cuestión',
  'cuestion',
];

const FILLER_STARTS = /^(bueno|ok|vale|entonces|pues|eh|mm+|a ver|como|bueno pues)\b/i;

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSpeakerTags(text) {
  return String(text || '')
    .replace(/^\[[^\]]+\]\s*/gm, '')
    .replace(/\[[^\]]+\]\s*/g, '')
    .trim();
}

function splitSentences(text) {
  return stripSpeakerTags(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4 && !FILLER_STARTS.test(s));
}

function lineMatchesAny(line, markers) {
  const low = normalizeText(line);
  return markers.some((m) => low.includes(m));
}

function capitalizeFirst(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatBulletList(items, emptyLabel) {
  const clean = items.map((s) => capitalizeFirst(s)).filter(Boolean);
  if (!clean.length) return emptyLabel;
  return clean.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

function extractAssigneeHint(sentence) {
  const raw = String(sentence || '');
  const patterns = [
    /(?:asignar(?:se)?|pendiente|responsable|encargad[oa])\s+(?:a|de|para)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{2,40})/i,
    /^([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{2,30})\s+(?:debe|va a|encargad[oa]|responsable)/i,
    /(?:a cargo de|a nombre de)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{2,40})/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) return m[1].trim().replace(/\s+(debe|va|encargad.*)$/i, '').trim();
  }
  return null;
}

function extractLines(text, markers, max = 15) {
  const lines = splitSentences(text);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    if (!lineMatchesAny(line, markers)) continue;
    const key = normalizeText(line);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

function extractKeyPoints(text, agreements, tasks) {
  const lines = splitSentences(text);
  const used = new Set([...agreements, ...tasks].map(normalizeText));
  const points = [];

  for (const line of lines) {
    const key = normalizeText(line);
    if (used.has(key)) continue;
    if (lineMatchesAny(line, AGREEMENT_MARKERS) || lineMatchesAny(line, TASK_MARKERS)) continue;
    if (lineMatchesAny(line, DISCUSSION_MARKERS) || line.length > 40) {
      points.push(line);
      used.add(key);
    }
    if (points.length >= 8) break;
  }

  if (points.length < 3) {
    for (const line of lines) {
      const key = normalizeText(line);
      if (used.has(key)) continue;
      if (lineMatchesAny(line, AGREEMENT_MARKERS) || lineMatchesAny(line, TASK_MARKERS)) continue;
      points.push(line);
      used.add(key);
      if (points.length >= 6) break;
    }
  }

  return points.slice(0, 8);
}

function buildExecutiveSummary(keyPoints, text) {
  if (keyPoints.length >= 2) {
    return keyPoints.slice(0, 2).map(capitalizeFirst).join(' ');
  }
  const sentences = splitSentences(text);
  if (sentences.length) {
    return sentences.slice(0, 2).map(capitalizeFirst).join(' ');
  }
  return capitalizeFirst(stripSpeakerTags(text).slice(0, 400));
}

function buildActionItems(text) {
  const lines = extractLines(text, TASK_MARKERS, 12);
  return lines.map((line) => ({
    text: capitalizeFirst(line),
    assignee_hint: extractAssigneeHint(line),
  }));
}

function isoToDatePart(iso) {
  if (!iso) return '';
  if (iso.includes('T')) return iso.split('T')[0];
  return String(iso).slice(0, 10);
}

function isoToTimePart(iso) {
  if (!iso) return '';
  const part = iso.includes('T') ? iso.split('T')[1] : iso;
  return String(part).slice(0, 5);
}

function locationLabel(type) {
  if (type === 'virtual') return 'Reunión virtual';
  return 'Sala de juntas';
}

function buildAttendeesFromMeeting(meeting, usersById) {
  const ids = Array.isArray(meeting.attendees) ? meeting.attendees : [];
  const rows = ids
    .map((id) => usersById.get(Number(id)))
    .filter(Boolean)
    .map((u) => ({
      nombre: [u.name, u.apellido].filter(Boolean).join(' ').trim(),
      cargo: [u.puesto, u.departamento].filter(Boolean).join(' · ') || '',
      asistencia: 'Presente',
    }));

  while (rows.length < 6) {
    rows.push({ nombre: '', cargo: '', asistencia: 'Presente' });
  }
  return rows;
}

function buildInterventions(segments) {
  if (!Array.isArray(segments) || segments.length <= 1) return [];
  return segments
    .filter((s) => s?.text?.trim())
    .map((s) => ({
      speaker: s.speaker || 'Participante',
      text: String(s.text).trim(),
      word_count: String(s.text).trim().split(/\s+/).filter(Boolean).length,
    }));
}

function buildTopicsForPdf({ executiveSummary, keyPoints, agreements, actionItems, interventions, meeting }) {
  const keyPointsText = formatBulletList(
    keyPoints,
    'No se detectaron puntos específicos; revisa la transcripción.',
  );
  const agreementsText = formatBulletList(
    agreements,
    'Sin acuerdos detectados automáticamente. Revisa la transcripción o agrégalos manualmente.',
  );
  const actionLines = actionItems.map((item) => {
    const who = item.assignee_hint ? ` (Responsable: ${item.assignee_hint})` : '';
    return `${item.text}${who}`;
  });
  const actionsText = formatBulletList(
    actionLines,
    'Sin compromisos detectados automáticamente.',
  );

  const interventionComment =
    interventions.length > 1
      ? interventions
          .slice(0, 6)
          .map((i) => `• ${i.speaker}: ${i.text.slice(0, 120)}${i.text.length > 120 ? '…' : ''}`)
          .join('\n')
      : meeting.location_type === 'sala_juntas'
        ? 'Tip: en sala, pide a cada persona decir su nombre antes de hablar (ej. "María López: …").'
        : '';

  return [
    {
      titulo: 'Resumen y puntos tratados',
      descripcion: [executiveSummary, '', 'Puntos tratados:', keyPointsText].filter(Boolean).join('\n'),
      comentarios: interventionComment,
    },
    {
      titulo: 'Acuerdos',
      descripcion: agreementsText,
      comentarios: agreements.length ? `${agreements.length} acuerdo(s) detectado(s) en la grabación.` : '',
    },
    {
      titulo: 'Compromisos y seguimiento',
      descripcion: actionsText,
      comentarios: actionItems.length ? `${actionItems.length} compromiso(s) o pendiente(s) detectado(s).` : '',
    },
  ];
}

/**
 * @param {object} meeting — reunión parseada (attendees array)
 * @param {Map<number, object>} usersById
 * @param {string} transcript
 * @param {object|null} structured — salida de structureTranscript
 */
function buildMinuteDraftFromTranscript(meeting, usersById, transcript, structured = null) {
  const text = String(structured?.formattedText || transcript || '').trim();
  const segments = Array.isArray(structured?.segments) ? structured.segments : [];
  const plainText = stripSpeakerTags(text) || text;

  const agreements = extractLines(plainText, AGREEMENT_MARKERS);
  const actionItems = buildActionItems(plainText);
  const keyPoints = extractKeyPoints(plainText, agreements, actionItems.map((a) => a.text));
  const executiveSummary = buildExecutiveSummary(keyPoints, plainText);
  const interventions = buildInterventions(segments);

  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const sentenceCount = splitSentences(plainText).length;
  const speakerCount = structured?.speakerCount ?? (interventions.length > 1 ? new Set(interventions.map((i) => i.speaker)).size : 0);

  const minute_brief = {
    executive_summary: executiveSummary,
    key_points: keyPoints.map(capitalizeFirst),
    agreements: agreements.map(capitalizeFirst),
    action_items: actionItems,
    interventions,
    stats: {
      word_count: wordCount,
      sentence_count: sentenceCount,
      speaker_count: speakerCount,
      agreements_count: agreements.length,
      action_items_count: actionItems.length,
      key_points_count: keyPoints.length,
    },
  };

  const topics = buildTopicsForPdf({
    executiveSummary,
    keyPoints,
    agreements,
    actionItems,
    interventions,
    meeting,
  });

  return {
    meeting_id: meeting.id,
    lugar: locationLabel(meeting.location_type),
    fecha: isoToDatePart(meeting.start_time),
    hora_inicio: isoToTimePart(meeting.start_time),
    hora_cierre: isoToTimePart(meeting.end_time),
    tema: meeting.title || '',
    attendees: buildAttendeesFromMeeting(meeting, usersById),
    topics,
    transcript_text: text,
    transcript_segments: segments,
    speaker_count: speakerCount,
    minute_brief,
  };
}

module.exports = {
  buildMinuteDraftFromTranscript,
  splitSentences,
  extractLines,
  formatBulletList,
};
