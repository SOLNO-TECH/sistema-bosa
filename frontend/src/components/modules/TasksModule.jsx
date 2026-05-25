import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import UserAvatar from '../UserAvatar';
import StatSummaryPanel from '../StatSummaryPanel';

const DEPARTAMENTOS = [
  'Obra Civil', 'Proyectos', 'Diseño', 'Acabados', 'Eléctricos',
  'HVAC', 'Hidrosanitarios', 'Sistemas', 'Contabilidad', 'Finanzas',
  'Recursos Humanos', 'Jurídico', 'Compras', 'Costos', 'Operaciones',
  'Mantenimiento', 'Almacén', 'Marketing', 'Restaurantes', 'Berry Yum',
];

const TASK_STATUS = {
  pending: { label: 'Pendiente', color: '#94a3b8', accent: '#64748b' },
  in_progress: { label: 'En progreso', color: '#CBAC80', accent: '#A47D3B' },
  done: { label: 'Hecha', color: '#10b981', accent: '#059669' },
  cancelled: { label: 'Cancelada', color: '#64748b', accent: '#475569' },
};

const STAT_SUMMARY = [
  {
    key: 'total',
    label: 'Visibles',
    subtitle: 'En el cronograma actual',
    color: '#0A1930',
    accent: '#CBAC80',
    bar: '#CBAC80',
    icon: 'visible',
  },
  {
    key: 'pending',
    label: TASK_STATUS.pending.label,
    subtitle: 'Por iniciar',
    color: '#475569',
    accent: '#64748b',
    bar: '#94a3b8',
    icon: 'pending',
  },
  {
    key: 'in_progress',
    label: TASK_STATUS.in_progress.label,
    subtitle: 'En ejecución',
    color: '#7A5C2E',
    accent: '#A47D3B',
    bar: '#CBAC80',
    icon: 'progress',
  },
  {
    key: 'done',
    label: TASK_STATUS.done.label,
    subtitle: 'Completadas',
    color: '#047857',
    accent: '#059669',
    bar: '#10b981',
    icon: 'done',
  },
  {
    key: 'cancelled',
    label: TASK_STATUS.cancelled.label,
    subtitle: 'No aplican',
    color: '#475569',
    accent: '#64748b',
    bar: '#94a3b8',
    icon: 'cancelled',
  },
];

const TICKET_STATUS = {
  open: { label: 'Ticket pendiente', color: '#94a3b8' },
  in_progress: { label: 'Ticket en progreso', color: '#CBAC80' },
  resolved: { label: 'Ticket en revisión', color: '#3b82f6' },
  closed: { label: 'Ticket cerrado', color: '#10b981' },
};

function taskDept(row) {
  return (row?.ticket_category || row?.department || '').trim();
}

function hasTicket(row) {
  return row?.ticket_id != null && row.ticket_id !== '';
}

function canManageTaskRow(authUser, row) {
  if (!authUser || !row) return false;
  if (authUser.role === 'superadmin' || authUser.role === 'administrator') return true;
  if (authUser.role !== 'manager') return false;
  const cat = taskDept(row);
  const dept = (authUser.departamento || '').trim();
  return Boolean(cat && dept === cat);
}

function canCreateStandaloneTask(authUser) {
  if (!authUser) return false;
  return authUser.role === 'superadmin' || authUser.role === 'administrator' || authUser.role === 'manager';
}

function canParticipateOnTask(authUser, row) {
  if (!authUser || !row) return false;
  if (authUser.role === 'superadmin' || authUser.role === 'administrator') return true;
  const cat = taskDept(row);
  const dept = (authUser.departamento || '').trim();
  if (cat && dept === cat) return true;
  if (Number(row.assigned_to) === Number(authUser.id)) return true;
  if (Number(row.created_by) === Number(authUser.id)) return true;
  return false;
}

function canDeleteTaskAttachment(authUser, task, file) {
  if (!authUser || !task) return false;
  if (file?.can_delete === true) return true;
  if (authUser.role === 'superadmin' || authUser.role === 'administrator') return true;
  if (Number(task.assigned_to) === Number(authUser.id)) return true;
  if (Number(task.created_by) === Number(authUser.id)) return true;
  if (file && Number(file.uploaded_by) === Number(authUser.id)) return true;
  return canManageTaskRow(authUser, task);
}

function taskFileUrl(f) {
  if (!f?.path) return '';
  if (f.path.startsWith('/api/') || f.path.startsWith('http')) return f.path;
  const parts = f.path.replace(/\\/g, '/').split('/');
  return `/api/uploads/${parts[parts.length - 1]}`;
}

function freshStandaloneTaskForm(user) {
  const t = new Date();
  const e = new Date(t);
  e.setDate(e.getDate() + 3);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const isAdmin = user?.role === 'superadmin' || user?.role === 'administrator';
  return {
    title: '',
    description: '',
    assigned_to: '',
    start_date: fmt(t),
    end_date: fmt(e),
    department: isAdmin ? '' : (user?.departamento || ''),
  };
}

