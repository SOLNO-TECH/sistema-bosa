import { useState, useEffect, useMemo } from 'react';
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
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-gold/25 bg-gold/5 ${compact ? 'p-2.5' : 'p-3'}`}>
      <span className={`shrink-0 flex items-center justify-center rounded-md bg-gold/25 font-black text-navy-950 ${compact ? 'h-9 w-9 text-[10px]' : 'h-8 w-8 text-[10px] rounded-lg'}`}>
        ✦
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-navy-800 ${compact ? 'text-[10px]' : 'text-xs'}`}>Tarea independiente</p>
        {dept ? (
          <p className={`text-navy-500 mt-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            Depto. <span className="font-bold text-navy-700">{dept}</span>
          </p>
        ) : null}
        {task.description ? (
          <p className={`text-navy-600 mt-1 line-clamp-2 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{task.description}</p>
        ) : null}
      </div>
    </div>
  );
}

function TaskMobileCard({
  task,
  canManage,
  canStatus,
  onOpenTicket,
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
          <div className="flex items-start gap-2">
            <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-gold/20 text-[10px] font-black text-navy-950">
              ✦
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-navy-800">Tarea independiente</p>
              {dept ? (
                <p className="text-[10px] text-navy-500 mt-1">
                  Depto. <span className="font-bold text-navy-700">{dept}</span>
                </p>
              ) : null}
              {task.description ? (
                <p className="text-[10px] text-navy-600 mt-1 line-clamp-2">{task.description}</p>
              ) : null}
            </div>
          </div>
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
    return (
      <div className="flex flex-wrap items-center gap-2 mt-3">
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
                        <span className="inline-flex text-[10px] font-bold uppercase tracking-wide text-navy-800 bg-gold/15 px-2 py-1 rounded border border-gold/30">
                          Independiente
                        </span>
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
                    <td className="px-4 py-3">
                      {canManage && (
                        <button type="button" onClick={() => deleteTask(t.id)} className="text-[10px] font-bold text-red-600 hover:underline">
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
        <strong className="text-navy-950">Tickets → Detalle y tareas</strong>. Sube tu foto en{' '}
        <strong className="text-navy-950">Configuración → Perfil</strong> para verla en el cronograma.
      </p>

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
