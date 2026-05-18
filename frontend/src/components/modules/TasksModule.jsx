import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const TASK_STATUS = {
  pending: { label: 'Pendiente', color: '#94a3b8' },
  in_progress: { label: 'En progreso', color: '#CBAC80' },
  done: { label: 'Hecha', color: '#10b981' },
  cancelled: { label: 'Cancelada', color: '#64748b' },
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

const BAR_COLORS = ['#1e3a5f', '#2d5f8f', '#CBAC80', '#3b82f6', '#0d9488', '#7c3aed'];

export default function TasksModule({ onOpenTicket } = {}) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('gantt');

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

  const { minTime, maxTime } = useMemo(() => {
    if (!tasks.length) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(end.getDate() + 14);
      return { minTime: now.getTime(), maxTime: end.getTime() };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const t of tasks) {
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
  }, [tasks]);

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

  return (
    <div className="h-full flex flex-col animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-medium text-navy-950 tracking-tight">Tareas operativas</h2>
          <p className="text-sm text-navy-600 mt-1 max-w-3xl">
            Cronograma ligado a tickets. Desde aquí puedes abrir el requerimiento cuando lo necesites.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView('gantt')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition ${view === 'gantt' ? 'bg-navy-950 text-gold' : 'bg-white border border-gray-200 text-navy-700 hover:border-gold/40'}`}
          >
            Gantt
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition ${view === 'list' ? 'bg-navy-950 text-gold' : 'bg-white border border-gray-200 text-navy-700 hover:border-gold/40'}`}
          >
            Lista
          </button>
          <button type="button" onClick={() => fetchTasks()} className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white border border-gray-200 text-navy-700 hover:border-gold/40">
            Actualizar
          </button>
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
            El gerente de departamento las define desde el ticket.
          </p>
        </div>
      ) : view === 'gantt' ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-gray-50/80">
            <p className="text-[10px] font-bold uppercase tracking-widest text-navy-700">Cronograma</p>
            <p className="text-[10px] text-navy-500 font-medium">{rangeLabel}</p>
          </div>
          <div className="relative h-8 border-b border-gray-100 bg-white px-4">
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
          <div className="divide-y divide-gray-100 max-h-[min(70vh,520px)] overflow-y-auto">
            {tasks.map((t, idx) => {
              const st = TASK_STATUS[t.status] || TASK_STATUS.pending;
              const { left, width } = barLayout(t.start_date, t.end_date);
              const color = BAR_COLORS[idx % BAR_COLORS.length];
              const assignee = [t.assignee_name, t.assignee_apellido].filter(Boolean).join(' ') || '—';
              const canManage = canManageTaskRow(user, t);
              const isAssignee = Number(t.assigned_to) === Number(user?.id);
              const canStatus = canManage || isAssignee;
              return (
                <div key={t.id} className="flex flex-col sm:flex-row sm:items-stretch gap-0 sm:gap-0">
                  <div className="sm:w-52 flex-shrink-0 p-3 border-b sm:border-b-0 sm:border-r border-gray-100 bg-gray-50/40">
                    <p className="text-xs font-bold text-navy-950 leading-snug line-clamp-2">{t.title}</p>
                    <p className="text-[10px] text-navy-500 mt-1">
                      Ticket #{t.ticket_id} · {t.ticket_title || '—'}
                    </p>
                    {onOpenTicket && (
                      <button
                        type="button"
                        onClick={() => onOpenTicket(t.ticket_id)}
                        className="mt-1.5 text-[9px] font-bold uppercase tracking-wide text-navy-950 bg-gold/20 hover:bg-gold/35 px-2 py-1 rounded border border-gold/40"
                      >
                        Abrir ticket #{t.ticket_id}
                      </button>
                    )}
                    <p className="text-[10px] text-navy-600 mt-0.5">{assignee}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: st.color + '22', color: st.color }}>
                        {st.label}
                      </span>
                      {canStatus && (
                        <select
                          value={t.status}
                          onChange={(e) => updateStatus(t.id, e.target.value)}
                          className="text-[9px] border border-gray-200 rounded px-1.5 py-0.5 bg-white text-navy-800"
                        >
                          {Object.entries(TASK_STATUS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {canManage && (
                        <button type="button" onClick={() => deleteTask(t.id)} className="text-[9px] font-bold text-red-600 hover:underline">
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 p-3 min-h-[52px]">
                    <div className="relative h-9 rounded-md bg-gray-100 overflow-hidden">
                      <div
                        className="absolute top-1 bottom-1 rounded shadow-sm flex items-center px-2 min-w-[8px]"
                        style={{ left: `${left}%`, width: `${width}%`, background: color }}
                        title={`${t.start_date} → ${t.end_date}`}
                      >
                        <span className="text-[9px] font-bold text-white truncate drop-shadow-sm">
                          {new Date(t.start_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} —{' '}
                          {new Date(t.end_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-[10px] uppercase tracking-widest text-navy-600">
                <th className="px-4 py-3 font-bold">Tarea</th>
                <th className="px-4 py-3 font-bold">Ticket / enlace</th>
                <th className="px-4 py-3 font-bold">Responsable</th>
                <th className="px-4 py-3 font-bold">Inicio</th>
                <th className="px-4 py-3 font-bold">Fin</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3 font-bold w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((t) => {
                const st = TASK_STATUS[t.status] || TASK_STATUS.pending;
                const assignee = [t.assignee_name, t.assignee_apellido].filter(Boolean).join(' ') || '—';
                const canManage = canManageTaskRow(user, t);
                const isAssignee = Number(t.assigned_to) === Number(user?.id);
                const canStatus = canManage || isAssignee;
                return (
                  <tr key={t.id} className="hover:bg-gold/5">
                    <td className="px-4 py-3">
                      <p className="font-bold text-navy-950 text-xs">{t.title}</p>
                      {t.description ? <p className="text-[10px] text-navy-500 line-clamp-2 mt-0.5">{t.description}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-navy-700">
                      <span className="tabular-nums">#{t.ticket_id}</span>
                      <span className="block text-[10px] text-navy-500 line-clamp-2">{t.ticket_title}</span>
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
                    <td className="px-4 py-3 text-xs text-navy-700">{assignee}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-navy-700">{t.start_date}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-navy-700">{t.end_date}</td>
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
    </div>
  );
}
