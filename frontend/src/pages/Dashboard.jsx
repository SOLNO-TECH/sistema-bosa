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

function MetricCard({ title, value, sub, icon, highlight }) {
  return (
    <div className={`rounded-xl p-6 border transition-all duration-300 hover:shadow-xl ${highlight ? 'border-gold/30 bg-white shadow-gold/5' : 'border-gray-100 bg-white shadow-sm'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <p className="text-3xl font-display font-bold text-navy-950 mt-1">{value}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">{sub}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${highlight ? 'bg-gold text-navy-950' : 'bg-slate-50 text-navy-900'}`}>{icon}</div>
      </div>
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
        axios.get('/api/users'),
        axios.get('/api/meetings'),
        axios.get('/api/tickets'),
        axios.get('/api/avisos')
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
    { title: 'Principal', items: [{ id: 'overview', label: 'Resumen', icon: <IconGrid /> }, { id: 'calendar', label: 'Calendario', icon: <IconCalendar /> }] },
    { title: 'Gestión', items: [{ id: 'tickets', label: 'Tickets', icon: <IconTickets /> }, { id: 'avisos', label: 'Avisos', icon: <IconAvisos /> }] }
  ];
  if (user?.role === 'superadmin') sections.push({ title: 'Admin', items: [{ id: 'users', label: 'Usuarios', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth={2}/></svg> }] });
  
  sections.push({ 
    title: 'Sistema', 
    items: [{ id: 'settings', label: 'Configuración', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth={2}/></svg> }] 
  });

  return (
    <div className="min-h-screen flex bg-white font-sans text-navy-950">
      
      {/* SIDEBAR FIJO */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy-950 flex flex-col transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8"><img src="/logo.png" alt="BOSA" className="w-full" /></div>
        <nav className="flex-1 px-4 space-y-8">
          {sections.map(s => (
            <div key={s.title}>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-4 mb-4">{s.title}</p>
              {s.items.map(i => (
                <button key={i.id} onClick={() => { setActive(i.id); setSidebar(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-all ${active === i.id ? 'bg-gold text-navy-950' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                  {i.icon}<span>{i.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-8 border-t border-white/5"><button onClick={logout} className="w-full py-3 rounded-xl border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/10">Cerrar Sesión</button></div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col bg-gray-50/50 min-w-0">
        <header className="h-20 flex items-center justify-between px-8 bg-white border-b border-gray-100">
           <div className="flex items-center gap-4">
             <button onClick={() => setSidebar(true)} className="lg:hidden text-navy-900"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth={2}/></svg></button>
             <h2 className="text-xl font-bold tracking-tight">{sections.flatMap(s => s.items).find(i => i.id === active)?.label || 'Dashboard'}</h2>
           </div>
           <div className="flex items-center gap-4">
             <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-widest">Sistema Estable</span>
             <div className="w-10 h-10 rounded-full bg-navy-50 flex items-center justify-center font-bold text-navy-900 border border-navy-100">{user?.name?.charAt(0)}</div>
           </div>
        </header>

        <main className="p-8 flex-1 overflow-y-auto">
          {active === 'overview' ? (
            <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="Colaboradores" value={stats.users} sub="Activos hoy" highlight icon={<IconGrid />} />
                <MetricCard title="Reuniones" value={stats.meetings} sub="En agenda" icon={<IconCalendar />} />
                <MetricCard title="Tickets" value={stats.tickets} sub="Pendientes" icon={<IconTickets />} />
                <MetricCard title="Avisos" value={stats.avisos} sub="Publicados" icon={<IconAvisos />} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* GRÁFICA SVG MANUAL (SIN LIBRERÍAS) */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm h-[450px] flex flex-col">
                  <div className="flex justify-between items-center mb-10">
                    <div>
                      <h3 className="text-lg font-bold text-navy-950">Tendencia de Actividad</h3>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Últimos 7 períodos</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gold" /><span className="text-[10px] font-black uppercase text-slate-500">Tickets</span></div>
                    </div>
                  </div>
                  
                  <div className="flex-1 relative mt-4">
                    {/* Rejilla de fondo */}
                    <div className="absolute inset-0 flex flex-col justify-between">
                      {[0,1,2,3,4].map(i => <div key={i} className="w-full h-px bg-slate-50" />)}
                    </div>
                    {/* Gráfica SVG */}
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 700 200">
                      <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style={{stopColor:'#D4AF37', stopOpacity:0.4}} /><stop offset="100%" style={{stopColor:'#D4AF37', stopOpacity:0}} /></linearGradient>
                      </defs>
                      <path d="M0,150 Q100,120 200,160 Q300,100 400,140 Q500,80 600,130 L700,90 L700,200 L0,200 Z" fill="url(#grad)" />
                      <path d="M0,150 Q100,120 200,160 Q300,100 400,140 Q500,80 600,130 L700,90" fill="none" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" />
                      {/* Puntos */}
                      {[0,1,2,3,4,5,6].map((x,i) => <circle key={i} cx={x*116} cy={150 - (i*10)} r="5" fill="white" stroke="#D4AF37" strokeWidth="2" />)}
                    </svg>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col">
                  <h3 className="text-lg font-bold text-navy-950 mb-8 border-b border-gray-50 pb-4">Desempeño Global</h3>
                  <div className="space-y-8 flex-1 flex flex-col justify-center">
                    <KPIBar label="Tasa de Respuesta" value={performance.resolutionRate || 85} color="#D4AF37" />
                    <KPIBar label="Eficiencia" value={performance.efficiency || 92} color="#0A1930" />
                    <div className="pt-8">
                       <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6">Top Colaboradores</p>
                       <div className="space-y-4">
                         {performance.topUsers?.map((u, i) => (
                           <div key={i} className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-950 flex items-center justify-center text-xs font-black">{u.name.charAt(0)}</div>
                               <div><p className="text-xs font-bold text-navy-900">{u.name}</p></div>
                             </div>
                             <span className="text-xs font-black text-gold">KPI {u.score}</span>
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

function KPIBar({ label, value, color }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p><p className="text-sm font-black text-navy-950">{value}%</p></div>
      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full transition-all duration-1000" style={{ width: `${value}%`, backgroundColor: color }} /></div>
    </div>
  );
}
