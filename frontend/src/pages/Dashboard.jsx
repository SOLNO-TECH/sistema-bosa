import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { EmptyStateIllustration, SparkleIcon } from '../components/Illustrations';
import UsersModule from '../components/modules/UsersModule';
import ConfigModule from '../components/modules/ConfigModule';
import TicketsModule from '../components/modules/TicketsModule';
import AvisosModule from '../components/modules/AvisosModule';
import CalendarModule from '../components/modules/CalendarModule';
import ForoModule from '../components/modules/ForoModule';
import axios from 'axios';
import NotificationsModule from '../components/modules/NotificationsModule';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  administrator: 'Administrador',
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
const IconAvisos = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg>;
const IconBell = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
const IconForo = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>;

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

// ── Componente principal ──────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState('overview');
  const [sidebarOpen, setSidebar] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [stats, setStats] = useState({ users: 0, meetings: 0, tickets: 0, avisos: 0 });
  const [kpis, setKpis] = useState({ resolutionRate: 0, inProgress: 0, urgent: 0, overdue: 0, meetingsThisWeek: 0, activeAvisos: 0 });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    fetchStats();
    return () => clearTimeout(t);
  }, []);

  const fetchStats = async () => {
    try {
      const [uRes, mRes, tRes, aRes] = await Promise.all([
        axios.get('/api/users'),
        axios.get('/api/meetings'),
        axios.get('/api/tickets'),
        axios.get('/api/avisos')
      ]);

      const users = Array.isArray(uRes.data) ? uRes.data : [];
      const meetings = Array.isArray(mRes.data) ? mRes.data : [];
      const tickets = Array.isArray(tRes.data) ? tRes.data : [];
      const avisos = Array.isArray(aRes.data) ? aRes.data : [];

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

      const activeAvisos = avisos.filter(a => a.is_active === undefined || a.is_active === 1 || a.is_active === true).length;

      setKpis({
        resolutionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
        inProgress,
        urgent,
        overdue,
        meetingsThisWeek,
        activeAvisos,
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
          { id: 'avisos', label: 'Avisos', icon: <IconAvisos /> },
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
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(160deg, #071221 0%, #050D1A 100%)' }}>

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col border-r border-surface lg:relative lg:translate-x-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #0A1930 0%, #071221 100%)' }}
      >
        <div className="px-5 py-6 border-b border-surface flex items-center h-[96px] relative">
          <img src="/logo.png" alt="BOSA Logo" className="w-40" />
          <button onClick={() => setSidebar(false)} className="lg:hidden ml-auto text-slate-muted hover:text-gold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="border-b border-surface px-5 py-4 bg-gold/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-gold/40 flex items-center justify-center bg-navy-900">
            <span className="font-display text-gold text-base font-bold">{user?.name?.charAt(0)}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-slate-text text-[11px] font-bold truncate tracking-wide">{user?.name} {user?.apellido}</span>
            <span className="text-gold text-[9px] font-bold mt-1 uppercase tracking-widest">{ROLE_LABELS[user?.role]}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {allSections.map((section) => (
            <div key={section.title}>
              <p className="font-label text-slate-muted text-[9px] tracking-[0.35em] uppercase px-3 mb-1.5">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <button key={item.id} onClick={() => { setActive(item.id); setSidebar(false); }} className={active === item.id ? 'nav-item-active' : 'nav-item-default'}>
                    {item.icon}<span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-surface p-4 pb-20 lg:pb-4">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-900/30 text-red-400 text-[10px] tracking-widest uppercase font-bold hover:bg-red-900/10">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebar(false)} />}

      <div className={`flex-1 flex flex-col min-w-0 bg-gray-50 transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/90 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebar(true)} className="lg:hidden text-navy-600 hover:text-gold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
              <div className="flex items-center gap-4">
                <h2 className="font-display font-medium text-navy-950 text-xl">{allSections.flatMap(s => s.items).find(i => i.id === active)?.label ?? 'Resumen General'}</h2>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">v1.3 - CLEAN</span>
              </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center pl-2 border-l border-gray-200 relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 text-navy-600 hover:text-gold transition-colors">
                <IconBell />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                  <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <span className="font-sans font-bold text-navy-950 text-sm">Notificaciones</span>
                    <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-bold">1 Nueva</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                      <p className="text-xs font-bold text-navy-800">Bienvenido a BOSA</p>
                      <p className="text-[10px] text-navy-500 mt-1 line-clamp-2">Revisa los últimos avisos y actualizaciones del sistema.</p>
                      <span className="text-[9px] text-gray-400 mt-1 block">Hace un momento</span>
                    </div>
                  </div>
                  <div className="p-2 text-center bg-gray-50 border-t border-gray-200">
                    <button onClick={() => { setActive('notifications'); setShowNotifications(false); }} className="text-[10px] font-bold text-gold hover:text-navy-900 uppercase tracking-wider">Ver todas</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto pb-48 lg:pb-8">
          {active === 'foro' ? <ForoModule /> : active === 'notifications' ? <NotificationsModule /> : active === 'users' ? <UsersModule /> : active === 'tickets' ? <TicketsModule /> : active === 'avisos' ? <AvisosModule /> : active === 'calendar' ? <CalendarModule /> : active === 'settings' ? <ConfigModule /> : active === 'overview' ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <SparkleIcon size={16} className="text-gold" />
                <p className="font-label text-gold text-[10px] tracking-widest uppercase font-bold">Bienvenido</p>
              </div>
              <h3 className="font-display font-medium text-navy-950 text-2xl mt-0.5">{user?.name}</h3>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard title="Usuarios" value={stats.users} sub="Colaboradores activos" highlight icon={<IconGrid />} onClick={() => setActive('users')} />
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
        {allSections.flatMap(s => s.items).filter(item => ['overview', 'calendar', 'users', 'tickets', 'avisos'].includes(item.id)).map(item => (
          <button key={item.id} onClick={() => setActive(item.id)} className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all ${active === item.id ? 'text-gold bg-gold/10' : 'text-slate-muted'}`}>
            <span className="w-5 h-5">{item.icon}</span>
            <span className="text-[8px] font-black uppercase truncate max-w-[50px]">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
