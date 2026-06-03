/**
 * Contexto de sesión por usuario — refuerza comandos cortos y seguimiento.
 */
const { resolveVoicePick } = require('./voiceAssigneeResolver');

const TTL_MS = 8 * 60 * 1000;
const sessions = new Map();
const postExecute = new Map();

function getSession(userId) {
  if (!userId) return null;
  const row = sessions.get(Number(userId));
  if (!row) return null;
  if (Date.now() - row.at > TTL_MS) {
    sessions.delete(Number(userId));
    return null;
  }
  return row;
}

function rememberSession(userId, transcript, parsed, activeModule) {
  if (!userId || !parsed) return;
  sessions.set(Number(userId), {
    transcript: String(transcript || '').slice(0, 500),
    intent: parsed.intent,
    params: parsed.params || {},
    summary: parsed.summary || '',
    activeModule: activeModule || '',
    needsClarification: Boolean(parsed.needsClarification),
    pendingVoicePick: parsed.pendingVoicePick || null,
    at: Date.now(),
  });
}

function clearSession(userId) {
  if (userId) sessions.delete(Number(userId));
}

function rememberPostExecute(userId, data) {
  if (!userId || !data) return;
  postExecute.set(Number(userId), { ...data, at: Date.now() });
}

function getPostExecute(userId) {
  if (!userId) return null;
  const row = postExecute.get(Number(userId));
  if (!row) return null;
  if (Date.now() - row.at > TTL_MS) {
    postExecute.delete(Number(userId));
    return null;
  }
  return row;
}

function clearPostExecute(userId) {
  if (userId) postExecute.delete(Number(userId));
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Si hay desambiguación pendiente, intenta resolver con la nueva frase corta.
 */
function tryResolvePendingVoicePick(transcript, userId, users = []) {
  const session = getSession(userId);
  const pick = session?.pendingVoicePick;
  if (!pick?.options?.length) return null;

  const t = normalizeText(transcript);
  if (!t || t.split(/\s+/).length > 10) return null;

  const field = pick.field || 'assigned_to';
  const resolvedId = resolveVoicePick(transcript, pick.options);
  if (!resolvedId) return null;

  const mergedParams = { ...(session.params || {}), ...(field === 'assigned_to' ? { [field]: resolvedId } : {}) };
  if (field === 'attendees') {
    const list = Array.isArray(mergedParams.attendees) ? [...mergedParams.attendees] : [];
    if (!list.includes(resolvedId)) list.push(resolvedId);
    mergedParams.attendees = list;
  } else if (field === 'assigned_to') {
    mergedParams.assigned_to = resolvedId;
    if (users.length) {
      const u = users.find((x) => Number(x.id) === Number(resolvedId));
      if (u) mergedParams.assignee_label = `${u.name || ''} ${u.apellido || ''}`.trim();
      if (u?.departamento && !mergedParams.department) mergedParams.department = u.departamento;
    }
  }

  return {
    intent: session.intent,
    params: mergedParams,
    transcript: `${session.transcript} ${transcript}`.replace(/\s+/g, ' ').trim(),
    pendingVoicePick: null,
    voicePickResolved: true,
  };
}

/**
 * Completa comandos cortos con el contexto previo.
 */
function mergeWithSessionContext(transcript, userId) {
  const session = getSession(userId);
  if (!session) return transcript;

  const t = normalizeText(transcript);
  if (!t) return transcript;

  if (session.pendingVoicePick?.options?.length >= 2 && t.split(/\s+/).length <= 8) {
    return transcript;
  }

  if (session.needsClarification || session.pendingVoicePick) {
    return `${session.transcript} ${transcript}`.replace(/\s+/g, ' ').trim().slice(0, 500);
  }

  if (t.length > 120) return transcript;

  const isShortFollowUp =
    t.split(/\s+/).length <= 8 &&
    (/\b(manana|mañana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(t) ||
      /\b(a\s+las|para\s+las|\d{1,2}(:\d{2})?\s*(am|pm)?)\b/.test(t) ||
      /\b(titulo|titulo|departamento|asignar|prioridad|virtual|sala|responsable|asignado|asignada|descripcion|descripción|contenido|mensaje|inicio|fin|invitar|participantes|semanal|quincenal|mensual)\b/.test(
        t,
      ) ||
      /^[a-záéíóúñ\s.'-]{2,40}$/i.test(t));

  if (!isShortFollowUp) return transcript;

  return transcript;
}

function getSessionForParse(userId) {
  const session = getSession(userId);
  if (!session) return null;
  return {
    intent: session.intent,
    params: session.params || {},
    needsClarification: Boolean(session.needsClarification),
    pendingVoicePick: session.pendingVoicePick || null,
    transcript: session.transcript || '',
    activeModule: session.activeModule || '',
  };
}

module.exports = {
  rememberSession,
  getSession,
  getSessionForParse,
  clearSession,
  mergeWithSessionContext,
  tryResolvePendingVoicePick,
  rememberPostExecute,
  getPostExecute,
  clearPostExecute,
};
