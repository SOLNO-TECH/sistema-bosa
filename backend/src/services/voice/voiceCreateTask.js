/**
 * Flujo de creación de tareas operativas por voz — alineado al formulario de Tareas.
 */

const { buildTaskDescription, knownDepartments } = require('./voiceFormDefaults');
const { resolveAssignee, buildVoicePickPrompt } = require('./voiceAssigneeResolver');
const { localDateYMD } = require('../../utils/localDate');

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

function actorPermissionLevel(actor) {
  if (!actor) return 'user';
  return (
    actor.permission_level ||
    (actor.role === 'superadmin'
      ? 'superadmin'
      : actor.role === 'administrator'
        ? 'administrator'
        : actor.role === 'manager'
          ? 'manager'
          : 'user')
  );
}

function isAdminActor(actor) {
  const level = actorPermissionLevel(actor);
  return level === 'superadmin' || level === 'administrator';
}

function isValidTaskTitle(title) {
  const t = String(title || '').trim();
  if (t.length < 3) return false;
  if (/desde comando de voz/i.test(t)) return false;
  if (/^(crea|crear|tarea|nueva|genera|un ticket|el ticket)$/i.test(t)) return false;
  if (/^(crea|crear|nueva|genera)\s+(?:una\s+)?tarea$/i.test(t)) return false;
  if (/^(departamento|depto|prioridad|inicio|fin|asignar|responsable)\b/i.test(t)) return false;
  return true;
}

function cleanTaskTitle(raw) {
  return String(raw || '')
    .replace(/^(?:el\s+)?(?:titulo|título|tarea)\s*(?:es|:|-)\s*/i, '')
    .replace(/\s+(?:asignar|asignado|responsable|departamento|depto|inicio|fin|desde|hasta)\s+.+$/i, '')
    .trim()
    .slice(0, 200);
}

function matchKnownDepartment(hint, known) {
  const h = normalizeText(hint);
  if (!h) return null;
  let best = null;
  let bestLen = 0;
  for (const d of known) {
    const nd = normalizeText(d);
    if (nd.includes(h) || h.includes(nd)) {
      if (nd.length > bestLen) {
        best = d;
        bestLen = nd.length;
      }
    }
  }
  return best;
}

function defaultTaskDates() {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  const fmt = (d) => localDateYMD(d);
  return { start_date: fmt(start), end_date: fmt(end) };
}

