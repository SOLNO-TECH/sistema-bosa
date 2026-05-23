import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { EmptyStateIllustration, SparkleIcon } from '../components/Illustrations';
import UsersModule from '../components/modules/UsersModule';
import ConfigModule from '../components/modules/ConfigModule';
import TicketsModule from '../components/modules/TicketsModule';
import TasksModule from '../components/modules/TasksModule';
import AvisosModule from '../components/modules/AvisosModule';
import CalendarModule from '../components/modules/CalendarModule';
import ForoModule from '../components/modules/ForoModule';
import axios from 'axios';
import NotificationsModule from '../components/modules/NotificationsModule';
import MinutasModule from '../components/modules/MinutasModule';
import ToastContainer from '../components/ToastContainer';
import {
  showIncomingNotificationToast,
  markAllNotificationsToastShown,
  setNotificationToastUserId,
} from '../utils/notificationToast';
import {
  NAV_BADGE_MODULES,
  initNavModuleBaseline,
  markNavModuleSeen,
  countUnseenSince,
} from '../utils/navModuleSeen';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  administrator: 'Administrador',
  manager: 'Gerente',
};

// ── Iconos ──────────────────────────────────────────────
const IconGrid = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>;
const IconCalendar = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>;
const IconBuilding = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" /></svg>;
const IconCondos = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" /></svg>;
const IconFinance = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 01-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>;
const IconReports = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
const IconUserAdmin = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const IconSettings = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const IconTickets = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>;
const IconTaskGantt = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" /></svg>;
const IconAvisos = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg>;
const IconBell = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
const IconForo = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>;
const IconMinuta = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;

// ── Chart colors ─────────────────────────────────────────
const CHART_DATA_KEYS = [
  { key: 'users',    name: 'Usuarios',  color: '#CBAC80' },
  { key: 'meetings', name: 'Reuniones', color: '#1e3a5f' },
  { key: 'tickets',  name: 'Tickets',   color: '#2d5f8f' },
  { key: 'avisos',   name: 'Avisos',    color: '#4a7fb5' },
];

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-lg px-3 py-2">
      <p className="font-label text-[9px] tracking-widest uppercase text-navy-500 mb-1">{label}</p>
      <p className="font-display text-navy-950 text-xl font-light">{payload[0].value}</p>
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-lg px-3 py-2">
      <p className="font-label text-[9px] tracking-widest uppercase text-navy-500 mb-1">{payload[0].name}</p>
      <p className="font-display text-navy-950 text-xl font-light">{payload[0].value}</p>
    </div>
  );
};

