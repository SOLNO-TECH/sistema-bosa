import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { exportMinutaPdf } from '../../utils/exportMinutaPdf';

const TOPIC_STYLES = [
  { head: 'bg-navy-950', label: 'Tema 1 del día', headText: 'text-white' },
  { head: 'bg-[#152a45]', label: 'Tema 2 del día', headText: 'text-white' },
  { head: 'bg-[#1e3a5f]', label: 'Tema 3 del día', headText: 'text-white' },
];

function IconEye({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconDownload({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
    </svg>
  );
}

function IconPencil({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

function IconTrash({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

const userActionBtn =
  'px-3 py-1.5 rounded-sm bg-white border border-gray-200 text-navy-600 hover:border-gold hover:text-gold transition-all text-[10px] font-bold tracking-wide uppercase shadow-sm flex items-center gap-1.5';
const userActionBtnDanger =
  'px-3 py-1.5 rounded-sm bg-white border border-gray-200 text-red-500 hover:border-red-600 hover:bg-red-50 transition-all text-[10px] font-bold tracking-wide uppercase shadow-sm flex items-center gap-1.5';

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

export default function MinutasModule() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterSort, setFilterSort] = useState('desc');
  const [modal, setModal] = useState(null); // null | 'create' | 'edit' | 'view'
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

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

  const openCreate = () => {
    setEditingId(null);
    setForm({
      lugar: '',
      fecha: new Date().toISOString().slice(0, 10),
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

  const closeModal = () => {
    setModal(null);
    setViewRecord(null);
    setEditingId(null);
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

  const handlePdf = (record) => {
    try {
      exportMinutaPdf(record);
    } catch (e) {
      console.error(e);
      alert('Error al generar el PDF.');
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-slate-400 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 transition-colors';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-display font-medium text-navy-950 text-xl sm:text-2xl">Minutas de reunión</h3>
          <p className="font-sans text-navy-600 text-sm mt-1">
            Registro formal de reuniones, seguimiento y exportación a PDF para archivo operativo.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-gold-header self-end sm:self-auto"
          aria-label="Nueva minuta"
        >
          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="sm:hidden">Nueva</span>
          <span className="hidden sm:inline">Nueva minuta</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96">
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por tema, lugar, fecha o autor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 placeholder-gray-400 transition-all bg-gray-50 hover:bg-white shadow-inner"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none flex-1 md:flex-none min-w-0"
          >
            <option value="">Todos los periodos</option>
            <option value="month">Mes en curso</option>
            <option value="quarter">Últimos 3 meses</option>
          </select>
          <select
            value={filterSort}
            onChange={(e) => setFilterSort(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none flex-1 md:flex-none min-w-0"
          >
            <option value="desc">Más recientes primero</option>
            <option value="asc">Más antiguas primero</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Fecha</th>
                <th className="px-6 py-4 font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Tema</th>
                <th className="px-6 py-4 font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Lugar</th>
                <th className="px-6 py-4 font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Autor</th>
                <th className="px-6 py-4 font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-navy-500 font-medium">Cargando...</td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-navy-500 font-medium">No hay minutas registradas</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-navy-500 font-medium">Ningún resultado coincide con los filtros</td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-navy-700 font-medium whitespace-nowrap">{formatFechaTabla(m.fecha)}</td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-navy-950 line-clamp-2">{m.tema || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-navy-700 font-medium line-clamp-2">{m.lugar || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-navy-700 text-xs font-medium">{creatorLabel(m)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openView(m.id)}
                          className={userActionBtn}
                          title="Vista previa"
                        >
                          <IconEye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePdf(m)}
                          className={userActionBtn}
                          title="Descargar PDF"
                        >
                          <IconDownload className="w-3.5 h-3.5" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(m.id)}
                          className={userActionBtn}
                          title="Editar minuta"
                        >
                          <IconPencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className={userActionBtnDanger}
                          title="Eliminar minuta"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <p className="p-6 text-center text-navy-500 font-medium">Cargando...</p>
          ) : list.length === 0 ? (
            <p className="p-6 text-center text-navy-500 font-medium">No hay minutas registradas</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-navy-500 font-medium">Ningún resultado coincide con los filtros</p>
          ) : (
            filtered.map((m) => (
              <div key={m.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center text-sm font-bold border-2 border-gold/30 flex-shrink-0">
                      {(m.tema || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-navy-950 truncate">{m.tema || 'Sin tema'}</p>
                      <p className="text-navy-500 text-xs truncate">{m.lugar || '—'}</p>
                    </div>
                  </div>
                  <span className="role-badge flex-shrink-0 border-gray-200 text-navy-700 font-bold">
                    {formatFechaTabla(m.fecha)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wide mb-0.5">Lugar</p>
                    <p className="font-bold text-navy-800 line-clamp-2">{m.lugar || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-400 font-bold uppercase text-[9px] tracking-wide mb-0.5">Autor</p>
                    <p className="font-bold text-navy-800 truncate">{creatorLabel(m)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openView(m.id)} className={`${userActionBtn} flex-1 min-w-[40%] justify-center py-2`}>
                    <IconEye className="w-3.5 h-3.5" />
                    Ver
                  </button>
                  <button type="button" onClick={() => handlePdf(m)} className={`${userActionBtn} flex-1 min-w-[40%] justify-center py-2`}>
                    <IconDownload className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button type="button" onClick={() => openEdit(m.id)} className={`${userActionBtn} flex-1 min-w-[40%] justify-center py-2`}>
                    <IconPencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button type="button" onClick={() => handleDelete(m.id)} className={`${userActionBtnDanger} flex-1 min-w-[40%] justify-center py-2`}>
                    <IconTrash className="w-3.5 h-3.5" />
                    Borrar
                  </button>
                </div>
              </div>
            ))
          )}
          <div className="h-32 md:hidden" />
        </div>
      </div>

      {/* Modal formulario crear / editar */}
      {(modal === 'create' || modal === 'edit') &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
            onClick={closeModal}
            role="presentation"
          >
            <div
              className="flex max-h-[min(92dvh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="minuta-form-title"
            >
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-6 pb-6 sm:px-8 sm:pt-7">
                <div className="pointer-events-none absolute -right-20 -top-28 h-60 w-60 rounded-full bg-gold/12 blur-3xl" aria-hidden />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                    <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/[0.12] sm:flex">
                      <svg className="h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">Acta de reunión</p>
                      <h2 id="minuta-form-title" className="mt-1.5 font-display text-xl font-medium leading-tight text-white sm:text-2xl">
                        {modal === 'edit' ? 'Editar minuta' : 'Nueva minuta de reunión'}
                      </h2>
                      <p className="mt-1.5 text-sm text-white/55">Completa datos generales, asistentes y hasta tres temas del día.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
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
                  handleSave();
                }}
              >
                <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8 sm:py-7">
                  <section>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Datos generales</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Lugar</span>
                        <input
                          className={inputClass}
                          value={form.lugar}
                          onChange={(e) => setForm((f) => ({ ...f, lugar: e.target.value }))}
                          placeholder="Sala, dirección u oficina"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Fecha *</span>
                        <input
                          type="date"
                          className={inputClass}
                          value={form.fecha}
                          onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                          required
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Inicio</span>
                          <input
                            type="time"
                            className={inputClass}
                            value={form.hora_inicio}
                            onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Cierre</span>
                          <input
                            type="time"
                            className={inputClass}
                            value={form.hora_cierre}
                            onChange={(e) => setForm((f) => ({ ...f, hora_cierre: e.target.value }))}
                          />
                        </label>
                      </div>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Tema de la reunión</span>
                        <input
                          className={inputClass}
                          value={form.tema}
                          onChange={(e) => setForm((f) => ({ ...f, tema: e.target.value }))}
                          placeholder="Asunto o título general"
                        />
                      </label>
                    </div>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Asistentes</h3>
                      <button
                        type="button"
                        onClick={addAttendeeRow}
                        className="rounded-lg border border-gold/35 bg-gold/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gold transition-colors hover:bg-gold/15"
                      >
                        + Añadir fila
                      </button>
                    </div>
                    <div className="overflow-hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-black/[0.03]">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead>
                          <tr className="bg-gradient-to-r from-navy-950 to-navy-900 text-white">
                            <th className="w-10 px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide" />
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide">Nombre</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide">Cargo</th>
                            <th className="w-[128px] px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide">Asistencia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {form.attendees.map((row, idx) => (
                            <tr key={idx} className="bg-white">
                              <td className="px-1 py-2 align-middle text-center">
                                <button
                                  type="button"
                                  onClick={() => removeAttendeeRow(idx)}
                                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                  title="Quitar fila"
                                >
                                  ×
                                </button>
                              </td>
                              <td className="px-2 py-2">
                                <input className={inputClass} value={row.nombre} onChange={(e) => setAttendee(idx, 'nombre', e.target.value)} placeholder="Nombre" />
                              </td>
                              <td className="px-2 py-2">
                                <input className={inputClass} value={row.cargo} onChange={(e) => setAttendee(idx, 'cargo', e.target.value)} placeholder="Cargo" />
                              </td>
                              <td className="px-2 py-2">
                                <select className={inputClass} value={row.asistencia} onChange={(e) => setAttendee(idx, 'asistencia', e.target.value)}>
                                  <option value="Presente">Presente</option>
                                  <option value="Ausente">Ausente</option>
                                  <option value="Justificado">Justificado</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Temas del día</h3>
                    <div className="space-y-4">
                      {form.topics.map((topic, idx) => {
                        const st = TOPIC_STYLES[idx];
                        return (
                          <div key={idx} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-black/[0.03]">
                            <div className={`px-4 py-2.5 ${st.head} ${st.headText || 'text-white'}`}>
                              <span className="text-[10px] font-bold uppercase tracking-wider">{st.label}</span>
                            </div>
                            <div className="space-y-3 p-4">
                              <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Título del tema</span>
                                <input className={inputClass} value={topic.titulo} onChange={(e) => setTopic(idx, 'titulo', e.target.value)} />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Descripción</span>
                                <textarea className={`${inputClass} min-h-[76px] resize-y`} value={topic.descripcion} onChange={(e) => setTopic(idx, 'descripcion', e.target.value)} />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Comentarios</span>
                                <textarea className={`${inputClass} min-h-[76px] resize-y`} value={topic.comentarios} onChange={(e) => setTopic(idx, 'comentarios', e.target.value)} />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-[8rem]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-navy-900/10 bg-navy-950 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold shadow-md transition-colors hover:bg-navy-900 disabled:opacity-50 sm:min-w-[11rem]"
                  >
                    {saving ? (
                      <>
                        <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Guardando…
                      </>
                    ) : (
                      <>
                        {modal === 'create' && (
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        )}
                        Guardar minuta
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal solo lectura */}
      {modal === 'view' &&
        viewRecord &&
        createPortal(
          <div
            className="fixed inset-0 z-[105] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
            onClick={closeModal}
            role="presentation"
          >
            <div
              className="flex max-h-[min(92dvh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="minuta-view-title"
            >
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-6 pb-5 sm:px-8 sm:pt-7">
                <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-gold/12 blur-3xl" aria-hidden />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">Vista previa</p>
                    <h2 id="minuta-view-title" className="mt-1.5 truncate font-display text-lg font-medium text-white sm:text-xl">
                      {viewRecord.tema || 'Minuta de reunión'}
                    </h2>
                    <p className="mt-1 text-sm text-white/50">
                      {formatFechaTabla(viewRecord.fecha)}
                      {viewRecord.lugar ? ` · ${viewRecord.lugar}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePdf(viewRecord)}
                      className="inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gold transition-colors hover:bg-gold/15"
                    >
                      <IconDownload className="h-4 w-4 shrink-0" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Cerrar"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 text-sm sm:px-8">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Lugar</p>
                    <p className="mt-0.5 font-semibold text-navy-950">{viewRecord.lugar || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fecha</p>
                    <p className="mt-0.5 font-semibold text-navy-950">{formatFechaTabla(viewRecord.fecha)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Inicio</p>
                    <p className="mt-0.5 font-semibold text-navy-950">{viewRecord.hora_inicio || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cierre</p>
                    <p className="mt-0.5 font-semibold text-navy-950">{viewRecord.hora_cierre || '—'}</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-navy-950 text-white">
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wide">Nombre</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wide">Cargo</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wide">Asist.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(viewRecord.attendees || [])
                        .filter((a) => (a.nombre || '').trim() || (a.cargo || '').trim())
                        .map((a, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-navy-800">{a.nombre}</td>
                            <td className="px-3 py-2 text-navy-800">{a.cargo}</td>
                            <td className="px-3 py-2 text-navy-800">{a.asistencia}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {(viewRecord.topics || []).map((t, idx) => {
                  const st = TOPIC_STYLES[idx];
                  return (
                    <div key={idx} className="overflow-hidden rounded-xl border border-slate-200">
                      <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide ${st.head} ${st.headText || 'text-white'}`}>
                        {['Tema 1', 'Tema 2', 'Tema 3'][idx]} del día
                      </div>
                      <div className="space-y-2 bg-slate-50/50 p-4 text-xs leading-relaxed">
                        <p>
                          <span className="font-semibold text-slate-600">Título:</span> <span className="text-navy-950">{t.titulo || '—'}</span>
                        </p>
                        <p>
                          <span className="font-semibold text-slate-600">Descripción:</span>
                          <br />
                          <span className="text-navy-800">{t.descripcion || '—'}</span>
                        </p>
                        <p>
                          <span className="font-semibold text-slate-600">Comentarios:</span>
                          <br />
                          <span className="text-navy-800">{t.comentarios || '—'}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
