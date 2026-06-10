import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import UserAvatar from '../UserAvatar';
import BosaGoldButton from '../BosaGoldButton';
import { useCatalog } from '../../hooks/useCatalog';
import {
  isAdminUser,
  isManagerUser,
  isSuperadminUser,
  canManageDeptAsManager,
  canCreateStandaloneTask as canCreateStandalone,
} from '../../utils/permissions';
import { localDateYMD, parseYMD, formatDateShort } from '../../utils/localDate';

const TASK_STATUS = {
  pending: { label: 'Pendiente', color: '#94a3b8', accent: '#64748b' },
  in_progress: { label: 'En progreso', color: '#CBAC80', accent: '#A47D3B' },
  done: { label: 'Hecha', color: '#10b981', accent: '#059669' },
  cancelled: { label: 'Cancelada', color: '#64748b', accent: '#475569' },
};

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
  return canManageDeptAsManager(authUser, taskDept(row));
}

function canCreateStandaloneTask(authUser) {
  return canCreateStandalone(authUser);
}

function canParticipateOnTask(authUser, row) {
  if (!authUser || !row) return false;
  if (isAdminUser(authUser)) return true;
  const cat = taskDept(row);
  const dept = (authUser.departamento || '').trim();
  if (cat && dept === cat) return true;
  if (Number(row.assigned_to) === Number(authUser.id)) return true;
  if (Number(row.created_by) === Number(authUser.id)) return true;
  return false;
}

/** Creador de la tarea o del ticket vinculado (o superadmin). */
function isTaskOrTicketCreator(authUser, row) {
  if (!authUser || !row) return false;
  if (isSuperadminUser(authUser)) return true;
  if (Number(row.created_by) === Number(authUser.id)) return true;
  if (row.ticket_created_by != null && Number(row.ticket_created_by) === Number(authUser.id)) return true;
  return false;
}

function canViewTaskDetail(authUser, row) {
  return canParticipateOnTask(authUser, row);
}

/** Asignado sin ser creador: solo lectura al abrir la tarea. */
function isAssigneeViewOnly(authUser, row) {
  if (!authUser || !row) return false;
  return Number(row.assigned_to) === Number(authUser.id) && !isTaskOrTicketCreator(authUser, row);
}