function parseYMD(s) {
  if (!s) return null;
  const d = new Date(String(s).includes('T') ? s : `${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function taskDurationLabel(start_date, end_date) {
  const s = parseYMD(start_date);
  const e = parseYMD(end_date);
  if (!s || !e) return '';
  const days = Math.max(1, Math.round((e - s) / 86400000) + 1);
  return days === 1 ? '1 día' : `${days} días`;
}

function DeptBadge({ label, title }) {
  if (!label) return null;
  return (
    <span
      title={title || label}
      className="inline-flex max-w-full items-center rounded-md border border-navy-200/80 bg-navy-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-navy-800 truncate"
    >
      {label}
    </span>
  );
}

function AssigneeBlock({ task, size = 'sm' }) {
  const name = [task.assignee_name, task.assignee_apellido].filter(Boolean).join(' ') || 'Sin asignar';
  const dept = (task.assignee_departamento || taskDept(task) || '').trim();
  const puesto = (task.assignee_puesto || '').trim();
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <UserAvatar
        name={task.assignee_name}
        apellido={task.assignee_apellido}
        avatarUrl={task.assignee_avatar_url}
        size={size}
      />
      <div className="min-w-0">
        <p className="text-xs font-bold text-navy-950 truncate">{name}</p>
        {puesto ? <p className="text-[10px] text-navy-500 truncate">{puesto}</p> : null}
        {dept ? (
          <p className="text-[9px] text-navy-400 truncate mt-0.5">Depto. {dept}</p>
        ) : null}
      </div>
    </div>
  );
}

function TaskMetaChips({ task }) {
  const dept = taskDept(task);
  const tSt = hasTicket(task) ? (TICKET_STATUS[task.ticket_status] || null) : null;
  const duration = taskDurationLabel(task.start_date, task.end_date);
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {dept ? <DeptBadge label={dept} title={`Departamento del ticket: ${dept}`} /> : null}
      {tSt ? (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
          style={{ background: tSt.color + '18', color: tSt.color }}
        >
          {tSt.label}
        </span>
      ) : null}
      {duration ? (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 tabular-nums">
          {duration}
        </span>
      ) : null}
    </div>
  );
}

const BAR_COLORS = ['#1e3a5f', '#2d5f8f', '#CBAC80', '#3b82f6', '#0d9488', '#7c3aed'];

const MOBILE_MQ = '(max-width: 767px)';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function formatDateShort(ymd) {
  const d = parseYMD(ymd);
  return d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ymd;
}

/** Icono SVG para tareas sin ticket (sustituye ✦). */
function StandaloneTaskIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function StandaloneTaskBadge({ size = 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'xs' ? 'h-7 w-7 rounded-md' : 'h-9 w-9 rounded-lg';
  const icon = size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';
  return (
    <span
      className={`shrink-0 flex items-center justify-center bg-navy-950 text-gold shadow-sm ring-1 ring-gold/35 ${box}`}
      title="Tarea independiente"
    >
      <StandaloneTaskIcon className={icon} />
    </span>
  );
}

function StandaloneTaskOrigin({ task, compact = false, showDescription = true }) {
  const dept = taskDept(task);
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border border-gold/35 bg-gradient-to-br from-gold/[0.12] via-white to-navy-950/[0.03] shadow-sm ${
        compact ? 'p-2.5' : 'p-3'
      }`}
    >
      <StandaloneTaskBadge size={compact ? 'sm' : 'md'} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={`font-semibold text-navy-950 ${compact ? 'text-[10px]' : 'text-xs'}`}>Tarea independiente</p>
          <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-navy-950 text-gold">
            Sin ticket
          </span>
        </div>
        {dept ? (
          <p className={`text-navy-500 mt-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            Depto. <span className="font-bold text-navy-700">{dept}</span>
          </p>
        ) : null}
        {showDescription && task.description ? (
          <p className={`text-navy-600 mt-1 line-clamp-2 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{task.description}</p>
        ) : null}
      </div>
    </div>
  );
}

function StandaloneTicketCell() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-navy-950 bg-gradient-to-r from-gold/20 to-gold/5 px-2 py-1.5 rounded-lg border border-gold/35">
      <StandaloneTaskBadge size="xs" />
      <span className="leading-none">Independiente</span>
    </span>
  );
}

