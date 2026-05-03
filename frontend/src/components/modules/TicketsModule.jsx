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
  { id: 'open',        label: 'Pendientes',   color: 'border-slate-300',  bg: 'bg-slate-50'  },
  { id: 'in_progress', label: 'En Progreso',  color: 'border-blue-400',   bg: 'bg-blue-50'   },
  { id: 'resolved',    label: 'En Revisión',  color: 'border-amber-400',  bg: 'bg-amber-50'  },
  { id: 'closed',      label: 'Completados',  color: 'border-emerald-400',bg: 'bg-emerald-50'},
];

const PRIORITY_STYLES = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-100',
  high: 'bg-amber-50 text-amber-700 border-amber-100',
  urgent: 'bg-red-50 text-red-700 border-red-100',
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
    setTimeout(() => e.target.classList.add('opacity-50'), 0);
  };
  const handleDragEnd = (e) => { e.target.classList.remove('opacity-50'); setDraggedTicket(null); };
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
      
      {/* Header - Matching Avisos style */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-medium text-navy-950 tracking-tight">Soporte y Tareas</h2>
          <p className="text-sm text-navy-600 mt-1">Gestión avanzada de tickets y requerimientos internos</p>
        </div>
        <button onClick={() => { setFormData(defaultForm); setIsModalOpen(true); }} className="btn-gold flex items-center gap-2 shadow-md">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nuevo Ticket
        </button>
      </div>

      {/* Filters - Matching Avisos style */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96">
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Buscar por ID, título o responsable..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 placeholder-gray-400 bg-gray-50 hover:bg-white shadow-inner transition-all" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none">
          <option value="">Todos los departamentos</option>
          {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Kanban Board - Formal/Professional */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {COLUMNS.map(col => {
          const colTickets = filteredTickets.filter(t => t.status === col.id);
          return (
            <div key={col.id} className="flex-shrink-0 w-80 flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden shadow-sm" onDragOver={handleDragOver} onDrop={e => handleDrop(e, col.id)}>
              <div className={`px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white border-t-4 ${col.color}`}>
                <h3 className="font-bold text-navy-900 text-sm">{col.label}</h3>
                <span className="bg-gray-200 text-navy-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{colTickets.length}</span>
              </div>
              <AnimatedColumn className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
                {colTickets.length === 0 ? (
                  <div className="h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-[10px] font-medium text-gray-400 uppercase tracking-widest">Sin items</div>
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

      {/* Modal - Modern & Formal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/50 pt-[72px] px-4 pb-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="font-display font-medium text-navy-950 text-xl">Nuevo Ticket</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-navy-950">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Asunto</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none" placeholder="Ej. Falla en sistema" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Departamento</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none">
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Prioridad</label>
                  <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Descripción</label>
                <textarea rows="4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Asignar a</label>
                <select value={formData.assigned_to || ''} onChange={e => setFormData({...formData, assigned_to: e.target.value || null})} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none">
                  <option value="">Sin asignar</option>
                  {dbUsers.map(u => <option key={u.id} value={u.id}>{u.name} {u.apellido || ''}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-navy-600 font-bold uppercase text-xs tracking-widest hover:bg-gray-100 transition-colors">Cancelar</button>
              <button onClick={handleSaveTicket} className="btn-gold">Guardar Ticket</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy-950/50 px-4 pt-20 pb-6 animate-fade-in" onClick={() => setSelectedTicket(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-navy-950 text-white px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">T-{selectedTicket.id}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${PRIORITY_STYLES[selectedTicket.priority] || PRIORITY_STYLES.medium}`}>{selectedTicket.priority}</span>
                </div>
                <h3 className="font-display font-medium text-navy-950 text-lg">{selectedTicket.title}</h3>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-navy-400 mb-2">Descripción</p>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-navy-700 text-sm leading-relaxed">{selectedTicket.description || 'Sin descripción.'}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-navy-400 mb-1">Responsable</p>
                  <p className="text-navy-950 font-bold text-sm">{selectedTicket.assigned_name || 'Sin asignar'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-navy-400 mb-1">Departamento</p>
                  <p className="text-navy-950 font-bold text-sm">{selectedTicket.category}</p>
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
  useEffect(() => { if (ref.current) autoAnimate(ref.current, { duration: 250, easing: 'ease-out' }); }, []);
  return <div ref={ref} className={className} {...props}>{children}</div>;
}

function TicketCard({ ticket, onDragStart, onDragEnd, onClick }) {
  return (
    <div draggable onDragStart={e => onDragStart(e, ticket)} onDragEnd={onDragEnd} onClick={() => onClick(ticket)}
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-gold/40 hover:shadow-md transition-all cursor-pointer group">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-black text-white bg-navy-950 px-2 py-0.5 rounded tracking-widest">T-{ticket.id}</span>
        <div className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium}`}>
          {ticket.priority}
        </div>
      </div>
      <h4 className="font-bold text-navy-950 text-sm leading-snug mb-3 group-hover:text-gold transition-colors line-clamp-2">{ticket.title}</h4>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-[10px] font-bold text-navy-500 uppercase bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{ticket.category}</span>
        {ticket.assigned_name ? (
          <div className="w-7 h-7 rounded-lg bg-navy-950 text-white flex items-center justify-center text-[10px] font-bold border border-gold/30 shadow-sm">{ticket.assigned_name.charAt(0).toUpperCase()}</div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </div>
        )}
      </div>
    </div>
  );
}