function canDeleteTaskAttachment(authUser, task, file) {
  if (!authUser || !task) return false;
  if (file?.can_delete === true) return true;
  if (isAdminUser(authUser)) return true;
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
  const fmt = (d) => localDateYMD(d);
  const isAdmin = isAdminUser(user);
  return {
    title: '',
    description: '',
    assigned_to: '',
    start_date: fmt(t),
    end_date: fmt(e),
    department: isAdmin ? '' : (user?.departamento || ''),
  };
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
  canDelete,
  canStatus,
  canOpenDetail,
  onOpenTicket,
  onOpenDetail,
  onStatusChange,
  onDelete,
  onEdit,
}) {
  const st = TASK_STATUS[task.status] || TASK_STATUS.pending;
  const dept = taskDept(task);
  const duration = taskDurationLabel(task.start_date, task.end_date);
  const linked = hasTicket(task);

  return (
    <article className="tasks-module__card">
      <div className="tasks-module__card-main">
        <div className="flex items-start justify-between gap-3">
          {canOpenDetail && onOpenDetail ? (
            <button
              type="button"
              onClick={() => onOpenDetail(task)}
              className="tasks-module__card-title flex-1 min-w-0 text-left hover:text-gold transition-colors"
            >
              {task.title}
            </button>
          ) : (
            <h3 className="tasks-module__card-title flex-1 min-w-0">{task.title}</h3>
          )}
          <span
            className="tasks-module__pill shrink-0"
            style={{ background: `${st.color}22`, color: st.color }}
          >
            {st.label}
          </span>
        </div>
        <div className="tasks-module__card-meta">
          {dept ? (
            <span className="tasks-module__pill bg-slate-100 text-slate-600">{dept}</span>
          ) : null}
          {linked ? (
            <span className="tasks-module__pill bg-slate-100 text-slate-600">Ticket #{task.ticket_id}</span>
          ) : (
            <span className="tasks-module__pill" style={{ background: 'rgba(203,172,128,0.2)', color: '#78350f' }}>
              Independiente
            </span>
          )}
          {duration ? (
            <span className="tasks-module__pill bg-slate-100 text-slate-600">{duration}</span>
          ) : null}
        </div>
        {linked && task.ticket_title ? (
          <p className="mt-2 line-clamp-2 text-[13px] text-slate-600">{task.ticket_title}</p>
        ) : null}
      </div>

      <div className="tasks-module__card-section">
        <div className="tasks-module__card-dates">
          <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatDateShort(task.start_date)} → {formatDateShort(task.end_date)}
        </div>
        <div className="mt-3">
          <AssigneeBlock task={task} size="sm" />
        </div>
      </div>

      <div className="tasks-module__card-actions">
        {canStatus && (
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            className="tasks-module__field w-full py-2 text-[13px] sm:max-w-[10rem]"
            aria-label="Cambiar estado"
          >
            {Object.entries(TASK_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}
        <TaskRowActions
          task={task}
          linked={linked}
          canEvidence={Boolean(onOpenDetail)}
          canManage={canManage}
          canDelete={canDelete}
          onOpenDetail={onOpenDetail}
          onOpenTicket={onOpenTicket}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </article>
  );
}

function getInitialView() {
  return 'list';
}

/** Gerentes y administradores ven todas las tareas visibles sin activar el toggle. */
function userSeesAllTasksByDefault(authUser) {
  return isAdminUser(authUser) || isManagerUser(authUser);
}

function TaskEvidenceIcon() {
  return (
    <span className="tasks-module__action-icon-wrap tasks-module__action-icon-wrap--evidence" aria-hidden>
      <svg
        className="tasks-module__action-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
        <path d="M15 4v3h3" />
        <path d="M9 13l2 2 3.5-3.5" />
      </svg>
    </span>
  );
}

/** Misma barra de acciones que en cronograma (Evidencia = action-primary dorado). */
function TaskRowActions({ task, linked, canEvidence, canManage, canDelete, onOpenDetail, onOpenTicket, onEdit, onDelete }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEvidence && onOpenDetail && (
        <button
          type="button"
          onClick={() => onOpenDetail(task)}
          className="tasks-module__action-primary gap-1.5 px-3 py-2 text-[13px]"
        >
          <TaskEvidenceIcon />
          Evidencia
        </button>
      )}
      {linked && onOpenTicket && (
        <button
          type="button"
          onClick={() => onOpenTicket(task.ticket_id)}
          className="tasks-module__action-secondary px-3 py-2 text-[13px]"
        >
          Ticket
        </button>
      )}
      {canManage && onEdit && (
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="tasks-module__action-secondary px-3 py-2 text-[13px]"
        >
          Editar
        </button>
      )}
      {canDelete && onDelete && (
        <button type="button" onClick={() => onDelete(task.id)} className="tasks-module__action-danger px-2 py-2">
          Eliminar
        </button>
      )}
    </div>
  );
}

