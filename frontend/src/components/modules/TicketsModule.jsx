import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import autoAnimate from '@formkit/auto-animate';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';
import UserAvatar from '../UserAvatar';

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

const EMPTY_TICKET_FORM = { title: '', description: '', category: DEPARTAMENTOS[0] };

/** Igual que el backend: administradores o rol Gerente del mismo departamento que el ticket. */
function formatTaskDate(ymd) {
  if (!ymd) return '';
  const d = new Date(String(ymd).includes('T') ? ymd : `${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function canDelegarTarea(authUser, ticket) {
  if (!authUser || !ticket) return false;
  if (authUser.role === 'superadmin' || authUser.role === 'administrator') return true;
  if (authUser.role !== 'manager') return false;
  const cat = (ticket.category || '').trim();
  const dept = (authUser.departamento || '').trim();
  return Boolean(cat && dept === cat);
}

export default function TicketsModule({
  openTicketId = null,
  openTicketTab = 'info',
  onConsumeOpenTicket,
} = {}) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [taskView, setTaskView] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('info');
  const [ticketTasks, setTicketTasks] = useState([]);
  const [newTaskForm, setNewTaskForm] = useState({
    assigned_to: '',
    start_date: '',
    end_date: '',
  });
  const [formData, setFormData] = useState(EMPTY_TICKET_FORM);
  const [newComment, setNewComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [newTicketFiles, setNewTicketFiles] = useState([]);
  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [ticketEditForm, setTicketEditForm] = useState(null);

  const handleDeleteAttachment = async (attachmentId, filename) => {
    if (!window.confirm(`¿Eliminar el archivo "${filename}"? Esta acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`/api/tickets/${selectedTicket.id}/attachments/${attachmentId}`, { data: { user_id: user?.id } });
      fetchTicketDetails(selectedTicket.id);
      PushEvents.ticketFileDel(filename);
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

  useEffect(() => {
    if (openTicketId == null) return;
    setActiveTab(openTicketTab || 'info');
    fetchTicketDetails(openTicketId);
    onConsumeOpenTicket?.();
  }, [openTicketId, openTicketTab]);

  useEffect(() => {
    setIsEditingTicket(false);
    setTicketEditForm(null);
  }, [selectedTicket?.id]);

  const freshTaskForm = () => {
    const t = new Date();
    const e = new Date(t);
    e.setDate(e.getDate() + 3);
    const fmt = (d) => d.toISOString().slice(0, 10);
    return { assigned_to: '', start_date: fmt(t), end_date: fmt(e) };
  };

  const fetchTicketTasks = async (ticketId) => {
    try {
      const { data } = await axios.get(`/api/ticket-tasks/by-ticket/${ticketId}`);
      setTicketTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setTicketTasks([]);
    }
  };

  useEffect(() => {
    if (!selectedTicket?.id) {
      setTicketTasks([]);
      return;
    }
    setNewTaskForm(freshTaskForm());
    fetchTicketTasks(selectedTicket.id);
  }, [selectedTicket?.id]);

  const handleCreateTicketTask = async () => {
    if (!selectedTicket) return;
    if (!newTaskForm.assigned_to || !newTaskForm.start_date || !newTaskForm.end_date) {
      alert('Selecciona responsable, fecha de inicio y fecha de fin.');
      return;
    }
    const baseTitle = selectedTicket.title?.trim() || 'Requerimiento';
    const n = ticketTasks.length + 1;
    const autoTitle = n > 1 ? `${baseTitle} (${n})` : baseTitle;
    try {
      await axios.post(`/api/ticket-tasks/by-ticket/${selectedTicket.id}`, {
        title: autoTitle,
        description: '',
        assigned_to: Number(newTaskForm.assigned_to),
        start_date: newTaskForm.start_date,
        end_date: newTaskForm.end_date,
      });
      setNewTaskForm(freshTaskForm());
      fetchTicketTasks(selectedTicket.id);
    } catch (err) {
      alert(err?.response?.data?.error || err?.response?.data?.message || 'No se pudo crear la tarea');
    }
  };

  const handleTicketTaskStatus = async (taskId, status) => {
    try {
      await axios.patch(`/api/ticket-tasks/${taskId}`, { status });
      fetchTicketTasks(selectedTicket.id);
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo actualizar la tarea');
    }
  };

  const handleDeleteTicketTask = async (taskId) => {
    if (!window.confirm('¿Eliminar esta tarea operativa?')) return;
    try {
      await axios.delete(`/api/ticket-tasks/${taskId}`);
      fetchTicketTasks(selectedTicket.id);
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo eliminar');
    }
  };

  const changeStatus = async (ticket, statusId) => {
    if (!ticket || ticket.status === statusId) return;
    // Actualización optimista: mover la tarjeta de inmediato
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: statusId } : t));
    try {
      await axios.patch(`/api/tickets/${ticket.id}/status`, { status: statusId, user_id: user?.id });
      fetchTickets(); // refresca datos (historial, etc.)
      const labels = { open: 'Pendientes', in_progress: 'En Progreso', resolved: 'En Revisión', closed: 'Completados' };
      PushEvents.ticketMoved(ticket.title, labels[statusId] || statusId);
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
    if (!formData.title?.trim() || isSavingTicket) return;
    const titleForPush = formData.title.trim();
    setIsSavingTicket(true);
    try {
      const { data } = await axios.post('/api/tickets', {
        title: titleForPush,
        description: formData.description,
        category: formData.category,
      });
      const ticketId = data.id;
      for (const file of newTicketFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('user_id', user?.id);
        await axios.post(`/api/tickets/${ticketId}/attachments`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      fetchTickets();
      setIsModalOpen(false);
      setFormData({ ...EMPTY_TICKET_FORM });
      setNewTicketFiles([]);
      PushEvents.ticketCreated(titleForPush);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || err?.response?.data?.message || 'No se pudo crear el ticket');
    } finally {
      setIsSavingTicket(false);
    }
  };

  const beginTicketEdit = () => {
    if (!selectedTicket) return;
    setTicketEditForm({
      title: selectedTicket.title || '',
      description: selectedTicket.description || '',
      category: selectedTicket.category || DEPARTAMENTOS[0],
    });
    setIsEditingTicket(true);
    setActiveTab('info');
  };

  const saveTicketEdit = async () => {
    if (!selectedTicket || !ticketEditForm?.title?.trim()) return;
    try {
      await axios.patch(`/api/tickets/${selectedTicket.id}`, {
        title: ticketEditForm.title.trim(),
        description: ticketEditForm.description,
        category: ticketEditForm.category,
      });
      await fetchTicketDetails(selectedTicket.id);
      setIsEditingTicket(false);
      fetchTickets();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || err?.response?.data?.message || 'No se pudo guardar el ticket');
    }
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
      PushEvents.ticketComment(selectedTicket.title);
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
      PushEvents.ticketFileUp(file.name);
    } catch (err) { console.error(err); }
    setIsUploading(false);
  };

  const saveTicketAssignment = async (assignedRaw) => {
    if (!selectedTicket || !canDelegarTarea(user, selectedTicket)) return;
    const assigned_to = assignedRaw === '' || assignedRaw == null ? null : Number(assignedRaw);
    try {
      await axios.patch(`/api/tickets/${selectedTicket.id}`, { assigned_to });
      await fetchTicketDetails(selectedTicket.id);
      fetchTickets();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || err?.response?.data?.message || 'No se pudo actualizar la asignación');
    }
  };

  const deptMembersForTicket = (ticket) =>
    dbUsers.filter((u) => {
      if ((u.departamento || '').trim() !== (ticket?.category || '').trim()) return false;
      if (u.is_active === 0 || u.is_active === false) return false;
      return true;
    });

  const filteredTickets = tickets.filter(t => {
    const matchSearch = (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (t.assigned_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        String(t.id).includes(searchTerm);
    const matchDept = filterDept ? t.category === filterDept : true;
    const matchMine = taskView === 'mine' ? Number(t.assigned_to) === Number(user?.id) : true;
    return matchSearch && matchDept && matchMine;
  });

  return (
    <div className="h-full flex flex-col animate-fade-in space-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-display font-medium text-navy-950 tracking-tight">Centro de Soporte Avanzado</h2>
          <p className="text-sm text-navy-600 mt-1">Gestión integral con historial, comentarios y multimedia</p>
        </div>
        <button
          type="button"
          onClick={() => { setFormData({ ...EMPTY_TICKET_FORM }); setNewTicketFiles([]); setIsModalOpen(true); }}
          className="btn-gold-header self-end sm:self-auto"
          aria-label="Nuevo requerimiento"
        >
          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="sm:hidden">Nuevo</span>
          <span className="hidden sm:inline">Nuevo Requerimiento</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96">
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Buscar por ID, asunto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:border-gold text-sm text-navy-900 placeholder-gray-400 bg-gray-50 hover:bg-white shadow-inner transition-all" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto md:items-center">
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-navy-900 bg-gray-50 outline-none min-w-[200px]">
            <option value="">Todos los departamentos</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={taskView} onChange={e => setTaskView(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-navy-900 bg-gray-50 outline-none min-w-[180px]">
            <option value="all">Todos los tickets</option>
            <option value="mine">Mis tareas</option>
          </select>
        </div>
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
                    onClick={t => { setActiveTab('info'); fetchTicketDetails(t.id); }}
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

      {/* Modal nuevo ticket (portal = mismo efecto difuminado que calendario, cubre todo el viewport) */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
            onClick={() => {
              setIsModalOpen(false);
              setFormData({ ...EMPTY_TICKET_FORM });
              setNewTicketFiles([]);
            }}
            role="presentation"
          >
          <div
            className="flex max-h-[min(92dvh,40rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-ticket-modal-title"
          >
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-6 pb-6 sm:px-8 sm:pt-7">
              <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-gold/12 blur-3xl" aria-hidden />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                  <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/[0.12] sm:flex">
                    <svg className="h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">Centro de soporte</p>
                    <h2 id="new-ticket-modal-title" className="mt-1.5 font-display text-xl font-medium leading-tight text-white sm:text-2xl">
                      Nuevo requerimiento
                    </h2>
                    <p className="mt-1.5 text-sm text-white/55">
                      Describe el caso y el área responsable; puedes adjuntar evidencias.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData({ ...EMPTY_TICKET_FORM });
                    setNewTicketFiles([]);
                  }}
                  className="shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Cerrar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveTicket();
              }}
            >
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
                <section>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Asunto</h3>
                  <label htmlFor="new-ticket-title" className="sr-only">
                    Título del ticket
                  </label>
                  <input
                    id="new-ticket-title"
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                    placeholder="Ej. Falla en acceso al sistema…"
                  />
                </section>

                <section>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Departamento responsable</h3>
                  <label htmlFor="new-ticket-dept" className="sr-only">
                    Departamento
                  </label>
                  <select
                    id="new-ticket-dept"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                  >
                    {DEPARTAMENTOS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Adjuntos</h3>
                    {newTicketFiles.length > 0 && (
                      <span className="text-xs font-medium tabular-nums text-slate-500">
                        {newTicketFiles.length} archivo{newTicketFiles.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 transition-colors hover:border-gold/50 hover:bg-gold/[0.04]">
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                      className="hidden"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || []);
                        if (picked.length) setNewTicketFiles((prev) => [...prev, ...picked]);
                        e.target.value = '';
                      }}
                    />
                    <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
                      <svg className="h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <span className="text-center text-sm font-semibold text-slate-800">Arrastra o elige archivos</span>
                    <span className="mt-1 text-center text-xs text-slate-500">
                      PDF, Office, imágenes, ZIP · máx. 10 MB por archivo
                    </span>
                  </label>
                  {newTicketFiles.length > 0 && (
                    <ul className="mt-3 max-h-32 space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-2">
                      {newTicketFiles.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm"
                        >
                          <span className="truncate text-xs font-medium text-slate-800">{f.name}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-600 transition-colors hover:bg-red-50"
                            onClick={() => setNewTicketFiles((prev) => prev.filter((_, j) => j !== i))}
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Descripción del problema</h3>
                  <label htmlFor="new-ticket-desc" className="sr-only">
                    Descripción
                  </label>
                  <textarea
                    id="new-ticket-desc"
                    rows="4"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                    placeholder="Pasos para reproducir, mensaje de error, ambiente (oficina / remoto), urgencia percibida…"
                  />
                </section>
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-8">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setFormData({ ...EMPTY_TICKET_FORM });
                      setNewTicketFiles([]);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-[8rem]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTicket}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-navy-900/10 bg-navy-950 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold shadow-md transition-colors hover:bg-navy-900 disabled:opacity-60 sm:min-w-[11rem]"
                  >
                    {isSavingTicket ? (
                      <>
                        <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Creando…
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Crear ticket
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}

      {/* ── DETALLE DEL TICKET — modal centrado ── */}
      {selectedTicket &&
        createPortal(
          (() => {
        const STATUS_INFO = {
          open:        { label: 'Pendiente',   color: '#94a3b8' },
          in_progress: { label: 'En Progreso', color: '#CBAC80' },
          resolved:    { label: 'En Revisión', color: '#3b82f6' },
          closed:      { label: 'Completado',  color: '#10b981' },
        };
        const sInfo = STATUS_INFO[selectedTicket.status] || { label: selectedTicket.status, color: '#94a3b8' };
        const isOverdue = selectedTicket.due_date && new Date(selectedTicket.due_date) < new Date() && selectedTicket.status !== 'closed';

        // Helper para construir URL de archivo desde el path almacenado
        const fileUrl = (f) => {
          if (!f?.path) return '';
          if (f.path.startsWith('/api/') || f.path.startsWith('http')) return f.path;
          const parts = f.path.replace(/\\/g, '/').split('/');
          return `/api/uploads/${parts[parts.length - 1]}`;
        };

        return (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
            onClick={() => setSelectedTicket(null)}
          >
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
                      {isOverdue && (
                        <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-sm bg-red-500/20 text-red-300 border border-red-400/30">
                          Vencido
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-display font-medium text-white leading-tight">{selectedTicket.title}</h3>
                  </div>
                  <div className="flex items-start gap-2 flex-shrink-0">
                    {!isEditingTicket ? (
                      <button type="button" onClick={beginTicketEdit} className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white/10 text-gold hover:bg-white/15 border border-white/10 transition">
                        Editar
                      </button>
                    ) : (
                      <>
                        <button type="button" onClick={() => { setIsEditingTicket(false); setTicketEditForm(null); }} className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white/5 text-white/90 hover:bg-white/10 border border-white/10 transition">
                          Cancelar
                        </button>
                        <button type="button" onClick={saveTicketEdit} className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-gold text-navy-950 hover:bg-gold/90 transition">
                          Guardar
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => { setSelectedTicket(null); }} className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex flex-shrink-0 overflow-x-auto border-b border-gray-200 bg-slate-100/90 px-2 pt-1.5 gap-1">
                {[
                  { id: 'info',  label: 'Información', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', count: null },
                  { id: 'tasks', label: 'Tareas operativas', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664v.75h-4.5M15 10.5a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0h.008v.008H15V10.5z', count: ticketTasks.length },
                  { id: 'chat',  label: 'Comentarios', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', count: selectedTicket.comments?.length || 0 },
                  { id: 'files', label: 'Archivos',    icon: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13', count: selectedTicket.attachments?.length || 0 },
                  { id: 'log',   label: 'Historial',   icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', count: selectedTicket.history?.length || 0 },
                ].map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 py-3 px-3.5 sm:px-4 text-[10px] font-bold tracking-widest uppercase whitespace-nowrap rounded-t-lg transition-all ${
                      isActive
                        ? 'bg-white text-navy-950 shadow-sm border border-gray-200 border-b-white -mb-px z-10'
                        : 'text-navy-500 border border-transparent hover:text-navy-800 hover:bg-white/60'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isActive && (
                      <span className="absolute inset-x-2 top-0 h-[3px] rounded-b-sm bg-gold" aria-hidden />
                    )}
                    <svg className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-gold' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                    </svg>
                    {tab.label}
                    {tab.count !== null && tab.count > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 rounded-full tabular-nums ${isActive ? 'bg-gold text-navy-950' : 'bg-navy-200/80 text-navy-800'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                  );
                })}
              </div>

              {/* Contenido */}
              <div className="surface-light flex-1 overflow-y-auto bg-gray-50 text-navy-950">

                {/* INFO */}
                {activeTab === 'info' && (
                  isEditingTicket && ticketEditForm ? (
                    <div className="p-6 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Asunto</label>
                        <input
                          type="text"
                          value={ticketEditForm.title}
                          onChange={e => setTicketEditForm(f => ({ ...f, title: e.target.value }))}
                          className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Departamento</label>
                        <select
                          value={ticketEditForm.category}
                          onChange={e => setTicketEditForm(f => ({ ...f, category: e.target.value }))}
                          className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none"
                        >
                          {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-navy-950">Descripción</label>
                        <textarea
                          rows={5}
                          value={ticketEditForm.description}
                          onChange={e => setTicketEditForm(f => ({ ...f, description: e.target.value }))}
                          className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-navy-950 focus:border-gold outline-none resize-none"
                        />
                      </div>
                    </div>
                  ) : (
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

                    <div className="grid grid-cols-2 gap-3">
                      <DetailItem
                        label="Responsable"
                        value={selectedTicket.assigned_name || 'Sin asignar (en cola del depto.)'}
                        icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z"
                        muted={!selectedTicket.assigned_name}
                      />
                      <DetailItem
                        label="Departamento"
                        value={selectedTicket.category || '—'}
                        icon="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21"
                      />
                      {selectedTicket.due_date ? (
                        <DetailItem
                          label="Fecha límite"
                          value={new Date(selectedTicket.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                          icon="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                          accent={isOverdue ? 'red' : null}
                        />
                      ) : null}
                      <DetailItem
                        label="Creado"
                        value={selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                        icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </div>

                    {canDelegarTarea(user, selectedTicket) && (
                      <div className="bg-white border border-gold/30 rounded-lg p-4 space-y-2 shadow-sm">
                        <p className="font-label text-[10px] tracking-[0.2em] text-navy-800 uppercase font-bold">Coordinador del ticket</p>
                        <label className="sr-only" htmlFor="delegar-responsable">Coordinador del ticket</label>
                        <select
                          id="delegar-responsable"
                          value={selectedTicket.assigned_to != null && selectedTicket.assigned_to !== '' ? String(selectedTicket.assigned_to) : ''}
                          onChange={(e) => saveTicketAssignment(e.target.value)}
                          className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm text-navy-950 focus:border-gold outline-none bg-gray-50"
                        >
                          <option value="">Sin asignar (cola del departamento)</option>
                          {deptMembersForTicket(selectedTicket).map((u) => (
                            <option key={u.id} value={String(u.id)}>
                              {u.name} {u.apellido || ''}{u.puesto ? ` · ${u.puesto}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  )
                )}

                {/* TAREAS OPERATIVAS (subtareas con fechas) */}
                {activeTab === 'tasks' && (
                  <div className="p-6 space-y-5 text-navy-950">

                    {canDelegarTarea(user, selectedTicket) && (
                      <div className="rounded-lg border border-gold/40 bg-white p-4 shadow-sm">
                        <p className="font-label text-[10px] tracking-[0.2em] text-navy-950 uppercase font-bold mb-3">Asignar tramo</p>
                        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-end gap-3">
                          <div className="flex-1 min-w-[140px] space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-navy-950">Responsable</label>
                            <select
                              value={newTaskForm.assigned_to}
                              onChange={(e) => setNewTaskForm((f) => ({ ...f, assigned_to: e.target.value }))}
                              className="bosa-field"
                            >
                              <option value="">Selecciona quién ejecuta…</option>
                              {deptMembersForTicket(selectedTicket).map((u) => (
                                <option key={u.id} value={String(u.id)}>
                                  {u.name} {u.apellido || ''}{u.puesto ? ` · ${u.puesto}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-full sm:w-auto sm:min-w-[150px] space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-navy-950">Inicio</label>
                            <input
                              type="date"
                              value={newTaskForm.start_date}
                              onChange={(e) => setNewTaskForm((f) => ({ ...f, start_date: e.target.value }))}
                              className="bosa-field"
                            />
                          </div>
                          <div className="w-full sm:w-auto sm:min-w-[150px] space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-navy-950">Fin</label>
                            <input
                              type="date"
                              value={newTaskForm.end_date}
                              onChange={(e) => setNewTaskForm((f) => ({ ...f, end_date: e.target.value }))}
                              className="bosa-field"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateTicketTask}
                            className="btn-gold text-[10px] py-2.5 px-5 uppercase tracking-widest font-bold whitespace-nowrap lg:mb-0.5"
                          >
                            Asignar tarea
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <p className="font-label text-[10px] tracking-widest text-navy-950 uppercase font-bold">Asignaciones</p>
                      {ticketTasks.length === 0 ? (
                        <p className="text-center text-xs text-navy-500 py-8">Aún no hay tareas para este requerimiento.</p>
                      ) : (
                        ticketTasks.map((task) => {
                          const assignee = [task.assignee_name, task.assignee_apellido].filter(Boolean).join(' ') || '—';
                          const canManage = canDelegarTarea(user, selectedTicket);
                          const isAssignee = Number(task.assigned_to) === Number(user?.id);
                          const canStatus = canManage || isAssignee;
                          return (
                            <div key={task.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex gap-3 min-w-0">
                                  <UserAvatar
                                    name={task.assignee_name}
                                    apellido={task.assignee_apellido}
                                    avatarUrl={task.assignee_avatar_url}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                  <p className="font-bold text-navy-950 text-sm">{assignee}</p>
                                  {(task.assignee_departamento || selectedTicket?.category) && (
                                    <p className="text-[10px] text-navy-500 mt-0.5">
                                      {task.assignee_departamento || selectedTicket.category}
                                    </p>
                                  )}
                                  <p className="text-sm font-semibold text-navy-950 mt-1.5 tabular-nums">
                                    {formatTaskDate(task.start_date)} → {formatTaskDate(task.end_date)}
                                  </p>
                                  {task.description ? (
                                    <p className="text-xs text-navy-600 mt-2 whitespace-pre-wrap">{task.description}</p>
                                  ) : (
                                    <p className="text-[10px] text-navy-400 mt-1">Mismo requerimiento que en Información · etiqueta en Gantt: {task.title}</p>
                                  )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {canStatus ? (
                                    <select
                                      value={task.status}
                                      onChange={(e) => handleTicketTaskStatus(task.id, e.target.value)}
                                      className="text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-navy-950 font-bold uppercase tracking-wide"
                                    >
                                      <option value="pending">Pendiente</option>
                                      <option value="in_progress">En progreso</option>
                                      <option value="done">Hecha</option>
                                      <option value="cancelled">Cancelada</option>
                                    </select>
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase text-navy-500">{task.status}</span>
                                  )}
                                  {canManage && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTicketTask(task.id)}
                                      className="text-[10px] font-bold text-red-600 hover:underline"
                                    >
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
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
      })(),
          document.body
        )}

      {/* Lightbox para imágenes */}
      {lightboxUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in cursor-zoom-out"
            onClick={() => setLightboxUrl(null)}
          >
            <img
              src={lightboxUrl}
              alt="vista ampliada"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
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
              onClick={(e) => e.stopPropagation()}
              className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
              title="Descargar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </a>
          </div>,
          document.body
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
      {/* Acento discreto (sin prioridad) */}
      <div className="h-0.5 w-full rounded-t-sm bg-gradient-to-r from-gold/80 to-navy-950/25" />

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
