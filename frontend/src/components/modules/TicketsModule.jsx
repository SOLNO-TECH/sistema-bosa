import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import autoAnimate from '@formkit/auto-animate';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';
import UserAvatar from '../UserAvatar';
import BosaGoldButton from '../BosaGoldButton';
import { useCatalog } from '../../hooks/useCatalog';
import { FALLBACK_DEPARTMENTS } from '../../utils/catalog';
import { canManageDeptAsManager, isSuperadminUser } from '../../utils/permissions';
import { localDateYMD } from '../../utils/localDate';

const COLUMNS = [
  { id: 'open',        label: 'Pendientes',  accent: '#94a3b8' },
  { id: 'in_progress', label: 'En Progreso', accent: '#CBAC80' },
  { id: 'resolved',    label: 'En Revisión', accent: '#3b82f6' },
  { id: 'closed',      label: 'Completados', accent: '#10b981' },
];

const EMPTY_TICKET_FORM = { title: '', description: '', category: FALLBACK_DEPARTMENTS[0] };

/** Igual que el backend: administradores o rol Gerente del mismo departamento que el ticket. */
function formatTaskDate(ymd) {
  if (!ymd) return '';
  const d = new Date(String(ymd).includes('T') ? ymd : `${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function canDelegarTarea(authUser, ticket) {
  return canManageDeptAsManager(authUser, ticket?.category);
}

function AssignTaskIcon() {
  return (
    <span className="tasks-module__action-icon-wrap tasks-module__action-icon-wrap--assign" aria-hidden>
      <svg
        className="tasks-module__action-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
      </svg>
    </span>
  );
}

/** Pestañas antiguas (tasks, chat, files) → nuevas unificadas */
function normalizeTicketTab(tab) {
  if (tab === 'tasks') return 'info';
  if (tab === 'chat' || tab === 'files') return 'collaboration';
  if (tab === 'info' || tab === 'collaboration' || tab === 'log') return tab;
  return 'info';
}

export default function TicketsModule({
  openTicketId = null,
  openTicketTab = 'info',
  onConsumeOpenTicket,
} = {}) {
  const { user } = useAuth();
  const { departments } = useCatalog();
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
  const [creatingTicketTask, setCreatingTicketTask] = useState(false);
  const canDeleteTask = isSuperadminUser(user);
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
    setActiveTab(normalizeTicketTab(openTicketTab));
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
    const fmt = (d) => localDateYMD(d);
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
    if (!selectedTicket || creatingTicketTask) return;
    if (!newTaskForm.assigned_to || !newTaskForm.start_date || !newTaskForm.end_date) {
      alert('Selecciona responsable, fecha de inicio y fecha de fin.');
      return;
    }
    const baseTitle = selectedTicket.title?.trim() || 'Requerimiento';
    const n = ticketTasks.length + 1;
    const autoTitle = n > 1 ? `${baseTitle} (${n})` : baseTitle;
    setCreatingTicketTask(true);
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
    } finally {
      setCreatingTicketTask(false);
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
      category: selectedTicket.category || departments[0] || FALLBACK_DEPARTMENTS[0],
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
        <BosaGoldButton
          icon="ticket"
          onClick={() => { setFormData({ ...EMPTY_TICKET_FORM }); setNewTicketFiles([]); setIsModalOpen(true); }}
          className="self-end sm:!w-auto sm:self-auto"
          aria-label="Nuevo ticket"
        >
          <span className="sm:hidden">Nuevo</span>
          <span className="hidden sm:inline">Nuevo ticket</span>
        </BosaGoldButton>
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
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
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
            className="meeting-sheet-overlay z-[100] animate-fade-in"
            onClick={() => {
              setIsModalOpen(false);
              setFormData({ ...EMPTY_TICKET_FORM });
              setNewTicketFiles([]);
            }}
            role="presentation"
          >
          <div
            className="meeting-sheet meeting-sheet--form animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-ticket-modal-title"
          >
            <div className="meeting-sheet__hero shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="meeting-sheet__pill meeting-sheet__pill--gold">Centro de soporte</span>
                  <h2 id="new-ticket-modal-title" className="meeting-sheet__hero-title mt-2">
                    Nuevo requerimiento
                  </h2>
                  <p className="meeting-sheet__hero-subtitle">
                    Describe el caso y el área responsable; puedes adjuntar evidencias.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData({ ...EMPTY_TICKET_FORM });
                    setNewTicketFiles([]);
                  }}
                  className="meeting-sheet__close"
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
              <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
                <p className="meeting-sheet__section-label">Asunto</p>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label htmlFor="new-ticket-title" className="sr-only">
                      Título del ticket
                    </label>
                    <input
                      id="new-ticket-title"
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="meeting-sheet__input font-semibold"
                      placeholder="Ej. Falla en acceso al sistema…"
                    />
                  </div>
                </div>

                <p className="meeting-sheet__section-label">Departamento responsable</p>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label htmlFor="new-ticket-dept" className="sr-only">
                      Departamento
                    </label>
                    <select
                      id="new-ticket-dept"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="meeting-sheet__select"
                    >
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="meeting-sheet__section-label">
                  Adjuntos{newTicketFiles.length > 0 ? ` · ${newTicketFiles.length}` : ''}
                </p>
                <div className="meeting-sheet__group">
                  <label className="meeting-sheet__upload">
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
                    <span className="meeting-sheet__upload-icon">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </span>
                    <span className="text-[15px] font-semibold text-slate-900">Elegir archivos</span>
                    <span className="mt-1 text-[13px] text-slate-500">
                      PDF, Office, imágenes, ZIP · máx. 10 MB
                    </span>
                  </label>
                  {newTicketFiles.length > 0 && (
                    <div className="border-t border-slate-100">
                      {newTicketFiles.map((f, i) => (
                        <div key={`${f.name}-${i}`} className="meeting-sheet__file-row">
                          <span className="truncate text-[14px] font-medium text-slate-800">{f.name}</span>
                          <button
                            type="button"
                            className="meeting-sheet__file-remove"
                            onClick={() => setNewTicketFiles((prev) => prev.filter((_, j) => j !== i))}
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="meeting-sheet__section-label">Descripción</p>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label htmlFor="new-ticket-desc" className="sr-only">
                      Descripción
                    </label>
                    <textarea
                      id="new-ticket-desc"
                      rows="4"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="meeting-sheet__textarea"
                      placeholder="Pasos para reproducir, mensaje de error, ambiente (oficina / remoto), urgencia percibida…"
                    />
                  </div>
                </div>
              </div>

              <div className="meeting-sheet__footer shrink-0">
                <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setFormData({ ...EMPTY_TICKET_FORM });
                      setNewTicketFiles([]);
                    }}
                    className="voice-minute-footer__btn voice-minute-footer__btn--secondary"
                  >
                    <svg
                      className="voice-minute-footer__icon voice-minute-footer__icon--close"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTicket}
                    className="voice-minute-footer__btn voice-minute-footer__btn--primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingTicket ? (
                      <>
                        <span
                          className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-navy-950/25 border-t-navy-950"
                          aria-hidden
                        />
                        Creando…
                      </>
                    ) : (
                      <>
                        <svg
                          className="voice-minute-footer__icon voice-minute-footer__icon--ticket"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
                          <path d="M15 4v3h3" />
                          <path d="M12 11v6M9 14h6" />
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
            className="meeting-sheet-overlay z-[110] animate-fade-in"
            onClick={() => setSelectedTicket(null)}
            role="presentation"
          >
            <div
              className="meeting-sheet meeting-sheet--wide meeting-sheet--form animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ticket-detail-title"
            >
              <div className="meeting-sheet__hero shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="meeting-sheet__pill meeting-sheet__pill--gold">Ticket #{selectedTicket.id}</span>
                      <span
                        className="meeting-sheet__pill"
                        style={{ background: `${sInfo.color}22`, color: sInfo.color }}
                      >
                        {sInfo.label}
                      </span>
                      {isOverdue && (
                        <span className="meeting-sheet__pill" style={{ background: 'rgba(239,68,68,0.16)', color: '#fca5a5' }}>
                          Vencido
                        </span>
                      )}
                    </div>
                    <h3 id="ticket-detail-title" className="meeting-sheet__hero-title">
                      {selectedTicket.title}
                    </h3>
                  </div>
                  <div className="flex items-start gap-1">
                    <div className="meeting-sheet__hero-actions">
                      {!isEditingTicket ? (
                        <button type="button" onClick={beginTicketEdit} className="meeting-sheet__hero-btn meeting-sheet__hero-btn--ghost">
                          Editar
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => { setIsEditingTicket(false); setTicketEditForm(null); }}
                            className="meeting-sheet__hero-btn meeting-sheet__hero-btn--ghost"
                          >
                            Cancelar
                          </button>
                          <button type="button" onClick={saveTicketEdit} className="meeting-sheet__hero-btn meeting-sheet__hero-btn--gold">
                            Guardar
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(null)}
                      className="meeting-sheet__close"
                      aria-label="Cerrar"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="meeting-sheet__tabs">
                {[
                  { id: 'info', label: 'Detalle y tareas', count: ticketTasks.length },
                  {
                    id: 'collaboration',
                    label: 'Comentarios y archivos',
                    count: (selectedTicket.comments?.length || 0) + (selectedTicket.attachments?.length || 0),
                  },
                  { id: 'log', label: 'Historial', count: selectedTicket.history?.length || 0 },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`meeting-sheet__tab${activeTab === tab.id ? ' meeting-sheet__tab--active' : ''}`}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                  >
                    {tab.label}
                    {tab.count > 0 && <span className="meeting-sheet__tab-badge">{tab.count}</span>}
                  </button>
                ))}
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="meeting-sheet__scroll meeting-sheet__scroll--form flex-1">

                {/* INFO */}
                {activeTab === 'info' && (
                  isEditingTicket && ticketEditForm ? (
                    <div className="space-y-4">
                      <p className="meeting-sheet__section-label">Editar ticket</p>
                      <div className="meeting-sheet__group">
                        <div className="meeting-sheet__cell meeting-sheet__cell--field">
                          <label className="meeting-sheet__cell-label">Asunto</label>
                          <input
                            type="text"
                            value={ticketEditForm.title}
                            onChange={(e) => setTicketEditForm((f) => ({ ...f, title: e.target.value }))}
                            className="meeting-sheet__input font-semibold"
                          />
                        </div>
                        <div className="meeting-sheet__cell meeting-sheet__cell--field">
                          <label className="meeting-sheet__cell-label">Departamento</label>
                          <select
                            value={ticketEditForm.category}
                            onChange={(e) => setTicketEditForm((f) => ({ ...f, category: e.target.value }))}
                            className="meeting-sheet__select"
                          >
                            {departments.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div className="meeting-sheet__cell meeting-sheet__cell--field">
                          <label className="meeting-sheet__cell-label">Descripción</label>
                          <textarea
                            rows={5}
                            value={ticketEditForm.description}
                            onChange={(e) => setTicketEditForm((f) => ({ ...f, description: e.target.value }))}
                            className="meeting-sheet__textarea"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                  <div className="space-y-4">
                    <p className="meeting-sheet__section-label">Descripción</p>
                    <div className="meeting-sheet__group">
                      <div className="meeting-sheet__cell">
                        <p className="meeting-sheet__cell-value meeting-sheet__cell-value--body whitespace-pre-wrap">
                          {selectedTicket.description || 'Sin descripción detallada.'}
                        </p>
                      </div>
                    </div>

                    <p className="meeting-sheet__section-label">Información</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <DetailItem
                        label="Responsable"
                        value={selectedTicket.assigned_name || 'Sin asignar (en cola del depto.)'}
                        muted={!selectedTicket.assigned_name}
                      />
                      <DetailItem label="Departamento" value={selectedTicket.category || '—'} />
                      {selectedTicket.due_date ? (
                        <DetailItem
                          label="Fecha límite"
                          value={new Date(selectedTicket.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                          accent={isOverdue ? 'red' : null}
                        />
                      ) : null}
                      <DetailItem
                        label="Creado"
                        value={
                          selectedTicket.created_at
                            ? new Date(selectedTicket.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
                            : '—'
                        }
                      />
                    </div>

                    {canDelegarTarea(user, selectedTicket) && (
                      <>
                        <p className="meeting-sheet__section-label">Coordinador</p>
                        <div className="meeting-sheet__group">
                          <div className="meeting-sheet__cell meeting-sheet__cell--field">
                            <label className="sr-only" htmlFor="delegar-responsable">Coordinador del ticket</label>
                            <select
                              id="delegar-responsable"
                              value={selectedTicket.assigned_to != null && selectedTicket.assigned_to !== '' ? String(selectedTicket.assigned_to) : ''}
                              onChange={(e) => saveTicketAssignment(e.target.value)}
                              className="meeting-sheet__select"
                            >
                              <option value="">Sin asignar (cola del departamento)</option>
                              {deptMembersForTicket(selectedTicket).map((u) => (
                                <option key={u.id} value={String(u.id)}>
                                  {u.name} {u.apellido || ''}{u.puesto ? ` · ${u.puesto}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    <TicketPanelSection
                      title="Tareas operativas"
                      subtitle="Tramos de ejecución vinculados a este requerimiento"
                      count={ticketTasks.length}
                    >
                      {canDelegarTarea(user, selectedTicket) && (
                        <div className="meeting-sheet__task-form mb-3 space-y-3">
                          <p className="text-[13px] font-semibold text-slate-700">Asignar tramo</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-1.5 sm:col-span-2">
                              <label className="meeting-sheet__cell-label">Responsable</label>
                              <select
                                value={newTaskForm.assigned_to}
                                onChange={(e) => setNewTaskForm((f) => ({ ...f, assigned_to: e.target.value }))}
                                className="meeting-sheet__select"
                              >
                                <option value="">Selecciona quién ejecuta…</option>
                                {deptMembersForTicket(selectedTicket).map((u) => (
                                  <option key={u.id} value={String(u.id)}>
                                    {u.name} {u.apellido || ''}{u.puesto ? ` · ${u.puesto}` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="meeting-sheet__cell-label">Inicio</label>
                              <input
                                type="date"
                                value={newTaskForm.start_date}
                                onChange={(e) => setNewTaskForm((f) => ({ ...f, start_date: e.target.value }))}
                                className="meeting-sheet__input tabular-nums"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="meeting-sheet__cell-label">Fin</label>
                              <input
                                type="date"
                                value={newTaskForm.end_date}
                                onChange={(e) => setNewTaskForm((f) => ({ ...f, end_date: e.target.value }))}
                                className="meeting-sheet__input tabular-nums"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateTicketTask}
                            disabled={creatingTicketTask}
                            className="tasks-module__action-primary gap-1.5 px-3 py-2.5 text-[13px] w-full sm:w-auto sm:px-6 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <AssignTaskIcon />
                            {creatingTicketTask ? 'Asignando…' : 'Asignar tarea'}
                          </button>
                        </div>
                      )}

                      <div className="space-y-2">
                        {ticketTasks.length === 0 ? (
                          <p className="meeting-sheet__cell meeting-sheet__cell--empty rounded-[14px] bg-white">
                            Aún no hay tareas para este requerimiento.
                          </p>
                        ) : (
                          ticketTasks.map((task) => {
                            const assignee = [task.assignee_name, task.assignee_apellido].filter(Boolean).join(' ') || '—';
                            const canManage = canDelegarTarea(user, selectedTicket);
                            const isAssignee = Number(task.assigned_to) === Number(user?.id);
                            const canStatus = canManage || isAssignee;
                            return (
                              <div key={task.id} className="meeting-sheet__task-card">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="flex min-w-0 gap-3">
                                    <UserAvatar
                                      name={task.assignee_name}
                                      apellido={task.assignee_apellido}
                                      avatarUrl={task.assignee_avatar_url}
                                      size="sm"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-[15px] font-semibold text-slate-900">{assignee}</p>
                                      {(task.assignee_departamento || selectedTicket?.category) && (
                                        <p className="mt-0.5 text-[13px] text-slate-500">
                                          {task.assignee_departamento || selectedTicket.category}
                                        </p>
                                      )}
                                      <p className="mt-1.5 text-[14px] font-semibold tabular-nums text-slate-800">
                                        {formatTaskDate(task.start_date)} → {formatTaskDate(task.end_date)}
                                      </p>
                                      {task.description ? (
                                        <p className="mt-2 whitespace-pre-wrap text-[13px] text-slate-600">{task.description}</p>
                                      ) : (
                                        <p className="mt-1 text-[12px] text-slate-400">Etiqueta en cronograma: {task.title}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {canStatus ? (
                                      <select
                                        value={task.status}
                                        onChange={(e) => handleTicketTaskStatus(task.id, e.target.value)}
                                        className="meeting-sheet__select w-auto py-1.5 text-[13px]"
                                      >
                                        <option value="pending">Pendiente</option>
                                        <option value="in_progress">En progreso</option>
                                        <option value="done">Hecha</option>
                                        <option value="cancelled">Cancelada</option>
                                      </select>
                                    ) : (
                                      <span className="text-[13px] font-semibold text-slate-500">{task.status}</span>
                                    )}
                                    {canDeleteTask && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTicketTask(task.id)}
                                        className="meeting-sheet__file-remove"
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
                    </TicketPanelSection>
                  </div>
                  )
                )}

                {/* COMENTARIOS + ARCHIVOS */}
                {activeTab === 'collaboration' && (
                  <div className="space-y-4">
                      <TicketPanelSection
                        title="Comentarios"
                        subtitle="Conversación del equipo sobre este ticket"
                        count={selectedTicket.comments?.length || 0}
                      >
                        {(!selectedTicket.comments || selectedTicket.comments.length === 0) ? (
                          <p className="meeting-sheet__cell meeting-sheet__cell--empty rounded-[14px] bg-white">
                            Sin comentarios todavía. Escribe el primero abajo.
                          </p>
                        ) : (
                          <div className="meeting-sheet__comments-scroll">
                            <div className="meeting-sheet__comments-list">
                            {selectedTicket.comments.map((c) => {
                              const mine = c.user_id === user?.id;
                              return (
                                <div key={c.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${mine ? 'bg-gold text-navy-950' : 'bg-slate-100 text-slate-700'}`}>
                                    {(c.user_name || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className={`flex max-w-[85%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                                    <span className="mb-0.5 px-1 text-[12px] font-semibold text-slate-600">{c.user_name}</span>
                                    <div className={`meeting-sheet__bubble ${mine ? 'meeting-sheet__bubble--mine' : 'meeting-sheet__bubble--other'}`}>
                                      <p className="whitespace-pre-wrap">{c.content}</p>
                                    </div>
                                    <span className="mt-1 px-1 text-[11px] text-slate-400">
                                      {new Date(c.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} · {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            </div>
                          </div>
                        )}
                      </TicketPanelSection>

                      <TicketPanelSection
                        title="Archivos y evidencia"
                        subtitle="Fotos, documentos y material de soporte"
                        count={selectedTicket.attachments?.length || 0}
                      >
                        <div className="meeting-sheet__attachment-grid">
                          {selectedTicket.attachments?.map((f) => {
                            const url = fileUrl(f);
                            const isImg = f.mimetype?.startsWith('image/');
                            return (
                              <div key={f.id} className="group relative meeting-sheet__attachment-tile">
                                {isImg ? (
                                  <button
                                    type="button"
                                    onClick={() => setLightboxUrl(url)}
                                    className="block h-full w-full cursor-zoom-in"
                                  >
                                    <img src={url} alt={f.filename} className="h-full w-full object-cover" />
                                  </button>
                                ) : (
                                  <a href={url} download={f.filename} target="_blank" rel="noreferrer" className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 p-3 transition-colors hover:bg-slate-100">
                                    <svg className="h-9 w-9 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                    <span className="line-clamp-2 break-all px-1 text-center text-[11px] font-semibold text-slate-700">{f.filename}</span>
                                  </a>
                                )}
                                <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  {isImg && (
                                    <a
                                      href={url}
                                      download={f.filename}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex h-7 w-7 items-center justify-center rounded-md bg-navy-950/85 text-gold transition hover:bg-navy-950"
                                      title="Descargar"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                      </svg>
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(f.id, f.filename); }}
                                    className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/90 text-white transition hover:bg-red-600"
                                    title="Eliminar"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          <label className={`meeting-sheet__attachment-add ${isUploading ? 'cursor-wait opacity-50' : ''}`}>
                            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                            {isUploading ? (
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                            ) : (
                              <>
                                <svg className="mb-1 h-7 w-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                <span className="px-2 text-center text-[12px] font-semibold text-slate-500">Subir evidencia</span>
                              </>
                            )}
                          </label>
                        </div>
                        {(!selectedTicket.attachments || selectedTicket.attachments.length === 0) && (
                          <p className="meeting-sheet__meta mt-2 text-center">Sin archivos aún — usa el recuadro para subir.</p>
                        )}
                      </TicketPanelSection>
                  </div>
                )}

                {activeTab === 'log' && (
                  <div>
                    {(!selectedTicket.history || selectedTicket.history.length === 0) ? (
                      <p className="meeting-sheet__cell meeting-sheet__cell--empty rounded-[14px] bg-white">
                        Sin actividad registrada.
                      </p>
                    ) : (
                      <div className="meeting-sheet__timeline">
                        {selectedTicket.history.map((h) => (
                          <div key={h.id} className="meeting-sheet__timeline-item">
                            <span className="meeting-sheet__timeline-dot" aria-hidden />
                            <div className="meeting-sheet__detail-card flex-1">
                              <p className="text-[14px] font-semibold leading-snug text-slate-900">{h.details}</p>
                              <p className="mt-1 text-[12px] text-slate-500">
                                {h.user_name} · {new Date(h.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} · {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {activeTab === 'collaboration' && (
                <div className="meeting-sheet__footer shrink-0">
                  <p className="mb-2 px-1 text-[13px] font-semibold text-slate-500">Nuevo comentario</p>
                  <div className="meeting-sheet__comment-bar">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                      placeholder="Escribe un comentario…"
                      className="meeting-sheet__comment-input"
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="meeting-sheet__comment-send"
                      aria-label="Enviar comentario"
                    >
                      <svg className="ml-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
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

function TicketPanelSection({ title, subtitle, count, children }) {
  return (
    <section>
      <p className="meeting-sheet__section-label">
        {title}{count > 0 ? ` · ${count}` : ''}
      </p>
      {subtitle ? <p className="mb-2 px-1 text-[12px] text-slate-500">{subtitle}</p> : null}
      {children}
    </section>
  );
}

function DetailItem({ label, value, accent, muted }) {
  const valueClass = accent === 'red' ? 'text-red-600' : muted ? 'text-slate-400 italic font-normal' : '';
  return (
    <div className="meeting-sheet__detail-card">
      <p className="meeting-sheet__cell-label">{label}</p>
      <p className={`meeting-sheet__cell-value mt-0.5 truncate ${valueClass}`}>{value}</p>
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
