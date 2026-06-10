import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { isSuperadminUser } from '../../utils/permissions';
import { localDateYMD } from '../../utils/localDate';
import MeetingMinuteAudioPlayer from '../MeetingMinuteAudioPlayer';
import MinutaListenModal from '../MinutaListenModal';
import BosaGoldButton from '../BosaGoldButton';
import { MinutaPdfProLock, MinutaProLockedBlocks } from '../MinutaProSections';

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

function IconEye({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconListen({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396.234-.847 1.058-1.354 1.938-1.354H6.75z"
      />
    </svg>
  );
}

function IconPencil({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

function IconTrash({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

/** Minuta generada desde el calendario (reunión), no desde «Nueva minuta». */
function isMinuteFromMeeting(record) {
  const meetingId = Number(record?.meeting_id);
  return Number.isFinite(meetingId) && meetingId > 0;
}

function minuteHasRecording(record) {
  return Boolean(record?.audio_url || record?.audio_path);
}

function canListenMinute(record) {
  return isMinuteFromMeeting(record) && minuteHasRecording(record);
}

const emptyAttendee = () => ({ nombre: '', cargo: '', asistencia: 'Presente' });
const emptyTopics = () => [
  { titulo: '', descripcion: '', comentarios: '' },
  { titulo: '', descripcion: '', comentarios: '' },
  { titulo: '', descripcion: '', comentarios: '' },
];

function formatFechaTabla(fecha) {
  if (!fecha) return '—';
  try {
    const d = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return fecha;
  }
}

function creatorLabel(m) {
  const n = [m.creator_name, m.creator_apellido].filter(Boolean).join(' ').trim();
  return n || '—';
}

function formatHorario(inicio, cierre) {
  if (!inicio && !cierre) return null;
  if (inicio && cierre) return `${inicio} – ${cierre}`;
  return inicio || cierre;
}

function MinutaCard({ record, canDelete, onView, onListen, onEdit, onDelete }) {
  const horario = formatHorario(record.hora_inicio, record.hora_cierre);
  const showListen = canListenMinute(record);
  const fromMeeting = isMinuteFromMeeting(record);
  const creator = creatorLabel(record);

  return (
    <article className="tasks-module__card minuta-card">
      <div className="tasks-module__card-main">
        <div className="flex items-start justify-between gap-3">
          <h3 className="tasks-module__card-title flex-1 min-w-0">{record.tema || 'Sin tema'}</h3>
          <span className="tasks-module__pill shrink-0 tabular-nums bg-slate-100 text-slate-600">
            {formatFechaTabla(record.fecha)}
          </span>
        </div>
        <div className="tasks-module__card-meta">
          {record.lugar ? (
            <span className="tasks-module__pill bg-slate-100 text-slate-600">{record.lugar}</span>
          ) : null}
          {fromMeeting ? (
            <span className="tasks-module__pill" style={{ background: 'rgba(7,18,33,0.08)', color: '#071221' }}>
              Desde reunión
            </span>
          ) : null}
          {showListen ? (
            <span className="tasks-module__pill bg-emerald-50 text-emerald-800">Con audio</span>
          ) : null}
        </div>
      </div>

      {(horario || creator !== '—') ? (
        <div className="tasks-module__card-section">
          {horario ? (
            <div className="tasks-module__card-dates">
              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {horario}
            </div>
          ) : null}
          {creator !== '—' ? (
            <p className={`text-[13px] text-slate-500${horario ? ' mt-2' : ''}`}>
              Registrada por <span className="font-semibold text-slate-700">{creator}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="tasks-module__card-actions minuta-card__actions">
        <button
          type="button"
          onClick={() => onView(record.id)}
          className="tasks-module__action-primary minuta-card__btn minuta-card__btn--primary gap-1.5"
        >
          <span className="tasks-module__action-icon-wrap tasks-module__action-icon-wrap--evidence" aria-hidden>
            <IconEye className="tasks-module__action-icon" />
          </span>
          Visualizar
        </button>
        <div className="minuta-card__toolbar" role="group" aria-label="Acciones de la minuta">
          <MinutaPdfProLock className="minuta-card__btn" />
          {showListen ? (
            <button
              type="button"
              onClick={() => onListen(record)}
              className="tasks-module__action-secondary minuta-card__btn gap-1.5"
            >
              <IconListen className="h-4 w-4 shrink-0" />
              Escuchar
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onEdit(record.id)}
            className="tasks-module__action-secondary minuta-card__btn gap-1.5"
          >
            <IconPencil className="h-4 w-4 shrink-0" />
            Editar
          </button>
          {canDelete ? (
            <button
              type="button"
              onClick={() => onDelete(record.id)}
              className="tasks-module__action-danger minuta-card__btn gap-1.5"
            >
              <IconTrash className="h-4 w-4 shrink-0" />
              Eliminar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function MinutasModule() {
  const { user } = useAuth();
  const canDeleteMinuta = isSuperadminUser(user);
  const isMobile = useMediaQuery(MOBILE_MQ);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterSort, setFilterSort] = useState('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [listenRecord, setListenRecord] = useState(null);
  const [formMeetingId, setFormMeetingId] = useState(null);

  const [form, setForm] = useState({
    lugar: '',
    fecha: '',
    hora_inicio: '',
    hora_cierre: '',
    tema: '',
    attendees: Array.from({ length: 6 }, () => emptyAttendee()),
    topics: emptyTopics(),
  });

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/minutes');
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filtered = useMemo(() => {
    let rows = list;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((m) => {
        const blob = [m.tema, m.lugar, creatorLabel(m), m.fecha].join(' ').toLowerCase();
        return blob.includes(q);
      });
    }
    if (filterPeriod === 'month') {
      const now = new Date();
      const y = now.getFullYear();
      const mo = now.getMonth();
      rows = rows.filter((m) => {
        if (!m.fecha) return false;
        const d = new Date(`${m.fecha}T12:00:00`);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === mo;
      });
    } else if (filterPeriod === 'quarter') {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 3);
      rows = rows.filter((m) => {
        if (!m.fecha) return false;
        const d = new Date(`${m.fecha}T12:00:00`);
        return !Number.isNaN(d.getTime()) && d >= cutoff;
      });
    }
    rows = [...rows].sort((a, b) => {
      const ta = String(a.created_at || a.fecha || '');
      const tb = String(b.created_at || b.fecha || '');
      return filterSort === 'asc' ? ta.localeCompare(tb) : tb.localeCompare(ta);
    });
    return rows;
  }, [list, search, filterPeriod, filterSort]);

  const stats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    let monthCount = 0;
    let quarterCount = 0;
    for (const m of list) {
      if (!m.fecha) continue;
      const d = new Date(`${m.fecha}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() === y && d.getMonth() === mo) monthCount++;
      if (d >= cutoff) quarterCount++;
    }
    return { total: filtered.length, all: list.length, month: monthCount, quarter: quarterCount };
  }, [list, filtered.length]);

  const filtersActive = Boolean(search || filterPeriod || filterSort !== 'desc');

  const openCreate = () => {
    setEditingId(null);
    setFormMeetingId(null);
    setForm({
      lugar: '',
      fecha: localDateYMD(),
      hora_inicio: '',
      hora_cierre: '',
      tema: '',
      attendees: Array.from({ length: 6 }, () => emptyAttendee()),
      topics: emptyTopics(),
    });
    setModal('create');
  };

  const openEdit = async (id) => {
    try {
      const { data } = await axios.get(`/api/minutes/${id}`);
      const att = Array.isArray(data.attendees) ? [...data.attendees] : [];
      while (att.length < 6) att.push(emptyAttendee());
      setForm({
        lugar: data.lugar || '',
        fecha: data.fecha || '',
        hora_inicio: data.hora_inicio || '',
        hora_cierre: data.hora_cierre || '',
        tema: data.tema || '',
        attendees: att,
        topics: [0, 1, 2].map((i) => ({
          titulo: data.topics?.[i]?.titulo ?? '',
          descripcion: data.topics?.[i]?.descripcion ?? '',
          comentarios: data.topics?.[i]?.comentarios ?? '',
        })),
      });
      setEditingId(id);
      const mid = Number(data.meeting_id);
      setFormMeetingId(Number.isFinite(mid) && mid > 0 ? mid : null);
      setModal('edit');
    } catch (e) {
      console.error(e);
      alert('No se pudo cargar la minuta.');
    }
  };

  const openView = async (id) => {
    try {
      const { data } = await axios.get(`/api/minutes/${id}`);
      setViewRecord(data);
      setModal('view');
    } catch (e) {
      console.error(e);
      alert('No se pudo cargar la minuta.');
    }
  };

  const openListen = async (record) => {
    if (!isMinuteFromMeeting(record)) return;
    try {
      let full = record;
      if (!minuteHasRecording(record) || !record.audio_url) {
        const { data } = await axios.get(`/api/minutes/${record.id}`);
        full = data;
      }
      if (!minuteHasRecording(full)) {
        alert('Esta minuta de reunión no tiene grabación de audio guardada.');
        return;
      }
      setListenRecord(full);
    } catch (e) {
      console.error(e);
      alert('No se pudo cargar el audio de la reunión.');
    }
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
    setViewRecord(null);
    setEditingId(null);
    setFormMeetingId(null);
  };

  const setAttendee = (idx, field, value) => {
    setForm((f) => {
      const attendees = [...f.attendees];
      attendees[idx] = { ...attendees[idx], [field]: value };
      return { ...f, attendees };
    });
  };

  const addAttendeeRow = () => {
    setForm((f) => ({ ...f, attendees: [...f.attendees, emptyAttendee()] }));
  };

  const removeAttendeeRow = (idx) => {
    if (form.attendees.length <= 1) return;
    setForm((f) => ({
      ...f,
      attendees: f.attendees.filter((_, i) => i !== idx),
    }));
  };

  const setTopic = (idx, field, value) => {
    setForm((f) => {
      const topics = [...f.topics];
      topics[idx] = { ...topics[idx], [field]: value };
      return { ...f, topics };
    });
  };

  const buildPayload = () => ({
    lugar: form.lugar,
    fecha: form.fecha,
    hora_inicio: form.hora_inicio,
    hora_cierre: form.hora_cierre,
    tema: form.tema,
    attendees: form.attendees,
    topics: form.topics,
  });

  const handleSave = async () => {
    if (!form.fecha) {
      alert('Indica la fecha de la reunión.');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await axios.put(`/api/minutes/${editingId}`, payload);
      } else {
        await axios.post('/api/minutes', payload);
      }
      await fetchList();
      closeModal();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta minuta? Esta acción no se puede deshacer.')) return;
    try {
      await axios.delete(`/api/minutes/${id}`);
      await fetchList();
    } catch (e) {
      console.error(e);
      alert('No se pudo eliminar.');
    }
  };

  return (
    <div className="tasks-module surface-light h-full animate-fade-in pb-4">
      <header className="tasks-module__top">
        <div>
          <h2 className="tasks-module__title">Minutas de reunión</h2>
          <p className="tasks-module__subtitle">
            {stats.total} minuta{stats.total === 1 ? '' : 's'} · actas y exportación PDF
          </p>
        </div>
        <div className="tasks-module__toolbar">
          <button type="button" onClick={() => fetchList()} className="tasks-module__btn-ghost">
            Actualizar
          </button>
          <BosaGoldButton icon="minute" onClick={openCreate} className="sm:!w-auto" aria-label="Nueva minuta">
            Nueva minuta
          </BosaGoldButton>
        </div>
      </header>

      <div className="tasks-module__stats">
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.all}</div>
          <div className="tasks-module__stat-label">Total</div>
        </div>
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.month}</div>
          <div className="tasks-module__stat-label">Este mes</div>
        </div>
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.quarter}</div>
          <div className="tasks-module__stat-label">Últimos 3 meses</div>
        </div>
        <div className="tasks-module__stat sm:col-span-2 lg:col-span-1">
          <div className="tasks-module__stat-value">{stats.total}</div>
          <div className="tasks-module__stat-label">Visibles</div>
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
            {filtersActive && <span className="ml-1 text-gold">· activos</span>}
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
          <div className="sm:col-span-2">
            <label className="tasks-module__field-label" htmlFor="minutas-search">
              Buscar
            </label>
            <input
              id="minutas-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tema, lugar, autor o fecha…"
              className="tasks-module__field"
            />
          </div>
          <div>
            <label className="tasks-module__field-label" htmlFor="minutas-period">
              Periodo
            </label>
            <select
              id="minutas-period"
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="tasks-module__field"
            >
              <option value="">Todos</option>
              <option value="month">Mes en curso</option>
              <option value="quarter">Últimos 3 meses</option>
            </select>
          </div>
          <div>
            <label className="tasks-module__field-label" htmlFor="minutas-sort">
              Orden
            </label>
            <select
              id="minutas-sort"
              value={filterSort}
              onChange={(e) => setFilterSort(e.target.value)}
              className="tasks-module__field"
            >
              <option value="desc">Más recientes</option>
              <option value="asc">Más antiguas</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      ) : list.length === 0 ? (
        <div className="tasks-module__empty">
          <p className="text-[15px] font-semibold text-slate-800">Sin minutas registradas</p>
          <p className="mx-auto mt-2 max-w-sm text-[14px] text-slate-500">
            Crea la primera acta de reunión con asistentes, temas y exportación a PDF.
          </p>
          <BosaGoldButton icon="minute" onClick={openCreate} className="mt-4 sm:!w-auto" aria-label="Nueva minuta">
            Nueva minuta
          </BosaGoldButton>
        </div>
      ) : filtered.length === 0 ? (
        <div className="tasks-module__empty">
          <p className="text-[15px] font-semibold text-slate-800">Ninguna minuta coincide con los filtros</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilterPeriod('');
              setFilterSort('desc');
            }}
            className="tasks-module__btn-ghost mt-4"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="tasks-module__list">
          {filtered.map((m) => (
            <MinutaCard
              key={m.id}
              record={m}
              canDelete={canDeleteMinuta}
              onView={openView}
              onListen={openListen}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {(modal === 'create' || modal === 'edit') &&
        createPortal(
          <div className="meeting-sheet-overlay z-[120] animate-fade-in" onClick={closeModal} role="presentation">
            <div
              className="meeting-sheet meeting-sheet--form meeting-sheet--wide animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="minuta-form-title"
            >
              <div className="meeting-sheet__hero shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="meeting-sheet__pill meeting-sheet__pill--gold">Acta de reunión</span>
                    <h3 id="minuta-form-title" className="meeting-sheet__hero-title mt-2">
                      {modal === 'edit' ? 'Editar minuta' : 'Nueva minuta'}
                    </h3>
                    <p className="meeting-sheet__hero-subtitle">
                      {modal === 'edit' && formMeetingId
                        ? 'Edita datos generales y asistentes. El análisis IA y el PDF son Pro.'
                        : 'Datos generales, asistentes y hasta tres temas del día.'}
                    </p>
                  </div>
                  <button type="button" onClick={closeModal} className="meeting-sheet__close" aria-label="Cerrar">
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
                  handleSave();
                }}
              >
                <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
                  <p className="meeting-sheet__section-label">Datos generales</p>
                  <div className="meeting-sheet__group">
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Lugar</label>
                      <input
                        className="meeting-sheet__input"
                        value={form.lugar}
                        onChange={(e) => setForm((f) => ({ ...f, lugar: e.target.value }))}
                        placeholder="Sala, dirección u oficina"
                      />
                    </div>
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Fecha</label>
                      <input
                        type="date"
                        className="meeting-sheet__input tabular-nums"
                        value={form.fecha}
                        onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Hora inicio</label>
                      <input
                        type="time"
                        className="meeting-sheet__input tabular-nums"
                        value={form.hora_inicio}
                        onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                      />
                    </div>
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Hora cierre</label>
                      <input
                        type="time"
                        className="meeting-sheet__input tabular-nums"
                        value={form.hora_cierre}
                        onChange={(e) => setForm((f) => ({ ...f, hora_cierre: e.target.value }))}
                      />
                    </div>
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Tema de la reunión</label>
                      <input
                        className="meeting-sheet__input meeting-sheet__input--title"
                        value={form.tema}
                        onChange={(e) => setForm((f) => ({ ...f, tema: e.target.value }))}
                        placeholder="Asunto o título general"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-4 pb-1">
                    <p className="meeting-sheet__section-label mb-0">Asistentes</p>
                    <button
                      type="button"
                      onClick={addAttendeeRow}
                      className="text-[13px] font-semibold text-gold"
                    >
                      Añadir
                    </button>
                  </div>
                  {form.attendees.map((row, idx) => (
                    <div key={idx} className="meeting-sheet__group mb-3">
                      <div className="meeting-sheet__cell flex items-center justify-between gap-2">
                        <span className="meeting-sheet__cell-label mb-0">Asistente {idx + 1}</span>
                        {form.attendees.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAttendeeRow(idx)}
                            className="tasks-module__action-danger text-[13px]"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <div className="meeting-sheet__cell meeting-sheet__cell--field">
                        <label className="meeting-sheet__cell-label">Nombre</label>
                        <input
                          className="meeting-sheet__input"
                          value={row.nombre}
                          onChange={(e) => setAttendee(idx, 'nombre', e.target.value)}
                          placeholder="Nombre"
                        />
                      </div>
                      <div className="meeting-sheet__cell meeting-sheet__cell--field">
                        <label className="meeting-sheet__cell-label">Cargo</label>
                        <input
                          className="meeting-sheet__input"
                          value={row.cargo}
                          onChange={(e) => setAttendee(idx, 'cargo', e.target.value)}
                          placeholder="Cargo"
                        />
                      </div>
                      <div className="meeting-sheet__cell meeting-sheet__cell--field">
                        <label className="meeting-sheet__cell-label">Asistencia</label>
                        <select
                          className="meeting-sheet__select"
                          value={row.asistencia}
                          onChange={(e) => setAttendee(idx, 'asistencia', e.target.value)}
                        >
                          <option value="Presente">Presente</option>
                          <option value="Ausente">Ausente</option>
                          <option value="Justificado">Justificado</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {formMeetingId ? (
                    <MinutaProLockedBlocks />
                  ) : (
                    <>
                      <p className="meeting-sheet__section-label">Temas del día</p>
                      {form.topics.map((topic, idx) => (
                        <div key={idx} className="meeting-sheet__group mb-4">
                          <div className="meeting-sheet__cell">
                            <span className="meeting-sheet__pill meeting-sheet__pill--gold">Tema {idx + 1}</span>
                          </div>
                          <div className="meeting-sheet__cell meeting-sheet__cell--field">
                            <label className="meeting-sheet__cell-label">Título</label>
                            <input
                              className="meeting-sheet__input"
                              value={topic.titulo}
                              onChange={(e) => setTopic(idx, 'titulo', e.target.value)}
                            />
                          </div>
                          <div className="meeting-sheet__cell meeting-sheet__cell--field">
                            <label className="meeting-sheet__cell-label">Descripción</label>
                            <textarea
                              className="meeting-sheet__textarea"
                              rows={3}
                              value={topic.descripcion}
                              onChange={(e) => setTopic(idx, 'descripcion', e.target.value)}
                            />
                          </div>
                          <div className="meeting-sheet__cell meeting-sheet__cell--field">
                            <label className="meeting-sheet__cell-label">Comentarios</label>
                            <textarea
                              className="meeting-sheet__textarea"
                              rows={3}
                              value={topic.comentarios}
                              onChange={(e) => setTopic(idx, 'comentarios', e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="meeting-sheet__footer voice-minute-sheet__footer shrink-0">
                  <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
                    <button
                      type="button"
                      onClick={closeModal}
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
                      disabled={saving}
                      className="voice-minute-footer__btn voice-minute-footer__btn--primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <span
                            className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-navy-950/25 border-t-navy-950"
                            aria-hidden
                          />
                          Guardando…
                        </>
                      ) : (
                        <>
                          <svg
                            className="voice-minute-footer__icon voice-minute-footer__icon--save"
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
                            <path d="M9 14l2 2 4-4.5" />
                          </svg>
                          Guardar minuta
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

      {modal === 'view' &&
        viewRecord &&
        createPortal(
          <div className="meeting-sheet-overlay z-[125] animate-fade-in" onClick={closeModal} role="presentation">
            <div
              className="meeting-sheet meeting-sheet--form meeting-sheet--wide animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="minuta-view-title"
            >
              <div className="meeting-sheet__hero shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="meeting-sheet__pill meeting-sheet__pill--gold">Visualizar minuta</span>
                    <h3 id="minuta-view-title" className="meeting-sheet__hero-title mt-2">
                      {viewRecord.tema || 'Minuta de reunión'}
                    </h3>
                    <p className="meeting-sheet__hero-subtitle">
                      {formatFechaTabla(viewRecord.fecha)}
                      {viewRecord.lugar ? ` · ${viewRecord.lugar}` : ''}
                      {formatHorario(viewRecord.hora_inicio, viewRecord.hora_cierre)
                        ? ` · ${formatHorario(viewRecord.hora_inicio, viewRecord.hora_cierre)}`
                        : ''}
                    </p>
                  </div>
                  <button type="button" onClick={closeModal} className="meeting-sheet__close" aria-label="Cerrar">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="meeting-sheet__scroll">
                <p className="meeting-sheet__section-label">Datos generales</p>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell">
                    <p className="meeting-sheet__cell-label">Lugar</p>
                    <p className="meeting-sheet__cell-value">{viewRecord.lugar || '—'}</p>
                  </div>
                  <div className="meeting-sheet__cell">
                    <p className="meeting-sheet__cell-label">Fecha</p>
                    <p className="meeting-sheet__cell-value tabular-nums">{formatFechaTabla(viewRecord.fecha)}</p>
                  </div>
                  <div className="meeting-sheet__cell">
                    <p className="meeting-sheet__cell-label">Horario</p>
                    <p className="meeting-sheet__cell-value tabular-nums">
                      {formatHorario(viewRecord.hora_inicio, viewRecord.hora_cierre) || '—'}
                    </p>
                  </div>
                </div>

                <p className="meeting-sheet__section-label">Asistentes</p>
                <div className="meeting-sheet__group">
                  {(viewRecord.attendees || []).filter((a) => (a.nombre || '').trim() || (a.cargo || '').trim()).length === 0 ? (
                    <div className="meeting-sheet__cell meeting-sheet__cell--empty">
                      <p className="meeting-sheet__cell-note">Sin asistentes registrados.</p>
                    </div>
                  ) : (
                    (viewRecord.attendees || [])
                      .filter((a) => (a.nombre || '').trim() || (a.cargo || '').trim())
                      .map((a, i) => (
                        <div key={i} className="meeting-sheet__cell">
                          <p className="meeting-sheet__cell-value font-semibold">{a.nombre || '—'}</p>
                          <p className="meeting-sheet__cell-note">
                            {a.cargo || 'Sin cargo'} · {a.asistencia}
                          </p>
                        </div>
                      ))
                  )}
                </div>

                <MinutaProLockedBlocks includeTopics={isMinuteFromMeeting(viewRecord)} />

                {!isMinuteFromMeeting(viewRecord)
                  ? (viewRecord.topics || []).map((t, idx) => (
                      <div key={idx}>
                        <p className="meeting-sheet__section-label">Tema {idx + 1}</p>
                        <div className="meeting-sheet__group">
                          <div className="meeting-sheet__cell">
                            <p className="meeting-sheet__cell-label">Título</p>
                            <p className="meeting-sheet__cell-value">{t.titulo || '—'}</p>
                          </div>
                          <div className="meeting-sheet__cell">
                            <p className="meeting-sheet__cell-label">Descripción</p>
                            <p className="meeting-sheet__cell-value--body whitespace-pre-wrap">{t.descripcion || '—'}</p>
                          </div>
                          <div className="meeting-sheet__cell">
                            <p className="meeting-sheet__cell-label">Comentarios</p>
                            <p className="meeting-sheet__cell-value--body whitespace-pre-wrap">{t.comentarios || '—'}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  : null}

                {canListenMinute(viewRecord) ? (
                  <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                      <p className="meeting-sheet__section-label mb-0 mt-0 px-0">Audio de la reunión</p>
                      <p className="mt-0.5 text-xs text-slate-600">Escucha la grabación completa</p>
                    </div>
                    <div className="p-4">
                      <MeetingMinuteAudioPlayer
                        minuteId={viewRecord.id}
                        audioUrl={viewRecord.audio_url}
                        variant="plain"
                      />
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="meeting-sheet__footer voice-minute-sheet__footer shrink-0">
                <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions minuta-view-footer">
                  <MinutaPdfProLock className="minuta-view-footer__btn" />
                  <button
                    type="button"
                    onClick={closeModal}
                    className="voice-minute-footer__btn voice-minute-footer__btn--primary"
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
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <MinutaListenModal
        record={listenRecord}
        onClose={() => setListenRecord(null)}
        onViewFull={() => {
          const id = listenRecord?.id;
          setListenRecord(null);
          if (id) openView(id);
        }}
      />
    </div>
  );
}
