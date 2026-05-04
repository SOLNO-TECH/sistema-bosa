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
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  administrator: 'Administrador',
};

const IconGrid = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>;
const IconCalendar = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>;
const IconTickets = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>;
const IconAvisos = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg>;
const IconUserAdmin = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;

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

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const getSections = () => {
    const sections = [
      { title: 'Principal', items: [{ id: 'overview', label: 'Resumen General', icon: <IconGrid /> }, { id: 'calendar', label: 'Calendario', icon: <IconCalendar /> }] },
      { title: 'Gestión', items: [{ id: 'tickets', label: 'Tickets de Soporte', icon: <IconTickets /> }, { id: 'avisos', label: 'Avisos', icon: <IconAvisos /> }] }
    ];
    const systemItems = [];
    if (user?.role === 'superadmin') systemItems.push({ id: 'users', label: 'Usuarios', icon: <IconUserAdmin /> });
    systemItems.push({ id: 'settings', label: 'Configuración', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth={1.5}/></svg> });
    sections.push({ title: 'Sistema', items: systemItems });
    return sections;
  };

  const allSections = getSections();

  const chartData = [
    { name: 'Lun', tickets: 2, avisos: 1 }, { name: 'Mar', tickets: 5, avisos: 2 }, { name: 'Mie', tickets: 3, avisos: 0 },
    { name: 'Jue', tickets: 8, avisos: 3 }, { name: 'Vie', tickets: stats.tickets || 4, avisos: stats.avisos || 2 },
    { name: 'Sab', tickets: 0, avisos: 0 }, { name: 'Dom', tickets: 0, avisos: 0 }
  ];

  const pieData = [
    { name: 'Tickets', value: stats.tickets || 1, color: '#D4AF37' },
    { name: 'Avisos', value: stats.avisos || 1, color: '#0A1930' }
  ];

  return (
    <div className="min-h-screen flex bg-[#071221]">
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col border-r border-white/5 lg:relative lg:translate-x-0 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: '#0A1930' }}>
        <div className="px-5 py-6 border-b border-white/5 flex items-center h-[96px]"><img src="/logo.png" alt="BOSA" className="w-40" /></div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {allSections.map(section => (
            <div key={section.title}>
              <p className="text-[9px] tracking-widest uppercase text-slate-500 px-3 mb-2">{section.title}</p>
              {section.items.map(item => (
                <button key={item.id} onClick={() => { setActive(item.id); setSidebar(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${active === item.id ? 'bg-gold text-navy-950' : 'text-slate-400 hover:bg-white/5'}`}>
                  {item.icon}<span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5"><button onClick={handleLogout} className="w-full py-2 text-[10px] font-bold text-red-400 border border-red-900/20 rounded hover:bg-red-900/10">CERRAR SESIÓN</button></div>
      </aside>

      <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
        <header className="h-[72px] flex items-center justify-between px-6 border-b border-gray-200 bg-white shadow-sm">
           <div className="flex items-center gap-4">
             <button onClick={() => setSidebar(true)} className="lg:hidden text-navy-900"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth={2}/></svg></button>
             <h2 className="text-xl font-bold text-navy-950">{allSections.flatMap(s => s.items).find(i => i.id === active)?.label ?? 'Dashboard'}</h2>
           </div>
           <span className="text-[10px] font-black bg-gold/10 text-gold px-3 py-1 rounded-full border border-gold/20 uppercase tracking-widest">v2.6 Stable</span>
        </header>

        <main className="p-6 lg:p-8 flex-1 overflow-y-auto">
          {active === 'overview' ? (
            <div className="space-y-8 max-w-[1600px] mx-auto animate-fade-in">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="Usuarios" value={stats.users} sub="Activos" highlight icon={<IconGrid />} />
                <MetricCard title="Reuniones" value={stats.meetings} sub="Hoy" icon={<IconCalendar />} />
                <MetricCard title="Tickets" value={stats.tickets} sub="Total" icon={<IconTickets />} />
                <MetricCard title="Avisos" value={stats.avisos} sub="Enviados" icon={<IconAvisos />} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-8 shadow-sm flex flex-col h-[450px]">
                  <h3 className="text-sm font-bold text-navy-900 mb-8 border-b pb-4">Análisis de Operaciones Semanal</h3>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/><stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                        <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px rgba(0,0,0,0.1)'}} />
                        <Area type="monotone" dataKey="tickets" stroke="#D4AF37" strokeWidth={3} fill="url(#gGold)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-8 shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-navy-900 mb-8 border-b pb-4">Distribución</h3>
                  <div className="flex-1 flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart><Pie data={pieData} innerRadius={60} outerRadius={80} dataKey="value">{pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/></PieChart>
                    </ResponsiveContainer>
                    <div className="w-full mt-8 space-y-3">
                      {pieData.map((d,i)=>(
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{d.name}</span>
                          <span className="text-sm font-black text-navy-950">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm space-y-6">
                      <KPIBar label="Tasa de Respuesta" value={performance.resolutionRate} color="#D4AF37" />
                      <KPIBar label="Eficiencia del Equipo" value={performance.efficiency} color="#0A1930" />
                   </div>
                   <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Top Líderes de Productividad</p>
                      <div className="space-y-4">
                        {performance.topUsers?.map((u, i) => (
                          <div key={i} className="flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-navy-950 text-gold flex items-center justify-center font-black text-sm">{u.name.charAt(0)}</div>
                              <div><p className="text-xs font-bold text-navy-900 group-hover:text-gold transition-colors">{u.name}</p><p className="text-[10px] text-slate-400 uppercase font-medium">{u.dept}</p></div>
                            </div>
                            <span className="text-xs font-black text-navy-950">KPI {u.score}</span>
                          </div>
                        ))}
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
    <div className="space-y-2">
      <div className="flex justify-between items-end"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p><p className="text-sm font-black text-navy-950">{value}%</p></div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full transition-all duration-1000" style={{ width: `${value}%`, backgroundColor: color }} /></div>
    </div>
  );
}
