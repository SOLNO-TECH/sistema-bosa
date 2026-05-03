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
  { id: 'open',        label: 'Pendientes',   color: 'border-slate-400',  bg: 'bg-slate-100', text: 'text-slate-900', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
  { id: 'in_progress', label: 'En Progreso',  color: 'border-blue-600',   bg: 'bg-blue-100',  text: 'text-blue-900',  icon: 'M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75' },
  { id: 'resolved',    label: 'En Revisión',  color: 'border-amber-600',  bg: 'bg-amber-100', text: 'text-amber-900', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
  { id: 'closed',      label: 'Completados',  color: 'border-emerald-600',bg: 'bg-emerald-100',text: 'text-emerald-900',icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const PRIORITY_STYLES = {
  low: 'bg-gray-200 text-gray-800 border-gray-300',
  medium: 'bg-blue-600 text-white border-blue-700',
  high: 'bg-amber-500 text-white border-amber-600',
  urgent: 'bg-red-600 text-white border-red-700',
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
  };
  const handleDragEnd = (e) => { 
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
          <h2 className="text-3xl font-display font-black text-navy-950 tracking-tight">TABLERO DE TICKETS</h2>
          <p className="text-navy-600 font-bold mt-1">Gestión operativa y seguimiento de casos</p>
        </div>
        <button 
          onClick={() => { setFormData(defaultForm); setIsModalOpen(true); }} 
          className="bg-navy-950 text-white px-8 py-4 rounded-xl font-black flex items-center justify-center gap-3 shadow-2xl hover:bg-gold hover:text-navy-950 transition-all transform active:scale-95"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          NUEVO TICKET
        </button>
      </div>

      {/* ── FILTROS ── */}
      <div className="flex flex-col md:flex-row items-stretch gap-4">
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-navy-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="Buscar por asunto o responsable..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 border-navy-100 bg-white shadow-md focus:border-navy-950 focus:ring-0 text-navy-950 font-bold placeholder-navy-300 transition-all outline-none" 
          />
        </div>
        <div className="md:w-72">
          <select 
            value={filterDept} 
            onChange={e => setFilterDept(e.target.value)}
            className="w-full h-full px-6 py-4 rounded-2xl border-2 border-navy-100 bg-white shadow-md focus:border-navy-950 transition-all outline-none font-black text-navy-950 appearance-none"
          >
            <option value="">TODOS LOS DEPTOS</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* ── KANBAN CON ALTO CONTRASTE ── */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-6 -mx-2 px-2">
        {COLUMNS.map(col => {
          const colTickets = filteredTickets.filter(t => t.status === col.id);
          return (
            <div 
              key={col.id} 
              className="flex-shrink-0 w-[340px] flex flex-col rounded-[24px] bg-white border-2 border-slate-200 shadow-xl overflow-hidden"
              onDragOver={handleDragOver} 
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Header Columna */}
              <div className={`px-5 py-5 flex items-center justify-between border-b-2 border-slate-100 ${col.bg}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-white border-2 ${col.color} flex items-center justify-center ${col.text.replace('900', '600')}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d={col.icon} /></svg>
                  </div>
                  <h3 className={`font-black ${col.text} text-sm uppercase tracking-tighter`}>{col.label}</h3>
                </div>
                <span className="bg-navy-950 text-white text-[11px] font-black px-3 py-1 rounded-full">{colTickets.length}</span>
              </div>

              {/* Lista de Tarjetas */}
              <AnimatedColumn className="flex-1 overflow-y-auto space-y-4 p-4 bg-slate-50/50 min-h-[300px]">
                {colTickets.length === 0 ? (
                  <div className="h-40 rounded-3xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">VACÍO</span>
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

      {/* ── MODAL NUEVO TICKET ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/80 backdrop-blur-sm px-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="px-8 py-6 bg-navy-950 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">NUEVO REQUERIMIENTO</h3>
                <p className="text-xs text-gold font-bold mt-1 uppercase tracking-widest">Información de Soporte</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-red-500 transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-navy-950 ml-1">Asunto o Título</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  className="w-full bg-slate-100 border-4 border-transparent focus:border-navy-950 focus:bg-white rounded-2xl px-6 py-4 text-navy-950 font-black placeholder-slate-400 transition-all outline-none text-lg" 
                  placeholder="ESCRIBE EL ASUNTO AQUÍ..." 
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-navy-950 ml-1">Departamento</label>
                  <select 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})} 
                    className="w-full bg-slate-100 border-4 border-transparent focus:border-navy-950 focus:bg-white rounded-2xl px-5 py-4 text-navy-950 font-black outline-none appearance-none"
                  >
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-navy-950 ml-1">Prioridad</label>
                  <select 
                    value={formData.priority} 
                    onChange={e => setFormData({...formData, priority: e.target.value})} 
                    className="w-full bg-slate-100 border-4 border-transparent focus:border-navy-950 focus:bg-white rounded-2xl px-5 py-4 text-navy-950 font-black outline-none appearance-none"
                  >
                    <option value="low">BAJA</option>
                    <option value="medium">MEDIA</option>
                    <option value="high">ALTA</option>
                    <option value="urgent">URGENTE</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-navy-950 ml-1">Descripción</label>
                <textarea 
                  rows="4" 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className="w-full bg-slate-100 border-4 border-transparent focus:border-navy-950 focus:bg-white rounded-2xl px-6 py-4 text-navy-950 font-bold resize-none transition-all outline-none" 
                  placeholder="DETALLES ADICIONALES..."
                />
              </div>
            </div>

            <div className="px-8 py-6 bg-slate-50 border-t-2 border-slate-100 flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-navy-950 font-black uppercase text-xs tracking-widest hover:text-red-600 transition-colors">CANCELAR</button>
              <button onClick={handleSaveTicket} className="bg-navy-950 text-white px-12 py-4 rounded-2xl font-black shadow-xl hover:bg-gold hover:text-navy-950 transition-all">GUARDAR TICKET</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE ── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy-950/90 backdrop-blur-md px-4" onClick={() => setSelectedTicket(null)}>
          <div className="bg-white rounded-[40px] w-full max-w-3xl overflow-hidden shadow-2xl animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="px-10 py-12 bg-navy-950 text-white">
              <div className="flex items-center gap-4 mb-6">
                <span className="bg-gold text-navy-950 px-4 py-1.5 rounded-xl text-sm font-black tracking-widest">ID-{String(selectedTicket.id).padStart(3, '0')}</span>
                <span className="bg-white/20 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border-2 border-white/10">{selectedTicket.category}</span>
              </div>
              <h3 className="text-4xl font-black leading-tight uppercase">{selectedTicket.title}</h3>
            </div>

            <div className="p-10 space-y-8">
              <div>
                <h4 className="text-xs font-black uppercase tracking-[0.3em] text-navy-400 mb-4">DETALLES DEL REQUERIMIENTO</h4>
                <div className="bg-slate-50 p-8 rounded-3xl border-4 border-slate-100">
                  <p className="text-navy-950 text-xl font-bold leading-relaxed italic">
                    "{selectedTicket.description || 'SIN DESCRIPCIÓN DETALLADA.'}"
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="bg-slate-100 p-6 rounded-[32px] flex items-center gap-5">
                   <div className="w-16 h-16 rounded-2xl bg-navy-950 text-gold flex items-center justify-center font-black text-2xl border-4 border-white shadow-xl">
                      {(selectedTicket.assigned_name || 'U').charAt(0)}
                    </div>
                    <div>
                      <p className="text-navy-950 font-black text-lg leading-none uppercase">{selectedTicket.assigned_name || 'SIN ASIGNAR'}</p>
                      <p className="text-[11px] text-navy-500 font-black uppercase mt-1 tracking-widest">Responsable</p>
                    </div>
                </div>
                <div className={`p-6 rounded-[32px] border-4 flex flex-col justify-center items-center ${PRIORITY_STYLES[selectedTicket.priority] || PRIORITY_STYLES.medium}`}>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em]">PRIORIDAD</p>
                    <p className="text-2xl font-black mt-1 uppercase">{selectedTicket.priority}</p>
                </div>
              </div>
            </div>
            <div className="px-10 py-6 bg-slate-50 text-center border-t-2 border-slate-100">
               <button onClick={() => setSelectedTicket(null)} className="bg-navy-950 text-white px-12 py-3 rounded-full font-black text-sm uppercase tracking-widest">CERRAR VISTA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnimatedColumn({ children, className, ...props }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) autoAnimate(ref.current, { duration: 250, easing: 'ease-out' }); }, []);
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
      className="bg-white p-6 rounded-[28px] shadow-lg border-2 border-slate-200 hover:border-navy-950 hover:shadow-2xl transition-all duration-300 cursor-pointer group relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-4 gap-2">
        <span className="text-[11px] font-black text-white bg-navy-950 px-3 py-1.5 rounded-xl tracking-tight shadow-lg">ID-{String(ticket.id).padStart(3, '0')}</span>
        <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border-2 ${PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium} shadow-md`}>
          {ticket.priority}
        </div>
      </div>

      <h4 className="font-black text-navy-950 text-lg leading-[1.2] mb-6 group-hover:text-gold transition-colors uppercase tracking-tighter">
        {ticket.title}
      </h4>

      <div className="pt-5 border-t-4 border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-navy-950 text-gold flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
          </div>
          <span className="text-[11px] font-black text-navy-900 uppercase tracking-tighter bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">{ticket.category}</span>
        </div>
        
        {ticket.assigned_name ? (
          <div className="w-10 h-10 rounded-2xl bg-navy-950 text-white flex items-center justify-center font-black border-4 border-white shadow-xl text-sm" title={ticket.assigned_name}>
            {ticket.assigned_name.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="w-10 h-10 rounded-2xl bg-slate-200 border-4 border-white flex items-center justify-center text-slate-500 shadow-inner">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          </div>
        )}
      </div>
    </div>
  );
}
