import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';
import StatSummaryPanel from '../StatSummaryPanel';
import { useCatalog } from '../../hooks/useCatalog';

const AVISO_STAT_CONFIG = {
  total: {
    key: 'total',
    label: 'Total Avisos',
    subtitle: 'Publicados en plataforma',
    accent: '#CBAC80',
    bar: '#CBAC80',
    icon: 'avisos',
  },
  sent: {
    key: 'sent',
    label: 'Notif. Enviadas',
    subtitle: 'Notificaciones despachadas',
    accent: '#2563eb',
    bar: '#3b82f6',
    icon: 'sent',
  },
  read: {
    key: 'read',
    label: 'Total Leídos',
    subtitle: 'Confirmaciones de lectura',
    accent: '#059669',
    bar: '#10b981',
    icon: 'read',
  },
  rate: {
    key: 'rate',
    label: 'Tasa de Lectura',
    subtitle: 'Índice de compromiso',
    accent: '#7c3aed',
    bar: '#8b5cf6',
    icon: 'rate',
  },
};

const PRIORIDAD_STYLES = {
  normal: 'bg-blue-50 text-blue-700 border-blue-200',
  importante: 'bg-amber-50 text-amber-700 border-amber-200',
  urgente: 'bg-red-50 text-red-700 border-red-200',
};

const ESTADO_STYLES = {
  enviado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  borrador: 'bg-gray-100 text-gray-600 border-gray-200',
  programado: 'bg-purple-50 text-purple-700 border-purple-200',
};

const emptyAvisoForm = () => ({
  titulo: '',
  mensaje: '',
  prioridad: 'normal',
  tipo: 'departamento',
  departamentos: [],
  foroId: '',
  usuarioId: '',
});

