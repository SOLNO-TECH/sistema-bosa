import { emitToast } from './toastBus';

const SHOWN_KEY = 'bosa_toast_notif_ids';

let toastUserId = null;

export function setNotificationToastUserId(userId) {
  toastUserId = userId ?? null;
}

function storageKey() {
  return toastUserId ? `${SHOWN_KEY}_${toastUserId}` : SHOWN_KEY;
}

function loadShownIds() {
  try {
    const raw = localStorage.getItem(storageKey());
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveShownIds(ids) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(ids.slice(-300)));
  } catch (_) { /* noop */ }
}

export function wasNotificationToastShown(notificationId) {
  if (notificationId == null) return false;
  return loadShownIds().includes(Number(notificationId));
}

export function markNotificationToastShown(notificationId) {
  if (notificationId == null) return;
  const id = Number(notificationId);
  const ids = loadShownIds().filter((x) => x !== id);
  ids.push(id);
  saveShownIds(ids);
}

/** Marca todas las notificaciones actuales como ya mostradas (evita spam al abrir la app). */
export function markAllNotificationsToastShown(notifications) {
  if (!Array.isArray(notifications) || !notifications.length) return;
  const ids = loadShownIds();
  for (const n of notifications) {
    if (n?.id != null) ids.push(Number(n.id));
  }
  saveShownIds([...new Set(ids)]);
}

/**
 * Toast in-app una sola vez por notificación del servidor (estilo alerta / no leída).
 */
export function showIncomingNotificationToast(notification, onClick) {
  if (!notification?.id) return;
  const id = Number(notification.id);
  if (wasNotificationToastShown(id)) return;

  markNotificationToastShown(id);

  emitToast({
    dedupeKey: `notif-${id}`,
    title: notification.title || 'Notificación',
    body: notification.message || '',
    type: notification.type || 'system',
    variant: 'notification',
    onClick,
  });
}