function TasksListTable({
  tasks,
  user,
  onOpenTicket,
  onOpenDetail,
  onStatusChange,
  onDelete,
  onEdit,
}) {
  return (
    <div className="tasks-module__table-wrap hidden md:block">
      <table className="tasks-module__table">
        <thead>
          <tr>
            <th>Tarea</th>
            <th>Origen</th>
            <th>Responsable</th>
            <th>Periodo</th>
            <th>Estado</th>
            <th className="tasks-module__table-actions-head">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const st = TASK_STATUS[t.status] || TASK_STATUS.pending;
            const canOwn = isTaskOrTicketCreator(user, t);
            const canStatus = canOwn;
            const canOpenDetail = canViewTaskDetail(user, t);
            const linked = hasTicket(t);
            return (
              <tr key={t.id}>
                <td>
                  {canOpenDetail && onOpenDetail ? (
                    <button
                      type="button"
                      onClick={() => onOpenDetail(t)}
                      className="tasks-module__table-title text-left hover:text-gold transition-colors"
                    >
                      {t.title}
                    </button>
                  ) : (
                    <p className="tasks-module__table-title">{t.title}</p>
                  )}
                  {t.description ? (
                    <p className="tasks-module__table-desc">{t.description}</p>
                  ) : null}
                </td>
                <td>
                  <TaskOriginBlock task={t} onOpenTicket={onOpenTicket} compact />
                </td>
                <td>
                  <AssigneeBlock task={t} size="xs" />
                </td>
                <td className="tasks-module__table-dates">
                  {formatDateShort(t.start_date)}
                  <span className="text-slate-400"> → </span>
                  {formatDateShort(t.end_date)}
                </td>
                <td>
                  {canStatus ? (
                    <select
                      value={t.status}
                      onChange={(e) => onStatusChange(t.id, e.target.value)}
                      className="tasks-module__field tasks-module__table-select py-1.5 text-[13px]"
                      aria-label={`Estado de ${t.title}`}
                    >
                      {Object.entries(TASK_STATUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="tasks-module__pill" style={{ background: `${st.color}22`, color: st.color }}>
                      {st.label}
                    </span>
                  )}
                </td>
                <td>
                  <TaskRowActions
                    task={t}
                    linked={linked}
                    canEvidence={canOwn}
                    canManage={canOwn}
                    canDelete={canOwn}
                    onOpenDetail={onOpenDetail}
                    onOpenTicket={onOpenTicket}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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

  const canParticipate = task
    ? canParticipateOnTask(user, task) && !isAssigneeViewOnly(user, task)
    : false;

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
      className="meeting-sheet-overlay z-[125] animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="meeting-sheet meeting-sheet--wide meeting-sheet--form animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        <div className="meeting-sheet__hero shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="meeting-sheet__pill meeting-sheet__pill--gold">Tarea operativa</span>
                {st && (
                  <span
                    className="meeting-sheet__pill"
                    style={{ background: `${st.color}22`, color: st.color }}
                  >
                    {st.label}
                  </span>
                )}
              </div>
              <h3 id="task-detail-title" className="meeting-sheet__hero-title truncate">
                {task?.title || '…'}
              </h3>
            </div>
            <button type="button" onClick={onClose} className="meeting-sheet__close" aria-label="Cerrar">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          </div>
        ) : task ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="meeting-sheet__scroll meeting-sheet__scroll--form flex-1 space-y-4">
              <div className="meeting-sheet__group">
                <div className="meeting-sheet__cell space-y-2">
                  <TaskOriginBlock
                    task={task}
                    onOpenTicket={linked && onOpenTicket ? () => { onClose(); onOpenTicket(task.ticket_id); } : undefined}
                    compact
                  />
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
                    <AssigneeBlock task={task} size="xs" />
                    <span className="tabular-nums">
                      {formatDateShort(task.start_date)} → {formatDateShort(task.end_date)}
                    </span>
                  </div>
                </div>
              </div>

              <section>
                <p className="meeting-sheet__section-label">
                  Comentarios{task.comments?.length ? ` · ${task.comments.length}` : ''}
                </p>
                <p className="mb-2 px-1 text-[12px] text-slate-500">Notas y avances del responsable</p>
                {(!task.comments || task.comments.length === 0) ? (
                  <p className="meeting-sheet__cell meeting-sheet__cell--empty rounded-[14px] bg-white">
                    {canParticipate ? 'Sin comentarios todavía. Escribe el primero abajo.' : 'Sin comentarios todavía.'}
                  </p>
                ) : (
                  <div className="meeting-sheet__comments-scroll">
                    <div className="meeting-sheet__comments-list">
                      {task.comments.map((c) => {
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
                                {new Date(c.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} ·{' '}
                                {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              <section>
                <p className="meeting-sheet__section-label">
                  Archivos y evidencia{task.attachments?.length ? ` · ${task.attachments.length}` : ''}
                </p>
                <p className="mb-2 px-1 text-[12px] text-slate-500">Reportes, fotos y documentos de la tarea</p>
                <div className="meeting-sheet__attachment-grid">
                  {task.attachments?.map((f) => {
                    const url = taskFileUrl(f);
                    const isImg = f.mimetype?.startsWith('image/');
                    const canDeleteFile = canDeleteTaskAttachment(user, task, f);
                    return (
                      <div key={f.id} className="group relative meeting-sheet__attachment-tile">
                        {isImg ? (
                          <button type="button" onClick={() => setLightboxUrl(url)} className="block h-full w-full cursor-zoom-in">
                            <img src={url} alt={f.filename} className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <a href={url} download={f.filename} target="_blank" rel="noreferrer" className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 p-3 transition-colors hover:bg-slate-100">
                            <svg className="h-9 w-9 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <span className="line-clamp-2 break-all px-1 text-center text-[11px] font-semibold text-slate-700">{f.filename}</span>
                          </a>
                        )}
                        {canDeleteFile && (
                          <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {!isImg && (
                              <a
                                href={url}
                                download={f.filename}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex h-7 w-7 items-center justify-center rounded-md bg-navy-950/85 text-gold transition hover:bg-navy-950"
                                title="Descargar"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
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
                              className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/90 text-white transition hover:bg-red-600"
                              title="Eliminar documento"
                              aria-label={`Eliminar ${f.filename}`}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
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
                            className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-navy-950/85 text-gold transition hover:bg-navy-950"
                            title="Descargar"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                          </a>
                        )}
                      </div>
                    );
                  })}
                  {canParticipate && (
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
                  )}
                </div>
                {(!task.attachments || task.attachments.length === 0) && (
                  <p className="meeting-sheet__meta mt-2 text-center">
                    {canParticipate ? 'Sin archivos aún — usa el recuadro para subir.' : 'Sin archivos en esta tarea.'}
                  </p>
                )}
              </section>
            </div>

            {canParticipate ? (
              <div className="meeting-sheet__footer shrink-0">
                <p className="mb-2 px-1 text-[13px] font-semibold text-slate-500">Nuevo comentario</p>
                <div className="meeting-sheet__comment-bar">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Escribe un comentario o nota de avance…"
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
            ) : (
              <p className="meeting-sheet__footer shrink-0 text-center text-[13px] text-slate-500">
                Solo lectura: no tienes permiso para comentar o subir en esta tarea.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {lightboxUrl && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>,
    document.body,
  );
}

export default function TasksModule({ onOpenTicket } = {}) {
  const { user } = useAuth();
  const { departments: catalogDepartments } = useCatalog();
  const isMobile = useMediaQuery(MOBILE_MQ);
  const [tasks, setTasks] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const seesAllByRole = userSeesAllTasksByDefault(user);
  const [showAllTasks, setShowAllTasks] = useState(() => userSeesAllTasksByDefault(user));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(() => freshStandaloneTaskForm(null));
  const [creating, setCreating] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const openTaskDetail = (task) => {
    if (task?.id) setDetailTaskId(task.id);
  };

  const canCreate = canCreateStandaloneTask(user);
  const isAdmin = isAdminUser(user);

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

  useEffect(() => {
    setShowAllTasks(userSeesAllTasksByDefault(user));
  }, [user?.id]);

  const deptMembers = useMemo(() => {
    const dept = isAdmin ? (createForm.department || '').trim() : (user?.departamento || '').trim();
    if (!dept) return [];
    return dbUsers.filter((u) => u.is_active !== 0 && u.is_active !== false && (u.departamento || '').trim() === dept);
  }, [dbUsers, createForm.department, isAdmin, user?.departamento]);

  const editDeptMembers = useMemo(() => {
    const dept = (editForm?.department || '').trim();
    if (!dept) return [];
    return dbUsers.filter((u) => u.is_active !== 0 && u.is_active !== false && (u.departamento || '').trim() === dept);
  }, [dbUsers, editForm?.department]);

  const filterDepartments = useMemo(() => {
    const set = new Set(catalogDepartments);
    tasks.forEach((t) => {
      const d = taskDept(t);
      if (d) set.add(d);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalogDepartments, tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterDept && taskDept(t) !== filterDept) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (!showAllTasks && Number(t.assigned_to) !== Number(user?.id)) return false;
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
  }, [tasks, filterDept, filterStatus, showAllTasks, search, user?.id]);

  const stats = useMemo(() => {
    const byStatus = { pending: 0, in_progress: 0, done: 0, cancelled: 0 };
    filteredTasks.forEach((t) => {
      if (byStatus[t.status] != null) byStatus[t.status] += 1;
    });
    return { total: filteredTasks.length, ...byStatus };
  }, [filteredTasks]);

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

  const openEditTask = (t) => {
    if (!isTaskOrTicketCreator(user, t)) return;
    setEditForm({
      id: t.id,
      title: t.title || '',
      description: t.description || '',
      assigned_to: t.assigned_to != null ? String(t.assigned_to) : '',
      start_date: t.start_date || '',
      end_date: t.end_date || '',
      status: t.status || 'pending',
      department: taskDept(t),
    });
    setEditOpen(true);
  };

  const submitEditTask = async () => {
    if (!editForm?.title?.trim()) {
      alert('Indica el título de la tarea');
      return;
    }
    if (!editForm.assigned_to) {
      alert('Selecciona responsable');
      return;
    }
    setEditSaving(true);
    try {
      await axios.patch(`/api/ticket-tasks/${editForm.id}`, {
        title: editForm.title.trim(),
        description: editForm.description?.trim() || '',
        assigned_to: Number(editForm.assigned_to),
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        status: editForm.status,
      });
      setEditOpen(false);
      setEditForm(null);
      await fetchTasks();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo actualizar la tarea');
    } finally {
      setEditSaving(false);
    }
  };

  const submitCreateTask = async () => {
    if (creating) return;
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
      const { data } = await axios.post('/api/ticket-tasks', {
        title: createForm.title.trim(),
        description: createForm.description?.trim() || '',
        assigned_to: Number(createForm.assigned_to),
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        department: createForm.department?.trim() || undefined,
      });
      if (!data?.duplicate) {
        setCreateOpen(false);
      }
      await fetchTasks();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo crear la tarea');
    } finally {
      setCreating(false);
    }
  };

  const rangeLabel = `${new Date(minTime).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} — ${new Date(maxTime).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const renderStatusControls = (t, canStatus, canDelete) => {
    const st = TASK_STATUS[t.status] || TASK_STATUS.pending;
    const canOwn = isTaskOrTicketCreator(user, t);
    const canOpenDetail = canViewTaskDetail(user, t);
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canOpenDetail && !canOwn && (
          <button
            type="button"
            onClick={() => openTaskDetail(t)}
            className="tasks-module__action-secondary px-3 py-2 text-[13px]"
          >
            Ver tarea
          </button>
        )}
        {canOwn && (
          <button
            type="button"
            onClick={() => openTaskDetail(t)}
            className="tasks-module__action-primary gap-1.5 px-3 py-2 text-[13px]"
          >
            <TaskEvidenceIcon />
            Evidencia
          </button>
        )}
        <span className="tasks-module__pill" style={{ background: `${st.color}22`, color: st.color }}>
          {st.label}
        </span>
        {canStatus && (
          <select
            value={t.status}
            onChange={(e) => updateStatus(t.id, e.target.value)}
            className="tasks-module__field w-auto min-w-[8.5rem] py-2 text-[13px]"
            aria-label="Cambiar estado de la tarea"
          >
            {Object.entries(TASK_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        {canDelete && (
          <button type="button" onClick={() => deleteTask(t.id)} className="tasks-module__action-danger px-2 py-2">
            Eliminar
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="tasks-module surface-light h-full flex flex-col animate-fade-in pb-4">
      <header className="tasks-module__top">
        <div>
          <h2 className="tasks-module__title">Tareas operativas</h2>
          <p className="tasks-module__subtitle">
            {view === 'list'
              ? `${stats.total} tarea${stats.total === 1 ? '' : 's'} · lista${!showAllTasks && !seesAllByRole ? ' · asignadas a ti' : ''}`
              : `${stats.total} tarea${stats.total === 1 ? '' : 's'} · cronograma${!showAllTasks && !seesAllByRole ? ' · asignadas a ti' : ''}`}
          </p>
        </div>
        <div className="tasks-module__toolbar">
          <div className="tasks-module__segmented" role="tablist" aria-label="Vista de tareas">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'list'}
              onClick={() => setView('list')}
              className={`tasks-module__segment${view === 'list' ? ' tasks-module__segment--active' : ''}`}
            >
              Lista
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'gantt'}
              onClick={() => setView('gantt')}
              className={`tasks-module__segment${view === 'gantt' ? ' tasks-module__segment--active' : ''}`}
            >
              Cronograma
            </button>
          </div>
          <button type="button" onClick={() => fetchTasks()} className="tasks-module__btn-ghost">
            Actualizar
          </button>
          {canCreate && (
            <BosaGoldButton icon="task" onClick={openCreateModal} className="sm:!w-auto" aria-label="Nueva tarea">
              Nueva tarea
            </BosaGoldButton>
          )}
        </div>
      </header>

      <div className="tasks-module__stats">
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.total}</div>
          <div className="tasks-module__stat-label">Total</div>
        </div>
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.pending}</div>
          <div className="tasks-module__stat-label">{TASK_STATUS.pending.label}</div>
        </div>
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.in_progress}</div>
          <div className="tasks-module__stat-label">{TASK_STATUS.in_progress.label}</div>
        </div>
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.done}</div>
          <div className="tasks-module__stat-label">{TASK_STATUS.done.label}</div>
        </div>
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.cancelled}</div>
          <div className="tasks-module__stat-label">{TASK_STATUS.cancelled.label}</div>
        </div>
      </div>

      <div className="tasks-module__filters">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="tasks-module__filters-toggle"
          aria-expanded={filtersOpen}
        >
          <span className="text-[15px] font-semibold text-slate-800">
            Filtros
            {(filterDept || filterStatus || search || (!seesAllByRole && showAllTasks)) && (
              <span className="ml-1 text-gold">· activos</span>
            )}
          </span>
          <svg
            className={`h-5 w-5 text-slate-400 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className={`tasks-module__filters-body${isMobile && !filtersOpen ? ' hidden sm:grid' : ''}`}>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="tasks-module__field-label" htmlFor="tasks-search">
              Buscar
            </label>
            <input
              id="tasks-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tarea, ticket, persona…"
              className="tasks-module__field"
            />
          </div>
          <div>
            <label className="tasks-module__field-label" htmlFor="tasks-dept">
              Departamento
            </label>
            <select
              id="tasks-dept"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="tasks-module__field"
            >
              <option value="">Todos</option>
              {filterDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="tasks-module__field-label" htmlFor="tasks-status">
              Estado
            </label>
            <select
              id="tasks-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="tasks-module__field"
            >
              <option value="">Todos</option>
              {Object.entries(TASK_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          {!seesAllByRole ? (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setShowAllTasks((v) => !v)}
                className="tasks-module__toggle-scope w-full"
              >
                {showAllTasks ? 'Solo mis tareas' : 'Ver todas las tareas'}
              </button>
            </div>
          ) : (
            <div className="flex items-end">
              <p className="w-full rounded-[10px] bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-slate-500">
                Vista de gerente: todas las tareas del departamento
              </p>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="tasks-module__empty">
          <p className="text-[15px] font-semibold text-slate-800">Sin tareas asignadas aún</p>
          <p className="mx-auto mt-2 max-w-sm text-[14px] text-slate-500">
            {canCreate
              ? 'Pulsa Nueva tarea o créalas desde un ticket en Detalle y tareas.'
              : 'El gerente del departamento las crea desde aquí o desde un ticket.'}
          </p>
          {canCreate && (
            <BosaGoldButton icon="task" onClick={openCreateModal} className="mt-4 sm:!w-auto" aria-label="Nueva tarea">
              Nueva tarea
            </BosaGoldButton>
          )}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="tasks-module__empty">
          <p className="text-[15px] font-semibold text-slate-800">Ninguna tarea coincide con los filtros</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilterDept('');
              setFilterStatus('');
              setShowAllTasks(userSeesAllTasksByDefault(user));
            }}
            className="tasks-module__btn-ghost mt-4"
          >
            Limpiar filtros
          </button>
        </div>
      ) : view === 'list' ? (
        <>
          <TasksListTable
            tasks={filteredTasks}
            user={user}
            onOpenTicket={onOpenTicket}
            onOpenDetail={(t) => {
              if (canViewTaskDetail(user, t)) openTaskDetail(t);
            }}
            onStatusChange={updateStatus}
            onDelete={deleteTask}
            onEdit={openEditTask}
          />
          <div className="tasks-module__list md:hidden">
            {filteredTasks.map((t) => {
              const canOwn = isTaskOrTicketCreator(user, t);
              const canOpenDetail = canViewTaskDetail(user, t);
              return (
                <TaskMobileCard
                  key={t.id}
                  task={t}
                  canManage={canOwn}
                  canDelete={canOwn}
                  canStatus={canOwn}
                  canOpenDetail={canOpenDetail}
                  onOpenTicket={onOpenTicket}
                  onOpenDetail={canOpenDetail ? openTaskDetail : undefined}
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                  onEdit={canOwn ? openEditTask : undefined}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div className="tasks-module__gantt">
          <div className="tasks-module__gantt-header">
            <div>
              <p className="text-[15px] font-semibold text-slate-900">Cronograma</p>
              <p className="text-[13px] text-slate-500">Cada barra muestra el rango de fechas de la tarea</p>
            </div>
            <p className="text-[13px] font-semibold tabular-nums text-slate-600">{rangeLabel}</p>
          </div>
          <div className="hidden border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[minmax(280px,320px)_1fr]">
            <div className="border-r border-slate-100 px-4 py-2">Tarea</div>
            <div className="px-4 py-2">Línea de tiempo</div>
          </div>
          <div className="relative h-8 border-b border-slate-100 bg-white px-4 lg:ml-[320px]">
            {tickLabels.map((tk, i) => (
              <span
                key={i}
                className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-slate-400"
                style={{ left: `${tk.pos}%` }}
              >
                {tk.text}
              </span>
            ))}
          </div>
          <div className="max-h-[min(70vh,560px)] divide-y divide-slate-100 overflow-y-auto">
            {filteredTasks.map((t, idx) => {
              const { left, width } = barLayout(t.start_date, t.end_date);
              const color = BAR_COLORS[idx % BAR_COLORS.length];
              const canOwn = isTaskOrTicketCreator(user, t);
              const canOpenDetail = canViewTaskDetail(user, t);
              return (
                <div
                  key={t.id}
                  className="flex flex-col transition-colors hover:bg-gold/[0.03] sm:grid sm:grid-cols-[minmax(280px,320px)_1fr] sm:items-stretch"
                >
                  <div className="border-b border-slate-100 bg-white p-4 sm:border-b-0 sm:border-r sm:bg-slate-50/30">
                    {canOpenDetail ? (
                      <button
                        type="button"
                        onClick={() => openTaskDetail(t)}
                        className="text-left text-[14px] font-semibold leading-snug text-slate-900 hover:text-gold transition-colors"
                      >
                        {t.title}
                      </button>
                    ) : (
                      <p className="text-[14px] font-semibold leading-snug text-slate-900">{t.title}</p>
                    )}
                    <div className="mt-2">
                      <TaskOriginBlock task={t} onOpenTicket={onOpenTicket} compact />
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="mb-2 text-[12px] font-medium text-slate-500">Responsable</p>
                      <AssigneeBlock task={t} size="sm" />
                    </div>
                    <TaskMetaChips task={t} />
                    {renderStatusControls(t, canOwn, canOwn)}
                  </div>
                  <div className="flex min-h-[72px] flex-col justify-center p-4">
                    <div className="relative h-10 overflow-hidden rounded-[10px] bg-slate-100 ring-1 ring-slate-200/80">
                      <div
                        className="absolute bottom-1 top-1 flex min-w-[12px] items-center rounded-[8px] px-2 shadow-md"
                        style={{ left: `${left}%`, width: `${width}%`, background: color }}
                        title={`${t.start_date} → ${t.end_date}`}
                      >
                        <span className="truncate text-[10px] font-semibold text-white drop-shadow-sm">
                          {parseYMD(t.start_date)?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} —{' '}
                          {parseYMD(t.end_date)?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1.5 text-center text-[13px] font-semibold tabular-nums text-slate-800 sm:text-left">
                      {formatDateShort(t.start_date)} → {formatDateShort(t.end_date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
          onOpenTicket={onOpenTicket}
          onRefreshList={fetchTasks}
        />
      )}

      {editOpen && editForm && createPortal(
        <div
          className="meeting-sheet-overlay z-[120] animate-fade-in"
          onClick={() => !editSaving && setEditOpen(false)}
          role="presentation"
        >
          <div
            className="meeting-sheet meeting-sheet--form animate-slide-up flex min-h-0 flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-task-modal-title"
          >
            <div className="meeting-sheet__hero shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="meeting-sheet__pill meeting-sheet__pill--gold">Tareas operativas</span>
                  <h3 id="edit-task-modal-title" className="meeting-sheet__hero-title mt-2">
                    Editar tarea
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditOpen(false)}
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
                submitEditTask();
              }}
            >
            <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
              <p className="meeting-sheet__section-label">Detalles</p>
              <div className="meeting-sheet__group">
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Título</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    className="meeting-sheet__input font-semibold"
                  />
                </div>
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Descripción</label>
                  <textarea
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    className="meeting-sheet__textarea"
                  />
                </div>
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Estado</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                    className="meeting-sheet__select"
                  >
                    {Object.entries(TASK_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="meeting-sheet__section-label">Asignación</p>
              <div className="meeting-sheet__group">
                {editForm.department ? (
                  <div className="meeting-sheet__cell">
                    <p className="meeting-sheet__cell-label">Departamento</p>
                    <p className="meeting-sheet__cell-value">{editForm.department}</p>
                  </div>
                ) : null}
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Responsable</label>
                  <select
                    value={editForm.assigned_to}
                    onChange={(e) => setEditForm((f) => ({ ...f, assigned_to: e.target.value }))}
                    className="meeting-sheet__select"
                  >
                    <option value="">Selecciona responsable…</option>
                    {editDeptMembers.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.name} {u.apellido || ''}{u.puesto ? ` · ${u.puesto}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="meeting-sheet__section-label">Horario</p>
              <div className="meeting-sheet__group">
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Inicio</label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="meeting-sheet__input tabular-nums"
                  />
                </div>
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Fin</label>
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="meeting-sheet__input tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="meeting-sheet__footer shrink-0">
              <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditOpen(false)}
                  className="voice-minute-footer__btn voice-minute-footer__btn--secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="voice-minute-footer__btn voice-minute-footer__btn--primary disabled:opacity-50"
                >
                  {editSaving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {createOpen && createPortal(
        <div
          className="meeting-sheet-overlay z-[120] animate-fade-in"
          onClick={() => !creating && setCreateOpen(false)}
          role="presentation"
        >
          <div
            className="meeting-sheet meeting-sheet--form animate-slide-up flex min-h-0 flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-modal-title"
          >
            <div className="meeting-sheet__hero shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="meeting-sheet__pill meeting-sheet__pill--gold">Cronograma</span>
                  <h3 id="new-task-modal-title" className="meeting-sheet__hero-title mt-2">
                    Nueva tarea operativa
                  </h3>
                  <p className="meeting-sheet__hero-subtitle">
                    Sin ticket — queda en el cronograma del departamento.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setCreateOpen(false)}
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
                submitCreateTask();
              }}
            >
            <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
              <p className="meeting-sheet__section-label">Detalles</p>
              <div className="meeting-sheet__group">
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Título</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                    className="meeting-sheet__input font-semibold"
                    placeholder="Ej. Revisión de planos zona norte"
                  />
                </div>
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Descripción (opcional)</label>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                    className="meeting-sheet__textarea"
                  />
                </div>
              </div>

              <p className="meeting-sheet__section-label">Asignación</p>
              <div className="meeting-sheet__group">
                {isAdmin && (
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label className="meeting-sheet__cell-label">Departamento</label>
                    <select
                      value={createForm.department}
                      onChange={(e) => setCreateForm((f) => ({ ...f, department: e.target.value, assigned_to: '' }))}
                      className="meeting-sheet__select"
                    >
                      <option value="">Selecciona departamento…</option>
                      {catalogDepartments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
                {!isAdmin && user?.departamento ? (
                  <div className="meeting-sheet__cell">
                    <p className="meeting-sheet__cell-label">Departamento</p>
                    <p className="meeting-sheet__cell-value">{user.departamento}</p>
                  </div>
                ) : null}
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Responsable</label>
                  <select
                    value={createForm.assigned_to}
                    onChange={(e) => setCreateForm((f) => ({ ...f, assigned_to: e.target.value }))}
                    className="meeting-sheet__select"
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
              </div>

              <p className="meeting-sheet__section-label">Horario</p>
              <div className="meeting-sheet__group">
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Inicio</label>
                  <input
                    type="date"
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="meeting-sheet__input tabular-nums"
                  />
                </div>
                <div className="meeting-sheet__cell meeting-sheet__cell--field">
                  <label className="meeting-sheet__cell-label">Fin</label>
                  <input
                    type="date"
                    value={createForm.end_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="meeting-sheet__input tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="meeting-sheet__footer shrink-0">
              <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setCreateOpen(false)}
                  className="voice-minute-footer__btn voice-minute-footer__btn--secondary disabled:cursor-not-allowed disabled:opacity-50"
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
                  disabled={creating}
                  className="voice-minute-footer__btn voice-minute-footer__btn--primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <span
                        className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-navy-950/25 border-t-navy-950"
                        aria-hidden
                      />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <span className="bosa-gold-btn__icon-wrap bosa-gold-btn__icon-wrap--task" aria-hidden>
                        <svg
                          className="bosa-gold-btn__icon"
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
                      Crear tarea
                    </>
                  )}
                </button>
              </div>
            </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
