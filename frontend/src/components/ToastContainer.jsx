import { useEffect, useState } from 'react';
import { onToast } from '../utils/toastBus';

const ICONS = {
  ticket: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  ),
  comment: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  aviso: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  meeting: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  forum: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
    </svg>
  ),
  user: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  system: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const COLORS = {
  ticket:  { bar: 'bg-gold',        iconBg: 'bg-gold/15',     iconText: 'text-gold' },
  comment: { bar: 'bg-blue-500',    iconBg: 'bg-blue-50',     iconText: 'text-blue-600' },
  aviso:   { bar: 'bg-amber-500',   iconBg: 'bg-amber-50',    iconText: 'text-amber-600' },
  meeting: { bar: 'bg-emerald-500', iconBg: 'bg-emerald-50',  iconText: 'text-emerald-600' },
  forum:   { bar: 'bg-cyan-500',    iconBg: 'bg-cyan-50',     iconText: 'text-cyan-600' },
  user:    { bar: 'bg-purple-500',  iconBg: 'bg-purple-50',   iconText: 'text-purple-600' },
  system:  { bar: 'bg-navy-700',    iconBg: 'bg-navy-50',     iconText: 'text-navy-700' },
};

function ToastCard({ toast, onClose }) {
  const type = toast.type || 'system';
  const colors = COLORS[type] || COLORS.system;
  const icon = ICONS[type] || ICONS.system;

  return (
    <div
      onClick={() => { if (toast.onClick) toast.onClick(); onClose(); }}
      className={`bg-white shadow-2xl rounded-lg border border-gray-200 overflow-hidden flex items-stretch min-w-[300px] max-w-sm pointer-events-auto cursor-pointer transition-all hover:shadow-2xl hover:-translate-y-0.5 ${toast.exiting ? 'animate-fade-out' : 'animate-slide-left'}`}
      role="alert"
    >
      <div className={`w-1 flex-shrink-0 ${colors.bar}`} />
      <div className="flex-1 min-w-0 p-3 pl-3 flex items-start gap-3">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${colors.iconBg} ${colors.iconText}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-navy-950 text-sm leading-tight">{toast.title}</p>
          {toast.body && <p className="text-xs text-navy-600 mt-0.5 leading-snug">{toast.body}</p>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-gray-300 hover:text-navy-700 transition-colors flex-shrink-0 -mt-0.5"
          title="Cerrar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = onToast((toast) => {
      setToasts(prev => [...prev, toast].slice(-5)); // máximo 5 simultáneos
      // Auto-cierre tras 6 segundos
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 6000);
    });
    return unsubscribe;
  }, []);

  const closeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} onClose={() => closeToast(t.id)} />
      ))}
    </div>
  );
}
