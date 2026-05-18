// Helper de notificaciones. Combina dos canales:
// 1. Toast in-app (siempre se muestra dentro de la app, no requiere permisos)
// 2. Notificación del navegador (pop-up del SO, requiere HTTPS + permiso)

import { emitToast } from './toastBus';

const PREF_KEY = 'bosa_push_enabled';

export function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermission() {
  if (!isSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export function isEnabled() {
  if (!isSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  // Por default está habilitado; se puede desactivar manualmente en Config
  const pref = localStorage.getItem(PREF_KEY);
  return pref !== '0';
}

export function setEnabled(value) {
  localStorage.setItem(PREF_KEY, value ? '1' : '0');
}

export async function requestPermission() {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (e) {
    return 'error';
  }
}

/**
 * Notificación del navegador (pantalla de bloqueo). El toast in-app solo para notificaciones del servidor.
 * @param {object} options - { body, tag, onClick, toast: true } toast solo si se pide explícitamente
 */
export function pushNotify(title, options = {}) {
  if (options.toast) {
    try {
      emitToast({
        title,
        body: options.body || '',
        type: options.type || inferTypeFromTag(options.tag),
        onClick: options.onClick,
      });
    } catch (err) {
      console.warn('toast emit error:', err);
    }
  }

  if (!isEnabled()) return null;
  try {
    const n = new Notification(title, {
      body: options.body || '',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
      silent: false,
    });
    if (options.onClick) {
      n.onclick = (e) => {
        e.preventDefault();
        window.focus();
        try { options.onClick(); } catch (_) {}
        n.close();
      };
    }
    if (!options.requireInteraction) {
      setTimeout(() => { try { n.close(); } catch (_) {} }, 8000);
    }
    return n;
  } catch (err) {
    console.warn('pushNotify error:', err);
    return null;
  }
}

// Inferir tipo de evento a partir del tag (para colorear el toast)
function inferTypeFromTag(tag) {
  if (!tag) return 'system';
  if (tag.startsWith('ticket-comment')) return 'comment';
  if (tag.startsWith('ticket'))         return 'ticket';
  if (tag.startsWith('aviso'))          return 'aviso';
  if (tag.startsWith('meeting'))        return 'meeting';
  if (tag.startsWith('forum'))          return 'forum';
  if (tag.startsWith('user') || tag.startsWith('password')) return 'user';
  if (tag.startsWith('srv-'))           return 'system';
  return 'system';
}

/** Acciones propias del usuario: sin toast (evita spam). El aviso al destinatario llega por el servidor. */
export const PushEvents = {
  ticketCreated:   () => {},
  ticketAssigned:  () => {},
  ticketMoved:     () => {},
  ticketComment:   () => {},
  ticketFileUp:    () => {},
  ticketFileDel:   () => {},

  avisoCreated:    () => {},
  avisoReceived:   () => {},

  meetingCreated:  () => {},
  meetingInvite:   () => {},
  meetingDeleted:  () => {},

  forumMessage:    () => {},
  forumGroupNew:   () => {},
  forumGroupEdit:  () => {},
  forumGroupDel:   () => {},

  userCreated:     () => {},
  userUpdated:     () => {},
  userDeleted:     () => {},
  passwordChanged: () => {},

  fromServer: () => {},
};
