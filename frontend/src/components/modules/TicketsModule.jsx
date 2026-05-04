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
    setTimeout(() => e.target.classList.add('opacity-50'), 0);
  };
  const handleDragEnd = (e) => { e.target.classList.remove('opacity-50'); setDraggedTicket(null); };
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
      await axios.post('/api/tickets', {
        ...formData,
        created_by: user?.id
      });
      fetchTickets();
      setIsModalOpen(false);
      setFormData(defaultForm);
    } catch (err) { console.error(err); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await axios.post(`/api/tickets/${selectedTicket.id}/comments`, {
        user_id: user?.id,
        content: newComment
      });
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
      await axios.post(`/api/tickets/${selectedTicket.id}/attachments`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
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
    <div className="h-full flex flex-col animate-fade-in space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-medium text-navy-950 tracking-tight">Centro de Soporte Avanzado</h2>
          <p className="text-sm text-navy-600 mt-1">Gestión integral con historial, comentarios y multimedia</p>
        </div>
        <button onClick={() => { setFormData(defaultForm); setIsModalOpen(true); }} className="btn-gold flex items-center gap-2 shadow-md">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nuevo Requerimiento
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96">
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Buscar por ID, asunto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:border-gold text-sm text-navy-900 placeholder-gray-400 bg-gray-50 hover:bg-white shadow-inner transition-all" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-navy-900 bg-gray-50 outline-none">
          <option value="">Todos los departamentos</option>
          {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {COLUMNS.map(col => {
          const colTickets = filteredTickets.filter(t => t.status === col.id);
          return (
            <div key={col.id} className="flex-shrink-0 w-80 flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden shadow-sm" onDragOver={handleDragOver} onDrop={e => handleDrop(e, col.id)}>
              <div className={`px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white border-t-4 ${col.color}`}>
                <h3 className="font-bold text-navy-900 text-sm">{col.label}</h3>
                <span className="bg-navy-950 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{colTickets.length}</span>
              </div>
              <AnimatedColumn className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
                {colTickets.map(ticket => (
                  <TicketCard key={ticket.id} ticket={ticket} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onClick={t => fetchTicketDetails(t.id)} />
                ))}
              </AnimatedColumn>
            </div>
          );
        })}
      </div>

      {/* Modal Creación */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/50 pt-[72px] px-4 pb-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-display font-medium text-navy-950 text-xl">Nuevo Ticket</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-navy-950">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Asunto</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none" placeholder="Ej. Falla en servidor" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Depto</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none">
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Fecha Límite</label>
                  <input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none" />
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
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-navy-600 font-bold uppercase text-xs tracking-widest hover:bg-gray-100 transition-colors">Cancelar</button>
              <button onClick={handleSaveTicket} className="btn-gold">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* DETALLE AVANZADO (SIDEBAR/DRAWER) */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[110] flex items-center justify-end bg-navy-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedTicket(null)}>
          <div className="bg-white h-full w-full max-w-xl shadow-2xl flex flex-col animate-slide-left" onClick={e => e.stopPropagation()}>
            {/* Header del Ticket */}
            <div className="p-6 bg-navy-950 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-gold text-navy-950 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">ID-{selectedTicket.id}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-white/20`}>{selectedTicket.status}</span>
                </div>
                <h3 className="text-xl font-display font-bold leading-tight">{selectedTicket.title}</h3>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-white/60 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Pestañas */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {[
                { id: 'info', label: 'Información', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                { id: 'chat', label: 'Comentarios', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
                { id: 'files', label: 'Archivos', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
                { id: 'log', label: 'Historial', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${
                    activeTab === tab.id ? 'border-gold bg-white text-navy-950' : 'border-transparent text-gray-400 hover:text-navy-600 hover:bg-gray-100'
                  }`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} /></svg>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Contenido Pestañas */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'info' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-navy-400 mb-2">Descripción del Requerimiento</h4>
                    <p className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-navy-800 text-sm leading-relaxed whitespace-pre-wrap">{selectedTicket.description || 'Sin descripción detallada.'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Prioridad</p>
                      <p className="text-sm font-black text-navy-950 capitalize">{selectedTicket.priority}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Fecha Límite</p>
                      <p className={`text-sm font-black ${new Date(selectedTicket.due_date) < new Date() ? 'text-red-600' : 'text-navy-950'}`}>
                        {selectedTicket.due_date ? new Date(selectedTicket.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long' }) : 'No asignada'}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Asignado a</p>
                      <p className="text-sm font-black text-navy-950">{selectedTicket.assigned_name || 'Sin asignar'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-[9px] font-bold text-navy-400 uppercase tracking-widest mb-1">Departamento</p>
                      <p className="text-sm font-black text-navy-950">{selectedTicket.category}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="flex flex-col h-full space-y-4">
                  <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                    {selectedTicket.comments?.length === 0 && <p className="text-center text-gray-400 py-10 text-xs">No hay comentarios aún.</p>}
                    {selectedTicket.comments?.map(c => (
                      <div key={c.id} className={`flex flex-col ${c.user_id === user?.id ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${c.user_id === user?.id ? 'bg-navy-950 text-white rounded-tr-none' : 'bg-gray-100 text-navy-900 rounded-tl-none'}`}>
                          <p className="font-bold text-[10px] mb-1 opacity-70">{c.user_name}</p>
                          <p>{c.content}</p>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1">{new Date(c.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex gap-2">
                      <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                        placeholder="Escribe un comentario..." className="flex-1 bg-gray-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-gold outline-none" />
                      <button onClick={handleAddComment} className="w-10 h-10 bg-navy-950 text-gold rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'files' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {selectedTicket.attachments?.map(f => (
                      <div key={f.id} className="group relative border border-gray-200 rounded-xl overflow-hidden aspect-square bg-gray-50 flex items-center justify-center">
                        {f.mimetype.startsWith('image/') ? (
                          <img src={`/api/uploads/${path.basename(f.path)}`} alt={f.filename} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            <span className="text-[10px] font-bold text-gray-500 uppercase px-2 text-center truncate w-full">{f.filename}</span>
                          </div>
                        )}
                        <a href={`/api/uploads/${path.basename(f.path)}`} download={f.filename} className="absolute inset-0 bg-navy-950/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </a>
                      </div>
                    ))}
                    <label className={`border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center aspect-square cursor-pointer hover:border-gold hover:bg-amber-50 transition-all ${isUploading ? 'opacity-50 cursor-wait' : ''}`}>
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                      {isUploading ? (
                        <div className="w-6 h-6 border-4 border-gold border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subir Evidencia</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'log' && (
                <div className="space-y-6">
                  {selectedTicket.history?.map((h, i, arr) => (
                    <div key={h.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-navy-950 mt-1.5" />
                        {i < arr.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-xs font-bold text-navy-950">{h.details}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">{h.user_name} · {new Date(h.created_at).toLocaleDateString()} {new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
  const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date() && ticket.status !== 'closed';
  
  return (
    <div draggable onDragStart={e => onDragStart(e, ticket)} onDragEnd={onDragEnd} onClick={() => onClick(ticket)}
      className={`bg-white p-4 rounded-xl shadow-sm border-2 transition-all cursor-pointer group hover:shadow-md ${isOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-100 hover:border-gold/40'}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-black text-white bg-navy-950 px-2 py-0.5 rounded tracking-widest">T-{ticket.id}</span>
        {isOverdue && (
           <span className="text-[8px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">Vencido</span>
        )}
        <div className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium}`}>
          {ticket.priority}
        </div>
      </div>
      <h4 className="font-bold text-navy-950 text-sm leading-snug mb-3 group-hover:text-gold transition-colors line-clamp-2">{ticket.title}</h4>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-navy-500 uppercase bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{ticket.category}</span>
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
