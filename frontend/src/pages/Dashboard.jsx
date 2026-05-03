import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { EmptyStateIllustration, SparkleIcon } from '../components/Illustrations';
import UsersModule from '../components/modules/UsersModule';
import ConfigModule from '../components/modules/ConfigModule';
import TicketsModule from '../components/modules/TicketsModule';
import AvisosModule from '../components/modules/AvisosModule';
import CalendarModule from '../components/modules/CalendarModule';
import axios from 'axios';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  administrator: 'Administrador',
};

// ── Iconos ──────────────────────────────────────────────
const IconGrid = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>;
const IconCalendar = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>;
const IconTickets = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>;
const IconAvisos = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg>;
const IconUserAdmin = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const IconSettings = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378.138.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

// ── Metric Card ──────────────────────────────────────────
function MetricCard({ title, value, sub, icon, highlight }) {
  return (
    <div className={`rounded-sm p-5 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group ${highlight ? 'border-gold/30 bg-gold/5' : 'border-gray-200 bg-white shadow-sm'}`}>
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
  const [mounted, setMounted] = useState(false);
  
  const [stats, setStats] = useState({ users: 0, meetings: 0, tickets: 0, avisos: 0 });
  const [performance, setPerformance] = useState({ resolutionRate: 0, efficiency: 0, topUsers: [], engagement: '...' });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    fetchStats();
    fetchPerformance();
    return () => clearTimeout(t);
  }, [active]);

  const fetchStats = async () => {
    try {
      const [uRes, mRes, tRes, aRes] = await Promise.all([
        axios.get('/api/users'),
        axios.get('/api/meetings'),
        axios.get('/api/tickets'),
        axios.get('/api/avisos')
      ]);
      setStats({
        users: Array.isArray(uRes.data) ? uRes.data.length : (uRes.data.users ? uRes.data.users.length : 0),
        meetings: Array.isArray(mRes.data) ? mRes.data.filter(m => {
          const today = new Date().toISOString().split('T')[0];
          return m.start_time.startsWith(today);
        }).length : 0,
        tickets: Array.isArray(tRes.data) ? tRes.data.length : 0,
        avisos: Array.isArray(aRes.data) ? aRes.data.length : 0
      });
    } catch (err) { console.error(err); }
  };

  const fetchPerformance = async () => {
    try {
      const res = await axios.get('/api/stats/performance');
      setPerformance(res.data);
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
    systemItems.push({ id: 'settings', label: 'Configuración', icon: <IconSettings /> });
    
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
          <div className="w-10 h-10 rounded-lg border border-gold/40 flex items-center justify-center bg-navy-900">
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
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
              <div className="flex items-center gap-4">
                <h2 className="font-display font-medium text-navy-950 text-xl">{allSections.flatMap(s => s.items).find(i => i.id === active)?.label ?? 'Resumen General'}</h2>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">v2.1 - REAL DATA</span>
              </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto pb-48 lg:pb-8">
          {active === 'users' ? <UsersModule /> : active === 'tickets' ? <TicketsModule /> : active === 'avisos' ? <AvisosModule /> : active === 'calendar' ? <CalendarModule /> : active === 'settings' ? <ConfigModule /> : active === 'overview' ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <SparkleIcon size={16} className="text-gold" />
                <p className="font-label text-gold text-[10px] tracking-widest uppercase font-bold">Monitor de Rendimiento en Tiempo Real</p>
              </div>
              <h3 className="font-display font-medium text-navy-950 text-2xl mt-0.5">{user?.name} {user?.apellido}</h3>
              
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard title="Usuarios" value={stats.users} sub="Colaboradores activos" highlight icon={<IconGrid />} />
                <MetricCard title="Reuniones" value={stats.meetings} sub="Hoy en agenda" icon={<IconCalendar />} />
                <MetricCard title="Tickets" value={stats.tickets} sub="Total acumulado" icon={<IconTickets />} />
                <MetricCard title="Avisos" value={stats.avisos} sub="Comunicados globales" icon={<IconAvisos />} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-sm border border-gray-200 p-6 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                    <p className="font-sans font-bold text-navy-950 text-sm tracking-wide">Registro de Actividad Reciente</p>
                    <button onClick={fetchPerformance} className="text-gold hover:underline text-[10px] font-black uppercase">Actualizar</button>
                  </div>
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <EmptyStateIllustration className="w-24 h-24 opacity-30 grayscale" />
                    <p className="font-label font-bold text-navy-300 text-[10px] tracking-widest uppercase">Próximamente: Historial en tiempo real</p>
                  </div>
                </div>
                
                {/* SECCIÓN DE KPIs DE RENDIMIENTO REAL */}
                <div className="rounded-sm border border-gray-200 p-6 bg-white shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                    <p className="font-label font-bold text-navy-950 text-xs tracking-widest uppercase">KPIs de Rendimiento</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-tighter">Conectado</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-8">
                    {/* KPI 1: Resolución de Tickets Real */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-2">
                           <div className="w-1 h-3 bg-gold rounded-full" />
                           <p className="text-[10px] font-black text-navy-600 uppercase tracking-tight">Tasa de Resolución Real</p>
                        </div>
                        <p className="text-sm font-black text-navy-950">{performance.resolutionRate}%</p>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gold transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(212,175,55,0.4)]" style={{ width: `${performance.resolutionRate}%` }} />
                      </div>
                    </div>

                    {/* KPI 2: Eficiencia Operativa Real */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-2">
                           <div className="w-1 h-3 bg-navy-950 rounded-full" />
                           <p className="text-[10px] font-black text-navy-600 uppercase tracking-tight">Eficiencia Operativa</p>
                        </div>
                        <p className="text-sm font-black text-navy-950">{performance.efficiency}%</p>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-navy-950 transition-all duration-1000 ease-out" style={{ width: `${performance.efficiency}%` }} />
                      </div>
                    </div>

                    {/* Mini Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1">Audit Log</p>
                        <p className="text-2xl font-display font-bold text-navy-950">{performance.efficiency > 50 ? 'OK' : '...'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1">Compromiso</p>
                        <p className="text-2xl font-display font-bold text-navy-950">{performance.engagement}</p>
                      </div>
                    </div>

                    {/* Leaderboard Section Real */}
                    <div className="pt-6">
                      <h4 className="text-[10px] font-black text-navy-950 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg>
                        Líderes de Productividad
                      </h4>
                      <div className="space-y-3">
                        {performance.topUsers?.length === 0 && <p className="text-center text-[10px] text-slate-400 py-4 uppercase font-bold tracking-widest">Sin datos suficientes</p>}
                        {performance.topUsers?.map((u, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:shadow-md transition-all group">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${i === 0 ? 'bg-navy-950' : 'bg-slate-100'} text-${i === 0 ? 'gold' : 'navy-900'} flex items-center justify-center text-xs font-black shadow-sm`}>{u.name.charAt(0)}</div>
                              <div>
                                <p className="text-[11px] font-black text-navy-950 leading-none group-hover:text-gold transition-colors">{u.name}</p>
                                <p className="text-[9px] text-navy-400 font-bold mt-1 uppercase tracking-tighter">{u.dept}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black text-navy-950">KPI {u.score}</p>
                              <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                <div className={`h-full ${i === 0 ? 'bg-gold' : 'bg-navy-900'}`} style={{ width: `${Math.min(100, u.score)}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
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
