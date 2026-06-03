/**
 * Asignar ticket a responsable por voz.
 */

const { resolveAssignee, buildVoicePickPrompt } = require('./voiceAssigneeResolver');

function lazyParser() {
  return require('../voiceCommandParserService');
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function userFullName(u) {
  return `${u?.name || ''} ${u?.apellido || ''}`.trim();
}

function resolveTicketId(raw, text, postExecute = null) {
  const parser = lazyParser();
  const fromText = parser.extractTicketId?.(raw);
  if (fromText) return fromText;

  const t = normalizeText(text);
  if (/\b(este|ese|el|ultimo|último)\s+ticket\b/.test(t) && postExecute?.ticket_id) {
    return Number(postExecute.ticket_id);
  }
  if (postExecute?.ticket_id && /\basignar\b/.test(t) && !/\bticket\s*#?\s*\d+/i.test(raw)) {
    return Number(postExecute.ticket_id);
  }
  return null;
}

function extractAssigneeFromRaw(raw, users, actor) {
  const hint =
    lazyParser().extractAssigneeHint?.(raw) ||
    raw.match(/(?:asignar(?:le|la|lo)?|asigna)\s+(?:el\s+)?(?:ticket\s*#?\s*\d+\s+)?(?:a\s+)?(.+)/i)?.[1]?.trim() ||
    raw.match(/(?:responsable|encargado)\s*(?:es|:|-)\s*(.+)/i)?.[1]?.trim() ||
    '';
  if (!hint) return { assigned_to: null, assignee_hint: '', pendingVoicePick: null };
  const resolved = resolveAssignee(users, hint.replace(/\s+ticket.*$/i, '').trim(), actor);
  return {
    assigned_to: resolved.assigned_to,
    assignee_hint: hint,
    assignee_label: resolved.assigned_to
      ? userFullName(users.find((u) => Number(u.id) === Number(resolved.assigned_to)))
      : '',
    pendingVoicePick: resolved.needsVoicePick,
  };
}

function evaluateAssignParams(params) {
  const missing = [];
  if (!params?.ticket_id) missing.push('número de ticket');
  if (!params?.assigned_to) missing.push('responsable');
  return { params, missing, ready: missing.length === 0 && !params?.pendingVoicePick };
}

function buildAssignTicketFromUtterance(raw, text, users = [], actor = null, postExecute = null) {
  const ticketId = resolveTicketId(raw, text, postExecute);
  const assignee = extractAssigneeFromRaw(raw, users, actor);

  const params = {
    ticket_id: ticketId,
    assigned_to: assignee.assigned_to,
    assignee_hint: assignee.assignee_hint,
    assignee_label: assignee.assignee_label,
  };

  const { missing, ready } = evaluateAssignParams({
    ...params,
    pendingVoicePick: assignee.pendingVoicePick,
  });

  return {
    intent: 'assign_ticket',
    confidence: ready ? 'high' : ticketId && assignee.assigned_to ? 'high' : 'medium',
    params,
    pendingVoicePick: assignee.pendingVoicePick,
    assignMissing: missing,
    summary: ready
      ? `Asignar ticket #${ticketId} a ${assignee.assignee_label}`
      : ticketId
        ? `Asignar ticket #${ticketId}`
        : 'Asignar ticket a responsable',
    allowed: true,
    denyReason: null,
  };
}

function continueAssignTicket(raw, text, session, users = [], actor = null, postExecute = null) {
  if (!session || session.intent !== 'assign_ticket') return null;

  const combinedRaw = `${session.transcript || ''} ${raw}`.replace(/\s+/g, ' ').trim().slice(0, 500);
  const combinedText = normalizeText(combinedRaw);
  const built = buildAssignTicketFromUtterance(combinedRaw, combinedText, users, actor, postExecute);

  const merged = {
    ...(session.params || {}),
    ...built.params,
  };
  if (!merged.ticket_id && postExecute?.ticket_id) merged.ticket_id = postExecute.ticket_id;

  if (!merged.assigned_to) {
    const follow = extractAssigneeFromRaw(raw, users, actor);
    if (follow.assigned_to) {
      merged.assigned_to = follow.assigned_to;
      merged.assignee_label = follow.assignee_label;
    }
    if (follow.pendingVoicePick) merged.pendingVoicePick = follow.pendingVoicePick;
  }

  if (!merged.ticket_id) {
    const id = lazyParser().extractTicketId?.(raw);
    if (id) merged.ticket_id = id;
  }

  const pendingVoicePick = merged.pendingVoicePick;
  const { missing, ready } = evaluateAssignParams(merged);

  if (merged.assigned_to) {
    merged.assignee_label = userFullName(users.find((u) => Number(u.id) === Number(merged.assigned_to)));
  }

  return {
    intent: 'assign_ticket',
    confidence: ready ? 'high' : 'medium',
    params: merged,
    pendingVoicePick: pendingVoicePick && !merged.assigned_to ? pendingVoicePick : null,
    assignMissing: missing,
    summary: ready
      ? `Asignar ticket #${merged.ticket_id} a ${merged.assignee_label}`
      : merged.ticket_id
        ? `Asignar ticket #${merged.ticket_id}`
        : 'Asignar ticket',
    allowed: true,
    denyReason: null,
    sessionMerged: true,
  };
}

module.exports = {
  buildAssignTicketFromUtterance,
  continueAssignTicket,
  evaluateAssignParams,
  resolveTicketId,
  buildVoicePickPrompt,
};
