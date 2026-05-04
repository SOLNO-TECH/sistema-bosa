import { useState } from 'react';

const NOTIFICACIONES_MOCK = [
  {
    id: 1,
    title: 'Bienvenido a BOSA',
    message: 'Revisa los últimos avisos y actualizaciones del sistema. Hemos implementado nuevas funciones para mejorar tu experiencia.',
    date: 'Hoy',
    time: 'Hace un momento',
    type: 'system',
    read: false,
  },
  {
    id: 2,
    title: 'Actualización de Tickets',
    message: 'Se ha resuelto el ticket #TK-045 relacionado con el mantenimiento del aire acondicionado.',
    date: 'Ayer',
    time: '14:30',
    type: 'ticket',
    read: true,
  },
  {
    id: 3,
    title: 'Nuevo Aviso General',
    message: 'Mantenimiento programado para los servidores este fin de semana.',
    date: '15 May',
    time: '09:00',
    type: 'alert',
    read: true,
  }
];

const ICONS = {
  system: <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ticket: <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  alert: <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
};

export default function NotificationsModule() {
  const [notifications, setNotifications] = useState(NOTIFICACIONES_MOCK);
  const [filter, setFilter] = useState('all'); // all, unread

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-display font-medium text-navy-950 tracking-tight flex items-center gap-2">
            <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Centro de Notificaciones
          </h2>
          <p className="text-sm text-navy-600 mt-1">Revisa todas las alertas y actualizaciones del sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${filter === 'all' ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 border border-gray-200 hover:bg-gray-50'}`}>
            Todas
          </button>
          <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${filter === 'unread' ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 border border-gray-200 hover:bg-gray-50'}`}>
            No Leídas
          </button>
          <button onClick={markAllAsRead} className="px-4 py-2 rounded-lg text-xs font-bold uppercase text-gold bg-gold/10 hover:bg-gold/20 transition-colors border border-gold/30">
            Marcar todas leídas
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-16 text-navy-400 font-medium bg-white rounded-xl border border-gray-100 shadow-sm">
            No hay notificaciones para mostrar
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <div 
              key={notification.id} 
              onClick={() => markAsRead(notification.id)}
              className={`flex items-start gap-4 p-5 rounded-xl transition-all cursor-pointer border ${
                notification.read 
                  ? 'bg-white border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md' 
                  : 'bg-blue-50/50 border-blue-200 shadow-sm hover:bg-blue-50'
              }`}
            >
              <div className="mt-1 flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  notification.read ? 'bg-gray-100' : 'bg-white border border-blue-100 shadow-sm'
                }`}>
                  {ICONS[notification.type]}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className={`font-bold text-base ${notification.read ? 'text-navy-800' : 'text-navy-950'}`}>
                    {notification.title}
                  </h3>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{notification.date} · {notification.time}</span>
                    {!notification.read && <span className="w-2.5 h-2.5 bg-blue-500 rounded-full border border-white shadow-sm"></span>}
                  </div>
                </div>
                <p className={`mt-1 text-sm leading-relaxed ${notification.read ? 'text-navy-500' : 'text-navy-700 font-medium'}`}>
                  {notification.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
