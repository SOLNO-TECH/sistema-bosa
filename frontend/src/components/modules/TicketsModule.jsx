import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import autoAnimate from '@formkit/auto-animate';
import axios from 'axios';

const DEPARTAMENTOS = [
  'Obra Civil', 'Proyectos', 'Diseño', 'Acabados', 'Eléctricos',
  'HVAC', 'Hidrosanitarios', 'Sistemas', 'Contabilidad', 'Finanzas',
  'Recursos Humanos', 'Jurídico', 'Compras', 'Costos', 'Operaciones',
  'Mantenimiento', 'Almacén', 'Marketing', 'Restaurantes', 'Berry Yum'
];

const COLUMNS = [
  { id: 'open',        label: 'Pendientes',   color: 'border-slate-400',  bg: 'bg-slate-50',  text: 'text-slate-700', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
  { id: 'in_progress', label: 'En Progreso',  color: 'border-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700',  icon: 'M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75' },
  { id: 'resolved',    label: 'En Revisión',  color: 'border-amber-500',  bg: 'bg-amber-50',  text: 'text-amber-700', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
  { id: 'closed',      label: 'Completados',  color: 'border-emerald-500',bg: 'bg-emerald-50',text: 'text-emerald-700',icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const PRIORITY_STYLES = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  medium: 'bg-blue-50 text-blue-600 border-blue-200',
  high: 'bg-amber-50 text-amber-600 border-amber-200',
  urgent: 'bg-red-50 text-red-600 border-red-200',
};

export default function TicketsModule() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);

  const fetchTickets = async () => {
    try {
      const res = await axios.get('/api/tickets');
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchTickets();
    axios.get('/api/users')
      .then(r => setDbUsers(Array.isArray(r.data.users) ? r.data.users : (Array.isArray(r.data) ? r.data : [])))
      .catch(() => setDbUsers([]));
  }, []);

  const defaultForm = { title: '', description: '', priority: 'medium', category: DEPARTAMENTOS[0], assigned_to: null };
  const [formData, setFormData] = useState(defaultForm);

  const handleDragStart = (e, ticket) => {
    setDraggedTicket(ticket);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('opacity-40', 'scale-95'), 0);
  };
  const handleDragEnd = (e) => { 
    e.target.classList.remove('opacity-40', 'scale-95'); 
    setDraggedTicket(null); 
  };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleDrop = async (e, statusId) => {
    e.preventDefault();
    if (!draggedTicket || draggedTicket.status === statusId) return;
    try {
      await axios.patch(`/api/tickets/${draggedTicket.id}/status`, { status: statusId });
      fetchTickets();
    } catch (err) { console.error(err); }
    setDraggedTicket(null);
  };

  const handleSaveTicket = async () => {
    if (!formData.title) return;
    try {
      await axios.post('/api/tickets', {
        ...formData,
        created_by: user?.id
      });
      fetchTickets();
      setIsModalOpen(false);
      setFormData(defaultForm);
    } catch (err) { console.error(err); }
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch = (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (t.assigned_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = filterDept ? t.category === filterDept : true;
    return matchSearch && matchDept;
  });

  return (
    <div className="h-full flex flex-col animate-fade-in space-y-6">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-navy-950 tracking-tight">Gestión de Tickets</h2>
          <p className="text-navy-500 font-medium mt-1">Monitorea y resuelve los requerimientos de la organización</p>
        </div>
        <button 
          onClick={() => { setFormData(defaultForm); setIsModalOpen(true); }} 
          className="bg-navy-950 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-gold hover:text-navy-950 transition-all active:scale-95"
        >
          <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </div>
          Nuevo Requerimiento
        </button>
      </div>

      {/* ── FILTROS PREMIUM ── */}
      <div className="flex flex-col md:flex-row items-stretch gap-4">
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-navy-400 group-focus-within:text-gold transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="Buscar por asunto, responsable o ID..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-transparent bg-white shadow-sm focus:border-gold focus:ring-0 text-navy-900 font-medium placeholder-navy-300 transition-all outline-none" 
          />
        </div>
        <div className="md:w-64">
          <select 
            value={filterDept} 
            onChange={e => setFilterDept(e.target.value)}
            className="w-full h-full px-5 py-4 rounded-2xl border-2 border-transparent bg-white shadow-sm focus:border-gold transition-all outline-none font-bold text-navy-800 appearance-none"
          >
            <option value="">Departamentos: Todos</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* ── TABLERO KANBAN ESTILO MODERNO ── */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-6 -mx-2 px-2 scrollbar-hide">
        {COLUMNS.map(col => {
          const colTickets = filteredTickets.filter(t => t.status === col.id);
          return (
            <div 
              key={col.id} 
              className="flex-shrink-0 w-[320px] flex flex-col rounded-[24px] bg-slate-100/50 border-2 border-dashed border-slate-200/60 p-2"
              onDragOver={handleDragOver} 
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Header Columna */}
              <div className="px-4 py-4 flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${col.bg} border-2 ${col.color} flex items-center justify-center ${col.text}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d={col.icon} /></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-navy-950 text-sm tracking-tight">{col.label}</h3>
                    <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest">{colTickets.length} Items</p>
                  </div>
                </div>
              </div>

              {/* Lista de Tarjetas */}
              <AnimatedColumn className="flex-1 overflow-y-auto space-y-4 px-1 pb-4">
                {colTickets.length === 0 ? (
                  <div className="h-32 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center opacity-40">
                    <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sin tickets</span>
                  </div>
                ) : (
                  colTickets.map(ticket => (
                    <TicketCard key={ticket.id} ticket={ticket} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onClick={t => setSelectedTicket(t)} />
                  ))
                )}
              </AnimatedColumn>
            </div>
          );
        })}
      </div>

      {/* ── MODAL NUEVO TICKET (REDESIGN) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/70 backdrop-blur-md px-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up border border-white/20">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-display font-bold text-navy-950">Nuevo Requerimiento</h3>
                <p className="text-xs text-navy-500 font-medium mt-1">Completa los detalles para asignar el ticket</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-navy-400 hover:text-red-500 transition-all shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-navy-400 ml-1">Asunto Principal</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-gold focus:bg-white rounded-2xl px-6 py-4 text-navy-900 font-bold placeholder-slate-300 transition-all outline-none" 
                  placeholder="Ej. Error en servidor de archivos" 
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-navy-400 ml-1">Departamento</label>
                  <select 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})} 
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-gold focus:bg-white rounded-2xl px-5 py-4 text-navy-900 font-bold outline-none"
                  >
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-navy-400 ml-1">Prioridad</label>
                  <select 
                    value={formData.priority} 
                    onChange={e => setFormData({...formData, priority: e.target.value})} 
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-gold focus:bg-white rounded-2xl px-5 py-4 text-navy-900 font-bold outline-none"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-navy-400 ml-1">Descripción Detallada</label>
                <textarea 
                  rows="4" 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-gold focus:bg-white rounded-2xl px-6 py-4 text-navy-900 font-medium resize-none transition-all outline-none" 
                  placeholder="Explica el problema o solicitud..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-navy-400 ml-1">Asignar Responsable</label>
                <select 
                  value={formData.assigned_to || ''} 
                  onChange={e => setFormData({...formData, assigned_to: e.target.value || null})} 
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-gold focus:bg-white rounded-2xl px-5 py-4 text-navy-900 font-bold outline-none"
                >
                  <option value="">Dejar sin asignar (Pendiente)</option>
                  {dbUsers.map(u => <option key={u.id} value={u.id}>{u.name} {u.apellido || ''}</option>)}
                </select>
              </div>
            </div>

            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-navy-500 font-bold uppercase text-[11px] tracking-widest hover:text-navy-950 transition-colors">Descartar</button>
              <button onClick={handleSaveTicket} className="bg-navy-950 text-white px-10 py-4 rounded-2xl font-bold shadow-xl hover:bg-gold hover:text-navy-950 transition-all active:scale-95">Guardar Ticket</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE (EXPEDIENTE) ── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy-950/80 backdrop-blur-lg px-4" onClick={() => setSelectedTicket(null)}>
          <div className="bg-white rounded-[40px] w-full max-w-3xl overflow-hidden shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            {/* Header Detalle */}
            <div className="px-10 py-10 bg-navy-950 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-gold text-navy-950 px-3 py-1 rounded-lg text-xs font-black tracking-widest">T-00{selectedTicket.id}</span>
                  <span className="bg-white/10 text-white/80 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-white/10">{selectedTicket.category}</span>
                </div>
                <h3 className="text-3xl font-display font-bold leading-tight">{selectedTicket.title}</h3>
                <div className="mt-6 flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                    <span className="text-xs font-bold text-white/60 uppercase tracking-widest">{COLUMNS.find(c => c.id === selectedTicket.status)?.label}</span>
                  </div>
                  <div className="h-4 w-px bg-white/20" />
                  <span className="text-xs font-medium text-white/60">Creado el {new Date(selectedTicket.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long' })}</span>
                </div>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="absolute top-8 right-8 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Contenido Detalle */}
            <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="md:col-span-2 space-y-8">
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-navy-400 mb-4">Descripción del requerimiento</h4>
                  <p className="text-navy-900 text-lg leading-relaxed font-medium bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    {selectedTicket.description || 'Sin descripción detallada.'}
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-navy-400 mb-4">Responsable</h4>
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-navy-950 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                      {(selectedTicket.assigned_name || 'U').charAt(0)}
                    </div>
                    <div>
                      <p className="text-navy-950 font-bold text-sm leading-none">{selectedTicket.assigned_name || 'Sin asignar'}</p>
                      <p className="text-[10px] text-navy-400 font-bold uppercase mt-1">Encargado</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <div className={`p-4 rounded-2xl border-2 text-center ${PRIORITY_STYLES[selectedTicket.priority] || PRIORITY_STYLES.medium}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Prioridad</p>
                    <p className="text-xl font-bold mt-1 capitalize">{selectedTicket.priority}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnimatedColumn({ children, className, ...props }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) autoAnimate(ref.current, { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }); }, []);
  return <div ref={ref} className={className} {...props}>{children}</div>;
}

function TicketCard({ ticket, onDragStart, onDragEnd, onClick }) {
  const isUrgent = ticket.priority === 'urgent' || ticket.priority === 'high';
  
  return (
    <div 
      draggable 
      onDragStart={e => onDragStart(e, ticket)} 
      onDragEnd={onDragEnd} 
      onClick={() => onClick(ticket)}
      className={`relative bg-white p-5 rounded-[24px] shadow-sm border-2 border-transparent hover:border-gold hover:shadow-xl transition-all duration-300 cursor-pointer group active:scale-95 ${isUrgent ? 'ring-2 ring-red-500/10' : ''}`}
    >
      {isUrgent && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded-full shadow-lg border-2 border-white uppercase tracking-tighter">Prioritario</div>
      )}
      
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-black text-navy-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 group-hover:bg-navy-950 group-hover:text-gold transition-all duration-300 tracking-tighter">ID-{String(ticket.id).padStart(3, '0')}</span>
        <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium}`}>
          {ticket.priority}
        </div>
      </div>

      <h4 className="font-bold text-navy-950 text-base leading-snug mb-4 group-hover:text-gold transition-colors line-clamp-2">
        {ticket.title}
      </h4>

      <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-navy-400 group-hover:bg-gold/10 group-hover:text-gold transition-all duration-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
          </div>
          <span className="text-[10px] font-black text-navy-500 uppercase tracking-tighter">{ticket.category}</span>
        </div>
        
        {ticket.assigned_name ? (
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-xl bg-navy-950 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-md ring-1 ring-slate-100" title={ticket.assigned_name}>
              {ticket.assigned_name.charAt(0)}
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300" title="Sin asignar">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 013 19.235z" /></svg>
          </div>
        )}
      </div>
    </div>
  );
}
