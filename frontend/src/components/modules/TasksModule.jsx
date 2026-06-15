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
import { localDateYMD, parseYMD, formatDateShort, formatTaskScheduleLabel } from '../../utils/localDate';

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

function isTaskAssignee(authUser, task) {
  return Boolean(task && authUser && Number(task.assigned_to) === Number(authUser.id));
}

function isTaskTicketCoordinator(authUser, task) {
  return Boolean(
    task &&
      authUser &&
      task.ticket_assigned_to != null &&
      Number(task.ticket_assigned_to) === Number(authUser.id),
  );
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
  const textSizes =
    size === 'xs'
      ? { name: 'text-xs', meta: 'text-[10px]', dept: 'text-[9px]', gap: 'gap-2.5' }
      : size === 'md'
        ? { name: 'text-base', meta: 'text-[13px]', dept: 'text-[12px]', gap: 'gap-3.5' }
        : { name: 'text-sm', meta: 'text-[12px]', dept: 'text-[11px]', gap: 'gap-3' };
  return (
    <div className={`flex items-center min-w-0 ${textSizes.gap}`}>
      <UserAvatar
        name={task.assignee_name}
        apellido={task.assignee_apellido}
        avatarUrl={task.assignee_avatar_url}
        size={size}
      />
      <div className="min-w-0">
        <p className={`${textSizes.name} font-bold text-navy-950 truncate`}>{name}</p>
        {puesto ? <p className={`${textSizes.meta} text-navy-500 truncate`}>{puesto}</p> : null}
        {dept ? (
          <p className={`${textSizes.dept} text-navy-400 truncate mt-0.5`}>Depto. {dept}</p>
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

function ConfirmTaskIcon() {
  return (
    <span className="tasks-module__action-icon-wrap tasks-module__action-icon-wrap--confirm" aria-hidden>
      <svg
        className="tasks-module__action-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
  );
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const MOBILE_MQ = '(max-width: 767px)';

/** Tono del chip según cumplimiento en la fecha de término (end_date). */
function getTaskDeadlineTone(task) {
  if (task?.status === 'done') return 'done';
  if (task?.status === 'cancelled') return 'cancelled';
  const end = parseYMD(task?.end_date);
  const today = parseYMD(localDateYMD());
  if (end && today && end.getTime() < today.getTime()) return 'overdue';
  return 'pending';
}

function getTaskDeadlineChipClass(task) {
  const tone = getTaskDeadlineTone(task);
  const base =
    'calendar-meeting-chip w-full text-left text-[9px] p-1 rounded border-l-2 truncate font-bold uppercase tracking-tight transition-colors';
  if (tone === 'done') return `${base} tasks-calendar-chip--done`;
  if (tone === 'overdue') return `${base} tasks-calendar-chip--overdue`;
  if (tone === 'cancelled') return `${base} tasks-calendar-chip--cancelled`;
  return `${base} calendar-meeting-chip--no-minute`;
}

function getTaskDeadlineLabel(task) {
  const tone = getTaskDeadlineTone(task);
  if (tone === 'done') return 'Cumplida';
  if (tone === 'overdue') return 'Vencida / no cumplida';
  if (tone === 'cancelled') return 'Cancelada';
  return '';
}

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

/** Gerentes y administradores ven todas las tareas visibles sin activar el toggle. */
function userSeesAllTasksByDefault(authUser) {
  return isAdminUser(authUser) || isManagerUser(authUser);
}

function TaskDetailModal({ taskId, onClose, onRefreshList, onOpenTicket }) {
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [requestingCompletion, setRequestingCompletion] = useState(false);

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
  const isAssignee = task ? isTaskAssignee(user, task) : false;
  const isCoordinator = task ? isTaskTicketCoordinator(user, task) : false;
  const completionPending = Boolean(task?.completion_requested_at);
  const canReportCompletion =
    isAssignee && task && !['done', 'cancelled'].includes(task.status) && !completionPending;

  const handleRequestCompletion = async () => {
    if (!task || requestingCompletion || !canReportCompletion) return;
    setRequestingCompletion(true);
    try {
      await axios.post(`/api/ticket-tasks/${task.id}/request-completion`);
      await fetchDetail();
      onRefreshList?.();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo enviar a revisión');
    } finally {
      setRequestingCompletion(false);
    }
  };

  const handleApproveTask = async () => {
    if (!task || !isCoordinator) return;
    try {
      await axios.patch(`/api/ticket-tasks/${task.id}`, { status: 'done' });
      await fetchDetail();
      onRefreshList?.();
    } catch (err) {
      alert(err?.response?.data?.error || 'No se pudo confirmar la tarea');
    }
  };

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
                {completionPending && task.status !== 'done' ? (
                  <span className="meeting-sheet__pill meeting-sheet__pill--review">En revisión</span>
                ) : null}
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
                <div className="meeting-sheet__cell py-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[13px] text-slate-600">
                    <AssigneeBlock task={task} size="sm" />
                    <span className="shrink-0 max-w-[14rem] text-right text-[12px] leading-snug text-slate-500">
                      {formatTaskScheduleLabel(task.start_date, task.end_date)}
                    </span>
                  </div>
                </div>
              </div>

              {(canReportCompletion || completionPending || (isCoordinator && completionPending)) ? (
                <section className="space-y-3">
                  {canReportCompletion ? (
                    <>
                      <p className="meeting-sheet__section-label">Cierre del trabajo</p>
                      <div className="meeting-sheet__group">
                        <button
                          type="button"
                          onClick={handleRequestCompletion}
                          disabled={requestingCompletion}
                          className={`meeting-sheet__radio-row${requestingCompletion ? ' meeting-sheet__radio-row--selected' : ''} disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          <span className="meeting-sheet__modality-icon" aria-hidden>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                          <span className="meeting-sheet__modality-text">
                            <span className="meeting-sheet__modality-label">
                              {requestingCompletion ? 'Enviando a revisión…' : 'He terminado mi trabajo'}
                            </span>
                            <span className="block text-[12px] font-normal text-slate-500">
                              Toca para avisar al coordinador y que revise tu evidencia antes de cerrar la tarea.
                            </span>
                          </span>
                          <span className="meeting-sheet__modality-check" aria-hidden>
                            {requestingCompletion ? (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : null}
                          </span>
                        </button>
                      </div>
                    </>
                  ) : null}

                  {completionPending && isAssignee && !isCoordinator ? (
                    <>
                      <p className="meeting-sheet__section-label">Cierre del trabajo</p>
                      <div className="meeting-sheet__group">
                        <div className="meeting-sheet__radio-row meeting-sheet__radio-row--selected" aria-live="polite">
                          <span className="meeting-sheet__modality-icon meeting-sheet__modality-icon--virtual" aria-hidden>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                          <span className="meeting-sheet__modality-text">
                            <span className="meeting-sheet__modality-label">Enviado a revisión del coordinador</span>
                            <span className="block text-[12px] font-normal text-slate-500">
                              Espera a que revise comentarios y evidencia antes de dar por concluida la tarea.
                            </span>
                          </span>
                          <span className="meeting-sheet__modality-check" aria-hidden>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {isCoordinator && completionPending && task.status !== 'done' ? (
                    <div className="task-completion-request__status task-completion-request__status--coordinator">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">Trabajo reportado como terminado</p>
                        <p className="mt-0.5 text-[12px] text-slate-600">
                          {[task.completion_requester_name, task.completion_requester_apellido].filter(Boolean).join(' ') || 'El responsable'}{' '}
                          solicitó revisión. Verifica comentarios y archivos; luego confirma o cambia el estatus del ticket.
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleApproveTask}
                          className="tasks-module__action-primary gap-1.5 px-4 py-2 text-[13px]"
                        >
                          <ConfirmTaskIcon />
                          Confirmar tarea hecha
                        </button>
                        {task.ticket_id && onOpenTicket ? (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenTicket(task.ticket_id, 'info');
                            }}
                            className="tasks-module__action-secondary px-4 py-2 text-[13px]"
                          >
                            Abrir ticket
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

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
                            <UserAvatar
                              name={c.user_name}
                              apellido={c.user_apellido}
                              avatarUrl={c.user_avatar_url}
                              size="xs"
                              className="shrink-0"
                            />
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

function TasksCalendarView({
  tasks,
  currentDate,
  selectedDay,
  onSelectDay,
  onShiftMonth,
  onOpenTask,
  onDoubleClickDay,
}) {
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const monthTaskCount = useMemo(
    () => tasks.filter((t) => (t.end_date || '').startsWith(monthKey)).length,
    [tasks, monthKey],
  );

  const selectedDayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.end_date === selectedDay)
        .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'es')),
    [tasks, selectedDay],
  );

  const renderCalendar = () => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const days = [];

    for (let i = 0; i < startDay; i += 1) {
      days.push(
        <div key={`pad-${i}`} className="calendar-day-cell calendar-day-cell--pad lg:h-32 border border-gray-100 bg-gray-50/30" />,
      );
    }

    for (let d = 1; d <= totalDays; d += 1) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTasks = tasks.filter((t) => t.end_date === dateStr);
      const isSelected = selectedDay === dateStr;
      const isToday = localDateYMD() === dateStr;

      days.push(
        <div
          key={dateStr}
          role="button"
          tabIndex={0}
          onClick={() => onSelectDay(dateStr)}
          onDoubleClick={() => onDoubleClickDay?.(dateStr)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectDay(dateStr);
            }
          }}
          className={[
            'calendar-day-cell lg:h-32 border p-1 lg:p-2 cursor-pointer transition-all relative flex flex-col lg:block overflow-hidden',
            isSelected ? 'is-selected bg-gold/[0.04] border-gold/30 lg:bg-gold/10 lg:border-gold/50' : 'border-gray-100 hover:bg-navy-50/10',
            isToday && !isSelected ? 'is-today border-gold/20 lg:border-gold/30 lg:bg-gold/[0.07]' : '',
            dayTasks.length > 0 ? 'is-has-meetings' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="flex flex-col items-start shrink-0 px-0.5 pt-0.5 lg:p-0">
            <span
              className={`calendar-day-number ${
                isToday ? 'calendar-day-number--today' : isSelected ? 'calendar-day-number--selected' : 'calendar-day-number--default'
              }`}
            >
              {d}
            </span>
          </div>
          <div className="calendar-day-meetings mt-1 space-y-1 min-h-0 flex-1 overflow-hidden">
            {dayTasks.map((t, i) => (
              <button
                key={t.id ?? i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDay(dateStr);
                  onOpenTask(t);
                }}
                className={getTaskDeadlineChipClass(t)}
                title={`${t.title}${getTaskDeadlineLabel(t) ? ` · ${getTaskDeadlineLabel(t)}` : ''} · ${formatDateShort(t.end_date)}`}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>,
      );
    }

    return days;
  };

  return (
    <div className="tasks-calendar-view space-y-4">
      <div className="tasks-calendar-view__nav">
        <div>
          <p className="tasks-calendar-view__nav-title">Calendario de tareas</p>
          <p className="tasks-calendar-view__nav-sub">
            {monthTaskCount} tarea{monthTaskCount === 1 ? '' : 's'} con término en {MONTH_NAMES[month].toLowerCase()}
          </p>
        </div>
        <div className="calendar-module__month-nav" aria-label="Cambiar mes">
          <button type="button" onClick={() => onShiftMonth(-1)} className="calendar-module__month-btn" aria-label="Mes anterior">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="calendar-module__month-label">
            {MONTH_NAMES[month]} {year}
          </span>
          <button type="button" onClick={() => onShiftMonth(1)} className="calendar-module__month-btn" aria-label="Mes siguiente">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="lg:col-span-3 calendar-module__month-card bg-white rounded-xl lg:rounded-2xl shadow-sm lg:shadow-xl border border-gray-100 overflow-hidden h-fit">
          <div className="tasks-calendar-legend" role="note" aria-label="Leyenda del calendario de tareas">
            <span className="tasks-calendar-legend__title">Leyenda</span>
            <span className="tasks-calendar-legend__item">
              <span className="tasks-calendar-legend__chip tasks-calendar-legend__chip--done" aria-hidden />
              Cumplida
            </span>
            <span className="tasks-calendar-legend__item">
              <span className="tasks-calendar-legend__chip tasks-calendar-legend__chip--overdue" aria-hidden />
              Vencida / no cumplida
            </span>
          </div>
          <div className="calendar-month-scroll">
            <div className="calendar-month-board">
              <div className="calendar-weekdays grid grid-cols-7 bg-navy-950 text-white text-[8px] lg:text-[10px] font-black tracking-[0.16em] lg:tracking-[0.2em] uppercase py-1.5 lg:py-4 border-b border-navy-900">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((wd) => (
                  <div key={wd} className="text-center px-0.5">
                    {wd}
                  </div>
                ))}
              </div>
              <div className="calendar-month-grid grid grid-cols-7">{renderCalendar()}</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="calendar-day-agenda">
            <div className="calendar-day-agenda__header">
              <div>
                <h3 className="calendar-day-agenda__title">Tareas del día</h3>
                <p className="calendar-day-agenda__date">
                  {new Date(`${selectedDay}T12:00:00`).toLocaleDateString('es-MX', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <p className="mt-1 text-[10px] text-white/45">Fecha de término</p>
              </div>
              <span className="calendar-day-agenda__count">
                {selectedDayTasks.length} {selectedDayTasks.length === 1 ? 'tarea' : 'tareas'}
              </span>
            </div>

            <div className="calendar-day-agenda__list">
              {selectedDayTasks.length === 0 ? (
                <div className="calendar-day-agenda__empty">
                  <div className="calendar-day-agenda__empty-icon" aria-hidden>
                    <svg className="h-6 w-6 text-gold/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white/80">Sin tareas</p>
                  <p className="mt-1 text-xs text-white/40">Ninguna tarea vence este día.</p>
                </div>
              ) : (
                selectedDayTasks.map((t, i) => {
                  const tone = getTaskDeadlineTone(t);
                  const st = TASK_STATUS[t.status] || TASK_STATUS.pending;
                  const deadlineLabel = getTaskDeadlineLabel(t);
                  const assigneeName =
                    [t.assignee_name, t.assignee_apellido].filter(Boolean).join(' ') || 'Sin asignar';
                  const deptLabel = taskDept(t);
                  const agendaToneClass =
                    tone === 'done'
                      ? 'tasks-calendar-agenda__item--done'
                      : tone === 'overdue'
                        ? 'tasks-calendar-agenda__item--overdue'
                        : '';
                  return (
                    <button
                      key={t.id ?? i}
                      type="button"
                      onClick={() => onOpenTask(t)}
                      className={[
                        'calendar-day-agenda__item',
                        'tasks-calendar-agenda__item',
                        agendaToneClass,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="calendar-day-agenda__timeline" aria-hidden>
                        <span className="calendar-day-agenda__dot" />
                        {i < selectedDayTasks.length - 1 ? <span className="calendar-day-agenda__line" /> : null}
                      </div>
                      <div className="calendar-day-agenda__card">
                        <div className="calendar-day-agenda__time-row">
                          <span className="calendar-day-agenda__time">{formatDateShort(t.end_date)}</span>
                          <span
                            className="tasks-calendar-agenda__badge"
                            style={{ background: `${st.color}22`, color: st.color }}
                          >
                            {st.label}
                          </span>
                        </div>
                        <h4 className="calendar-day-agenda__meeting-title">{t.title}</h4>
                        <div className="calendar-day-agenda__meta">
                          {deadlineLabel ? (
                            <span className="calendar-day-agenda__location">{deadlineLabel}</span>
                          ) : null}
                          <span className="calendar-day-agenda__attendees tasks-calendar-agenda__assignee">
                            <UserAvatar
                              name={t.assignee_name}
                              apellido={t.assignee_apellido}
                              avatarUrl={t.assignee_avatar_url}
                              size="xs"
                            />
                            <span className="tasks-calendar-agenda__assignee-text min-w-0">
                              <span className="truncate block font-medium text-navy-900/80">{assigneeName}</span>
                              {deptLabel ? (
                                <span className="tasks-calendar-agenda__dept truncate block">{deptLabel}</span>
                              ) : null}
                            </span>
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TasksModule({ onOpenTicket } = {}) {
  const { user } = useAuth();
  const { departments: catalogDepartments } = useCatalog();
  const isMobile = useMediaQuery(MOBILE_MQ);
  const [tasks, setTasks] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => localDateYMD());
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

  const shiftCalendarMonth = (delta) => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const openCreateForDay = (dateStr) => {
    if (!canCreate) return;
    const form = freshStandaloneTaskForm(user);
    setCreateForm({ ...form, start_date: dateStr, end_date: dateStr });
    setCreateOpen(true);
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

  return (
    <div className="tasks-module surface-light h-full flex flex-col animate-fade-in pb-4">
      <header className="tasks-module__top">
        <div>
          <h2 className="tasks-module__title">Tareas operativas</h2>
          <p className="tasks-module__subtitle">
            {stats.total} tarea{stats.total === 1 ? '' : 's'} · calendario por fecha de término
            {!showAllTasks && !seesAllByRole ? ' · asignadas a ti' : ''}
          </p>
        </div>
        <div className="tasks-module__toolbar">
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
      ) : (
        <>
          {filteredTasks.length === 0 ? (
            <div className="tasks-module__empty mb-4 py-8">
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
          ) : null}
          <TasksCalendarView
            tasks={filteredTasks}
            currentDate={calendarDate}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onShiftMonth={shiftCalendarMonth}
            onOpenTask={openTaskDetail}
            onDoubleClickDay={openCreateForDay}
          />
        </>
      )}

      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
          onRefreshList={fetchTasks}
          onOpenTicket={onOpenTicket}
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
                    Sin ticket — queda en el calendario del departamento.
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
