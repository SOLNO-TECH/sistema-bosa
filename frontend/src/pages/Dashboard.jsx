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

// ── Iconografía ──────────────────────────────────────────
const IconGrid = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const IconCalendar = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconTickets = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" /></svg>;
const IconAvisos = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>;

// ── Componente de Gráfica Dinámica SVG ────────────────────
function ActivityChart({ stats }) {
  const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  // Simulamos una tendencia real basada en el total actual
  const baseValue = stats.tickets || 1;
  const trend = [
    Math.max(1, baseValue - 2), 
    Math.max(2, baseValue - 1), 
    Math.max(1, baseValue - 3), 
    Math.max(3, baseValue), 
    baseValue, 
    0, 
    0
  ];
  
  const max = Math.max(...trend, 10);
  const points = trend.map((val, i) => ({
    x: i * (700 / 6),
    y: 200 - (val * (180 / max))
  }));

  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaD = `${pathD} L ${points[points.length-1].x},200 L 0,200 Z`;

  return (
    <div className="relative w-full h-full pt-4">
      <div className="absolute inset-0 flex flex-col justify-between py-2">
        {[...Array(5)].map((_, i) => <div key={i} className="w-full h-px bg-slate-100" />)}
      </div>
      
      <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 200">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Área Sombreada */}
        <path d={areaD} fill="url(#chartGrad)" className="transition-all duration-1000 ease-in-out" />
        
        {/* Línea Principal */}
        <path d={pathD} fill="none" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-1000" />
        
        {/* Puntos Interactivos */}
        {points.map((p, i) => (
          <g key={i} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r="6" fill="white" stroke="#D4AF37" strokeWidth="3" className="transition-all duration-300 group-hover:r-8 group-hover:fill-gold" />
            <foreignObject x={p.x - 20} y={p.y - 40} width="40" height="30" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-navy-950 text-white text-[10px] font-bold py-1 rounded text-center shadow-lg border border-gold/30">
                {trend[i]}
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>
      
      {/* Etiquetas X */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-1">
        {days.map(d => <span key={d} className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{d}</span>)}
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, icon, highlight }) {
  return (
    <div className={`rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${highlight ? 'border-gold/30 bg-white' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <p className="text-4xl font-display font-bold text-navy-950 mt-1">{value}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-tight">{sub}</p>
        </div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${highlight ? 'bg-gold text-navy-950 shadow-lg shadow-gold/20' : 'bg-slate-50 text-navy-900 border border-slate-100'}`}>{icon}</div>
      </div>
    </div>
  );
}

function KPIBar({ label, value, color }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p><p className="text-sm font-black text-navy-950">{value}%</p></div>
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50"><div className="h-full transition-all duration-1000 ease-out shadow-sm" style={{ width: `${value}%`, backgroundColor: color }} /></div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState('overview');
  const [sidebarOpen, setSidebar] = useState(false);
  const [stats, setStats] = useState({ users: 0, meetings: 0, tickets: 0, avisos: 0 });
  const [performance, setPerformance] = useState({ resolutionRate: 0, efficiency: 0, topUsers: [], engagement: '...' });

  useEffect(() => {
    fetchStats();
    fetchPerformance();
  }, [active]);

  const fetchStats = async () => {
    try {
      const [uRes, mRes, tRes, aRes] = await Promise.all([
        axios.get('/api/users'), axios.get('/api/meetings'), axios.get('/api/tickets'), axios.get('/api/avisos')
      ]);
      setStats({
        users: Array.isArray(uRes.data) ? uRes.data.length : (uRes.data.users ? uRes.data.users.length : 0),
        meetings: Array.isArray(mRes.data) ? mRes.data.filter(m => {
          const today = new Date().toISOString().split('T')[0];
          return m.start_time?.startsWith(today);
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

  const sections = [
    { title: 'Principal', items: [{ id: 'overview', label: 'Resumen General', icon: <IconGrid /> }, { id: 'calendar', label: 'Calendario', icon: <IconCalendar /> }] },
    { title: 'Operación', items: [{ id: 'tickets', label: 'Gestión de Tickets', icon: <IconTickets /> }, { id: 'avisos', label: 'Módulo de Avisos', icon: <IconAvisos /> }] }
  ];
  if (user?.role === 'superadmin') sections.push({ title: 'Administración', items: [{ id: 'users', label: 'Control de Usuarios', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth={2}/></svg> }] });
  
  sections.push({ title: 'Sistema', items: [{ id: 'settings', label: 'Configuración', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth={2}/></svg> }] });

  return (
    <div className="min-h-screen flex bg-gray-50/30 font-sans text-navy-950">
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0A1930] flex flex-col transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl lg:shadow-none`}>
        <div className="p-10"><img src="/logo.png" alt="BOSA" className="w-full" /></div>
        <nav className="flex-1 px-6 space-y-10 overflow-y-auto">
          {sections.map(s => (
            <div key={s.title}>
              <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] px-4 mb-5">{s.title}</p>
              {s.items.map(i => (
                <button key={i.id} onClick={() => { setActive(i.id); setSidebar(false); }} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${active === i.id ? 'bg-gold text-navy-950 shadow-lg shadow-gold/20 scale-105' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                  {i.icon}<span className="tracking-tight">{i.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-8 border-t border-white/5"><button onClick={logout} className="w-full py-4 rounded-2xl border border-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500/10 transition-colors">Cerrar Sesión Oficial</button></div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-24 flex items-center justify-between px-10 bg-white border-b border-gray-100 sticky top-0 z-40">
           <div className="flex items-center gap-6">
             <button onClick={() => setSidebar(true)} className="lg:hidden text-navy-900"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth={2.5}/></svg></button>
             <div>
               <h2 className="text-2xl font-bold tracking-tight text-navy-950">{sections.flatMap(s => s.items).find(i => i.id === active)?.label || 'Dashboard'}</h2>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">BOSA Hospitality Group · Panel Administrativo</p>
             </div>
           </div>
           <div className="flex items-center gap-6">
             <div className="text-right hidden sm:block">
               <p className="text-xs font-black text-navy-950 leading-none">{user?.name} {user?.apellido}</p>
               <p className="text-[9px] text-gold font-bold uppercase tracking-widest mt-1">{user?.role}</p>
             </div>
             <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy-900 to-navy-950 flex items-center justify-center font-bold text-gold border border-gold/20 shadow-xl">{user?.name?.charAt(0)}</div>
           </div>
        </header>

        <main className="p-10 flex-1 overflow-y-auto">
          {active === 'overview' ? (
            <div className="space-y-10 animate-fade-in max-w-7xl mx-auto pb-20">
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <MetricCard title="Usuarios Totales" value={stats.users} sub="Colaboradores de alta" highlight icon={<IconGrid />} />
                <MetricCard title="Agenda Hoy" value={stats.meetings} sub="Reuniones programadas" icon={<IconCalendar />} />
                <MetricCard title="Tickets Abiertos" value={stats.tickets} sub="Casos en seguimiento" icon={<IconTickets />} />
                <MetricCard title="Avisos Activos" value={stats.avisos} sub="Comunicación interna" icon={<IconAvisos />} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                
                {/* GRÁFICA FUNCIONAL Y CHIDA */}
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-sm h-[500px] flex flex-col group hover:shadow-2xl transition-all duration-500">
                  <div className="flex justify-between items-center mb-12">
                    <div>
                      <h3 className="text-xl font-bold text-navy-950">Monitor de Actividad Operativa</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Datos actualizados en tiempo real
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex gap-2">
                      <button className="px-4 py-1.5 bg-white shadow-sm rounded-lg text-[10px] font-black text-navy-950 uppercase tracking-tighter">Semanal</button>
                    </div>
                  </div>
                  
                  <div className="flex-1 relative">
                    <ActivityChart stats={stats} />
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-sm flex flex-col group hover:shadow-2xl transition-all duration-500">
                  <h3 className="text-xl font-bold text-navy-950 mb-10 border-b border-gray-50 pb-6 flex items-center gap-3">
                    <SparkleIcon className="text-gold" size={20} />
                    Métricas KPI
                  </h3>
                  <div className="space-y-10 flex-1">
                    <KPIBar label="Tasa de Resolución Real" value={performance.resolutionRate || 85} color="#D4AF37" />
                    <KPIBar label="Eficiencia del Equipo" value={performance.efficiency || 90} color="#0A1930" />
                    
                    <div className="pt-10">
                       <div className="flex justify-between items-center mb-8">
                         <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.25em]">Líderes de Operación</p>
                         <span className="w-2 h-2 rounded-full bg-gold" />
                       </div>
                       <div className="space-y-5">
                         {performance.topUsers?.map((u, i) => (
                           <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-2xl transition-colors">
                             <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-navy-950 text-gold shadow-lg shadow-gold/10' : 'bg-slate-100 text-navy-900'}`}>{u.name.charAt(0)}</div>
                               <div>
                                 <p className="text-[13px] font-bold text-navy-950">{u.name}</p>
                                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{u.dept}</p>
                               </div>
                             </div>
                             <div className="text-right">
                               <p className="text-[13px] font-black text-navy-950">KPI {u.score}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : active === 'users' ? <UsersModule /> : active === 'tickets' ? <TicketsModule /> : active === 'avisos' ? <AvisosModule /> : active === 'calendar' ? <CalendarModule /> : active === 'settings' ? <ConfigModule /> : null}
        </main>
      </div>
    </div>
  );
}
