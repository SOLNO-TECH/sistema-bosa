import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const DEPARTAMENTOS = [
  'Obra Civil','Proyectos','Diseño','Acabados','Eléctricos',
  'HVAC','Hidrosanitarios','Sistemas','Contabilidad','Finanzas',
  'Recursos Humanos','Jurídico','Compras','Costos','Operaciones',
  'Mantenimiento','Almacén','Marketing','Restaurantes','Berry Yum'
];

const GRUPOS = ['Todos los departamentos','Directivos','Operativos','Administrativos'];

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

export default function AvisosModule() {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAviso, setSelectedAviso] = useState(null);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPrioridad, setFilterPrioridad] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  const [form, setForm] = useState({
    titulo: '',
    mensaje: '',
    prioridad: 'normal',
    tipo: 'departamento',
    departamentos: [],
    grupo: '',
  });

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
    const destinatarios = form.tipo === 'grupo' ? [form.grupo || GRUPOS[0]] : form.departamentos;
    
    setSending(true);
    try {
      await axios.post('/api/avisos', {
        title: form.titulo,
        content: form.mensaje,
        category: form.prioridad,
        created_by: user?.id,
      });
      
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
    } catch (err) {
      console.error(err);
      alert('Error al guardar el aviso en la base de datos.');
    } finally {
      setSending(false);
      setIsModalOpen(false);
      setForm({ titulo: '', mensaje: '', prioridad: 'normal', tipo: 'departamento', departamentos: [], grupo: '' });
    }
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

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-medium text-navy-950 tracking-tight">Avisos y Comunicados</h2>
          <p className="text-sm text-navy-600 mt-1">Envía notificaciones por departamento o grupo con copia al correo</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-gold flex items-center gap-2 shadow-md">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nuevo Aviso
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg>
          </div>
          <div>
            <p className="text-2xl font-black text-navy-950">{avisos.length}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Total Avisos</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
          </div>
          <div>
            <p className="text-2xl font-black text-navy-950">{totalEnviados}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Notif. Enviadas</p>
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-600">{totalLeidos}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Total Leídos</p>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white border border-purple-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>
          </div>
          <div>
            <p className="text-2xl font-black text-purple-600">{tasaLectura}%</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Tasa de Lectura</p>
          </div>
        </div>
      </div>

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
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${PRIORIDAD_STYLES[aviso.prioridad]}`}>
                    {aviso.prioridad}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${ESTADO_STYLES[aviso.estado] || ESTADO_STYLES.borrador}`}>
                    {aviso.estado === 'enviado' ? '✓ Enviado' : aviso.estado === 'programado' ? '⏰ Programado' : 'Borrador'}
                  </span>
                  <span className="bg-gray-100 text-navy-600 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                    {aviso.tipo === 'grupo' ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    )}
                    {aviso.tipo === 'grupo' ? 'Grupo' : 'Departamento'}
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/50 pt-[72px] px-4 pb-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="font-display font-medium text-navy-950 text-xl">Nuevo Aviso</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-navy-950">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Título */}
              <div className="space-y-1.5">
                <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Título del Aviso</label>
                <input type="text" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})}
                  className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white"
                  placeholder="Ej. Mantenimiento programado del sistema" />
              </div>

              {/* Prioridad */}
              <div className="space-y-1.5">
                <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Prioridad</label>
                <div className="flex gap-3">
                  {['normal','importante','urgente'].map(p => (
                    <button key={p} onClick={() => setForm({...form, prioridad: p})}
                      className={`flex-1 py-2.5 rounded-lg border-2 text-xs font-bold uppercase tracking-wide transition-all ${
                        form.prioridad === p ? 'border-gold bg-gold/10 text-gold' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de destinatario */}
              <div className="space-y-1.5">
                <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Enviar a</label>
                <div className="flex gap-3">
                  <button onClick={() => setForm({...form, tipo: 'departamento'})}
                    className={`flex-1 py-2.5 rounded-lg border-2 text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${form.tipo === 'departamento' ? 'border-gold bg-gold/10 text-gold' : 'border-gray-200 text-gray-500'}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    Departamentos
                  </button>
                  <button onClick={() => setForm({...form, tipo: 'grupo'})}
                    className={`flex-1 py-2.5 rounded-lg border-2 text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${form.tipo === 'grupo' ? 'border-gold bg-gold/10 text-gold' : 'border-gray-200 text-gray-500'}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Grupo
                  </button>
                </div>
              </div>

              {/* Selector de destinatarios */}
              {form.tipo === 'departamento' ? (
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">
                    Departamentos ({form.departamentos.length} seleccionados)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {DEPARTAMENTOS.map(d => (
                      <button key={d} onClick={() => toggleDept(d)}
                        className={`text-left px-3 py-2 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                          form.departamentos.includes(d)
                            ? 'border-gold bg-gold/10 text-gold'
                            : 'border-gray-200 text-navy-700 hover:border-gray-300 bg-gray-50'
                        }`}>
                        {form.departamentos.includes(d) ? (
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-3 h-3 flex-shrink-0 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                        )}
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Grupo</label>
                  <select value={form.grupo} onChange={e => setForm({...form, grupo: e.target.value})}
                    className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 focus:border-gold focus:ring-1 focus:ring-gold outline-none bg-white">
                    {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              )}

              {/* Mensaje */}
              <div className="space-y-1.5">
                <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Mensaje</label>
                <textarea rows={4} value={form.mensaje} onChange={e => setForm({...form, mensaje: e.target.value})}
                  className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none bg-white resize-none"
                  placeholder="Escribe el contenido del aviso aquí..." />
              </div>

              {/* Nota correo */}
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <p className="text-xs text-blue-700 font-medium">Este aviso se enviará por correo electrónico a todos los miembros de los departamentos o grupos seleccionados.</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 border border-gray-200 text-navy-600 rounded-sm text-sm font-bold tracking-wide uppercase hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSend} disabled={sending}
                className="btn-gold flex items-center gap-2 disabled:opacity-60">
                {sending ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Enviando...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Publicar y Enviar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE AVISO ── */}
      {selectedAviso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4 animate-fade-in" onClick={() => setSelectedAviso(null)}>
          <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 bg-navy-950 text-white text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-md">
                    <svg className="w-3 h-3 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                    {selectedAviso.id}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${PRIORIDAD_STYLES[selectedAviso.prioridad]}`}>{selectedAviso.prioridad}</span>
                </div>
                <h3 className="font-display font-medium text-navy-950 text-lg">{selectedAviso.titulo}</h3>
              </div>
              <button onClick={() => setSelectedAviso(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase mb-2">Mensaje</p>
                <p className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-navy-700 text-sm leading-relaxed">{selectedAviso.mensaje}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Publicado por <span className="font-bold text-navy-700">{selectedAviso.autor}</span> el {selectedAviso.fecha} a las {selectedAviso.hora}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
