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
 * Dispara una notificación. SIEMPRE muestra un toast dentro de la app,
 * y además una notificación del navegador si el permiso fue concedido.
 * @param {string} title - Título visible
 * @param {object} options - { body, type, tag, onClick, requireInteraction }
 */
export function pushNotify(title, options = {}) {
  // 1) Toast in-app (siempre)
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

  // 2) Notificación del navegador (si está habilitada y permitida)
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

// Atajos por tipo de evento — homogeniza títulos
export const PushEvents = {
  ticketCreated:   (title) => pushNotify('Ticket creado', { body: title, tag: 'ticket' }),
  ticketAssigned:  (title) => pushNotify('Te asignaron un ticket', { body: title, tag: 'ticket-assigned' }),
  ticketMoved:     (title, to) => pushNotify('Ticket movido', { body: `"${title}" → ${to}`, tag: 'ticket-move' }),
  ticketComment:   (title) => pushNotify('Nuevo comentario en ticket', { body: title, tag: 'ticket-comment' }),
  ticketFileUp:    (filename) => pushNotify('Archivo subido', { body: filename, tag: 'ticket-file' }),
  ticketFileDel:   (filename) => pushNotify('Archivo eliminado', { body: filename, tag: 'ticket-file' }),

  avisoCreated:    (title) => pushNotify('Aviso publicado', { body: title, tag: 'aviso' }),
  avisoReceived:   (title) => pushNotify('Nuevo aviso', { body: title, tag: 'aviso-rx', requireInteraction: false }),

  meetingCreated:  (title, when) => pushNotify('Reunión agendada', { body: `${title}${when ? ` · ${when}` : ''}`, tag: 'meeting' }),
  meetingInvite:   (title, when) => pushNotify('Te invitaron a una reunión', { body: `${title}${when ? ` · ${when}` : ''}`, tag: 'meeting-inv' }),
  meetingDeleted:  (title) => pushNotify('Reunión cancelada', { body: title, tag: 'meeting-del' }),

  forumMessage:    (groupName) => pushNotify('Mensaje enviado', { body: `En ${groupName}`, tag: 'forum-msg' }),
  forumGroupNew:   (name) => pushNotify('Grupo creado', { body: name, tag: 'forum-group' }),
  forumGroupEdit:  (name) => pushNotify('Grupo actualizado', { body: name, tag: 'forum-group' }),
  forumGroupDel:   (name) => pushNotify('Grupo eliminado', { body: name, tag: 'forum-group' }),

  userCreated:     (name) => pushNotify('Usuario creado', { body: name, tag: 'user' }),
  userUpdated:     (name) => pushNotify('Usuario actualizado', { body: name, tag: 'user' }),
  userDeleted:     (name) => pushNotify('Usuario eliminado', { body: name, tag: 'user' }),
  passwordChanged: () => pushNotify('Contraseña actualizada', { body: 'El cambio se aplicó correctamente.', tag: 'password' }),

  // Notificación genérica (usada por polling cuando llega algo del backend)
  fromServer: (n) => pushNotify(n.title || 'Notificación', {
    body: n.message || '',
    tag: `srv-${n.id}`,
    type: n.type || 'system',
  }),
};
