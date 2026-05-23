import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import UserAvatar from '../UserAvatar';

const TASK_STATUS = {
  pending: { label: 'Pendiente', color: '#94a3b8' },
  in_progress: { label: 'En progreso', color: '#CBAC80' },
  done: { label: 'Hecha', color: '#10b981' },
  cancelled: { label: 'Cancelada', color: '#64748b' },
};

const TICKET_STATUS = {
  open: { label: 'Ticket pendiente', color: '#94a3b8' },
  in_progress: { label: 'Ticket en progreso', color: '#CBAC80' },
  resolved: { label: 'Ticket en revisión', color: '#3b82f6' },
  closed: { label: 'Ticket cerrado', color: '#10b981' },
};

function canManageTaskRow(authUser, row) {
  if (!authUser || !row) return false;
  if (authUser.role === 'superadmin' || authUser.role === 'administrator') return true;
  if (authUser.role !== 'manager') return false;
  const cat = (row.ticket_category || '').trim();
  const dept = (authUser.departamento || '').trim();
  return Boolean(cat && dept === cat);
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
  const dept = (task.assignee_departamento || task.ticket_category || '').trim();
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
  const dept = (task.ticket_category || '').trim();
  const tSt = TICKET_STATUS[task.ticket_status] || null;
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

function TaskMobileCard({
  task,
  canManage,
  canStatus,
  onOpenTicket,
  onStatusChange,
  onDelete,
}) {
  const st = TASK_STATUS[task.status] || TASK_STATUS.pending;
  const dept = (task.ticket_category || '').trim();
  const duration = taskDurationLabel(task.start_date, task.end_date);

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

      {onOpenTicket && (
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
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(getInitialView);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMine, setFilterMine] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  }, []);

  const departments = useMemo(() => {
    const set = new Set();
    tasks.forEach((t) => {
      const d = (t.ticket_category || '').trim();
      if (d) set.add(d);
    });
    return [...set].sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterDept && (t.ticket_category || '').trim() !== filterDept) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterMine && Number(t.assigned_to) !== Number(user?.id)) return false;
      if (!q) return true;
      const hay = [
        t.title,
        t.ticket_title,
        t.assignee_name,
        t.assignee_apellido,
        t.ticket_category,
        String(t.ticket_id),
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
    <div className="h-full flex flex-col animate-fade-in space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-medium text-navy-950 tracking-tight">Tareas operativas</h2>
          <p className="text-sm text-navy-600 mt-1 max-w-2xl">
            {isMobile
              ? 'Vista en tarjetas: más clara en el celular. En computadora puedes usar el cronograma Gantt.'
              : 'Cronograma de trabajo por ticket: departamento, responsable con foto y fechas.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Resumen — scroll horizontal en móvil */}
      <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-visible md:pb-0">
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm min-w-[88px] snap-start shrink-0 md:min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-navy-500">Visibles</p>
          <p className="text-lg font-bold text-navy-950 tabular-nums">{stats.total}</p>
        </div>
        {Object.entries(TASK_STATUS).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm min-w-[88px] snap-start shrink-0 md:min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: v.color }}>
              {v.label}
            </p>
            <p className="text-lg font-bold text-navy-950 tabular-nums">{stats[k] ?? 0}</p>
          </div>
        ))}
      </div>

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
            El gerente del departamento las crea desde el ticket, pestaña <strong>Tareas operativas</strong>.
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
              const dept = (t.ticket_category || '').trim();
              return (
                <div key={t.id} className="flex flex-col sm:grid sm:grid-cols-[minmax(280px,320px)_1fr] sm:items-stretch hover:bg-gold/[0.03] transition-colors">
                  <div className="p-4 border-b sm:border-b-0 sm:border-r border-gray-100 bg-white sm:bg-gray-50/30">
                    <p className="text-xs font-bold text-navy-950 leading-snug">{t.title}</p>
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-gray-100 bg-white p-2.5 shadow-sm">
                      <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-md bg-navy-950 text-[10px] font-black text-gold tabular-nums">
                        #{t.ticket_id}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-navy-800 line-clamp-2">{t.ticket_title || 'Sin título'}</p>
                        {dept ? (
                          <p className="text-[9px] text-navy-500 mt-0.5">
                            Depto. ticket: <span className="font-bold text-navy-700">{dept}</span>
                          </p>
                        ) : null}
                        {onOpenTicket && (
                          <button
                            type="button"
                            onClick={() => onOpenTicket(t.ticket_id)}
                            className="mt-1.5 text-[9px] font-bold uppercase tracking-wide text-navy-950 bg-gold/25 hover:bg-gold/40 px-2 py-1 rounded border border-gold/40"
                          >
                            Abrir ticket #{t.ticket_id}
                          </button>
                        )}
                      </div>
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
                    <p className="text-[9px] text-navy-400 mt-1.5 text-center sm:text-left tabular-nums">
                      {t.start_date} → {t.end_date}
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
                const dept = (t.ticket_category || '').trim();
                return (
                  <tr key={t.id} className="hover:bg-gold/5 align-top">
                    <td className="px-4 py-3">
                      <p className="font-bold text-navy-950 text-xs">{t.title}</p>
                      {t.description ? <p className="text-[10px] text-navy-500 line-clamp-2 mt-0.5">{t.description}</p> : null}
                      <span className="inline-block mt-1 text-[9px] text-slate-500 tabular-nums">{taskDurationLabel(t.start_date, t.end_date)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-navy-700">
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
                    </td>
                    <td className="px-4 py-3">
                      {dept ? <DeptBadge label={dept} /> : <span className="text-[10px] text-navy-400">—</span>}
                      {TICKET_STATUS[t.ticket_status] ? (
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
                    <td className="px-4 py-3 text-xs tabular-nums text-navy-700 whitespace-nowrap">
                      <span className="block">{t.start_date}</span>
                      <span className="text-navy-400">→</span>
                      <span className="block">{t.end_date}</span>
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

      <p className="text-[10px] text-navy-400 text-center pb-2">
        Las tareas se crean en <strong className="text-navy-600">Tickets → detalle → Tareas operativas</strong>. Sube tu foto en{' '}
        <strong className="text-navy-600">Configuración → Perfil</strong> para verla aquí.
      </p>
    </div>
  );
}
