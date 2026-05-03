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
  { id: 'open',        label: 'Pendientes',   color: 'bg-slate-400',  dot: 'bg-slate-400' },
  { id: 'in_progress', label: 'En Progreso',  color: 'bg-blue-500',   dot: 'bg-blue-500'  },
  { id: 'resolved',    label: 'En Revisión',  color: 'bg-amber-500',  dot: 'bg-amber-500' },
  { id: 'closed',      label: 'Completados',  color: 'bg-emerald-500',dot: 'bg-emerald-500'},
];

const PRIORITY_THEME = {
  low:    'text-slate-500 bg-slate-50 border-slate-100',
  medium: 'text-blue-600 bg-blue-50 border-blue-100',
  high:   'text-amber-600 bg-amber-50 border-amber-100',
  urgent: 'text-red-600 bg-red-50 border-red-100',
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
  const [activeTab, setActiveTab] = useState('info');
  const [newComment, setNewComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fetchTickets = async () => {
    try {
      const res = await axios.get('/api/tickets');
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error(err); }
  };

  const fetchTicketDetails = async (id) => {
    try {
      const res = await axios.get(`/api/tickets/${id}`);
      setSelectedTicket(res.data);
      if (!selectedTicket) setActiveTab('info');
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchTickets();
    axios.get('/api/users')
      .then(r => setDbUsers(Array.isArray(r.data.users) ? r.data.users : (Array.isArray(r.data) ? r.data : [])))
      .catch(() => setDbUsers([]));
  }, []);

  const defaultForm = { title: '', description: '', priority: 'medium', category: DEPARTAMENTOS[0], assigned_to: null, due_date: '' };
  const [formData, setFormData] = useState(defaultForm);

  const handleDragStart = (e, ticket) => {
    setDraggedTicket(ticket);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragEnd = () => setDraggedTicket(null);
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleDrop = async (e, statusId) => {
    e.preventDefault();
    if (!draggedTicket || draggedTicket.status === statusId) return;
    try {
      await axios.patch(`/api/tickets/${draggedTicket.id}/status`, { status: statusId, user_id: user?.id });
      fetchTickets();
    } catch (err) { console.error(err); }
    setDraggedTicket(null);
  };

  const handleSaveTicket = async () => {
    if (!formData.title) return;
    try {
      await axios.post('/api/tickets', { ...formData, created_by: user?.id });
      fetchTickets();
      setIsModalOpen(false);
      setFormData(defaultForm);
    } catch (err) { console.error(err); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await axios.post(`/api/tickets/${selectedTicket.id}/comments`, { user_id: user?.id, content: newComment });
      setNewComment('');
      fetchTicketDetails(selectedTicket.id);
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const data = new FormData();
    data.append('file', file);
    data.append('user_id', user?.id);
    try {
      await axios.post(`/api/tickets/${selectedTicket.id}/attachments`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      fetchTicketDetails(selectedTicket.id);
    } catch (err) { console.error(err); }
    setIsUploading(false);
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch = (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (t.assigned_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        String(t.id).includes(searchTerm);
    const matchDept = filterDept ? t.category === filterDept : true;
    return matchSearch && matchDept;
  });

  return (
    <div className="h-full flex flex-col space-y-6 animate-fade-in font-sans">
      
      {/* HEADER LIMPIO */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-semibold text-navy-950 tracking-tight">Módulo de Seguimiento</h2>
          <p className="text-xs font-medium text-navy-500 uppercase tracking-widest mt-1">Gestión Centralizada de Requerimientos</p>
        </div>
        <button onClick={() => { setFormData(defaultForm); setIsModalOpen(true); }} className="btn-gold px-6 py-2.5 flex items-center gap-2 rounded-lg shadow-sm hover:shadow-md transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nuevo Ticket
        </button>
      </div>

      {/* FILTROS MINIMALISTAS */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-slate-100 shadow-sm">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Buscar por asunto o ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-navy-950 text-sm text-navy-900 bg-slate-50/50 transition-all" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-navy-800 bg-slate-50/50 outline-none hover:bg-white transition-all cursor-pointer">
          <option value="">Todos los Departamentos</option>
          {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* KANBAN PREMIUM (SOBRIO) */}
      <div className="flex-1 flex gap-5 overflow-x-auto pb-6 -mx-2 px-2 scrollbar-hide">
        {COLUMNS.map(col => {
          const colTickets = filteredTickets.filter(t => t.status === col.id);
          return (
            <div key={col.id} className="flex-shrink-0 w-80 flex flex-col group" onDragOver={handleDragOver} onDrop={e => handleDrop(e, col.id)}>
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                  <h3 className="font-bold text-navy-900 text-xs uppercase tracking-widest">{col.label}</h3>
                </div>
                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{colTickets.length}</span>
              </div>
              <AnimatedColumn className="flex-1 space-y-4 min-h-[400px] pb-10">
                {colTickets.map(ticket => (
                  <TicketCard key={ticket.id} ticket={ticket} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onClick={t => fetchTicketDetails(t.id)} />
                ))}
                {colTickets.length === 0 && (
                  <div className="h-20 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">Vacio</div>
                )}
              </AnimatedColumn>
            </div>
          );
        })}
      </div>

      {/* DRAWER LATERAL (ELEGANTE) */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[100] flex justify-end animate-fade-in" onClick={() => setSelectedTicket(null)}>
          <div className="absolute inset-0 bg-navy-950/20 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-xl bg-white h-full shadow-[-20px_0_40px_rgba(0,0,0,0.05)] flex flex-col animate-slide-left" onClick={e => e.stopPropagation()}>
            
            {/* Header Lateral */}
            <div className="p-8 border-b border-slate-100 flex justify-between items-start">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="bg-navy-950 text-white px-2 py-0.5 rounded text-[10px] font-black tracking-tighter">REF-{selectedTicket.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${PRIORITY_THEME[selectedTicket.priority]}`}>{selectedTicket.priority}</span>
                </div>
                <h3 className="text-2xl font-display font-semibold text-navy-950 leading-tight">{selectedTicket.title}</h3>
                <div className="flex items-center gap-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg> {new Date(selectedTicket.created_at).toLocaleDateString()}</span>
                  <span className="w-1 h-1 bg-slate-200 rounded-full" />
                  <span>{selectedTicket.category}</span>
                </div>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Tabs Minimalistas */}
            <div className="px-8 flex border-b border-slate-100">
              {[
                { id: 'info', label: 'Resumen' },
                { id: 'chat', label: 'Seguimiento' },
                { id: 'files', label: 'Archivos' },
                { id: 'log', label: 'Audit Log' }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-4 text-[11px] font-bold uppercase tracking-widest transition-all relative ${
                    activeTab === tab.id ? 'text-navy-950' : 'text-slate-400 hover:text-navy-600'
                  }`}>
                  {tab.label}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-navy-950 rounded-full" />}
                </button>
              ))}
            </div>

            {/* Contenido Lateral */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {activeTab === 'info' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descripción</label>
                    <p className="text-sm text-navy-800 leading-relaxed font-medium">{selectedTicket.description || 'Sin descripción.'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-8 pt-4">
                    <DetailItem label="Estado Actual" value={selectedTicket.status} isStatus />
                    <DetailItem label="Responsable" value={selectedTicket.assigned_name || 'Sin asignar'} />
                    <DetailItem label="Solicitado por" value={selectedTicket.creator_name} />
                    <DetailItem label="Fecha Limite" value={selectedTicket.due_date ? new Date(selectedTicket.due_date).toLocaleDateString() : 'N/A'} isDate alert={new Date(selectedTicket.due_date) < new Date()} />
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="h-full flex flex-col animate-fade-in">
                  <div className="flex-1 space-y-6 overflow-y-auto pb-4 pr-2 scrollbar-thin">
                    {selectedTicket.comments?.map(c => (
                      <div key={c.id} className="flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-navy-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-navy-900">{(c.user_name || 'U').charAt(0)}</div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-navy-950">{c.user_name}</span>
                            <span className="text-[9px] font-medium text-slate-400">{new Date(c.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className="text-sm text-navy-700 bg-slate-50 p-3 rounded-xl rounded-tl-none border border-slate-100">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 flex gap-2">
                    <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                      placeholder="Escribe una nota interna..." className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-navy-950 transition-all bg-slate-50" />
                    <button onClick={handleAddComment} className="bg-navy-950 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg hover:bg-navy-800 transition-all active:scale-95">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth={2}/></svg>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'files' && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  {selectedTicket.attachments?.map(f => (
                    <div key={f.id} className="group relative aspect-square rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                         <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={1.5}/></svg>
                      </div>
                      <div className="absolute inset-0 bg-navy-950/80 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center p-4 text-center">
                        <span className="text-[10px] text-white font-bold mb-3 truncate w-full">{f.filename}</span>
                        <a href={`/api/uploads/${f.path.split(/[\\/]/).pop()}`} download className="text-[10px] font-black uppercase tracking-widest bg-gold text-navy-950 px-4 py-2 rounded-full">Descargar</a>
                      </div>
                    </div>
                  ))}
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all">
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                    <svg className="w-6 h-6 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth={2}/></svg>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Adjuntar</span>
                  </label>
                </div>
              )}

              {activeTab === 'log' && (
                <div className="space-y-6 animate-fade-in">
                  {selectedTicket.history?.map((h, i) => (
                    <div key={h.id} className="relative pl-6 pb-6 last:pb-0 border-l border-slate-100">
                      <div className="absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full bg-slate-200" />
                      <p className="text-xs font-bold text-navy-950">{h.details}</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase mt-1 tracking-widest">{h.user_name} · {new Date(h.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREACIÓN (LIMPIO) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy-950/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-100">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-display font-semibold text-navy-950">Crear Requerimiento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-navy-950"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Asunto</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-navy-950" placeholder="Escribe el título..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prioridad</label>
                  <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha Limite</label>
                  <input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Asignar Responsable</label>
                <select value={formData.assigned_to || ''} onChange={e => setFormData({...formData, assigned_to: e.target.value || null})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none">
                  <option value="">Sin Asignar</option>
                  {dbUsers.map(u => <option key={u.id} value={u.id}>{u.name} {u.apellido || ''}</option>)}
                </select>
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 text-xs font-bold uppercase tracking-widest px-4">Cancelar</button>
              <button onClick={handleSaveTicket} className="btn-gold px-10 py-3 rounded-xl shadow-lg">Guardar Requerimiento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, isStatus, isDate, alert }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-sm font-bold capitalize ${alert ? 'text-red-500' : 'text-navy-950'} ${isStatus ? 'bg-slate-50 px-2 py-0.5 rounded border border-slate-100 w-fit' : ''}`}>{value}</p>
    </div>
  );
}

function AnimatedColumn({ children, className, ...props }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) autoAnimate(ref.current, { duration: 300 }); }, []);
  return <div ref={ref} className={className} {...props}>{children}</div>;
}

function TicketCard({ ticket, onDragStart, onDragEnd, onClick }) {
  const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date() && ticket.status !== 'closed';
  return (
    <div draggable onDragStart={e => onDragStart(e, ticket)} onDragEnd={onDragEnd} onClick={() => onClick(ticket)}
      className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-navy-950/20 transition-all cursor-pointer group active:scale-[0.98]">
      <div className="flex justify-between items-start mb-3">
        <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-widest border ${PRIORITY_THEME[ticket.priority]}`}>{ticket.priority}</span>
        {isOverdue && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" title="Vencido" />}
      </div>
      <h4 className="font-semibold text-navy-950 text-[15px] leading-snug mb-4 group-hover:text-gold transition-colors">{ticket.title}</h4>
      <div className="flex items-center justify-between pt-3 border-t border-slate-50">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ticket.category}</span>
        {ticket.assigned_name ? (
          <div className="w-6 h-6 rounded-md bg-navy-950 text-white flex items-center justify-center text-[10px] font-bold shadow-sm" title={ticket.assigned_name}>{ticket.assigned_name.charAt(0)}</div>
        ) : (
          <div className="w-6 h-6 rounded-md border border-dashed border-slate-200 flex items-center justify-center text-slate-300"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth={2}/></svg></div>
        )}
      </div>
    </div>
  );
}
