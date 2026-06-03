import { parseDbDateTime } from './localDate';

export const NOTIFICATION_TYPE_LABELS = {
  ticket: 'Ticket',
  comment: 'Comentario',
  aviso: 'Aviso',
  meeting: 'Reunión',
  forum: 'Foro',
  task: 'Tarea',
  system: 'Sistema',
};

export function formatNotificationRelative(iso) {
  if (!iso) return '';
  const d = parseDbDateTime(iso);
  if (!d) return '';
  const diffMin = Math.floor((Date.now() - d) / 60000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffMin < 1440) return `Hace ${Math.floor(diffMin / 60)} h`;
  if (diffMin < 10080) return `Hace ${Math.floor(diffMin / 1440)} d`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}
