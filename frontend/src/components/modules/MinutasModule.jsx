import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { isSuperadminUser, canManageMinuteRecord } from '../../utils/permissions';
import { localDateYMD } from '../../utils/localDate';
import MeetingMinuteAudioPlayer from '../MeetingMinuteAudioPlayer';
import MeetingMinuteActaPanel from '../MeetingMinuteActaPanel';
import MeetingManualMinuteModal from '../MeetingManualMinuteModal';
import BosaGoldButton from '../BosaGoldButton';
import UserAvatar from '../UserAvatar';
import { MinutaProLockedBlocks } from '../MinutaProSections';
import { isManualMinuteForListing, resolveMinuteAudio, formatAudioExpiryHint } from '../../utils/minuteContent';

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

function canListenMinute(record) {
  return Boolean(resolveMinuteAudio(record));
}

function MinutaActaAudioSection({ record }) {
  const audio = resolveMinuteAudio(record);
  if (!audio) return null;

  const expiryHint = formatAudioExpiryHint({
    audio_available: true,
    audio_url: audio.audioUrl,
    audio_permanent: audio.permanent,
    audio_expires_at: audio.expiresAt,
  });

  return (
    <div className="minutas-module__acta-audio">
      <p className="minutas-module__acta-audio-label">Audio de la reunión</p>
      {expiryHint ? <p className="minutas-module__acta-audio-note">{expiryHint}</p> : null}
      <MeetingMinuteAudioPlayer minuteId={audio.minuteId} audioUrl={audio.audioUrl} variant="plain" />
    </div>
  );
}

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

function resolveMinuteCreator(record, dbUsers) {
  const id = Number(record?.created_by);
  const fromDb = Number.isFinite(id) ? dbUsers.find((u) => Number(u.id) === id) : null;
  return {
    name: fromDb?.name || record?.creator_name || '',
    apellido: fromDb?.apellido || record?.creator_apellido || '',
    avatarUrl: fromDb?.avatar_url || '',
  };
}

function MinutaListItem({ record, selected, onSelect, dbUsers = [] }) {
  const horario = formatHorario(record.hora_inicio, record.hora_cierre);
  const creator = resolveMinuteCreator(record, dbUsers);
  return (
    <button
      type="button"
      onClick={() => onSelect(record.id)}
      className={`minutas-module__list-item${selected ? ' is-selected' : ''}`}
      aria-current={selected ? 'true' : undefined}
    >
      <div className="minutas-module__list-item-top">
        <span className="minutas-module__list-item-date">{formatFechaTabla(record.fecha)}</span>
        {horario ? <span className="minutas-module__list-item-time">{horario}</span> : null}
      </div>
      <div className="minutas-module__list-item-main">
        <div className="minutas-module__list-item-copy">
          <span className="minutas-module__list-item-title">{record.tema || 'Sin tema'}</span>
          {record.lugar ? (
            <span className="minutas-module__list-item-meta">{record.lugar}</span>
          ) : null}
        </div>
        <div className="minutas-module__list-item-avatar-wrap">
          <UserAvatar
            name={creator.name}
            apellido={creator.apellido}
            avatarUrl={creator.avatarUrl}
            size="xs"
            className="minutas-module__list-item-avatar"
          />
        </div>
      </div>
    </button>
  );
}

function MinutaMobileCard({ record, onOpen }) {
  const horario = formatHorario(record.hora_inicio, record.hora_cierre);
  return (
    <article className="minutas-module__mobile-card">
      <div className="minutas-module__mobile-card-top">
        <span className="minutas-module__mobile-card-date">{formatFechaTabla(record.fecha)}</span>
        {horario ? <span className="minutas-module__mobile-card-time">{horario}</span> : null}
      </div>
      <h3 className="minutas-module__mobile-card-title">{record.tema || 'Sin tema'}</h3>
      <p className="minutas-module__mobile-card-meta">
        <span>{departmentLabel(record)}</span>
        {record.lugar ? <span> · {record.lugar}</span> : null}
      </p>
      <button type="button" onClick={() => onOpen(record.id)} className="minutas-module__mobile-card-cta">
        Ver acta
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </article>
  );
}