export default function AvisosModule() {
  const { user } = useAuth();
  const { departments } = useCatalog();
  const [avisos, setAvisos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAviso, setSelectedAviso] = useState(null);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPrioridad, setFilterPrioridad] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  const [form, setForm] = useState(emptyAvisoForm());

  // Fuentes para los selectores nuevos
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
    axios.get('/api/users').then(r => setUsersList(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const fetchAvisos = async () => {
    try {
      const res = await axios.get('/api/avisos');
      const data = Array.isArray(res.data) ? res.data : [];
      setAvisos(data.map(a => ({
        id: `AV-${String(a.id).padStart(3, '0')}`,
        titulo: a.title,
        mensaje: a.content,
        prioridad: a.category,
        estado: 'enviado',
        fecha: new Date(a.created_at).toLocaleDateString('es-MX'),
        hora: new Date(a.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        autor: a.creator_name || 'Sistema',
        enviados: 0,
        leidos: 0,
        destinatarios: ['Todos']
      })));
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchAvisos(); }, []);

  const toggleDept = (dept) => {
    setForm(f => ({
      ...f,
      departamentos: f.departamentos.includes(dept)
        ? f.departamentos.filter(d => d !== dept)
        : [...f.departamentos, dept]
    }));
  };

  const handleSend = async () => {
    if (!form.titulo || !form.mensaje) return;

    // Validar destinatario según tipo
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

    // Calcular etiquetas de destinatarios
    let destinatarios = [];
    if (form.tipo === 'foro') {
      const f = forums.find(x => String(x.id) === String(form.foroId));
      destinatarios = [`Foro: ${f?.name || 'desconocido'}`];
    } else if (form.tipo === 'individual') {
      const u = usersList.find(x => String(x.id) === String(form.usuarioId));
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

      // Si va a un foro, también lo publicamos como mensaje en el chat de ese foro
      if (form.tipo === 'foro' && form.foroId) {
        try {
          const fd = new FormData();
          fd.append('user_id', user?.id || '');
          const prioLabel = form.prioridad === 'urgente' ? 'URGENTE' : form.prioridad === 'importante' ? 'IMPORTANTE' : 'AVISO';
          fd.append('content', `📢 ${prioLabel} — ${form.titulo}\n\n${form.mensaje}`);
          await axios.post(`/api/forums/${form.foroId}/messages`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } catch (e) {
          console.warn('No se pudo publicar el aviso en el foro:', e);
        }
      }

      const now = new Date();
      setAvisos(prev => [{
        id: `AV-NEW`,
        titulo: form.titulo,
        mensaje: form.mensaje,
        destinatarios,
        tipo: form.tipo,
        prioridad: form.prioridad,
        estado: 'enviado',
        fecha: now.toLocaleDateString('es-MX'),
        hora: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        autor: user?.name || 'Administrador',
        enviados: destinatarios.length,
        leidos: 0,
      }, ...prev]);

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
    setIsModalOpen(false);
    setForm(emptyAvisoForm());
  };

  const filtered = avisos.filter(a =>
    (a.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (a.autor || '').toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterPrioridad ? a.prioridad === filterPrioridad : true) &&
    (filterEstado ? a.estado === filterEstado : true)
  );

  const totalEnviados = avisos.reduce((s,a) => s + (a.enviados || 0), 0);
  const totalLeidos = avisos.reduce((s,a) => s + (a.leidos || 0), 0);
  const tasaLectura = totalEnviados > 0 ? Math.round((totalLeidos / totalEnviados) * 100) : 0;

  const avisoStatItems = useMemo(
    () => [
      { config: AVISO_STAT_CONFIG.total, value: avisos.length },
      {
        config: AVISO_STAT_CONFIG.sent,
        value: totalEnviados,
        footerLabel: 'Alcance',
        progressPct: totalEnviados > 0 ? 100 : 0,
        showProportionBadge: false,
      },
      {
        config: AVISO_STAT_CONFIG.read,
        value: totalLeidos,
        proportionBase: totalEnviados,
      },
      {
        config: AVISO_STAT_CONFIG.rate,
        value: tasaLectura,
        displayValue: `${tasaLectura}%`,
        progressPct: tasaLectura,
        footerLabel: 'Índice',
        showProportionBadge: false,
      },
    ],
    [avisos.length, totalEnviados, totalLeidos, tasaLectura]
  );

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-display font-medium text-navy-950 tracking-tight">Avisos y Comunicados</h2>
          <p className="text-sm text-navy-600 mt-1">Envía notificaciones por departamento o grupo con copia al correo</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="btn-gold-header self-end sm:self-auto"
          aria-label="Nuevo aviso"
        >
          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="sm:hidden">Nuevo</span>
          <span className="hidden sm:inline">Nuevo Aviso</span>
        </button>
      </div>

      <StatSummaryPanel
        title="Resumen de comunicados"
        subtitle="Métricas de envío y lectura"
        badge={`${avisos.length} aviso${avisos.length === 1 ? '' : 's'}`}
        items={avisoStatItems}
        proportionBase={totalEnviados}
        referenceKey="total"
        columnsClass="md:grid-cols-2 lg:grid-cols-4"
        headerIcon="megaphone"
      />

      {/* Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96">
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Buscar por título o autor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 placeholder-gray-400 bg-gray-50 hover:bg-white shadow-inner transition-all" />
        </div>
        <select value={filterPrioridad} onChange={e => setFilterPrioridad(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none">
          <option value="">Todas las prioridades</option>
          <option value="normal">Normal</option>
          <option value="importante">Importante</option>
          <option value="urgente">Urgente</option>
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none">
          <option value="">Todos los estados</option>
          <option value="enviado">Enviado</option>
          <option value="programado">Programado</option>
          <option value="borrador">Borrador</option>
        </select>
      </div>

      {/* Lista de Avisos */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-navy-400 font-medium">No hay avisos registrados</div>
        )}
        {filtered.map(aviso => (
          <div key={aviso.id} onClick={() => setSelectedAviso(aviso)}
            className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:border-gold/40 hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 bg-navy-950 text-white text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-md">
                    <svg className="w-3 h-3 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                    {aviso.id}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${PRIORIDAD_STYLES[aviso.prioridad] || PRIORIDAD_STYLES.normal}`}>
                    {aviso.prioridad}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${ESTADO_STYLES[aviso.estado] || ESTADO_STYLES.borrador}`}>
                    {aviso.estado === 'enviado' ? '✓ Enviado' : aviso.estado === 'programado' ? '⏰ Programado' : 'Borrador'}
                  </span>
                  <span className="bg-gray-100 text-navy-600 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                    {aviso.tipo === 'foro' ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                    ) : aviso.tipo === 'individual' ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    )}
                    {aviso.tipo === 'foro' ? 'Foro' : aviso.tipo === 'individual' ? 'Individual' : 'Departamento'}
                  </span>
                </div>
                <h3 className="font-bold text-navy-950 text-base group-hover:text-gold transition-colors mb-1">{aviso.titulo}</h3>
                <p className="text-navy-500 text-sm line-clamp-2 mb-3">{aviso.mensaje}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(aviso.destinatarios || []).map(d => (
                    <span key={d} className="bg-navy-50 text-navy-700 border border-navy-100 text-[10px] font-bold uppercase px-2 py-0.5 rounded">{d}</span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 text-right space-y-2">
                <div className="flex items-center gap-1.5 justify-end text-gray-400 text-xs font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  {aviso.fecha} · {aviso.hora}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── MODAL NUEVO AVISO ── */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
            onClick={closeNewAvisoModal}
            role="presentation"
          >
            <div
              className="flex max-h-[min(92dvh,48rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-aviso-title"
            >
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-6 pb-6 sm:px-8 sm:pt-7">
                <div className="pointer-events-none absolute -right-20 -top-28 h-60 w-60 rounded-full bg-gold/12 blur-3xl" aria-hidden />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                    <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/[0.12] sm:flex">
                      <svg className="h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">Comunicación interna</p>
                      <h2 id="new-aviso-title" className="mt-1.5 font-display text-xl font-medium leading-tight text-white sm:text-2xl">
                        Nuevo aviso
                      </h2>
                      <p className="mt-1.5 text-sm text-white/55">
                        Audiencia y mensaje. Si eliges foro, también se publica en el chat.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeNewAvisoModal}
                    className="shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
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
                  handleSend();
                }}
              >
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
                  <section>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Título</h3>
                    <input
                      type="text"
                      value={form.titulo}
                      onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                      placeholder="Ej. Mantenimiento programado del sistema"
                    />
                  </section>

                  <section>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Destinatarios</h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, tipo: 'departamento' })}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold uppercase tracking-wide transition-all ${
                          form.tipo === 'departamento'
                            ? 'border-gold bg-gold/10 text-gold shadow-sm ring-1 ring-gold/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Departamentos
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, tipo: 'foro' })}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold uppercase tracking-wide transition-all ${
                          form.tipo === 'foro'
                            ? 'border-gold bg-gold/10 text-gold shadow-sm ring-1 ring-gold/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                        </svg>
                        Foro
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, tipo: 'individual' })}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold uppercase tracking-wide transition-all ${
                          form.tipo === 'individual'
                            ? 'border-gold bg-gold/10 text-gold shadow-sm ring-1 ring-gold/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Una persona
                      </button>
                    </div>
                  </section>

                  {form.tipo === 'departamento' && (
                    <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Departamentos</h3>
                        <span className="text-xs font-medium tabular-nums text-slate-600">{form.departamentos.length} seleccionados</span>
                      </div>
                      <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                        {departments.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleDept(d)}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                              form.departamentos.includes(d)
                                ? 'border-gold bg-white text-gold shadow-sm ring-1 ring-gold/15'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                form.departamentos.includes(d) ? 'border-gold bg-gold text-white' : 'border-slate-300 bg-white'
                              }`}
                            >
                              {form.departamentos.includes(d) && (
                                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="truncate">{d}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {form.tipo === 'foro' && (
                    <section>
                      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Foro destino</h3>
                      {forums.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                          No hay foros disponibles con tu acceso. Crea uno en Foro o solicita ingreso.
                        </p>
                      ) : (
                        <select
                          value={form.foroId}
                          onChange={(e) => setForm({ ...form, foroId: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                        >
                          <option value="">— Elige un foro —</option>
                          {forums.map((f) => (
                            <option key={f.id} value={f.id}>
                              # {f.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="mt-2 text-xs text-slate-500">El contenido se copia como mensaje en el chat del foro.</p>
                    </section>
                  )}

                  {form.tipo === 'individual' && (
                    <section>
                      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Usuario</h3>
                      {usersList.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">No hay usuarios registrados.</p>
                      ) : (
                        <select
                          value={form.usuarioId}
                          onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                        >
                          <option value="">— Elige un usuario —</option>
                          {usersList.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} {u.apellido || ''}
                              {u.puesto ? ` — ${u.puesto}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </section>
                  )}

                  <section>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Mensaje</h3>
                    <textarea
                      rows={5}
                      value={form.mensaje}
                      onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                      placeholder="Redacta el comunicado…"
                    />
                  </section>
                </div>

                <div className="shrink-0 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-8">
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeNewAvisoModal}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-[8rem]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-navy-900/10 bg-navy-950 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold shadow-md transition-colors hover:bg-navy-900 disabled:opacity-60 sm:min-w-[12rem]"
                    >
                      {sending ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Enviando…
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Publicar y enviar
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

      {/* ── MODAL DETALLE AVISO ── */}
      {selectedAviso &&
        createPortal(
          <div
            className="fixed inset-0 z-[105] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
            onClick={() => setSelectedAviso(null)}
            role="presentation"
          >
            <div
              className="flex max-h-[min(92dvh,40rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="aviso-detail-title"
            >
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-6 pb-6 sm:px-8 sm:pt-7">
                <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-gold/12 blur-3xl" aria-hidden />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gold ring-1 ring-gold/20">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        {selectedAviso.id}
                      </span>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORIDAD_STYLES[selectedAviso.prioridad] || PRIORIDAD_STYLES.normal}`}>
                        {selectedAviso.prioridad}
                      </span>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${ESTADO_STYLES[selectedAviso.estado] || ESTADO_STYLES.borrador}`}>
                        {selectedAviso.estado === 'enviado' ? 'Enviado' : selectedAviso.estado === 'programado' ? 'Programado' : 'Borrador'}
                      </span>
                    </div>
                    <h2 id="aviso-detail-title" className="font-display text-lg font-medium leading-tight text-white sm:text-xl">
                      {selectedAviso.titulo}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAviso(null)}
                    className="shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Cerrar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Mensaje</p>
                  <p className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm leading-relaxed text-slate-800">{selectedAviso.mensaje}</p>
                </div>
                {(selectedAviso.destinatarios || []).length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Destinatarios</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedAviso.destinatarios || []).map((d) => (
                        <span key={d} className="rounded-lg border border-navy-100 bg-navy-50 px-2 py-0.5 text-[10px] font-bold uppercase text-navy-800">{d}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>
                    <span className="font-semibold text-slate-700">{selectedAviso.autor}</span>
                    {' · '}
                    {selectedAviso.fecha} a las {selectedAviso.hora}
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
}
