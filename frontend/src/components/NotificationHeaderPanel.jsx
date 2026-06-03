import {
  NOTIFICATION_TYPE_LABELS,
  formatNotificationRelative,
} from '../utils/notificationDisplay';

const TYPE_ICONS = {
  ticket: (
    <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  ),
  comment: (
    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  aviso: (
    <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  meeting: (
    <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  forum: (
    <svg className="h-4 w-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
    </svg>
  ),
  task: (
    <svg className="h-4 w-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  system: (
    <svg className="h-4 w-4 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

function NotificationTypeIcon({ type }) {
  return TYPE_ICONS[type] || TYPE_ICONS.system;
}

export default function NotificationHeaderPanel({
  notifications = [],
  unreadCount = 0,
  closing = false,
  onClose,
  onOpenNotification,
  onViewAll,
  onMarkAllRead,
}) {
  return (
    <>
      <div
        className={`header-notif-backdrop${closing ? ' header-notif-backdrop--closing' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`header-notif-panel${closing ? ' header-notif-panel--closing' : ''}`}
        role="dialog"
        aria-label="Notificaciones recientes"
      >
        <div className="header-notif-panel__header">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="font-display text-sm font-medium text-slate-text">Notificaciones</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-subtle">
              {unreadCount > 0 ? `${unreadCount} sin leer` : 'Estás al día'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="header-notif-panel__action"
              >
                Marcar leídas
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="header-notif-panel__close"
              aria-label="Cerrar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="header-notif-panel__list">
          {notifications.length === 0 ? (
            <div className="header-notif-panel__empty">
              <div className="header-notif-panel__empty-icon">
                <svg className="h-6 w-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </div>
              <p className="font-sans text-sm font-bold text-navy-800">Sin notificaciones</p>
              <p className="mt-1 text-xs text-navy-500">Cuando haya actividad aparecerá aquí.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onOpenNotification(n)}
                className={`header-notif-panel__item${n.is_read ? '' : ' header-notif-panel__item--unread'}`}
              >
                <div className={`header-notif-panel__icon${n.is_read ? '' : ' header-notif-panel__icon--unread'}`}>
                  <NotificationTypeIcon type={n.type} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="header-notif-panel__type">
                      {NOTIFICATION_TYPE_LABELS[n.type] || 'Sistema'}
                    </span>
                    {!n.is_read ? <span className="header-notif-panel__dot" aria-hidden="true" /> : null}
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-navy-950">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-navy-600">{n.message}</p>
                  <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-wide text-navy-400">
                    {formatNotificationRelative(n.created_at)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="header-notif-panel__footer">
          <button type="button" onClick={onViewAll} className="header-notif-panel__view-all">
            Ver centro de notificaciones
          </button>
        </div>
      </div>
    </>
  );
}
