/** Última vez que el usuario abrió cada módulo (localStorage por usuario). */

const STORAGE_KEY = 'bosa_nav_module_seen';

export const NAV_BADGE_MODULES = ['calendar', 'tickets', 'tasks', 'avisos', 'minutas'];

export function loadNavModuleSeen(userId) {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function markNavModuleSeen(userId, moduleId) {
  if (!userId || !moduleId) return;
  const data = loadNavModuleSeen(userId);
  data[moduleId] = new Date().toISOString();
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(data));
  } catch (_) { /* noop */ }
}

/** Primera vez: marcar “ya visto” para no inundar con todo lo histórico. */
export function initNavModuleBaseline(userId, moduleIds = NAV_BADGE_MODULES) {
  if (!userId) return {};
  const data = loadNavModuleSeen(userId);
  const now = new Date().toISOString();
  let changed = false;
  for (const id of moduleIds) {
    if (!data[id]) {
      data[id] = now;
      changed = true;
    }
  }
  if (changed) {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(data));
    } catch (_) { /* noop */ }
  }
  return data;
}

function parseActivityMs(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Cuenta ítems con actividad posterior a la última visita al módulo. */
export function countUnseenSince(items, lastSeenIso, getActivityAt, filterFn) {
  const lastMs = parseActivityMs(lastSeenIso);
  if (!lastMs || !Array.isArray(items)) return 0;
  return items.filter((item) => {
    if (filterFn && !filterFn(item)) return false;
    return parseActivityMs(getActivityAt(item)) > lastMs;
  }).length;
}
