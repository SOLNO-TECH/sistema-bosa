import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const ICONS = {
  ticket:  <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>,
  comment: <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
  aviso:   <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
  meeting: <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  forum:   <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>,
  system:  <svg className="w-5 h-5 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

const TYPE_LABELS = {
  ticket: 'Ticket', comment: 'Comentario', aviso: 'Aviso',
  meeting: 'Reunión', forum: 'Foro', system: 'Sistema',
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Hace ${diffD} d`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function NotificationsModule() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/notifications', { params: { limit: 100 } });
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error al obtener notificaciones:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Polling cada 30s para que aparezcan nuevas notificaciones
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const filtered = notifications.filter(n => filter === 'unread' ? !n.is_read : true);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id, currentlyRead) => {
    if (currentlyRead) return;
    // Optimistic
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    try {
      await axios.patch(`/api/notifications/${id}/read`);
    } catch (err) {
      console.error(err);
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    try {
      await axios.patch('/api/notifications/read-all');
    } catch (err) {
      console.error(err);
      fetchNotifications();
    }
  };

  const deleteOne = async (id, e) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta notificación?')) return;
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await axios.delete(`/api/notifications/${id}`);
    } catch (err) {
      console.error(err);
      fetchNotifications();
    }
  };

  const deleteAllRead = async () => {
    if (!confirm('¿Eliminar todas las notificaciones leídas?')) return;
    setNotifications(prev => prev.filter(n => !n.is_read));
    try {
      await axios.delete('/api/notifications/read');
    } catch (err) {
      console.error(err);
      fetchNotifications();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-display font-medium text-navy-950 tracking-tight flex items-center gap-2">
            <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Centro de Notificaciones
          </h2>
          <p className="text-sm text-navy-600 mt-1">
            {unreadCount > 0 ? `Tienes ${unreadCount} sin leer` : 'Todas las notificaciones revisadas'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFilter('all')} className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase transition-colors ${filter === 'all' ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 border border-gray-200 hover:bg-gray-50'}`}>
            Todas ({notifications.length})
          </button>
          <button onClick={() => setFilter('unread')} className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase transition-colors ${filter === 'unread' ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 border border-gray-200 hover:bg-gray-50'}`}>
            No leídas ({unreadCount})
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="px-3 py-2 rounded-lg text-[11px] font-bold uppercase text-gold bg-gold/10 hover:bg-gold/20 transition-colors border border-gold/30">
              Marcar todas leídas
            </button>
          )}
          {notifications.some(n => n.is_read) && (
            <button onClick={deleteAllRead} className="px-3 py-2 rounded-lg text-[11px] font-bold uppercase text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200">
              Borrar leídas
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 text-navy-500">Cargando notificaciones…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gold/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
            </div>
            <p className="text-navy-700 font-bold">
              {filter === 'unread' ? 'Sin notificaciones nuevas' : 'No hay notificaciones'}
            </p>
            <p className="text-navy-500 text-sm mt-1">
              {filter === 'unread' ? 'Estás al día.' : 'Cuando recibas alguna actividad aparecerá aquí.'}
            </p>
          </div>
        ) : (
          filtered.map(n => (
            <div
              key={n.id}
              onClick={() => markAsRead(n.id, n.is_read)}
              className={`group flex items-start gap-4 p-4 lg:p-5 rounded-xl transition-all cursor-pointer border ${
                n.is_read
                  ? 'bg-white border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md'
                  : 'bg-gold/5 border-gold/30 shadow-sm hover:bg-gold/10'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  n.is_read ? 'bg-gray-100' : 'bg-white border border-gold/40 shadow-sm'
                }`}>
                  {ICONS[n.type] || ICONS.system}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-navy-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {TYPE_LABELS[n.type] || 'Sistema'}
                      </span>
                      {!n.is_read && <span className="w-2 h-2 bg-gold rounded-full" />}
                    </div>
                    <h3 className={`font-bold text-sm lg:text-base ${n.is_read ? 'text-navy-800' : 'text-navy-950'}`}>
                      {n.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-bold text-navy-500 uppercase tracking-wide whitespace-nowrap">
                      {formatDate(n.created_at)}
                    </span>
                    <button
                      onClick={(e) => deleteOne(n.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                      title="Eliminar"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className={`mt-1 text-sm leading-relaxed ${n.is_read ? 'text-navy-600' : 'text-navy-800'}`}>
                  {n.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
