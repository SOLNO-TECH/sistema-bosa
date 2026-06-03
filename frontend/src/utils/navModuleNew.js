/**
 * Etiqueta "Nuevo" en el sidebar hasta que el usuario abre el módulo.
 * Agregar el id del módulo a NAV_NEW_MODULES al lanzar una función nueva.
 */

const STORAGE_KEY = 'bosa_nav_new_seen';

/** Módulos que muestran "Nuevo" (quitar el id cuando ya no haga falta destacarlo). */
export const NAV_NEW_MODULES = ['knowledge'];

/** Módulos en desarrollo — etiqueta "Próximamente" en el sidebar. */
export const NAV_COMING_SOON_MODULES = ['cronograma'];

export function loadNavNewSeen(userId) {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function markNavNewSeen(userId, moduleId) {
  if (!userId || !moduleId) return;
  const data = loadNavNewSeen(userId);
  data[moduleId] = new Date().toISOString();
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(data));
  } catch (_) {
    /* noop */
  }
}

export function shouldShowNavNew(userId, moduleId, seenMap = null) {
  if (!userId || !NAV_NEW_MODULES.includes(moduleId)) return false;
  const seen = seenMap ?? loadNavNewSeen(userId);
  return !seen[moduleId];
}
