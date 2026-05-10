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
  { id: 'open',        label: 'Pendientes',  accent: '#94a3b8' },
  { id: 'in_progress', label: 'En Progreso', accent: '#CBAC80' },
  { id: 'resolved',    label: 'En Revisión', accent: '#3b82f6' },
  { id: 'closed',      label: 'Completados', accent: '#10b981' },
];

const PRIORITY_STYLES = {
  low:    { label: 'Baja',    cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  medium: { label: 'Media',   cls: 'bg-sky-50 text-sky-700 border-sky-200'        },
  high:   { label: 'Alta',    cls: 'bg-amber-50 text-amber-700 border-amber-200'  },
  urgent: { label: 'Urgente', cls: 'bg-red-50 text-red-600 border-red-200'        },
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
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const handleDeleteAttachment = async (attachmentId, filename) => {
    if (!window.confirm(`¿Eliminar el archivo "${filename}"? Esta acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`/api/tickets/${selectedTicket.id}/attachments/${attachmentId}`, { data: { user_id: user?.id } });
      fetchTicketDetails(selectedTicket.id);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el archivo');
    }
  };

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

  const changeStatus = async (ticket, statusId) => {
    if (!ticket || ticket.status === statusId) return;
    // Actualización optimista: mover la tarjeta de inmediato
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: statusId } : t));
    try {
      await axios.patch(`/api/tickets/${ticket.id}/status`, { status: statusId, user_id: user?.id });
      fetchTickets(); // refresca datos (historial, etc.)
    } catch (err) {
      const code = err?.response?.status;
      const msg  = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Error desconocido';
      console.error('Error al cambiar estado del ticket:', { code, msg, err });
      fetchTickets(); // revierte al estado real si falló
      alert(`No se pudo cambiar el estado del ticket.\nCódigo: ${code || 'sin respuesta'}\nMotivo: ${msg}`);
    }
  };

  const handleDragStart = (e, ticket) => {
    setDraggedTicket(ticket);
    // Pasar la info por dataTransfer para evitar problemas de state asíncrono
    try { e.dataTransfer.setData('application/json', JSON.stringify({ id: ticket.id, status: ticket.status })); } catch (_) {}
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { try { e.target.classList.add('opacity-50'); } catch (_) {} }, 0);
  };
  const handleDragEnd = (e) => { try { e.target.classList.remove('opacity-50'); } catch (_) {} setDraggedTicket(null); };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = async (e, statusId) => {
    e.preventDefault();
    e.stopPropagation();
    // Intentar leer del dataTransfer primero, fallback al state
    let ticket = draggedTicket;
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        ticket = tickets.find(t => t.id === parsed.id) || ticket;
      }
    } catch (_) {}
    if (!ticket) return;
    setDraggedTicket(null);
    await changeStatus(ticket, statusId);
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
      <div className="flex-1 flex gap-4 overflow-x-auto pb-6" style={{ minHeight: 0 }}>
        {COLUMNS.map(col => {
          const colTickets = filteredTickets.filter(t => t.status === col.id);
          return (
            <div
              key={col.id}
              className="flex-shrink-0 w-72 flex flex-col rounded-sm overflow-hidden border border-gray-200 shadow-sm"
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Cabecera de columna — navy oscuro con línea de acento */}
              <div
                className="px-4 py-3 flex items-center justify-between flex-shrink-0"
                style={{ background: '#0A1930', borderBottom: `2px solid ${col.accent}` }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.accent }} />
                  <span className="font-label text-[10px] tracking-[0.25em] uppercase text-white/90">{col.label}</span>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-sm tabular-nums"
                  style={{ background: col.accent, color: '#071221' }}
                >
                  {colTickets.length}
                </span>
              </div>

              {/* Cuerpo de columna */}
              <AnimatedColumn
                className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-gray-50/70"
                style={{ minHeight: 220 }}
              >
                {colTickets.length === 0 && (
                  <div className="flex items-center justify-center h-24 border border-dashed border-gray-200 rounded-sm">
                    <p className="font-label text-[9px] tracking-widest text-gray-300 uppercase">Sin tickets</p>
                  </div>
                )}
                {colTickets.map(ticket => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onClick={t => fetchTicketDetails(t.id)}
                    onChangeStatus={changeStatus}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
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

      {/* ── DETALLE DEL TICKET — modal centrado ── */}
      {selectedTicket && (() => {
        const STATUS_INFO = {
          open:        { label: 'Pendiente',   color: '#94a3b8' },
          in_progress: { label: 'En Progreso', color: '#CBAC80' },
          resolved:    { label: 'En Revisión', color: '#3b82f6' },
          closed:      { label: 'Completado',  color: '#10b981' },
        };
        const sInfo = STATUS_INFO[selectedTicket.status] || { label: selectedTicket.status, color: '#94a3b8' };
        const priority = PRIORITY_STYLES[selectedTicket.priority] || PRIORITY_STYLES.medium;
        const isOverdue = selectedTicket.due_date && new Date(selectedTicket.due_date) < new Date() && selectedTicket.status !== 'closed';

        // Helper para construir URL de archivo desde el path almacenado
        const fileUrl = (f) => {
          if (!f?.path) return '';
          if (f.path.startsWith('/api/') || f.path.startsWith('http')) return f.path;
          const parts = f.path.replace(/\\/g, '/').split('/');
          return `/api/uploads/${parts[parts.length - 1]}`;
        };

        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy-950/70 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedTicket(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="bg-navy-950 px-6 py-5 relative flex-shrink-0">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                      <span className="font-label text-[9px] tracking-[0.25em] text-gold uppercase">Ticket #{selectedTicket.id}</span>
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      <span className="text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-sm" style={{ background: sInfo.color + '25', color: sInfo.color }}>
                        {sInfo.label}
                      </span>
                      <span className={`text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-sm border ${priority.cls}`}>
                        {priority.label}
                      </span>
                      {isOverdue && (
                        <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-sm bg-red-500/20 text-red-300 border border-red-400/30">
                          Vencido
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-display font-medium text-white leading-tight">{selectedTicket.title}</h3>
                  </div>
                  <button onClick={() => setSelectedTicket(null)} className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 bg-white px-2 flex-shrink-0 overflow-x-auto">
                {[
                  { id: 'info',  label: 'Información', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', count: null },
                  { id: 'chat',  label: 'Comentarios', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', count: selectedTicket.comments?.length || 0 },
                  { id: 'files', label: 'Archivos',    icon: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13', count: selectedTicket.attachments?.length || 0 },
                  { id: 'log',   label: 'Historial',   icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', count: selectedTicket.history?.length || 0 },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 py-3.5 px-4 text-[10px] font-bold tracking-widest uppercase transition-colors whitespace-nowrap ${
                      activeTab === tab.id ? 'text-navy-950' : 'text-navy-700 hover:text-navy-950'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                    </svg>
                    {tab.label}
                    {tab.count !== null && tab.count > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 rounded-full tabular-nums ${activeTab === tab.id ? 'bg-gold text-navy-950' : 'bg-navy-100 text-navy-800'}`}>
                        {tab.count}
                      </span>
                    )}
                    {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
                  </button>
                ))}
              </div>

              {/* Contenido */}
              <div className="flex-1 overflow-y-auto bg-gray-50/50">

                {/* INFO */}
                {activeTab === 'info' && (
                  <div className="p-6 space-y-5">
                    {/* Descripción */}
                    <div>
                      <p className="font-label text-[10px] tracking-[0.25em] text-navy-700 uppercase font-bold mb-2">Descripción del requerimiento</p>
                      <div className="bg-white p-4 rounded-lg border border-gray-200 relative">
                        <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-gold rounded-r" />
                        <p className="text-navy-800 text-sm leading-relaxed whitespace-pre-wrap pl-3">
                          {selectedTicket.description || <span className="italic text-gray-400">Sin descripción detallada.</span>}
                        </p>
                      </div>
                    </div>

                    {/* Grid de detalles */}
                    <div className="grid grid-cols-2 gap-3">
                      <DetailItem
                        label="Asignado a"
                        value={selectedTicket.assigned_name || 'Sin asignar'}
                        icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z"
                        muted={!selectedTicket.assigned_name}
                      />
                      <DetailItem
                        label="Departamento"
                        value={selectedTicket.category || '—'}
                        icon="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21"
                      />
                      <DetailItem
                        label="Fecha límite"
                        value={selectedTicket.due_date ? new Date(selectedTicket.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : 'No asignada'}
                        icon="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                        accent={isOverdue ? 'red' : null}
                      />
                      <DetailItem
                        label="Creado"
                        value={selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                        icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </div>
                  </div>
                )}

                {/* COMENTARIOS */}
                {activeTab === 'chat' && (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {(!selectedTicket.comments || selectedTicket.comments.length === 0) ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                          <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center">
                            <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                          <p className="text-xs text-navy-700 font-bold uppercase tracking-widest">Sin comentarios todavía</p>
                          <p className="text-[10px] text-navy-500">Escribe el primero abajo</p>
                        </div>
                      ) : (
                        selectedTicket.comments.map(c => {
                          const mine = c.user_id === user?.id;
                          return (
                            <div key={c.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${mine ? 'bg-gold text-navy-950' : 'bg-navy-100 text-navy-700'}`}>
                                {(c.user_name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className={`flex flex-col max-w-[80%] ${mine ? 'items-end' : 'items-start'}`}>
                                <span className="text-[10px] font-bold text-navy-700 mb-0.5 px-1">{c.user_name}</span>
                                <div className={`px-3.5 py-2.5 rounded-2xl text-sm shadow-sm ${
                                  mine ? 'bg-navy-950 text-white rounded-tr-sm' : 'bg-white text-navy-900 border border-gray-200 rounded-tl-sm'
                                }`}>
                                  <p className="whitespace-pre-wrap leading-snug">{c.content}</p>
                                </div>
                                <span className="text-[10px] text-navy-500 mt-1 px-1">
                                  {new Date(c.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} · {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                          placeholder="Escribe un comentario..."
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-navy-900 focus:outline-none focus:border-gold focus:bg-white transition"
                        />
                        <button onClick={handleAddComment} disabled={!newComment.trim()} className="w-10 h-10 bg-gold text-white rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-yellow-500 transition shadow-md flex-shrink-0">
                          <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ARCHIVOS */}
                {activeTab === 'files' && (
                  <div className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selectedTicket.attachments?.map(f => {
                        const url = fileUrl(f);
                        const isImg = f.mimetype?.startsWith('image/');
                        return (
                          <div key={f.id} className="group relative border border-gray-200 rounded-lg overflow-hidden aspect-square bg-white">
                            {isImg ? (
                              <button
                                type="button"
                                onClick={() => setLightboxUrl(url)}
                                className="w-full h-full block cursor-zoom-in"
                              >
                                <img src={url} alt={f.filename} className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <a href={url} download={f.filename} target="_blank" rel="noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                                <svg className="w-10 h-10 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                                <span className="text-[10px] font-bold text-navy-700 text-center break-all line-clamp-2 px-1">{f.filename}</span>
                              </a>
                            )}

                            {/* Botones flotantes — eliminar y descargar */}
                            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isImg && (
                                <a
                                  href={url}
                                  download={f.filename}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="w-7 h-7 rounded-md bg-navy-950/80 hover:bg-navy-950 text-gold flex items-center justify-center backdrop-blur-sm transition"
                                  title="Descargar"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                  </svg>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(f.id, f.filename); }}
                                className="w-7 h-7 rounded-md bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center backdrop-blur-sm transition"
                                title="Eliminar"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>

                            {/* Indicador de zoom para imágenes */}
                            {isImg && (
                              <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-navy-950/70 text-gold text-[8px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm pointer-events-none">
                                Click para ampliar
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <label className={`border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center aspect-square cursor-pointer hover:border-gold hover:bg-gold/5 transition-all ${isUploading ? 'opacity-50 cursor-wait' : ''}`}>
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                        {isUploading ? (
                          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <svg className="w-7 h-7 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center px-2">Subir evidencia</span>
                          </>
                        )}
                      </label>
                    </div>
                    {(!selectedTicket.attachments || selectedTicket.attachments.length === 0) && (
                      <p className="text-center text-[10px] text-navy-600 font-bold uppercase tracking-widest mt-6">Sin archivos adjuntos aún</p>
                    )}
                  </div>
                )}

                {/* HISTORIAL */}
                {activeTab === 'log' && (
                  <div className="p-6">
                    {(!selectedTicket.history || selectedTicket.history.length === 0) ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                        <div className="w-12 h-12 rounded-full bg-navy-50 flex items-center justify-center">
                          <svg className="w-6 h-6 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-xs text-navy-700 font-bold uppercase tracking-widest">Sin actividad registrada</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
                        <div className="space-y-4">
                          {selectedTicket.history.map((h) => (
                            <div key={h.id} className="flex gap-4 relative">
                              <div className="w-4 h-4 rounded-full bg-white border-2 border-gold mt-1 flex-shrink-0 z-10" />
                              <div className="flex-1 bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-xs font-bold text-navy-950 leading-snug">{h.details}</p>
                                <p className="text-[10px] text-navy-600 font-medium mt-1">
                                  {h.user_name} · {new Date(h.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} · {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lightbox para imágenes */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="vista ampliada"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            title="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <a
            href={lightboxUrl}
            download
            onClick={e => e.stopPropagation()}
            className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            title="Descargar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, icon, accent, muted }) {
  const accentClasses = {
    red: 'border-red-200 bg-red-50/40',
  };
  const valueClass = accent === 'red' ? 'text-red-700' : muted ? 'text-gray-500 italic' : 'text-navy-950';
  const iconClass = accent === 'red' ? 'text-red-600 bg-red-100' : 'text-navy-700 bg-navy-50';
  return (
    <div className={`bg-white p-3.5 rounded-lg border ${accentClasses[accent] || 'border-gray-200'} flex items-center gap-3`}>
      <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-label text-[10px] tracking-[0.2em] text-navy-700 uppercase font-bold">{label}</p>
        <p className={`text-sm font-bold mt-0.5 truncate ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

function AnimatedColumn({ children, className, ...props }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) autoAnimate(ref.current, { duration: 250, easing: 'ease-out' }); }, []);
  return <div ref={ref} className={className} {...props}>{children}</div>;
}

function TicketCard({ ticket, onClick, onChangeStatus, onDragStart, onDragEnd }) {
  const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date() && ticket.status !== 'closed';

  // Acciones de estado disponibles (sin incluir el actual)
  const STATUS_ACTIONS = [
    { id: 'in_progress', label: 'Progreso',  short: 'En curso',   accent: '#CBAC80', textOn: '#071221' },
    { id: 'resolved',    label: 'Revisión',  short: 'Revisar',    accent: '#3b82f6', textOn: '#ffffff' },
    { id: 'closed',      label: 'Completar', short: 'Completar',  accent: '#10b981', textOn: '#ffffff' },
  ];
  const availableActions = STATUS_ACTIONS.filter(a => a.id !== ticket.status);

  return (
    <div
      draggable
      onDragStart={e => onDragStart && onDragStart(e, ticket)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(ticket)}
      className={`bg-white rounded-sm border transition-all duration-150 cursor-pointer lg:cursor-grab lg:active:cursor-grabbing group hover:shadow-md hover:-translate-y-px select-none ${
        isOverdue ? 'border-red-200' : 'border-gray-200 hover:border-gold/50'
      }`}
    >
      {/* Franja superior de prioridad */}
      <div className={`h-0.5 w-full rounded-t-sm ${
        ticket.priority === 'urgent' ? 'bg-red-500' :
        ticket.priority === 'high'   ? 'bg-amber-400' :
        ticket.priority === 'medium' ? 'bg-sky-400' : 'bg-slate-300'
      }`} />

      <div className="p-3.5">
        {/* ID */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-label text-[9px] tracking-[0.2em] text-navy-500 uppercase font-bold">#{ticket.id}</span>
          {isOverdue && (
            <span className="text-[8px] font-bold text-red-600 uppercase tracking-wide bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-sm">Vencido</span>
          )}
        </div>

        {/* Título */}
        <h4 className="font-sans font-bold text-navy-950 text-xs leading-snug mb-3 group-hover:text-gold transition-colors line-clamp-2">
          {ticket.title}
        </h4>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
          <span className="font-label text-[8px] tracking-wider text-navy-600 uppercase truncate max-w-[110px] font-bold">
            {ticket.category}
          </span>
          {ticket.assigned_name ? (
            <div className="w-6 h-6 rounded-sm bg-navy-950 text-gold flex items-center justify-center text-[10px] font-bold border border-gold/20">
              {ticket.assigned_name.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-sm bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center">
              <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* Botones de cambio de estado — solo móvil/tablet */}
        {onChangeStatus && availableActions.length > 0 && (
          <div className="lg:hidden mt-3 pt-2.5 border-t border-gray-100 flex gap-1">
            {availableActions.map(act => (
              <button
                key={act.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); onChangeStatus(ticket, act.id); }}
                className="flex-1 py-1.5 rounded-sm text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95"
                style={{ background: act.accent, color: act.textOn }}
              >
                {act.short}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