function TaskOriginBlock({ task, onOpenTicket, compact = false }) {
  const dept = taskDept(task);
  const linked = hasTicket(task);
  if (linked) {
    return (
      <div className={`flex items-start gap-2 rounded-lg border border-gray-100 bg-white ${compact ? 'p-2.5 shadow-sm' : 'p-3'}`}>
        <span className={`shrink-0 flex items-center justify-center rounded-md bg-navy-950 font-black text-gold tabular-nums ${compact ? 'h-9 w-9 text-[10px]' : 'h-8 w-8 text-[10px] rounded-lg'}`}>
          #{task.ticket_id}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-navy-800 line-clamp-2 ${compact ? 'text-[10px]' : 'text-xs'}`}>{task.ticket_title || 'Sin título'}</p>
          {dept ? (
            <p className={`text-navy-500 mt-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
              Depto. <span className="font-bold text-navy-700">{dept}</span>
            </p>
          ) : null}
          {onOpenTicket && compact && (
            <button
              type="button"
              onClick={() => onOpenTicket(task.ticket_id)}
              className="mt-1.5 text-[9px] font-bold uppercase tracking-wide text-navy-950 bg-gold/25 hover:bg-gold/40 px-2 py-1 rounded border border-gold/40"
            >
              Abrir ticket #{task.ticket_id}
            </button>
          )}
        </div>
      </div>
    );
  }
  return <StandaloneTaskOrigin task={task} compact={compact} />;
}

function TaskMobileCard({
  task,
  canManage,
  canStatus,
  onOpenTicket,
  onOpenDetail,
  onStatusChange,
  onDelete,
}) {
  const st = TASK_STATUS[task.status] || TASK_STATUS.pending;
  const dept = taskDept(task);
  const duration = taskDurationLabel(task.start_date, task.end_date);
  const linked = hasTicket(task);

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-navy-950 leading-snug flex-1 min-w-0">{task.title}</h3>
        <span
          className="shrink-0 text-[9px] font-bold px-2 py-0.5 rounded uppercase"
          style={{ background: st.color + '22', color: st.color }}
        >
          {st.label}
        </span>
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 space-y-2">
        {linked ? (
          <>
            <div className="flex items-start gap-2">
              <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-navy-950 text-[10px] font-black text-gold">
                #{task.ticket_id}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-navy-800 line-clamp-2">{task.ticket_title || 'Sin título'}</p>
                {dept ? (
                  <p className="text-[10px] text-navy-500 mt-1">
                    Depto. <span className="font-bold text-navy-700">{dept}</span>
                  </p>
                ) : null}
              </div>
            </div>
            {TICKET_STATUS[task.ticket_status] ? (
              <p className="text-[9px] font-bold uppercase" style={{ color: TICKET_STATUS[task.ticket_status].color }}>
                {TICKET_STATUS[task.ticket_status].label}
              </p>
            ) : null}
          </>
        ) : (
          <StandaloneTaskOrigin task={task} compact showDescription />
        )}
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2.5">
        <svg className="h-5 w-5 shrink-0 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-bold text-navy-950 tabular-nums">
            {formatDateShort(task.start_date)} → {formatDateShort(task.end_date)}
          </p>
          {duration ? <p className="text-[10px] text-navy-600 mt-0.5">{duration} de trabajo</p> : null}
        </div>
      </div>

      <div className="pt-1 border-t border-gray-100">
        <p className="text-[9px] font-bold uppercase tracking-widest text-navy-500 mb-2">Responsable</p>
        <AssigneeBlock task={task} size="md" />
      </div>

      {onOpenDetail && (
        <button
          type="button"
          onClick={() => onOpenDetail(task)}
          className="w-full py-3 rounded-xl border border-gold/40 bg-gold/15 text-xs font-bold uppercase tracking-wide text-navy-950 shadow-sm active:scale-[0.99] transition-transform"
        >
          Evidencia y comentarios
        </button>
      )}

      {onOpenTicket && linked && (
        <button
          type="button"
          onClick={() => onOpenTicket(task.ticket_id)}
          className="w-full py-3 rounded-xl border border-navy-900/10 bg-navy-950 text-xs font-bold uppercase tracking-wide text-gold shadow-sm active:scale-[0.99] transition-transform"
        >
          Abrir ticket #{task.ticket_id}
        </button>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {canStatus && (
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-navy-800 font-medium"
            aria-label="Cambiar estado"
          >
            {Object.entries(TASK_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="text-xs font-bold text-red-600 py-2.5 px-3 rounded-xl border border-red-100 bg-red-50"
          >
            Eliminar
          </button>
        )}
      </div>
    </article>
  );
}

function getInitialView() {
  if (typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches) return 'cards';
  return 'gantt';
}

function TaskDetailModal({ taskId, onClose, onOpenTicket, onRefreshList }) {
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const fetchDetail = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/ticket-tasks/${taskId}`);
      setTask(data);
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo cargar la tarea');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [taskId]);

  const canParticipate = task ? canParticipateOnTask(user, task) : false;

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;
    try {
      await axios.post(`/api/ticket-tasks/${task.id}/comments`, { content: newComment.trim() });
      setNewComment('');
      await fetchDetail();
      onRefreshList?.();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo enviar el comentario');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    const fd = new FormData();
    fd.append('file', file);
    setIsUploading(true);
    try {
      await axios.post(`/api/ticket-tasks/${task.id}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchDetail();
      onRefreshList?.();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo subir el archivo');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId, filename) => {
    if (!task || !window.confirm(`¿Eliminar "${filename}"?`)) return;
    try {
      await axios.delete(`/api/ticket-tasks/${task.id}/attachments/${attachmentId}`);
      await fetchDetail();
      onRefreshList?.();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo eliminar');
    }
  };

  const st = task ? (TASK_STATUS[task.status] || TASK_STATUS.pending) : null;
  const linked = task && hasTicket(task);

  return createPortal(
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="surface-light w-full max-w-2xl max-h-[min(92vh,720px)] rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-navy-950 px-5 py-4 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gold">Tarea operativa</p>
            <h3 className="text-lg font-display text-white truncate">{task?.title || '…'}</h3>
            {st && (
              <span className="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: st.color + '33', color: st.color }}>
                {st.label}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 w-9 h-9 rounded-lg bg-white/10 text-white hover:bg-white/20 text-xl leading-none" aria-label="Cerrar">
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : task ? (
          <>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/80 space-y-2 shrink-0">
              <TaskOriginBlock task={task} onOpenTicket={linked && onOpenTicket ? () => { onClose(); onOpenTicket(task.ticket_id); } : undefined} compact />
              <div className="flex items-center gap-2 text-[10px] text-navy-600">
                <AssigneeBlock task={task} size="xs" />
                <span className="tabular-nums">
                  {formatDateShort(task.start_date)} → {formatDateShort(task.end_date)}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-8">
              <section>
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-navy-950">Archivos y evidencia</h4>
                    <p className="text-[10px] text-navy-500 mt-0.5">Reportes, fotos y documentos de la tarea</p>
                  </div>
                  <span className="text-[10px] font-bold text-navy-500 tabular-nums">{task.attachments?.length || 0}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {task.attachments?.map((f) => {
                    const url = taskFileUrl(f);
                    const isImg = f.mimetype?.startsWith('image/');
                    const canDeleteFile = canDeleteTaskAttachment(user, task, f);
                    return (
                      <div key={f.id} className="group relative border border-gray-200 rounded-xl overflow-hidden aspect-square bg-white shadow-sm">
                        {isImg ? (
                          <button type="button" onClick={() => setLightboxUrl(url)} className="w-full h-full block cursor-zoom-in">
                            <img src={url} alt={f.filename} className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <a href={url} download={f.filename} target="_blank" rel="noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                            <svg className="w-10 h-10 text-navy-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <span className="text-[10px] font-bold text-navy-700 text-center break-all line-clamp-2 px-1">{f.filename}</span>
                          </a>
                        )}
                        {canDeleteFile && (
                          <div className="absolute top-1.5 right-1.5 flex gap-1">
                            {!isImg && (
                              <a
                                href={url}
                                download={f.filename}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="w-7 h-7 rounded-md bg-navy-950/85 hover:bg-navy-950 text-gold flex items-center justify-center backdrop-blur-sm"
                                title="Descargar"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAttachment(f.id, f.filename);
                              }}
                              className="w-7 h-7 rounded-md bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md"
                              title="Eliminar documento"
                              aria-label={`Eliminar ${f.filename}`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        )}
                        {isImg && canDeleteFile && (
                          <a
                            href={url}
                            download={f.filename}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-1.5 left-1.5 w-7 h-7 rounded-md bg-navy-950/85 hover:bg-navy-950 text-gold flex items-center justify-center backdrop-blur-sm"
                            title="Descargar"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                          </a>
                        )}
                      </div>
                    );
                  })}
                  {canParticipate && (
                    <label className={`border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center aspect-square cursor-pointer hover:border-gold hover:bg-gold/5 bg-white/60 ${isUploading ? 'opacity-50 cursor-wait' : ''}`}>
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                      {isUploading ? (
                        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center px-2">Subir evidencia</span>
                      )}
                    </label>
                  )}
                </div>
                {(!task.attachments || task.attachments.length === 0) && !canParticipate && (
                  <p className="text-center text-[10px] text-navy-500 mt-3">Sin archivos en esta tarea.</p>
                )}
                {(!task.attachments || task.attachments.length === 0) && canParticipate && (
                  <p className="text-center text-[10px] text-navy-500 mt-3">Sin archivos aún — usa el recuadro punteado para subir.</p>
                )}
              </section>

              <section>
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-navy-950">Comentarios</h4>
                    <p className="text-[10px] text-navy-500 mt-0.5">Notas y avances del responsable</p>
                  </div>
                  <span className="text-[10px] font-bold text-navy-500 tabular-nums">{task.comments?.length || 0}</span>
                </div>
                {(!task.comments || task.comments.length === 0) ? (
                  <p className="text-center text-[10px] text-navy-500 py-6 rounded-xl border border-dashed border-gray-200">Sin comentarios todavía</p>
                ) : (
                  <div className="space-y-4 rounded-xl bg-white/80 border border-gray-200 p-4">
                    {task.comments.map((c) => {
                      const mine = c.user_id === user?.id;
                      return (
                        <div key={c.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${mine ? 'bg-gold text-navy-950' : 'bg-navy-100 text-navy-700'}`}>
                            {(c.user_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className={`flex flex-col max-w-[85%] ${mine ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] font-bold text-navy-700 mb-0.5 px-1">{c.user_name}</span>
                            <div className={`px-3.5 py-2.5 rounded-2xl text-sm shadow-sm ${mine ? 'bg-navy-950 text-white rounded-tr-sm' : 'bg-white text-navy-900 border border-gray-200 rounded-tl-sm'}`}>
                              <p className="whitespace-pre-wrap leading-snug">{c.content}</p>
                            </div>
                            <span className="text-[10px] text-navy-500 mt-1 px-1">
                              {new Date(c.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} ·{' '}
                              {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {canParticipate ? (
              <div className="p-4 bg-white border-t border-gray-200 shrink-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-navy-500 mb-2">Nuevo comentario</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Escribe un comentario o nota de avance…"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-navy-900 focus:outline-none focus:border-gold"
                  />
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="w-10 h-10 bg-gold text-navy-950 rounded-full flex items-center justify-center disabled:opacity-50 font-bold"
                  >
                    →
                  </button>
                </div>
              </div>
            ) : (
              <p className="px-5 py-3 text-[10px] text-navy-500 border-t border-gray-100 bg-gray-50 shrink-0">
                Solo lectura: no tienes permiso para comentar o subir en esta tarea.
              </p>
            )}
          </>
        ) : null}
      </div>

      {lightboxUrl && (
        <div className="fixed inset-0 z-[130] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>,
    document.body,
  );
}

export default function TasksModule({ onOpenTicket } = {}) {
  const { user } = useAuth();
  const isMobile = useMediaQuery(MOBILE_MQ);
  const [tasks, setTasks] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(getInitialView);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMine, setFilterMine] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(() => freshStandaloneTaskForm(null));
  const [creating, setCreating] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState(null);

  const openTaskDetail = (task) => {
    if (task?.id) setDetailTaskId(task.id);
  };

  const canCreate = canCreateStandaloneTask(user);
  const isAdmin = user?.role === 'superadmin' || user?.role === 'administrator';

  const effectiveView = isMobile ? 'cards' : view;

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/ticket-tasks');
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    axios.get('/api/users')
      .then((r) => setDbUsers(Array.isArray(r.data.users) ? r.data.users : (Array.isArray(r.data) ? r.data : [])))
      .catch(() => setDbUsers([]));
  }, []);

  const deptMembers = useMemo(() => {
    const dept = isAdmin ? (createForm.department || '').trim() : (user?.departamento || '').trim();
    if (!dept) return [];
    return dbUsers.filter((u) => u.is_active !== 0 && u.is_active !== false && (u.departamento || '').trim() === dept);
  }, [dbUsers, createForm.department, isAdmin, user?.departamento]);

  const departments = useMemo(() => {
    const set = new Set();
    tasks.forEach((t) => {
      const d = taskDept(t);
      if (d) set.add(d);
    });
    return [...set].sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterDept && taskDept(t) !== filterDept) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterMine && Number(t.assigned_to) !== Number(user?.id)) return false;
      if (!q) return true;
      const hay = [
        t.title,
        t.description,
        t.ticket_title,
        t.assignee_name,
        t.assignee_apellido,
        taskDept(t),
        hasTicket(t) ? String(t.ticket_id) : 'independiente',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, filterDept, filterStatus, filterMine, search, user?.id]);

  const stats = useMemo(() => {
    const byStatus = { pending: 0, in_progress: 0, done: 0, cancelled: 0 };
    filteredTasks.forEach((t) => {
      if (byStatus[t.status] != null) byStatus[t.status] += 1;
    });
    return { total: filteredTasks.length, ...byStatus };
  }, [filteredTasks]);

  const taskStatItems = useMemo(
    () => STAT_SUMMARY.map((cfg) => ({ config: cfg, value: stats[cfg.key] ?? 0 })),
    [stats]
  );

  const { minTime, maxTime } = useMemo(() => {
    if (!filteredTasks.length) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(end.getDate() + 14);
      return { minTime: now.getTime(), maxTime: end.getTime() };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const t of filteredTasks) {
      const s = parseYMD(t.start_date);
      const e = parseYMD(t.end_date);
      if (s) min = Math.min(min, s.getTime());
      if (e) max = Math.max(max, e.getTime());
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return { minTime: now.getTime(), maxTime: now.getTime() + 14 * 86400000 };
    }
    const pad = 86400000 * 2;
    return { minTime: min - pad, maxTime: max + pad };
  }, [filteredTasks]);

  const daySpan = useMemo(() => Math.max(1, Math.ceil((maxTime - minTime) / 86400000)), [minTime, maxTime]);

  const barLayout = (start_date, end_date) => {
    const s = parseYMD(start_date);
    const e = parseYMD(end_date);
    if (!s || !e) return { left: 0, width: 2 };
    const total = maxTime - minTime;
    if (total <= 0) return { left: 0, width: 100 };
    const left = ((s.getTime() - minTime) / total) * 100;
    const width = Math.max(((e.getTime() - s.getTime() + 86400000) / total) * 100, 0.35);
    return { left: Math.max(0, left), width: Math.min(100 - left, width) };
  };

  const tickLabels = useMemo(() => {
    const labels = [];
    const step = Math.max(1, Math.ceil(daySpan / 8));
    for (let i = 0; i <= daySpan; i += step) {
      const t = minTime + i * 86400000;
      labels.push({
        pos: ((t - minTime) / (maxTime - minTime)) * 100,
        text: new Date(t).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
      });
    }
    return labels;
  }, [minTime, maxTime, daySpan]);

  const updateStatus = async (taskId, status) => {
    try {
      await axios.patch(`/api/ticket-tasks/${taskId}`, { status });
      await fetchTasks();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo actualizar el estado');
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('¿Eliminar esta tarea operativa?')) return;
    try {
      await axios.delete(`/api/ticket-tasks/${taskId}`);
      await fetchTasks();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo eliminar');
    }
  };

  const openCreateModal = () => {
    setCreateForm(freshStandaloneTaskForm(user));
    setCreateOpen(true);
  };

  const submitCreateTask = async () => {
    if (!createForm.title?.trim()) {
      alert('Indica el título de la tarea');
      return;
    }
    if (!createForm.assigned_to) {
      alert('Selecciona responsable');
      return;
    }
    if (isAdmin && !createForm.department?.trim()) {
      alert('Selecciona departamento');
      return;
    }
    setCreating(true);
    try {
      await axios.post('/api/ticket-tasks', {
        title: createForm.title.trim(),
        description: createForm.description?.trim() || '',
        assigned_to: Number(createForm.assigned_to),
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        department: createForm.department?.trim() || undefined,
      });
      setCreateOpen(false);
      await fetchTasks();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo crear la tarea');
    } finally {
      setCreating(false);
    }
  };

  const rangeLabel = `${new Date(minTime).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} — ${new Date(maxTime).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const renderStatusControls = (t, canStatus, canManage) => {
    const st = TASK_STATUS[t.status] || TASK_STATUS.pending;
    const canEvidence = canParticipateOnTask(user, t);
    return (
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {canEvidence && (
          <button
            type="button"
            onClick={() => openTaskDetail(t)}
            className="text-[10px] font-bold uppercase tracking-wide text-navy-950 bg-gold/20 hover:bg-gold/35 px-2 py-1 rounded border border-gold/40"
          >
            Evidencia
          </button>
        )}
        <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: st.color + '22', color: st.color }}>
          {st.label}
        </span>
        {canStatus && (
          <select
            value={t.status}
            onChange={(e) => updateStatus(t.id, e.target.value)}
            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 bg-white text-navy-800"
            aria-label="Cambiar estado de la tarea"
          >
            {Object.entries(TASK_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        {canManage && (
          <button type="button" onClick={() => deleteTask(t.id)} className="text-[10px] font-bold text-red-600 hover:underline">
            Eliminar
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="surface-light h-full flex flex-col animate-fade-in space-y-5 text-navy-950">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-medium text-navy-950 tracking-tight">Tareas operativas</h2>
          <p className="text-sm text-navy-600 mt-1 max-w-2xl">
            {isMobile
              ? 'Vista en tarjetas: más clara en el celular. En computadora puedes usar el cronograma Gantt.'
              : 'Cronograma de trabajo por ticket o tareas independientes: departamento, responsable y fechas.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-gold text-navy-950 hover:bg-gold/90 shadow-sm"
            >
              Nueva tarea
            </button>
          )}
          {isMobile ? (
            <span className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-navy-950 text-gold">
              Tarjetas
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setView('gantt')}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition ${view === 'gantt' ? 'bg-navy-950 text-gold' : 'bg-white border border-gray-200 text-navy-700 hover:border-gold/40'}`}
              >
                Cronograma
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition ${view === 'list' ? 'bg-navy-950 text-gold' : 'bg-white border border-gray-200 text-navy-700 hover:border-gold/40'}`}
              >
                Lista
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => fetchTasks()}
            className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white border border-gray-200 text-navy-700 hover:border-gold/40"
          >
            Actualizar
          </button>
        </div>
      </div>

      <StatSummaryPanel
        title="Resumen operativo"
        subtitle="Indicadores según filtros activos"
        badge={`${stats.total} tarea${stats.total === 1 ? '' : 's'}`}
        items={taskStatItems}
        proportionBase={stats.total}
        referenceKey="total"
        columnsClass="md:grid-cols-2 lg:grid-cols-5"
      />

      {/* Filtros — colapsables en móvil */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {isMobile && (
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left bg-gray-50/90 border-b border-gray-100"
          >
            <span className="text-xs font-bold text-navy-800">
              Filtros
              {(filterDept || filterStatus || filterMine || search) && (
                <span className="ml-2 text-gold">· activos</span>
              )}
            </span>
            <svg
              className={`h-4 w-4 text-navy-500 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
        <div
          className={`p-4 flex flex-col gap-3 ${isMobile && !filtersOpen ? 'hidden' : ''} md:flex-row md:flex-wrap`}
        >
          <div className="flex-1 min-w-0 md:min-w-[200px]">
            <label className="block text-[9px] font-bold uppercase tracking-widest text-navy-500 mb-1">Buscar</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tarea, ticket, persona, depto…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-900 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
            />
          </div>
          <div className="w-full md:min-w-[160px] md:w-auto">
            <label className="block text-[9px] font-bold uppercase tracking-widest text-navy-500 mb-1">Departamento</label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-900 bg-white"
            >
              <option value="">Todos</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:min-w-[140px] md:w-auto">
            <label className="block text-[9px] font-bold uppercase tracking-widest text-navy-500 mb-1">Estado tarea</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-navy-900 bg-white"
            >
              <option value="">Todos</option>
              {Object.entries(TASK_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center md:items-end">
            <label className="flex w-full items-center gap-2 cursor-pointer rounded-lg border border-gray-200 px-3 py-2.5 bg-gray-50/80">
              <input
                type="checkbox"
                checked={filterMine}
                onChange={(e) => setFilterMine(e.target.checked)}
                className="accent-gold h-4 w-4"
              />
              <span className="text-sm font-semibold text-navy-800">Solo mis tareas</span>
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="font-label text-[10px] text-navy-500 uppercase tracking-widest">Sin tareas asignadas aún</p>
          <p className="text-sm text-navy-600 mt-2 max-w-md mx-auto">
            {canCreate
              ? 'Usa el botón Nueva tarea o créalas desde un ticket en Detalle y tareas.'
              : 'El gerente del departamento las crea desde Tareas operativas o desde un ticket.'}
          </p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-10 text-center">
          <p className="text-sm font-semibold text-amber-950">Ninguna tarea coincide con los filtros.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilterDept('');
              setFilterStatus('');
              setFilterMine(false);
            }}
            className="mt-3 text-xs font-bold text-gold hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      ) : effectiveView === 'cards' ? (
        <div className="space-y-3 pb-2">
          {filteredTasks.map((t) => {
            const canManage = canManageTaskRow(user, t);
            const isAssignee = Number(t.assigned_to) === Number(user?.id);
            const canStatus = canManage || isAssignee;
            return (
              <TaskMobileCard
                key={t.id}
                task={t}
                canManage={canManage}
                canStatus={canStatus}
                onOpenTicket={onOpenTicket}
                onOpenDetail={canParticipateOnTask(user, t) ? openTaskDetail : undefined}
                onStatusChange={updateStatus}
                onDelete={deleteTask}
              />
            );
          })}
        </div>
      ) : view === 'gantt' ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-gray-50 to-white">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-navy-700">Cronograma (Gantt)</p>
              <p className="text-[10px] text-navy-500 mt-0.5">Barra = rango de fechas de la tarea</p>
            </div>
            <p className="text-[10px] text-navy-500 font-medium tabular-nums">{rangeLabel}</p>
          </div>
          <div className="hidden sm:grid sm:grid-cols-[minmax(280px,320px)_1fr] border-b border-gray-100 bg-navy-950/5 text-[9px] font-bold uppercase tracking-widest text-navy-600">
            <div className="px-4 py-2 border-r border-gray-100">Tarea / ticket / responsable</div>
            <div className="px-4 py-2">Línea de tiempo</div>
          </div>
          <div className="relative h-8 border-b border-gray-100 bg-white px-4 md:ml-0 lg:ml-[320px]">
            {tickLabels.map((tk, i) => (
              <span
                key={i}
                className="absolute top-1 text-[9px] text-navy-400 font-bold -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${tk.pos}%` }}
              >
                {tk.text}
              </span>
            ))}
          </div>
          <div className="divide-y divide-gray-100 max-h-[min(70vh,560px)] overflow-y-auto">
            {filteredTasks.map((t, idx) => {
              const { left, width } = barLayout(t.start_date, t.end_date);
              const color = BAR_COLORS[idx % BAR_COLORS.length];
              const canManage = canManageTaskRow(user, t);
              const isAssignee = Number(t.assigned_to) === Number(user?.id);
              const canStatus = canManage || isAssignee;
              const dept = taskDept(t);
              return (
                <div key={t.id} className="flex flex-col sm:grid sm:grid-cols-[minmax(280px,320px)_1fr] sm:items-stretch hover:bg-gold/[0.03] transition-colors">
                  <div className="p-4 border-b sm:border-b-0 sm:border-r border-gray-100 bg-white sm:bg-gray-50/30">
                    <p className="text-xs font-bold text-navy-950 leading-snug">{t.title}</p>
                    <div className="mt-2">
                      <TaskOriginBlock task={t} onOpenTicket={onOpenTicket} compact />
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-navy-500 mb-2">Responsable</p>
                      <AssigneeBlock task={t} size="sm" />
                    </div>
                    <TaskMetaChips task={t} />
                    {renderStatusControls(t, canStatus, canManage)}
                  </div>
                  <div className="p-4 flex flex-col justify-center min-h-[72px]">
                    <div className="relative h-10 rounded-lg bg-gray-100 overflow-hidden ring-1 ring-gray-200/80">
                      <div
                        className="absolute top-1 bottom-1 rounded-md shadow-md flex items-center px-2 min-w-[12px]"
                        style={{ left: `${left}%`, width: `${width}%`, background: color }}
                        title={`${t.start_date} → ${t.end_date}`}
                      >
                        <span className="text-[9px] font-bold text-white truncate drop-shadow-sm">
                          {parseYMD(t.start_date)?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} —{' '}
                          {parseYMD(t.end_date)?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-navy-950 mt-1.5 text-center sm:text-left tabular-nums">
                      {formatDateShort(t.start_date)} → {formatDateShort(t.end_date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="hidden md:block rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-[10px] uppercase tracking-widest text-navy-600">
                <th className="px-4 py-3 font-bold">Tarea</th>
                <th className="px-4 py-3 font-bold">Ticket</th>
                <th className="px-4 py-3 font-bold">Departamento</th>
                <th className="px-4 py-3 font-bold">Responsable</th>
                <th className="px-4 py-3 font-bold">Fechas</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3 font-bold w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTasks.map((t) => {
                const st = TASK_STATUS[t.status] || TASK_STATUS.pending;
                const canManage = canManageTaskRow(user, t);
                const isAssignee = Number(t.assigned_to) === Number(user?.id);
                const canStatus = canManage || isAssignee;
                const dept = taskDept(t);
                const linked = hasTicket(t);
                return (
                  <tr key={t.id} className="hover:bg-gold/5 align-top">
                    <td className="px-4 py-3">
                      <p className="font-bold text-navy-950 text-xs">{t.title}</p>
                      {t.description ? <p className="text-[10px] text-navy-500 line-clamp-2 mt-0.5">{t.description}</p> : null}
                      <span className="inline-block mt-1 text-[9px] text-slate-500 tabular-nums">{taskDurationLabel(t.start_date, t.end_date)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-navy-700">
                      {linked ? (
                        <>
                          <span className="font-black tabular-nums text-gold bg-navy-950 px-1.5 py-0.5 rounded text-[10px]">#{t.ticket_id}</span>
                          <span className="block text-[10px] text-navy-600 line-clamp-2 mt-1 font-medium">{t.ticket_title}</span>
                          {onOpenTicket && (
                            <button
                              type="button"
                              onClick={() => onOpenTicket(t.ticket_id)}
                              className="mt-2 text-[10px] font-bold uppercase tracking-wide text-navy-950 bg-gold/15 hover:bg-gold/30 px-2 py-1 rounded border border-gold/30"
                            >
                              Abrir ticket
                            </button>
                          )}
                        </>
                      ) : (
                        <StandaloneTicketCell />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {dept ? <DeptBadge label={dept} /> : <span className="text-[10px] text-navy-400">—</span>}
                      {linked && TICKET_STATUS[t.ticket_status] ? (
                        <span
                          className="block mt-1 text-[9px] font-bold uppercase"
                          style={{ color: TICKET_STATUS[t.ticket_status].color }}
                        >
                          {TICKET_STATUS[t.ticket_status].label}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <AssigneeBlock task={t} size="xs" />
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-navy-950 font-semibold whitespace-nowrap">
                      <span className="block">{formatDateShort(t.start_date)}</span>
                      <span className="text-navy-600">→</span>
                      <span className="block">{formatDateShort(t.end_date)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {canStatus ? (
                        <select
                          value={t.status}
                          onChange={(e) => updateStatus(t.id, e.target.value)}
                          className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white text-navy-800"
                        >
                          {Object.entries(TASK_STATUS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: st.color + '22', color: st.color }}>
                          {st.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      {canParticipateOnTask(user, t) && (
                        <button
                          type="button"
                          onClick={() => openTaskDetail(t)}
                          className="block text-[10px] font-bold text-navy-950 hover:underline"
                        >
                          Evidencia
                        </button>
                      )}
                      {canManage && (
                        <button type="button" onClick={() => deleteTask(t.id)} className="block text-[10px] font-bold text-red-600 hover:underline">
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-navy-800 text-center pb-2 px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm max-w-xl mx-auto leading-relaxed">
        Crea tareas con <strong className="text-navy-950">Nueva tarea</strong> o desde{' '}
        <strong className="text-navy-950">Tickets → Detalle y tareas</strong>. El responsable sube evidencia y comentarios con{' '}
        <strong className="text-navy-950">Evidencia</strong> en cada tarea (sin depender del ticket).
      </p>

      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
          onOpenTicket={onOpenTicket}
          onRefreshList={fetchTasks}
        />
      )}

      {createOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4" onClick={() => !creating && setCreateOpen(false)}>
          <div
            className="surface-light w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-navy-950 px-5 py-4">
              <h3 className="text-lg font-display text-white">Nueva tarea operativa</h3>
              <p className="text-[11px] text-white/70 mt-1">Sin ticket — queda en el cronograma del departamento.</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-navy-950">Título</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  className="bosa-field w-full"
                  placeholder="Ej. Revisión de planos zona norte"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-navy-950">Descripción (opcional)</label>
                <textarea
                  rows={2}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  className="bosa-field w-full resize-none"
                />
              </div>
              {isAdmin && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-navy-950">Departamento</label>
                  <select
                    value={createForm.department}
                    onChange={(e) => setCreateForm((f) => ({ ...f, department: e.target.value, assigned_to: '' }))}
                    className="bosa-field w-full"
                  >
                    <option value="">Selecciona departamento…</option>
                    {DEPARTAMENTOS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
              {!isAdmin && user?.departamento ? (
                <p className="text-xs text-navy-600 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                  Departamento: <strong className="text-navy-950">{user.departamento}</strong>
                </p>
              ) : null}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-navy-950">Responsable</label>
                <select
                  value={createForm.assigned_to}
                  onChange={(e) => setCreateForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  className="bosa-field w-full"
                  disabled={isAdmin && !createForm.department}
                >
                  <option value="">Selecciona quién ejecuta…</option>
                  {deptMembers.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name} {u.apellido || ''}{u.puesto ? ` · ${u.puesto}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-navy-950">Inicio</label>
                  <input
                    type="date"
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="bosa-field w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-navy-950">Fin</label>
                  <input
                    type="date"
                    value={createForm.end_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="bosa-field w-full"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100 bg-gray-50/80">
              <button type="button" disabled={creating} onClick={() => setCreateOpen(false)} className="px-4 py-2 text-xs font-bold uppercase text-navy-700">
                Cancelar
              </button>
              <button type="button" disabled={creating} onClick={submitCreateTask} className="btn-gold text-[10px] py-2.5 px-5 uppercase tracking-widest font-bold">
                {creating ? 'Guardando…' : 'Crear tarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