function parseTaskDateRange(raw, text) {
  const parser = lazyParser();
  const slots = {};
  const r = String(raw || '');

  const startM = r.match(/(?:inicio|desde|del)\s*(?:el)?\s*(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i);
  const endM = r.match(/(?:fin|hasta|al)\s*(?:el)?\s*(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i);
  if (startM?.[1]) slots.start_date = parser.parseRelativeDate(startM[1]) || startM[1];
  if (endM?.[1]) slots.end_date = parser.parseRelativeDate(endM[1]) || endM[1];

  if (!slots.start_date && parser.hasDateReference(text)) {
    slots.start_date = parser.parseRelativeDate(text);
  }
  if (slots.start_date && !slots.end_date) {
    const d = new Date(`${slots.start_date}T12:00:00`);
    d.setDate(d.getDate() + 3);
    slots.end_date = localDateYMD(d);
  }
  return slots;
}

function extractFollowUpTaskSlots(raw, text, existingParams = {}, users = [], actor = null) {
  const slots = {};
  const r = String(raw || '').trim();
  const t = normalizeText(text);
  const parser = lazyParser();

  let assigneeHint = parser.extractAssigneeHint(raw) || '';
  if (!assigneeHint) {
    const m = r.match(/(?:responsable|asignar(?:le|la|lo)?|asignado)\s*(?:a|es|:|-)?\s*(.+)/i);
    if (m?.[1]) assigneeHint = m[1].trim();
  }
  if (assigneeHint) {
    const resolved = resolveAssignee(users, assigneeHint.replace(/\s+ticket.*$/i, '').trim(), actor);
    if (resolved.assigned_to) slots.assigned_to = resolved.assigned_to;
    else if (resolved.needsVoicePick) slots.pendingVoicePick = resolved.needsVoicePick;
  }

  const deptM = r.match(/(?:departamento|depto)\s*(?:es|:|-)?\s*(?:de\s+)?(.+)/i);
  if (deptM?.[1]) {
    const matched = matchKnownDepartment(deptM[1], knownDepartments(users));
    if (matched) slots.department = matched;
    return { ...slots, ...parseTaskDateRange(raw, text) };
  }

  const titleM = r.match(/(?:titulo|título|tarea)\s*(?:es|:|-)\s*(.+)/i);
  if (titleM?.[1]) {
    slots.title = cleanTaskTitle(titleM[1]);
    return { ...slots, ...parseTaskDateRange(raw, text) };
  }

  const descM = r.match(/(?:descripcion|descripción|detalle)\s*(?:es|:|-)\s*(.+)/i);
  if (descM?.[1]) {
    slots.description = descM[1].trim().slice(0, 4000);
    return { ...slots, ...parseTaskDateRange(raw, text) };
  }

  const dates = parseTaskDateRange(raw, text);
  if (dates.start_date || dates.end_date) return { ...slots, ...dates };

  if (Object.keys(slots).length) return slots;

  let bare = r.replace(/^asunto\s+/i, '').trim();
  if (bare.length >= 3 && !/^(crea|crear|tarea|nuevo|genera|asignar|departamento)/i.test(bare)) {
    bare = cleanTaskTitle(bare);
    if (!isValidTaskTitle(existingParams.title)) slots.title = bare;
    else if (bare.toLowerCase() !== String(existingParams.title || '').toLowerCase()) {
      slots.description = bare.slice(0, 4000);
    }
  }

  return slots;
}

function smartMergeTaskParams(base = {}, ...sources) {
  const out = { ...base };
  for (const src of sources) {
    if (!src) continue;
    for (const [key, val] of Object.entries(src)) {
      if (val == null || val === '') continue;
      if (key === 'pendingVoicePick') {
        if (val?.options?.length) out.pendingVoicePick = val;
        continue;
      }
      if (key === 'title') {
        if (isValidTaskTitle(val)) out.title = cleanTaskTitle(val);
        continue;
      }
      if (key === 'description' && String(val).length >= 3) out.description = val;
      else if (key === 'department' && String(val).trim()) out.department = String(val).trim();
      else if (key === 'assigned_to' && val) out.assigned_to = val;
      else if ((key === 'start_date' || key === 'end_date') && val) out[key] = String(val).slice(0, 10);
    }
  }
  return out;
}

function resolveTaskDepartmentForActor(users, assigneeId, actor, explicitDept) {
  if (explicitDept) return String(explicitDept).trim();
  const level = actorPermissionLevel(actor);
  if (level === 'manager' && actor?.departamento) return String(actor.departamento).trim();
  if (assigneeId) {
    const u = users.find((x) => Number(x.id) === Number(assigneeId));
    if (u?.departamento) return String(u.departamento).trim();
  }
  return actor?.departamento ? String(actor.departamento).trim() : '';
}

function evaluateTaskParams(params, raw = '', actor = null, users = [], pendingVoicePick = null) {
  const p = { ...params };
  delete p.pendingVoicePick;
  const defaults = defaultTaskDates();
  p.start_date = p.start_date || defaults.start_date;
  p.end_date = p.end_date || defaults.end_date;
  if (p.start_date && p.end_date && p.end_date < p.start_date) {
    p.end_date = p.start_date;
  }

  if (!p.department) {
    p.department = resolveTaskDepartmentForActor(users, p.assigned_to, actor, p.department);
  }

  if (isValidTaskTitle(p.title) && !p.description) {
    p.description = buildTaskDescription(raw, p.title) || '';
  }

  const missing = [];
  if (!isValidTaskTitle(p.title)) missing.push('título');
  if (!p.assigned_to) missing.push('responsable');
  if (isAdminActor(actor) && !p.department) missing.push('departamento');

  return { params: p, missing, ready: missing.length === 0 && !pendingVoicePick, pendingVoicePick };
}

function buildCreateTaskFromUtterance(raw, text, users = [], actor = null) {
  const parser = lazyParser();
  const assigneeHint = parser.extractAssigneeHint?.(raw) || '';
  const resolved = resolveAssignee(users, assigneeHint, actor);

  const titleRaw =
    parser.extractTaskTitle?.(raw) ||
    (raw.match(/(?:crea(?:r|me)?|nueva|genera(?:r|me)?|quiero|necesito)\s+(?:una\s+)?tarea\s+(?:de|sobre|para)?\s*[:\-]?\s*(.+)/i)?.[1] || '');
  const title = isValidTaskTitle(titleRaw) ? cleanTaskTitle(titleRaw) : 'Tarea desde comando de voz';

  const deptMatch = text.match(/departamento\s+([a-z0-9\sáéíóúñ]+)/i);
  const department = resolveTaskDepartmentForActor(
    users,
    resolved.assigned_to,
    actor,
    deptMatch?.[1] ? matchKnownDepartment(deptMatch[1], knownDepartments(users)) : null,
  );

  const dates = parseTaskDateRange(raw, text);
  const defaults = defaultTaskDates();

  const assigneeLabel = resolved.assigned_to
    ? `${users.find((u) => Number(u.id) === Number(resolved.assigned_to))?.name || ''} ${users.find((u) => Number(u.id) === Number(resolved.assigned_to))?.apellido || ''}`.trim()
    : assigneeHint || '';

  const params = {
    title,
    description: buildTaskDescription(raw, title),
    assigned_to: resolved.assigned_to,
    assignee_hint: assigneeHint,
    assignee_label: assigneeLabel,
    start_date: dates.start_date || defaults.start_date,
    end_date: dates.end_date || defaults.end_date,
    department,
  };

  let pendingVoicePick = resolved.needsVoicePick || null;

  const { params: finalParams, missing, ready, pendingVoicePick: pick } = evaluateTaskParams(
    params,
    raw,
    actor,
    users,
    pendingVoicePick,
  );

  return {
    intent: 'create_task',
    confidence: ready ? 'high' : 'medium',
    params: finalParams,
    pendingVoicePick: pick,
    taskMissing: missing,
    summary: ready
      ? `Crear tarea "${finalParams.title.slice(0, 60)}" para ${assigneeLabel || 'responsable'}`
      : `Crear tarea operativa`,
    allowed: true,
    denyReason: null,
  };
}

function continueCreateTask(raw, text, session, users = [], actor = null) {
  if (!session || session.intent !== 'create_task') return null;

  const combinedRaw = `${session.transcript || ''} ${raw}`.replace(/\s+/g, ' ').trim().slice(0, 500);
  const combinedText = normalizeText(combinedRaw);
  const fromCombined = buildCreateTaskFromUtterance(combinedRaw, combinedText, users, actor);
  const followSlots = extractFollowUpTaskSlots(raw, text, session.params, users, actor);

  let pendingVoicePick = followSlots.pendingVoicePick || session.pendingVoicePick || fromCombined.pendingVoicePick;
  delete followSlots.pendingVoicePick;

  const merged = smartMergeTaskParams(session.params || {}, fromCombined.params, followSlots);

  const { params: finalParams, missing, ready, pendingVoicePick: pick } = evaluateTaskParams(
    merged,
    combinedRaw,
    actor,
    users,
    pendingVoicePick,
  );

  if (finalParams.assigned_to) {
    const u = users.find((x) => Number(x.id) === Number(finalParams.assigned_to));
    if (u) finalParams.assignee_label = `${u.name || ''} ${u.apellido || ''}`.trim();
  }

  return {
    intent: 'create_task',
    confidence: ready ? 'high' : 'medium',
    params: finalParams,
    pendingVoicePick: pick,
    taskMissing: missing,
    summary: isValidTaskTitle(finalParams.title)
      ? `Crear tarea "${finalParams.title.slice(0, 60)}"`
      : 'Crear tarea operativa',
    allowed: true,
    denyReason: null,
    sessionMerged: true,
  };
}

module.exports = {
  isValidTaskTitle,
  cleanTaskTitle,
  defaultTaskDates,
  parseTaskDateRange,
  extractFollowUpTaskSlots,
  smartMergeTaskParams,
  evaluateTaskParams,
  buildCreateTaskFromUtterance,
  continueCreateTask,
  buildVoicePickPrompt,
};