function MinutaDetailBody({
  record,
  meeting,
  dbUsers,
  canManage,
  canDelete,
  detailLoading,
  onBack,
  showBack,
  onCreate,
  onEdit,
  onDelete,
  layout = 'desktop',
}) {
  if (detailLoading) {
    return (
      <div className="minutas-module__detail-empty">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="minutas-module__detail-empty">
        <div className="minutas-module__detail-empty-icon" aria-hidden>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="minutas-module__detail-empty-title">Selecciona una minuta</p>
        <p className="minutas-module__detail-empty-text">
          Elige un registro de la lista para visualizar el acta, exportar PDF o editarla.
        </p>
      </div>
    );
  }

  if (layout === 'mobile') {
    return (
      <>
        <div className="minutas-module__mobile-detail-info">
          <span className="minutas-module__mobile-detail-dept">{departmentLabel(record)}</span>
          <h2 className="minutas-module__mobile-detail-title">{record.tema || 'Minuta de reunión'}</h2>
          <p className="minutas-module__mobile-detail-meta">
            {formatFechaTabla(record.fecha)}
            {formatHorario(record.hora_inicio, record.hora_cierre)
              ? ` · ${formatHorario(record.hora_inicio, record.hora_cierre)}`
              : ''}
            {record.lugar ? ` · ${record.lugar}` : ''}
          </p>
        </div>

        <div className="minutas-module__detail-scroll minutas-module__detail-scroll--mobile">
          <div className="minutas-module__acta-card minutas-module__acta-card--mobile">
            <div className="minutas-module__acta-wrap minutas-module__acta-wrap--mobile">
              <MeetingMinuteActaPanel
                minute={record}
                meeting={meeting}
                dbUsers={dbUsers}
                canManage={canManage}
                onCreate={onCreate}
                onEdit={onEdit}
              />
              <MinutaActaAudioSection record={record} />
            </div>
          </div>
        </div>

        {canDelete ? (
          <div className="minutas-module__detail-footer minutas-module__detail-footer--mobile">
            <button
              type="button"
              onClick={() => onDelete(record.id)}
              className="tasks-module__action-danger inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2.5 text-[13px] font-semibold"
            >
              <IconTrash className="h-4 w-4 shrink-0" />
              Eliminar minuta
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="minutas-module__detail-hero">
        {showBack ? (
          <button type="button" onClick={onBack} className="minutas-module__detail-back">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Registros
          </button>
        ) : null}
        <span className="meeting-sheet__pill meeting-sheet__pill--dept minutas-module__hero-pill">
          {departmentLabel(record)}
        </span>
        <h3 className="minutas-module__detail-hero-title">{record.tema || 'Minuta de reunión'}</h3>
        <p className="minutas-module__detail-hero-sub">
          {formatFechaTabla(record.fecha)}
          {record.lugar ? ` · ${record.lugar}` : ''}
          {formatHorario(record.hora_inicio, record.hora_cierre)
            ? ` · ${formatHorario(record.hora_inicio, record.hora_cierre)}`
            : ''}
        </p>
        <div className="minutas-module__hero-chips">
          {creatorLabel(record) !== '—' ? (
            <span className="minutas-module__hero-chip">{creatorLabel(record)}</span>
          ) : null}
          {isMinuteFromMeeting(record) ? (
            <span className="minutas-module__hero-chip">Desde reunión</span>
          ) : null}
          {canListenMinute(record) ? (
            <span className="minutas-module__hero-chip minutas-module__hero-chip--audio">Con audio</span>
          ) : null}
        </div>
      </div>

      <div className="minutas-module__detail-scroll">
        <div className="minutas-module__acta-card">
          <p className="minutas-module__acta-label">Acciones del acta</p>
          <div className="minutas-module__acta-wrap">
            <MeetingMinuteActaPanel
              minute={record}
              meeting={meeting}
              dbUsers={dbUsers}
              canManage={canManage}
              onCreate={onCreate}
              onEdit={onEdit}
            />
            <MinutaActaAudioSection record={record} />
          </div>
        </div>
      </div>

      {canDelete ? (
        <div className="minutas-module__detail-footer">
          <button
            type="button"
            onClick={() => onDelete(record.id)}
            className="tasks-module__action-danger inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[13px] font-semibold"
          >
            <IconTrash className="h-4 w-4 shrink-0" />
            Eliminar minuta
          </button>
        </div>
      ) : null}
    </>
  );
}

const emptyAttendee = () => ({ nombre: '', cargo: '', asistencia: 'Presente' });
const emptyTopics = () => [
  { titulo: '', descripcion: '', comentarios: '' },
  { titulo: '', descripcion: '', comentarios: '' },
  { titulo: '', descripcion: '', comentarios: '' },
];

function departmentLabel(record) {
  const d = String(record?.department || '').trim();
  return d || 'Sin departamento';
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

function minuteSortTimestamp(record) {
  const raw = record?.created_at;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function applyMinuteFilters(rows, { search, filterDept, filterPeriod, filterSort }) {
  let result = rows;
  const q = search.trim().toLowerCase();
  if (q) {
    result = result.filter((m) => {
      const blob = [m.tema, m.lugar, creatorLabel(m), m.fecha, m.department].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }
  if (filterDept) {
    result = result.filter((m) => departmentLabel(m) === filterDept);
  }
  if (filterPeriod === 'month') {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    result = result.filter((m) => {
      if (!m.fecha) return false;
      const d = new Date(`${m.fecha}T12:00:00`);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === mo;
    });
  } else if (filterPeriod === 'quarter') {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    result = result.filter((m) => {
      if (!m.fecha) return false;
      const d = new Date(`${m.fecha}T12:00:00`);
      return !Number.isNaN(d.getTime()) && d >= cutoff;
    });
  }
  return [...result].sort((a, b) => {
    const cmp = minuteSortTimestamp(a) - minuteSortTimestamp(b);
    return filterSort === 'asc' ? cmp : -cmp;
  });
}

function MinutaMobileDeptChips({ departments, activeDept, deptCounts, totalAll, onSelect }) {
  if (!departments.length) return null;
  return (
    <div className="minutas-module__dept-chips-wrap">
      <p className="minutas-module__dept-chips-label">Ver por departamento</p>
      <div className="minutas-module__dept-chips" role="tablist" aria-label="Filtrar por departamento">
        <button
          type="button"
          role="tab"
          aria-selected={!activeDept}
          className={`minutas-module__dept-chip${!activeDept ? ' is-active' : ''}`}
          onClick={() => onSelect('')}
        >
          Todos
          <span className="minutas-module__dept-chip-count">{totalAll}</span>
        </button>
        {departments.map((dept) => (
          <button
            key={dept}
            type="button"
            role="tab"
            aria-selected={activeDept === dept}
            className={`minutas-module__dept-chip${activeDept === dept ? ' is-active' : ''}`}
            onClick={() => onSelect(dept)}
          >
            {dept}
            <span className="minutas-module__dept-chip-count">{deptCounts.get(dept) || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MinutasModule() {
  const { user } = useAuth();
  const canDeleteMinuta = isSuperadminUser(user);
  const isMobile = useMediaQuery(MOBILE_MQ);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterSort, setFilterSort] = useState('desc');
  const [modal, setModal] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formMeetingId, setFormMeetingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [manualMinuteOpen, setManualMinuteOpen] = useState(false);

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
    axios.get('/api/meetings').then((r) => setMeetings(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    axios.get('/api/users').then((r) => setDbUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isMobile || !mobileDetailOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, mobileDetailOpen]);

  const listEnriched = useMemo(() => {
    const meetingsById = new Map(meetings.map((mt) => [Number(mt.id), mt]));
    return list.map((m) => {
      const mid = Number(m.meeting_id);
      if (!Number.isFinite(mid) || mid <= 0) return m;
      const meeting = meetingsById.get(mid);
      if (!meeting) return m;
      return {
        ...m,
        meeting_created_at: m.meeting_created_at || meeting.created_at || null,
        meeting_start_time: m.meeting_start_time || meeting.start_time || null,
      };
    });
  }, [list, meetings]);

  const manualList = useMemo(
    () => listEnriched.filter((m) => isManualMinuteForListing(m)),
    [listEnriched],
  );

  const departmentOptions = useMemo(() => {
    const depts = new Set(manualList.map((m) => departmentLabel(m)));
    return [...depts].sort((a, b) => {
      if (a === 'Sin departamento') return 1;
      if (b === 'Sin departamento') return -1;
      return a.localeCompare(b, 'es');
    });
  }, [manualList]);

  const filteredWithoutDept = useMemo(
    () => applyMinuteFilters(manualList, { search, filterDept: '', filterPeriod, filterSort }),
    [manualList, search, filterPeriod, filterSort],
  );

  const filtered = useMemo(
    () => applyMinuteFilters(manualList, { search, filterDept, filterPeriod, filterSort }),
    [manualList, search, filterDept, filterPeriod, filterSort],
  );

  const mobileDeptCounts = useMemo(() => {
    const counts = new Map();
    for (const m of filteredWithoutDept) {
      const dept = departmentLabel(m);
      counts.set(dept, (counts.get(dept) || 0) + 1);
    }
    return counts;
  }, [filteredWithoutDept]);

  const groupedByDepartment = useMemo(() => {
    const groups = new Map();
    for (const m of filtered) {
      const dept = departmentLabel(m);
      if (!groups.has(dept)) groups.set(dept, []);
      groups.get(dept).push(m);
    }
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === 'Sin departamento') return 1;
      if (b === 'Sin departamento') return -1;
      return a.localeCompare(b, 'es');
    });
    return keys.map((department) => ({ department, items: groups.get(department) }));
  }, [filtered]);

  const stats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    let monthCount = 0;
    let quarterCount = 0;
    for (const m of manualList) {
      if (!m.fecha) continue;
      const d = new Date(`${m.fecha}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() === y && d.getMonth() === mo) monthCount++;
      if (d >= cutoff) quarterCount++;
    }
    return { total: filtered.length, all: manualList.length, month: monthCount, quarter: quarterCount };
  }, [manualList, filtered.length]);

  const filtersActive = Boolean(
    search || filterPeriod || filterSort !== 'desc' || (!isMobile && filterDept) || (isMobile && filterDept),
  );
  const mobileToolbarFiltersActive = Boolean(search || filterPeriod || filterSort !== 'desc');

  const canManageSelected = useMemo(
    () => canManageMinuteRecord(user, selectedRecord, selectedMeeting),
    [user, selectedRecord, selectedMeeting],
  );

  const refreshSelectedRecord = useCallback(async (id = selectedId) => {
    if (!id) return;
    try {
      const { data } = await axios.get(`/api/minutes/${id}`);
      setSelectedRecord(data);
      const mid = Number(data.meeting_id);
      if (Number.isFinite(mid) && mid > 0) {
        setSelectedMeeting(meetings.find((m) => Number(m.id) === mid) || null);
      } else {
        setSelectedMeeting(null);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedId, meetings]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      setSelectedRecord(null);
      setSelectedMeeting(null);
      setMobileDetailOpen(false);
      return;
    }
    if (!selectedId || !filtered.some((m) => m.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedRecord(null);
      setSelectedMeeting(null);
      setDetailLoading(false);
      return undefined;
    }
    let cancelled = false;
    if (!selectedRecord) setDetailLoading(true);

    (async () => {
      try {
        const { data } = await axios.get(`/api/minutes/${selectedId}`);
        if (cancelled) return;
        setSelectedRecord(data);
        const mid = Number(data.meeting_id);
        if (Number.isFinite(mid) && mid > 0) {
          setSelectedMeeting(meetings.find((m) => Number(m.id) === mid) || null);
        } else {
          setSelectedMeeting(null);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setSelectedRecord(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, meetings]);

  const selectMinute = (id) => {
    if (Number(id) !== Number(selectedId)) setSelectedId(id);
    if (isMobile) setMobileDetailOpen(true);
  };

  const handleDeptSelect = (dept) => {
    setFilterDept(dept);
    if (isMobile) setMobileDetailOpen(false);
  };

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

  const handleEditActa = () => {
    if (!selectedRecord) return;
    const mid = Number(selectedRecord.meeting_id);
    if (Number.isFinite(mid) && mid > 0 && selectedMeeting) {
      setManualMinuteOpen(true);
      return;
    }
    openEdit(selectedRecord.id);
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
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
      if (editingId && editingId === selectedId) await refreshSelectedRecord(editingId);
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
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedRecord(null);
        setMobileDetailOpen(false);
      }
    } catch (e) {
      console.error(e);
      alert('No se pudo eliminar.');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFilterDept('');
    setFilterPeriod('');
    setFilterSort('desc');
    setMobileFiltersOpen(false);
  };

  const filterSelects = (
    <>
      <select
        id="minutas-dept"
        value={filterDept}
        onChange={(e) => setFilterDept(e.target.value)}
        className="minutas-module__toolbar-select"
        aria-label="Departamento"
      >
        <option value="">Todos los departamentos</option>
        {departmentOptions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        id="minutas-period"
        value={filterPeriod}
        onChange={(e) => setFilterPeriod(e.target.value)}
        className="minutas-module__toolbar-select"
        aria-label="Periodo"
      >
        <option value="">Todos los periodos</option>
        <option value="month">Este mes</option>
        <option value="quarter">Últimos 3 meses</option>
      </select>
      <select
        id="minutas-sort"
        value={filterSort}
        onChange={(e) => setFilterSort(e.target.value)}
        className="minutas-module__toolbar-select"
        aria-label="Orden"
      >
        <option value="desc">Más recientes</option>
        <option value="asc">Más antiguas</option>
      </select>
    </>
  );

  const renderDetailPane = (layout = 'desktop') => {
    const bodyProps = {
      meeting: selectedMeeting,
      dbUsers,
      canManage: canManageSelected,
      canDelete: canDeleteMinuta,
      showBack: false,
      onCreate: openCreate,
      onEdit: handleEditActa,
      onDelete: handleDelete,
      layout,
    };
    const ready = selectedRecord && Number(selectedRecord.id) === Number(selectedId);
    const stale = selectedRecord && !ready;

    if (ready) {
      return (
        <div key={selectedId} className="minutas-module__detail-content">
          <MinutaDetailBody {...bodyProps} record={selectedRecord} detailLoading={false} />
        </div>
      );
    }
    if (stale) {
      return (
        <div className="minutas-module__detail-content is-stale" aria-busy="true">
          <MinutaDetailBody {...bodyProps} record={selectedRecord} detailLoading={false} />
        </div>
      );
    }
    return <MinutaDetailBody {...bodyProps} record={null} detailLoading={detailLoading} />;
  };

  return (
    <div className={`tasks-module surface-light h-full animate-fade-in pb-4${!isMobile ? ' minutas-module--desktop' : ''}`}>
      <header className="tasks-module__top">
        <div>
          <h2 className="tasks-module__title">Minutas de reunión</h2>
          <p className="tasks-module__subtitle">
            {isMobile
              ? `${stats.total} acta${stats.total === 1 ? '' : 's'} · elige departamento y pulsa Ver acta`
              : `${stats.total} minuta${stats.total === 1 ? '' : 's'} manuales · selecciona una para ver el acta`}
          </p>
        </div>
        <div className="tasks-module__toolbar">
          <BosaGoldButton onClick={() => fetchList()} className="sm:!w-auto" aria-label="Actualizar lista">
            Actualizar
          </BosaGoldButton>
        </div>
      </header>

      <div className={`minutas-module__toolbar${isMobile ? ' minutas-module__toolbar--mobile' : ''}`}>
        <div className="minutas-module__toolbar-search">
          <svg className="minutas-module__toolbar-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="minutas-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isMobile ? 'Buscar minuta…' : 'Buscar tema, lugar o autor…'}
            className="minutas-module__toolbar-input"
          />
        </div>
        {isMobile ? (
          <>
            <div className="minutas-module__toolbar-mobile-row">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((o) => !o)}
                className={`minutas-module__filters-toggle${mobileToolbarFiltersActive ? ' is-active' : ''}`}
                aria-expanded={mobileFiltersOpen}
              >
                <svg className="minutas-module__filters-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M4 8h16" />
                  <circle cx="9" cy="8" r="2.5" fill="currentColor" />
                  <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M4 13h16" />
                  <circle cx="15" cy="13" r="2.5" fill="currentColor" />
                  <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M4 18h16" />
                  <circle cx="11" cy="18" r="2.5" fill="currentColor" />
                </svg>
                Filtros
                {mobileToolbarFiltersActive ? <span className="minutas-module__filters-dot" aria-hidden /> : null}
              </button>
              <span className="minutas-module__toolbar-mobile-count">
                {stats.total} minuta{stats.total === 1 ? '' : 's'}
              </span>
              {filtersActive ? (
                <button type="button" onClick={clearFilters} className="minutas-module__toolbar-clear">
                  Limpiar
                </button>
              ) : null}
            </div>
            {mobileFiltersOpen ? (
              <div className="minutas-module__toolbar-filters">
                <label className="minutas-module__filter-label" htmlFor="minutas-period-mobile">
                  Periodo
                </label>
                <select
                  id="minutas-period-mobile"
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                  className="minutas-module__toolbar-select"
                >
                  <option value="">Todos</option>
                  <option value="month">Este mes</option>
                  <option value="quarter">Últimos 3 meses</option>
                </select>
                <label className="minutas-module__filter-label" htmlFor="minutas-sort-mobile">
                  Orden
                </label>
                <select
                  id="minutas-sort-mobile"
                  value={filterSort}
                  onChange={(e) => setFilterSort(e.target.value)}
                  className="minutas-module__toolbar-select"
                >
                  <option value="desc">Más recientes</option>
                  <option value="asc">Más antiguas</option>
                </select>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {filterSelects}
            {filtersActive ? (
              <button type="button" onClick={clearFilters} className="minutas-module__toolbar-clear">
                Limpiar
              </button>
            ) : null}
          </>
        )}
      </div>

      {isMobile && !loading && manualList.length > 0 ? (
        <MinutaMobileDeptChips
          departments={departmentOptions}
          activeDept={filterDept}
          deptCounts={mobileDeptCounts}
          totalAll={filteredWithoutDept.length}
          onSelect={handleDeptSelect}
        />
      ) : null}

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      ) : manualList.length === 0 ? (
        <div className="tasks-module__empty">
          <p className="text-[15px] font-semibold text-slate-800">Sin minutas manuales</p>
          <p className="mx-auto mt-2 max-w-sm text-[14px] text-slate-500">
            Aquí aparecen las actas creadas a mano. Las minutas con Saya (voz) siguen en Calendario.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="tasks-module__empty">
          <p className="text-[15px] font-semibold text-slate-800">Ninguna minuta coincide con los filtros</p>
          <button type="button" onClick={clearFilters} className="tasks-module__btn-ghost mt-4">
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className={`minutas-module__workspace${isMobile ? ' minutas-module__workspace--mobile' : ''}`}>
          <aside className="minutas-module__list-pane" aria-label="Lista de minutas">
            {!isMobile ? (
              <div className="minutas-module__list-head">
                <p className="minutas-module__list-head-title">Registros</p>
                <span className="minutas-module__list-head-count">{stats.total}</span>
              </div>
            ) : null}
            <div className="minutas-module__list-scroll">
              {isMobile && !filterDept ? (
                <div className="minutas-module__mobile-list">
                  {groupedByDepartment.map(({ department, items }) => (
                    <section key={department} className="minutas-module__mobile-dept-group">
                      <header className="minutas-module__mobile-dept-head">
                        <h3 className="minutas-module__mobile-dept-title">{department}</h3>
                        <span className="minutas-module__mobile-dept-count">
                          {items.length} minuta{items.length === 1 ? '' : 's'}
                        </span>
                      </header>
                      {items.map((m) => (
                        <MinutaMobileCard key={m.id} record={m} onOpen={selectMinute} />
                      ))}
                    </section>
                  ))}
                </div>
              ) : isMobile ? (
                <div className="minutas-module__mobile-list">
                  {filtered.map((m) => (
                    <MinutaMobileCard key={m.id} record={m} onOpen={selectMinute} />
                  ))}
                </div>
              ) : (
                <div className="minutas-by-dept">
                  {groupedByDepartment.map(({ department, items }) => (
                    <section key={department} className="minutas-dept-section">
                      <header className="minutas-dept-section__head">
                        <h3 className="minutas-dept-section__title">{department}</h3>
                        <span className="minutas-dept-section__count">
                          {items.length} minuta{items.length === 1 ? '' : 's'}
                        </span>
                      </header>
                      {items.map((m) => (
                        <MinutaListItem
                          key={m.id}
                          record={m}
                          selected={selectedId === m.id}
                          onSelect={selectMinute}
                          dbUsers={dbUsers}
                        />
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {!isMobile ? (
            <section
              className={`minutas-module__detail-pane${selectedRecord ? ' minutas-module__detail-pane--compact' : ''}`}
              aria-label="Detalle de la minuta"
            >
              {renderDetailPane('desktop')}
            </section>
          ) : null}
        </div>
      )}

      {isMobile &&
        mobileDetailOpen &&
        createPortal(
          <div className="minutas-module__mobile-sheet" role="dialog" aria-modal="true" aria-label="Detalle de minuta">
            <header className="minutas-module__mobile-sheet-bar">
              <button type="button" onClick={() => setMobileDetailOpen(false)} className="minutas-module__mobile-sheet-back">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Minutas
              </button>
            </header>
            <div className="minutas-module__mobile-sheet-inner">
              {renderDetailPane('mobile')}
            </div>
          </div>,
          document.body,
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

      {manualMinuteOpen && selectedMeeting && canManageSelected ? (
        <MeetingManualMinuteModal
          open={manualMinuteOpen}
          meeting={selectedMeeting}
          dbUsers={dbUsers}
          existingMinute={selectedRecord}
          onClose={() => setManualMinuteOpen(false)}
          onMeetingScheduled={async () => {
            const { data } = await axios.get('/api/meetings');
            setMeetings(Array.isArray(data) ? data : []);
          }}
          onSaved={async () => {
            await fetchList();
            await refreshSelectedRecord();
          }}
        />
      ) : null}
    </div>
  );
}