// ── KPI Card ─────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, progress, tone = 'navy' }) {
  const tones = {
    gold:    { bg: 'bg-gold/5',         border: 'border-gold/30',     accent: '#CBAC80', iconBg: 'bg-gold/10',     iconText: 'text-gold' },
    navy:    { bg: 'bg-white',          border: 'border-gray-200',    accent: '#1e3a5f', iconBg: 'bg-navy-50',     iconText: 'text-navy-700' },
    red:     { bg: 'bg-red-50/40',      border: 'border-red-200',     accent: '#ef4444', iconBg: 'bg-red-100',     iconText: 'text-red-600' },
    amber:   { bg: 'bg-amber-50/40',    border: 'border-amber-200',   accent: '#f59e0b', iconBg: 'bg-amber-100',   iconText: 'text-amber-600' },
    emerald: { bg: 'bg-emerald-50/40',  border: 'border-emerald-200', accent: '#10b981', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
  };
  const t = tones[tone] || tones.navy;
  return (
    <div className={`rounded-sm p-5 border shadow-sm ${t.bg} ${t.border}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="font-label text-navy-700 text-[10px] tracking-[0.2em] uppercase font-bold">{label}</p>
        <div className={`w-7 h-7 rounded-sm flex items-center justify-center ${t.iconBg} ${t.iconText}`}>
          {icon}
        </div>
      </div>
      <p className="font-display text-navy-950 text-3xl font-light tabular-nums">{value}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: t.accent }} />
        </div>
      )}
      {sub && <p className="font-sans text-navy-500 text-[10px] mt-2 font-medium">{sub}</p>}
    </div>
  );
}

// ── Metric Card ──────────────────────────────────────────
function MetricCard({ title, value, sub, icon, highlight, onClick }) {
  return (
    <div onClick={onClick} className={`rounded-sm p-5 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group ${onClick ? 'cursor-pointer' : ''} ${highlight ? 'border-gold/30 bg-gold/5' : 'border-gray-200 bg-white shadow-sm'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-label text-navy-700 text-[10px] tracking-[0.2em] uppercase font-bold">{title}</p>
          <p className="font-display text-navy-950 text-3xl font-light mt-2">{value}</p>
          {sub && <p className="font-sans text-navy-600 text-xs mt-1 font-medium">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-sm flex items-center justify-center border ${highlight ? 'border-gold/40 text-gold bg-gold/10' : 'border-gray-200 text-navy-600 bg-gray-50'}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 h-px w-0 group-hover:w-full transition-all duration-500 bg-gradient-to-r from-gold/60 to-transparent" />
    </div>
  );
}

/** Contador en sidebar: fondo rojo, número blanco; oculto si count ≤ 0 */
function NavCountBadge({ count }) {
  const n = Number(count);
  if (!n || n <= 0) return null;
  return (
    <span
      className="ml-auto flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white flex items-center justify-center"
      aria-label={`${n} sin revisar`}
    >
      <span className="text-[9px] font-bold leading-none tabular-nums">
        {n > 99 ? '99+' : n}
      </span>
    </span>
  );
}

// ── Componente principal ──────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState('overview');
  /** Abrir un ticket desde otro módulo (p. ej. tarea → ticket). */
  const [pendingTicketOpen, setPendingTicketOpen] = useState(null);
  const [sidebarOpen, setSidebar] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [stats, setStats] = useState({ users: 0, meetings: 0, tickets: 0, avisos: 0 });
  const [kpis, setKpis] = useState({ resolutionRate: 0, inProgress: 0, urgent: 0, overdue: 0, meetingsThisWeek: 0, activeAvisos: 0 });
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [navBadges, setNavBadges] = useState({});
  const notifPollReadyRef = useRef(false);
  const lastSeenKey = user?.id ? `bosa_last_notif_id_${user.id}` : 'bosa_last_notif_id';
  const lastSeenNotifIdRef = useRef(0);

  const fetchRecentNotifications = async () => {
    try {
      const [{ data: items }, { data: cnt }] = await Promise.all([
        axios.get('/api/notifications', { params: { limit: 10 } }),
        axios.get('/api/notifications/unread-count'),
      ]);
      const arr = Array.isArray(items) ? items : [];
      setRecentNotifs(arr.slice(0, 5));
      setUnreadCount(cnt?.count || 0);

      const prevMax = lastSeenNotifIdRef.current;

      if (!notifPollReadyRef.current) {
        markAllNotificationsToastShown(arr);
        notifPollReadyRef.current = true;
      } else {
        const incoming = arr
          .filter((n) => n.id > prevMax && !n.is_read)
          .sort((a, b) => a.id - b.id);
        for (const n of incoming) {
          showIncomingNotificationToast(n, () => {
            setShowNotifications(false);
            openFromPushData({
              module: n.module,
              related_id: n.related_id,
              link_id: n.related_id,
            });
          });
        }
      }

      const maxId = arr.reduce((m, n) => (n.id > m ? n.id : m), prevMax);
      if (maxId > prevMax) {
        lastSeenNotifIdRef.current = maxId;
        localStorage.setItem(lastSeenKey, String(maxId));
      }
    } catch (err) { /* silencioso */ }
  };

  const openFromPushData = (data) => {
    if (!data?.module) {
      setActive('notifications');
      return;
    }
    const ticketId = data.link_id ?? data.related_id;
    if (data.module === 'tickets' && ticketId) {
      setPendingTicketOpen({ id: Number(ticketId), tab: 'info' });
      setActive('tickets');
      return;
    }
    if (data.module === 'tasks' && ticketId) {
      setPendingTicketOpen({ id: Number(ticketId), tab: 'tasks' });
      setActive('tickets');
      return;
    }
    if (data.module === 'avisos') setActive('avisos');
    else if (data.module === 'calendar') setActive('calendar');
    else if (data.module === 'foro') setActive('foro');
    else if (data.module === 'minutas') setActive('minutas');
    else if (data.module === 'tasks') setActive('tasks');
    else setActive('notifications');
  };

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    fetchStats();
    const statsInterval = setInterval(fetchStats, 60000);
    return () => {
      clearTimeout(t);
      clearInterval(statsInterval);
    };
  }, [user?.id]);

  const getNavBadgeCount = (itemId) => {
    if (itemId === 'notifications') {
      return active === 'notifications' ? 0 : unreadCount;
    }
    if (itemId === active && NAV_BADGE_MODULES.includes(itemId)) return 0;
    return navBadges[itemId] ?? 0;
  };

  const goToModule = (moduleId) => {
    setActive(moduleId);
    setSidebar(false);
  };

  /** Al entrar a un módulo, quitar badge (ya “viste” ese apartado). */
  useEffect(() => {
    if (!user?.id) return;

    if (active === 'notifications') {
      axios.patch('/api/notifications/read-all').catch(() => {});
      setUnreadCount(0);
      return;
    }

    if (NAV_BADGE_MODULES.includes(active)) {
      markNavModuleSeen(user.id, active);
      setNavBadges((prev) => ({ ...prev, [active]: 0 }));
    }
  }, [active, user?.id]);

  useEffect(() => {
    setNotificationToastUserId(user?.id ?? null);
    const v = parseInt(localStorage.getItem(lastSeenKey) || '0', 10);
    lastSeenNotifIdRef.current = Number.isNaN(v) ? 0 : v;
    notifPollReadyRef.current = false;

    fetchRecentNotifications();
    const interval = setInterval(fetchRecentNotifications, 10000);

    const onSwMessage = (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        openFromPushData(event.data.data);
        setShowNotifications(false);
        return;
      }
      if (event.data?.type === 'PUSH_RECEIVED') {
        const p = event.data.payload || {};
        const data = p.data || {};
        const notif = {
          id: data.notificationId,
          title: p.title,
          message: p.body || '',
          type: data.type || 'system',
          module: data.module,
          related_id: data.related_id,
        };
        if (notif.id) {
          showIncomingNotificationToast(notif, () => openFromPushData(data));
        }
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }

    return () => {
      clearInterval(interval);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
    };
  }, [user?.id, lastSeenKey]);

  const fetchStats = async () => {
    try {
      const [uRes, mRes, tRes, aRes, minRes, taskRes] = await Promise.all([
        axios.get('/api/users'),
        axios.get('/api/meetings'),
        axios.get('/api/tickets'),
        axios.get('/api/avisos'),
        axios.get('/api/minutes').catch(() => ({ data: [] })),
        axios.get('/api/ticket-tasks').catch(() => ({ data: [] })),
      ]);

      const users = Array.isArray(uRes.data) ? uRes.data : [];
      const meetings = Array.isArray(mRes.data) ? mRes.data : [];
      const tickets = Array.isArray(tRes.data) ? tRes.data : [];
      const avisos = Array.isArray(aRes.data) ? aRes.data : [];
      const minutes = Array.isArray(minRes.data) ? minRes.data : [];
      const ticketTasks = Array.isArray(taskRes.data) ? taskRes.data : [];
      const uid = user?.id;

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      setStats({
        users: users.length,
        meetings: meetings.filter(m => m.start_time && m.start_time.startsWith(todayStr)).length,
        tickets: tickets.length,
        avisos: avisos.length
      });

      // ── KPIs ───────────────────────────────────────────────
      const total = tickets.length;
      const closed = tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length;
      const inProgress = tickets.filter(t => t.status === 'in_progress').length;
      const urgent = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed').length;
      const overdue = tickets.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'closed').length;

      // Reuniones de la semana actual (Dom → Sáb)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      const meetingsThisWeek = meetings.filter(m => {
        if (!m.start_time) return false;
        const s = new Date(m.start_time);
        return s >= startOfWeek && s < endOfWeek;
      }).length;

      const isActiveAviso = (a) =>
        a.is_active === undefined || a.is_active === 1 || a.is_active === true;
      const isOpenTicket = (t) => t.status !== 'closed' && t.status !== 'resolved';
      const isMyOpenTask = (t) =>
        uid &&
        Number(t.assigned_to) === Number(uid) &&
        t.status !== 'done' &&
        t.status !== 'cancelled';

      const seen = initNavModuleBaseline(uid);

      setNavBadges({
        calendar: countUnseenSince(meetings, seen.calendar, (m) => m.start_time),
        tickets: countUnseenSince(
          tickets,
          seen.tickets,
          (t) => t.updated_at || t.created_at,
          isOpenTicket
        ),
        tasks: countUnseenSince(
          ticketTasks,
          seen.tasks,
          (t) => t.updated_at || t.created_at,
          isMyOpenTask
        ),
        avisos: countUnseenSince(
          avisos,
          seen.avisos,
          (a) => a.created_at,
          isActiveAviso
        ),
        minutas: countUnseenSince(
          minutes,
          seen.minutas,
          (m) => m.updated_at || m.created_at
        ),
      });

      setKpis({
        resolutionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
        inProgress,
        urgent,
        overdue,
        meetingsThisWeek,
        activeAvisos: avisos.filter(isActiveAviso).length,
      });
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const getSections = () => {
    const sections = [
      {
        title: 'Principal',
        items: [
          { id: 'overview', label: 'Resumen General', icon: <IconGrid /> },
          { id: 'calendar', label: 'Calendario', icon: <IconCalendar /> },
        ],
      },
      {
        title: 'Gestión',
        items: [
          { id: 'tickets', label: 'Tickets de Soporte', icon: <IconTickets /> },
          { id: 'tasks', label: 'Tareas operativas', icon: <IconTaskGantt /> },
          { id: 'avisos', label: 'Avisos', icon: <IconAvisos /> },
          { id: 'minutas', label: 'Minutas', icon: <IconMinuta /> },
        ],
      }
    ];

    const systemItems = [];
    if (user?.role === 'superadmin') {
      systemItems.push({ id: 'users', label: 'Usuarios', icon: <IconUserAdmin /> });
    }
    systemItems.push({ id: 'foro', label: 'Foro', icon: <IconForo /> });
    systemItems.push({ id: 'settings', label: 'Configuración', icon: <IconSettings /> });
    systemItems.push({ id: 'notifications', label: 'Notificaciones', icon: <IconBell /> });
    
    sections.push({ title: 'Sistema', items: systemItems });
    return sections;
  };

  const allSections = getSections();

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #071221 0%, #050D1A 100%)' }}>

      {/* Toast notifications in-app (siempre visibles) */}
      <ToastContainer />

      {/* SIDEBAR — altura fija al viewport; solo el menú hace scroll */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 flex h-screen max-h-[100dvh] flex-col overflow-hidden border-r border-surface transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'linear-gradient(180deg, #0A1930 0%, #071221 100%)' }}
      >
        <div className="flex-shrink-0 px-5 py-6 border-b border-surface flex items-center justify-center h-[96px] relative">
          <img src="/bosahublogo-02.svg" alt="BOSA Hub" className="w-40 h-auto" />
          <button onClick={() => setSidebar(false)} className="lg:hidden absolute right-5 top-1/2 -translate-y-1/2 text-slate-muted hover:text-gold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-shrink-0 border-b border-surface px-5 py-4 bg-gold/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-gold/40 flex items-center justify-center bg-navy-900">
            <span className="font-display text-gold text-base font-bold">{user?.name?.charAt(0)}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-slate-text text-[11px] font-bold truncate tracking-wide">{user?.name} {user?.apellido}</span>
            <span className="text-gold text-[9px] font-bold mt-1 uppercase tracking-widest">{ROLE_LABELS[user?.role] || user?.role || ''}</span>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-5">
          {allSections.map((section) => (
            <div key={section.title}>
              <p className="font-label text-slate-muted text-[9px] tracking-[0.35em] uppercase px-3 mb-1.5">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToModule(item.id)}
                    className={active === item.id ? 'nav-item-active' : 'nav-item-default'}
                  >
                    {item.icon}
                    <span className="flex-1 min-w-0 truncate text-left">{item.label}</span>
                    <NavCountBadge count={getNavBadgeCount(item.id)} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex-shrink-0 border-t border-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-[#071221]">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-900/30 text-red-400 text-[10px] tracking-widest uppercase font-bold hover:bg-red-900/10 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebar(false)} />}

      <div className={`flex flex-col min-h-screen min-w-0 transition-opacity duration-1000 lg:ml-60 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/90 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebar(true)} className="lg:hidden text-navy-600 hover:text-gold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
              <div className="flex items-center gap-4">
                <h2 className="font-display font-medium text-navy-950 text-xl">{allSections.flatMap(s => s.items).find(i => i.id === active)?.label ?? 'Resumen General'}</h2>
              </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center pl-2 border-l border-gray-200 relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 text-navy-600 hover:text-gold transition-colors">
                <IconBell />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                      <span className="font-sans font-bold text-navy-950 text-sm">Notificaciones</span>
                      {unreadCount > 0 ? (
                        <span className="text-[10px] bg-gold/15 text-gold px-2 py-0.5 rounded-full font-bold">{unreadCount} sin leer</span>
                      ) : (
                        <span className="text-[10px] text-navy-500">Al día</span>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {recentNotifs.length === 0 ? (
                        <div className="p-6 text-center text-xs text-navy-500">Sin notificaciones aún</div>
                      ) : (
                        recentNotifs.map(n => (
                          <button
                            key={n.id}
                            onClick={async () => {
                              if (!n.is_read) {
                                try { await axios.patch(`/api/notifications/${n.id}/read`); } catch(_) {}
                              }
                              if (n.module) {
                                const mod = n.module;
                                if (mod === 'avisos') setActive('avisos');
                                else if (mod === 'calendar') setActive('calendar');
                                else if (mod === 'tickets') setActive('tickets');
                                else if (mod === 'tasks') setActive('tasks');
                                else if (mod === 'foro') setActive('foro');
                                else if (mod === 'minutas') setActive('minutas');
                                else setActive('notifications');
                              }
                              else setActive('notifications');
                              setShowNotifications(false);
                              fetchRecentNotifications();
                            }}
                            className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gold/5 cursor-pointer transition-colors block ${!n.is_read ? 'bg-gold/5' : ''}`}
                          >
                            <div className="flex items-start gap-2">
                              {!n.is_read && <span className="w-1.5 h-1.5 bg-gold rounded-full mt-1.5 flex-shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-navy-900 truncate">{n.title}</p>
                                <p className="text-[10px] text-navy-600 mt-0.5 line-clamp-2">{n.message}</p>
                                <span className="text-[9px] text-navy-500 mt-1 block">
                                  {(() => {
                                    if (!n.created_at) return '';
                                    const d = new Date(n.created_at.replace(' ', 'T') + (n.created_at.includes('Z') ? '' : 'Z'));
                                    const diffMin = Math.floor((Date.now() - d) / 60000);
                                    if (diffMin < 1) return 'Ahora mismo';
                                    if (diffMin < 60) return `Hace ${diffMin} min`;
                                    if (diffMin < 1440) return `Hace ${Math.floor(diffMin/60)} h`;
                                    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
                                  })()}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="p-2 text-center bg-gray-50 border-t border-gray-200">
                      <button onClick={() => { setActive('notifications'); setShowNotifications(false); }} className="text-[10px] font-bold text-gold hover:text-navy-900 uppercase tracking-wider">Ver todas</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="surface-light flex-1 bg-gray-50 p-4 lg:p-8 overflow-y-auto pb-24 lg:pb-8 text-navy-950">
          {active === 'foro' ? <ForoModule /> : active === 'notifications' ? <NotificationsModule /> : active === 'users' ? (user?.role === 'superadmin' ? <UsersModule /> : (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-center max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <p className="font-display font-bold text-navy-950">Acceso restringido</p>
              <p className="text-sm text-navy-600">Esta sección solo está disponible para Super Administradores.</p>
              <button onClick={() => setActive('overview')} className="btn-gold mt-2">Volver al inicio</button>
            </div>
          )) : active === 'tickets' ? (
            <TicketsModule
              openTicketId={pendingTicketOpen?.id ?? null}
              openTicketTab={pendingTicketOpen?.tab ?? 'info'}
              onConsumeOpenTicket={() => setPendingTicketOpen(null)}
            />
          ) : active === 'tasks' ? (
            <TasksModule
              onOpenTicket={(id) => {
                setPendingTicketOpen({ id, tab: 'info' });
                setActive('tickets');
              }}
            />
          ) : active === 'avisos' ? <AvisosModule /> : active === 'minutas' ? <MinutasModule /> : active === 'calendar' ? <CalendarModule /> : active === 'settings' ? <ConfigModule /> : active === 'overview' ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <SparkleIcon size={16} className="text-gold" />
                <p className="font-label text-gold text-[10px] tracking-widest uppercase font-bold">Bienvenido</p>
              </div>
              <h3 className="font-display font-medium text-navy-950 text-2xl mt-0.5">{user?.name}</h3>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard title="Usuarios" value={stats.users} sub="Colaboradores activos" highlight icon={<IconGrid />} onClick={user?.role === 'superadmin' ? () => setActive('users') : undefined} />
                <MetricCard title="Reuniones" value={stats.meetings} sub="Programadas hoy" icon={<IconCalendar />} onClick={() => setActive('calendar')} />
                <MetricCard title="Tickets" value={stats.tickets} sub="Pendientes de revisión" icon={<IconBuilding />} onClick={() => setActive('tickets')} />
                <MetricCard title="Avisos" value={stats.avisos} sub="Comunicados enviados" icon={<IconFinance />} onClick={() => setActive('avisos')} />
              </div>

              {/* ── Gráficas ── */}
              {(() => {
                const chartData = CHART_DATA_KEYS.map(({ key, name, color }) => ({
                  name, color, value: stats[key] ?? 0,
                }));
                const total = chartData.reduce((s, d) => s + d.value, 0);
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* Gráfica de barras */}
                    <div className="rounded-sm border border-gray-200 bg-white shadow-sm p-6">
                      <p className="font-sans font-bold text-navy-950 text-sm tracking-wide">Resumen de Actividad</p>
                      <p className="font-sans text-navy-500 text-xs mt-0.5 mb-6">Comparativa entre módulos principales</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} barSize={42} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Gráfica de pastel */}
                    <div className="rounded-sm border border-gray-200 bg-white shadow-sm p-6">
                      <p className="font-sans font-bold text-navy-950 text-sm tracking-wide">Distribución General</p>
                      <p className="font-sans text-navy-500 text-xs mt-0.5 mb-4">Proporción entre módulos</p>
                      <div className="flex items-center gap-6">
                        <div style={{ width: 170, height: 220, flexShrink: 0 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={3} dataKey="value" strokeWidth={0}>
                                {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                              </Pie>
                              <Tooltip content={<PieTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-4">
                          {chartData.map((item) => {
                            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                            return (
                              <div key={item.name}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                                    <span className="font-sans font-bold text-navy-700 text-xs">{item.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-display text-navy-950 text-sm font-light">{item.value}</span>
                                    <span className="font-label text-[9px] text-navy-400 tracking-wider">{pct}%</span>
                                  </div>
                                </div>
                                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.color }} />
                                </div>
                              </div>
                            );
                          })}
                          {total === 0 && (
                            <p className="font-label text-[10px] text-navy-400 tracking-widest uppercase text-center pt-6">Sin datos aún</p>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()}

              {/* ── KPIs ── */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-gold rounded-full" />
                  <p className="font-label text-navy-700 text-[10px] tracking-[0.25em] uppercase font-bold">Indicadores Clave (KPIs)</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    label="Tasa de Resolución"
                    value={`${kpis.resolutionRate}%`}
                    sub={`${stats.tickets} tickets totales`}
                    progress={kpis.resolutionRate}
                    tone="gold"
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  />
                  <KpiCard
                    label="En Progreso"
                    value={kpis.inProgress}
                    sub="Tickets siendo atendidos"
                    tone="navy"
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  />
                  <KpiCard
                    label="Urgentes Activos"
                    value={kpis.urgent}
                    sub="Requieren atención inmediata"
                    tone="red"
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
                  />
                  <KpiCard
                    label="Vencidos"
                    value={kpis.overdue}
                    sub="Pasaron su fecha límite"
                    tone="amber"
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
                  />
                  <KpiCard
                    label="Reuniones esta Semana"
                    value={kpis.meetingsThisWeek}
                    sub="Programadas de Dom a Sáb"
                    tone="emerald"
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
                  />
                  <KpiCard
                    label="Avisos Activos"
                    value={kpis.activeAvisos}
                    sub={`${stats.avisos} comunicados totales`}
                    tone="navy"
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>}
                  />
                  <KpiCard
                    label="Carga Promedio"
                    value={stats.users > 0 ? (stats.tickets / stats.users).toFixed(1) : '0'}
                    sub="Tickets por colaborador"
                    tone="navy"
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
                  />
                  <KpiCard
                    label="Pendientes Críticos"
                    value={kpis.urgent + kpis.overdue}
                    sub="Urgentes + vencidos"
                    tone="red"
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-60">
              <EmptyStateIllustration className="w-32 h-32 text-navy-500" />
              <p className="font-label font-bold text-navy-500 text-[10px] tracking-widest uppercase">Módulo en construcción</p>
            </div>
          )}
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-surface flex items-center justify-around px-2 py-2 bg-navy-950">
        {allSections.flatMap(s => s.items).filter(item => ['overview', 'calendar', 'users', 'tickets', 'tasks', 'avisos'].includes(item.id)).map(item => {
          const mobileLabel = item.id === 'tasks' ? 'Tareas' : item.id === 'tickets' ? 'Tickets' : item.label;
          const badge = getNavBadgeCount(item.id);
          return (
            <button key={item.id} type="button" onClick={() => goToModule(item.id)} className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all ${active === item.id ? 'text-gold bg-gold/10' : 'text-slate-muted'}`}>
              <span className="relative w-5 h-5 flex items-center justify-center">
                {item.icon}
                {badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[13px] h-3 px-0.5 rounded-full bg-red-500 text-white flex items-center justify-center">
                    <span className="text-[7px] font-bold leading-none tabular-nums">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  </span>
                )}
              </span>
              <span className="text-[8px] font-black uppercase truncate max-w-[50px]">{mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
