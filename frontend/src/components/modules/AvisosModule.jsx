import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';
import { useCatalog } from '../../hooks/useCatalog';
import BosaGoldButton from '../BosaGoldButton';

const PRIORIDAD_META = {
  normal: { label: 'Normal', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  importante: { label: 'Importante', color: '#b45309', bg: 'rgba(245,158,11,0.15)' },
  urgente: { label: 'Urgente', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
};

const ESTADO_META = {
  enviado: { label: 'Enviado', color: '#059669', bg: 'rgba(16,185,129,0.12)' },
  borrador: { label: 'Borrador', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  programado: { label: 'Programado', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
};

const TIPO_META = {
  foro: { label: 'Foro' },
  individual: { label: 'Individual' },
  departamento: { label: 'Departamento' },
};

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

const emptyAvisoForm = () => ({
  titulo: '',
  mensaje: '',
  prioridad: 'normal',
  tipo: 'departamento',
  departamentos: [],
  foroId: '',
  usuarioId: '',
});

const DESTINATARIO_OPTIONS = [
  { value: 'departamento', label: 'Deptos.', iconWrap: 'depto' },
  { value: 'foro', label: 'Foro', iconWrap: 'notice' },
  { value: 'individual', label: 'Persona', iconWrap: 'user' },
];

function DestinatarioSegmentIcon({ type }) {
  if (type === 'foro') {
    return (
      <>
        <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
        <path d="M10 12h6M10 16h4" />
      </>
    );
  }
  if (type === 'individual') {
    return (
      <>
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
      </>
    );
  }
  return (
    <>
      <path d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
    </>
  );
}

function AvisoDestinatarioSegmented({ value, onChange }) {
  return (
    <div className="aviso-destinatario-segmented" role="radiogroup" aria-label="Tipo de destinatario">
      {DESTINATARIO_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`aviso-destinatario-segmented__btn${active ? ' aviso-destinatario-segmented__btn--active' : ''}`}
          >
            <span className={`bosa-gold-btn__icon-wrap bosa-gold-btn__icon-wrap--${opt.iconWrap}`} aria-hidden>
              <svg
                className="bosa-gold-btn__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <DestinatarioSegmentIcon type={opt.value} />
              </svg>
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AvisoCard({ aviso, onOpen }) {
  const prio = PRIORIDAD_META[aviso.prioridad] || PRIORIDAD_META.normal;
  const estado = ESTADO_META[aviso.estado] || ESTADO_META.borrador;
  const tipo = TIPO_META[aviso.tipo] || TIPO_META.departamento;

  return (
    <article
      className="tasks-module__card cursor-pointer transition-transform active:scale-[0.995]"
      onClick={() => onOpen(aviso)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(aviso);
        }
      }}
    >
      <div className="tasks-module__card-main">
        <div className="flex items-start justify-between gap-3">
          <h3 className="tasks-module__card-title flex-1 min-w-0">{aviso.titulo}</h3>
          <span className="tasks-module__pill shrink-0 tabular-nums" style={{ background: 'rgba(7,18,33,0.08)', color: '#071221' }}>
            {aviso.id}
          </span>
        </div>
        <div className="tasks-module__card-meta">
          <span className="tasks-module__pill" style={{ background: prio.bg, color: prio.color }}>
            {prio.label}
          </span>
          <span className="tasks-module__pill" style={{ background: estado.bg, color: estado.color }}>
            {estado.label}
          </span>
          <span className="tasks-module__pill bg-slate-100 text-slate-600">{tipo.label}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-[14px] text-slate-600">{aviso.mensaje}</p>
        {(aviso.destinatarios || []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(aviso.destinatarios || []).slice(0, 4).map((d) => (
              <span key={d} className="tasks-module__pill bg-slate-100 text-slate-600">
                {d}
              </span>
            ))}
            {(aviso.destinatarios || []).length > 4 && (
              <span className="tasks-module__pill bg-slate-100 text-slate-500">
                +{(aviso.destinatarios || []).length - 4}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="tasks-module__card-section">
        <div className="tasks-module__card-dates">
          <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {aviso.fecha} · {aviso.hora}
        </div>
        <p className="mt-2 text-[13px] text-slate-500">
          Por <span className="font-semibold text-slate-700">{aviso.autor}</span>
        </p>
      </div>
      <div className="tasks-module__card-actions">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(aviso);
          }}
          className="tasks-module__action-primary"
        >
          Ver detalle
        </button>
      </div>
    </article>
  );
}

export default function AvisosModule() {
  const { user } = useAuth();
  const { departments } = useCatalog();
  const isMobile = useMediaQuery(MOBILE_MQ);
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAviso, setSelectedAviso] = useState(null);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPrioridad, setFilterPrioridad] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState(emptyAvisoForm());
  const [forums, setForums] = useState([]);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    axios
      .get('/api/forums')
      .then((r) => {
        const raw = Array.isArray(r.data) ? r.data : [];
        setForums(raw.filter((f) => f.has_access !== false));
      })
      .catch(() => {});
    axios
      .get('/api/users')
      .then((r) => setUsersList(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const fetchAvisos = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/avisos');
      const data = Array.isArray(res.data) ? res.data : [];
      setAvisos(
        data.map((a) => ({
          id: `AV-${String(a.id).padStart(3, '0')}`,
          titulo: a.title,
          mensaje: a.content,
          prioridad: a.category,
          estado: 'enviado',
          fecha: new Date(a.created_at).toLocaleDateString('es-MX'),
          hora: new Date(a.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          autor: a.creator_name || 'Sistema',
          enviados: 0,
          leidos: 0,
          destinatarios: ['Todos'],
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvisos();
  }, []);

  const toggleDept = (dept) => {
    setForm((f) => ({
      ...f,
      departamentos: f.departamentos.includes(dept) ? f.departamentos.filter((d) => d !== dept) : [...f.departamentos, dept],
    }));
  };

  const handleSend = async () => {
    if (!form.titulo || !form.mensaje) return;

    if (form.tipo === 'foro' && !form.foroId) {
      alert('Selecciona un foro');
      return;
    }
    if (form.tipo === 'individual' && !form.usuarioId) {
      alert('Selecciona un usuario');
      return;
    }
    if (form.tipo === 'departamento' && form.departamentos.length === 0) {
      alert('Selecciona al menos un departamento');
      return;
    }

    let destinatarios = [];
    if (form.tipo === 'foro') {
      const f = forums.find((x) => String(x.id) === String(form.foroId));
      destinatarios = [`Foro: ${f?.name || 'desconocido'}`];
    } else if (form.tipo === 'individual') {
      const u = usersList.find((x) => String(x.id) === String(form.usuarioId));
      destinatarios = [`${u?.name || ''} ${u?.apellido || ''}`.trim() || 'Usuario'];
    } else {
      destinatarios = form.departamentos;
    }

    setSending(true);
    try {
      await axios.post('/api/avisos', {
        title: form.titulo,
        content: form.mensaje,
        category: form.prioridad,
        created_by: user?.id,
      });

      if (form.tipo === 'foro' && form.foroId) {
        try {
          const fd = new FormData();
          fd.append('user_id', user?.id || '');
          const prioLabel = form.prioridad === 'urgente' ? 'URGENTE' : form.prioridad === 'importante' ? 'IMPORTANTE' : 'AVISO';
          fd.append('content', `📢 ${prioLabel} — ${form.titulo}\n\n${form.mensaje}`);
          await axios.post(`/api/forums/${form.foroId}/messages`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (e) {
          console.warn('No se pudo publicar el aviso en el foro:', e);
        }
      }

      const now = new Date();
      setAvisos((prev) => [
        {
          id: 'AV-NEW',
          titulo: form.titulo,
          mensaje: form.mensaje,
          destinatarios,
          tipo: form.tipo,
          prioridad: form.prioridad,
          estado: 'enviado',
          fecha: now.toLocaleDateString('es-MX'),
          hora: now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          autor: user?.name || 'Administrador',
          enviados: destinatarios.length,
          leidos: 0,
        },
        ...prev,
      ]);

      setTimeout(fetchAvisos, 1000);
      PushEvents.avisoCreated(form.titulo);
    } catch (err) {
      console.error(err);
      alert('Error al guardar el aviso en la base de datos.');
    } finally {
      setSending(false);
      setIsModalOpen(false);
      setForm(emptyAvisoForm());
    }
  };

  const closeNewAvisoModal = () => {
    if (sending) return;
    setIsModalOpen(false);
    setForm(emptyAvisoForm());
  };

  const filtered = useMemo(
    () =>
      avisos.filter(
        (a) =>
          (a.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.autor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.mensaje || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
          (filterPrioridad ? a.prioridad === filterPrioridad : true) &&
          (filterEstado ? a.estado === filterEstado : true)
      ),
    [avisos, searchTerm, filterPrioridad, filterEstado]
  );

  const stats = useMemo(() => {
    const enviados = filtered.reduce((s, a) => s + (a.enviados || 0), 0);
    const leidos = filtered.reduce((s, a) => s + (a.leidos || 0), 0);
    const tasa = enviados > 0 ? Math.round((leidos / enviados) * 100) : 0;
    return { total: filtered.length, enviados, leidos, tasa };
  }, [filtered]);

  const filtersActive = Boolean(searchTerm || filterPrioridad || filterEstado);

  return (
    <div className="tasks-module surface-light h-full animate-fade-in pb-4">
      <header className="tasks-module__top">
        <div>
          <h2 className="tasks-module__title">Avisos y comunicados</h2>
          <p className="tasks-module__subtitle">
            {stats.total} aviso{stats.total === 1 ? '' : 's'} · notificaciones internas
          </p>
        </div>
        <div className="tasks-module__toolbar">
          <button type="button" onClick={() => fetchAvisos()} className="tasks-module__btn-ghost">
            Actualizar
          </button>
          <BosaGoldButton icon="notice" onClick={() => setIsModalOpen(true)} className="sm:!w-auto" aria-label="Nuevo aviso">
            Nuevo aviso
          </BosaGoldButton>
        </div>
      </header>

      <div className="tasks-module__stats">
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.total}</div>
          <div className="tasks-module__stat-label">Total</div>
        </div>
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.enviados}</div>
          <div className="tasks-module__stat-label">Notif. enviadas</div>
        </div>
        <div className="tasks-module__stat">
          <div className="tasks-module__stat-value">{stats.leidos}</div>
          <div className="tasks-module__stat-label">Leídos</div>
        </div>
        <div className="tasks-module__stat sm:col-span-2 lg:col-span-1">
          <div className="tasks-module__stat-value">{stats.tasa}%</div>
          <div className="tasks-module__stat-label">Tasa de lectura</div>
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
            <label className="tasks-module__field-label" htmlFor="avisos-search">
              Buscar
            </label>
            <input
              id="avisos-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Título, autor o mensaje…"
              className="tasks-module__field"
            />
          </div>
          <div>
            <label className="tasks-module__field-label" htmlFor="avisos-prioridad">
              Prioridad
            </label>
            <select
              id="avisos-prioridad"
              value={filterPrioridad}
              onChange={(e) => setFilterPrioridad(e.target.value)}
              className="tasks-module__field"
            >
              <option value="">Todas</option>
              <option value="normal">Normal</option>
              <option value="importante">Importante</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div>
            <label className="tasks-module__field-label" htmlFor="avisos-estado">
              Estado
            </label>
            <select
              id="avisos-estado"
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="tasks-module__field"
            >
              <option value="">Todos</option>
              <option value="enviado">Enviado</option>
              <option value="programado">Programado</option>
              <option value="borrador">Borrador</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      ) : avisos.length === 0 ? (
        <div className="tasks-module__empty">
          <p className="text-[15px] font-semibold text-slate-800">Sin avisos publicados</p>
          <p className="mx-auto mt-2 max-w-sm text-[14px] text-slate-500">
            Crea el primer comunicado para tu equipo o departamento.
          </p>
          <BosaGoldButton icon="notice" onClick={() => setIsModalOpen(true)} className="mt-4 sm:!w-auto" aria-label="Nuevo aviso">
            Nuevo aviso
          </BosaGoldButton>
        </div>
      ) : filtered.length === 0 ? (
        <div className="tasks-module__empty">
          <p className="text-[15px] font-semibold text-slate-800">Ningún aviso coincide con los filtros</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setFilterPrioridad('');
              setFilterEstado('');
            }}
            className="tasks-module__btn-ghost mt-4"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="tasks-module__list">
          {filtered.map((aviso) => (
            <AvisoCard key={aviso.id} aviso={aviso} onOpen={setSelectedAviso} />
          ))}
        </div>
      )}

      {isModalOpen &&
        createPortal(
          <div className="meeting-sheet-overlay z-[120] animate-fade-in" onClick={closeNewAvisoModal} role="presentation">
            <div
              className="meeting-sheet meeting-sheet--form meeting-sheet--aviso meeting-sheet--wide animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-aviso-title"
            >
              <div className="meeting-sheet__hero shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="meeting-sheet__pill meeting-sheet__pill--gold">Comunicación</span>
                    <h3 id="new-aviso-title" className="meeting-sheet__hero-title mt-2">
                      Nuevo aviso
                    </h3>
                    <p className="meeting-sheet__hero-subtitle">
                      Elige audiencia y redacta el mensaje. Si eliges foro, también se publica en el chat.
                    </p>
                  </div>
                  <button type="button" onClick={closeNewAvisoModal} className="meeting-sheet__close" aria-label="Cerrar">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form
                className="meeting-sheet__form flex min-h-0 flex-1 flex-col overflow-hidden"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <div className="meeting-sheet__body flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="meeting-sheet__scroll meeting-sheet__scroll--form flex-1 min-h-0">
                  <p className="meeting-sheet__section-label">Contenido</p>
                  <div className="meeting-sheet__group">
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Título</label>
                      <input
                        type="text"
                        value={form.titulo}
                        onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                        className="meeting-sheet__input font-semibold"
                        placeholder="Ej. Mantenimiento programado del sistema"
                      />
                    </div>
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Prioridad</label>
                      <select
                        value={form.prioridad}
                        onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                        className="meeting-sheet__select"
                      >
                        <option value="normal">Normal</option>
                        <option value="importante">Importante</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                    <div className="meeting-sheet__cell meeting-sheet__cell--field">
                      <label className="meeting-sheet__cell-label">Mensaje</label>
                      <textarea
                        rows={5}
                        value={form.mensaje}
                        onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
                        className="meeting-sheet__textarea"
                        placeholder="Redacta el comunicado…"
                      />
                    </div>
                  </div>

                  <p className="meeting-sheet__section-label">Destinatarios</p>
                  <div className="meeting-sheet__group">
                    <div className="meeting-sheet__cell meeting-sheet__cell--field space-y-4">
                      <AvisoDestinatarioSegmented
                        value={form.tipo}
                        onChange={(tipo) => setForm({ ...form, tipo })}
                      />

                      {form.tipo === 'departamento' && (
                        <div className="space-y-2">
                          <label className="meeting-sheet__cell-label">
                            Departamentos ({form.departamentos.length} seleccionados)
                          </label>
                          <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                            {departments.map((d) => {
                              const selected = form.departamentos.includes(d);
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => toggleDept(d)}
                                  className={`rounded-[10px] px-3 py-2.5 text-left text-[14px] font-semibold transition-colors ${
                                    selected ? 'bg-gold/20 text-navy-950 ring-1 ring-gold/30' : 'bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {form.tipo === 'foro' && (
                        <div className="space-y-2">
                          <label className="meeting-sheet__cell-label" htmlFor="aviso-foro-select">
                            Foro destino
                          </label>
                          {forums.length === 0 ? (
                            <p className="meeting-sheet__cell-note">No hay foros disponibles con tu acceso.</p>
                          ) : (
                            <select
                              id="aviso-foro-select"
                              value={form.foroId}
                              onChange={(e) => setForm({ ...form, foroId: e.target.value })}
                              className="meeting-sheet__select"
                            >
                              <option value="">Elige un foro…</option>
                              {forums.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <p className="meeting-sheet__cell-note">
                            El contenido se copia como mensaje en el chat del foro.
                          </p>
                        </div>
                      )}

                      {form.tipo === 'individual' && (
                        <div className="space-y-2">
                          <label className="meeting-sheet__cell-label" htmlFor="aviso-usuario-select">
                            Usuario
                          </label>
                          {usersList.length === 0 ? (
                            <p className="meeting-sheet__cell-note">No hay usuarios registrados.</p>
                          ) : (
                            <select
                              id="aviso-usuario-select"
                              value={form.usuarioId}
                              onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}
                              className="meeting-sheet__select"
                            >
                              <option value="">Elige un usuario…</option>
                              {usersList.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} {u.apellido || ''}
                                  {u.puesto ? ` · ${u.puesto}` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>

                <div className="meeting-sheet__footer voice-minute-sheet__footer shrink-0">
                  <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
                    <button
                      type="button"
                      onClick={closeNewAvisoModal}
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
                      disabled={sending}
                      className="voice-minute-footer__btn voice-minute-footer__btn--primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? (
                        <>
                          <span
                            className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-navy-950/25 border-t-navy-950"
                            aria-hidden
                          />
                          Enviando…
                        </>
                      ) : (
                        <>
                          <span className="bosa-gold-btn__icon-wrap bosa-gold-btn__icon-wrap--notice" aria-hidden>
                            <svg
                              className="bosa-gold-btn__icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
                              <path d="M10 12h6M10 16h4" />
                            </svg>
                          </span>
                          Publicar aviso
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

      {selectedAviso &&
        createPortal(
          <div
            className="meeting-sheet-overlay z-[125] animate-fade-in"
            onClick={() => setSelectedAviso(null)}
            role="presentation"
          >
            <div
              className="meeting-sheet meeting-sheet--form animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="aviso-detail-title"
            >
              <div className="meeting-sheet__hero shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="meeting-sheet__pill meeting-sheet__pill--gold tabular-nums">{selectedAviso.id}</span>
                      <span
                        className="meeting-sheet__pill"
                        style={{
                          background: (PRIORIDAD_META[selectedAviso.prioridad] || PRIORIDAD_META.normal).bg,
                          color: (PRIORIDAD_META[selectedAviso.prioridad] || PRIORIDAD_META.normal).color,
                        }}
                      >
                        {(PRIORIDAD_META[selectedAviso.prioridad] || PRIORIDAD_META.normal).label}
                      </span>
                      <span
                        className="meeting-sheet__pill"
                        style={{
                          background: (ESTADO_META[selectedAviso.estado] || ESTADO_META.borrador).bg,
                          color: (ESTADO_META[selectedAviso.estado] || ESTADO_META.borrador).color,
                        }}
                      >
                        {(ESTADO_META[selectedAviso.estado] || ESTADO_META.borrador).label}
                      </span>
                    </div>
                    <h3 id="aviso-detail-title" className="meeting-sheet__hero-title">
                      {selectedAviso.titulo}
                    </h3>
                    <p className="meeting-sheet__hero-subtitle">
                      {selectedAviso.autor} · {selectedAviso.fecha} a las {selectedAviso.hora}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedAviso(null)} className="meeting-sheet__close" aria-label="Cerrar">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="meeting-sheet__scroll">
                <p className="meeting-sheet__section-label">Mensaje</p>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell">
                    <p className="meeting-sheet__cell-value--body whitespace-pre-wrap">{selectedAviso.mensaje}</p>
                  </div>
                </div>

                {(selectedAviso.destinatarios || []).length > 0 && (
                  <>
                    <p className="meeting-sheet__section-label">Destinatarios</p>
                    <div className="px-4 pb-2">
                      <div className="flex flex-wrap gap-2">
                        {(selectedAviso.destinatarios || []).map((d) => (
                          <span key={d} className="tasks-module__pill bg-slate-100 text-slate-700">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="meeting-sheet__footer shrink-0">
                <div className="meeting-sheet__footer-actions">
                  <button type="button" onClick={() => setSelectedAviso(null)} className="meeting-sheet__btn meeting-sheet__btn--primary">
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
