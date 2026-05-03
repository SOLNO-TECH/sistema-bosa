import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import autoAnimate from '@formkit/auto-animate';

const DEPARTAMENTOS = [
  'Obra Civil', 'Proyectos', 'Diseño', 'Acabados', 'Eléctricos',
  'HVAC', 'Hidrosanitarios', 'Sistemas', 'Contabilidad', 'Finanzas',
  'Recursos Humanos', 'Jurídico', 'Compras', 'Costos', 'Operaciones',
  'Mantenimiento', 'Almacén', 'Marketing', 'Restaurantes', 'Berry Yum'
];

// Los usuarios se cargan dinámicamente desde el backend

const INITIAL_TICKETS = [
  {
    id: 'T-1001',
    title: 'Actualizar servidores de base de datos',
    description: 'Se requiere realizar el mantenimiento programado y actualización de parches de seguridad.',
    status: 'todo',
    departamento: 'Sistemas',
    creadoPor: 'Super Administrador',
    asignadoA: null,
    date: '12 May 2026', time: '09:00 AM',
    historial: [
      { accion: 'Ticket creado y asignado al depto. Sistemas', autor: 'Super Administrador', fecha: '12 May 2026', hora: '09:00 AM' }
    ]
  },
  {
    id: 'T-1002',
    title: 'Revisión de facturación mensual',
    description: 'Validar las facturas emitidas vs el reporte del CRM de BOSA.',
    status: 'inProgress',
    departamento: 'Finanzas',
    creadoPor: 'Super Administrador',
    asignadoA: 'María López',
    date: '15 May 2026', time: '11:30 AM',
    historial: [
      { accion: 'Ticket creado y asignado al depto. Finanzas', autor: 'Super Administrador', fecha: '15 May 2026', hora: '11:30 AM' },
      { accion: 'Ticket asignado a María López', autor: 'María López', fecha: '15 May 2026', hora: '12:00 PM' },
      { accion: 'Estado cambiado a En Progreso', autor: 'María López', fecha: '15 May 2026', hora: '12:05 PM' }
    ]
  },
  {
    id: 'T-1003',
    title: 'Error de acceso en el portal de clientes',
    description: 'El cliente XYZ reporta que no puede acceder a su cuenta. Muestra error 500.',
    status: 'todo',
    departamento: 'Sistemas',
    creadoPor: 'Super Administrador',
    asignadoA: 'Ana García',
    date: '02 May 2026', time: '14:45 PM',
    historial: [
      { accion: 'Ticket creado y asignado al depto. Sistemas', autor: 'Super Administrador', fecha: '02 May 2026', hora: '14:45 PM' },
      { accion: 'Ticket asignado a Ana García', autor: 'Angel Palacios', fecha: '02 May 2026', hora: '15:00 PM' }
    ]
  },
];

const COLUMNS = [
  { id: 'todo',       label: 'Pendientes',   color: 'border-slate-300',  bg: 'bg-slate-50'  },
  { id: 'inProgress', label: 'En Progreso',  color: 'border-blue-300',   bg: 'bg-blue-50'   },
  { id: 'review',     label: 'En Revisión',  color: 'border-amber-300',  bg: 'bg-amber-50'  },
  { id: 'done',       label: 'Completados',  color: 'border-emerald-300',bg: 'bg-emerald-50'},
];

export default function TicketsModule() {
  const { user } = useAuth();
  const [tickets, setTickets]           = useState(INITIAL_TICKETS);
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterDept, setFilterDept]     = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [assignTarget, setAssignTarget] = useState('');
  const [showAssignPanel, setShowAssignPanel] = useState(false);

  const [dbUsers, setDbUsers] = useState([]);

  // Carga todos los usuarios desde la base de datos al montar
  useEffect(() => {
    fetch('http://localhost:4000/api/users')
      .then(r => r.json())
      .then(data => setDbUsers(Array.isArray(data) ? data : []))
      .catch(() => setDbUsers([]));
  }, []);

  const defaultForm = { title: '', description: '', departamento: DEPARTAMENTOS[0], date: '', time: '' };
  const [formData, setFormData] = useState(defaultForm);

  // Determina si el usuario logueado puede asignar el ticket
  const isGerenteOf = (ticket) =>
    user?.role === 'superadmin' ||
    (user?.puesto === 'Gerente' && user?.departamento === ticket?.departamento);

  // Devuelve todos los usuarios de la BD (se muestran todos para asignar)
  const usersOfDept = () => dbUsers;

  const handleDragStart = (e, ticket) => {
    setDraggedTicket(ticket);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('opacity-50'), 0);
  };
  const handleDragEnd   = (e) => { e.target.classList.remove('opacity-50'); setDraggedTicket(null); };
  const handleDragOver  = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e, statusId) => {
    e.preventDefault();
    if (!draggedTicket || draggedTicket.status === statusId) return;
    const label = COLUMNS.find(c => c.id === statusId)?.label || statusId;
    const now = new Date();
    const hora = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    const fecha = now.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
    setTickets(prev => prev.map(t => t.id === draggedTicket.id
      ? { ...t, status: statusId, historial: [...(t.historial||[]), { accion: `Estado cambiado a ${label}`, autor: user?.name||'Sistema', fecha, hora }] }
      : t
    ));
    setDraggedTicket(null);
  };

  const handleSaveTicket = () => {
    if (!formData.title || !formData.departamento) return;
    const now = new Date();
    const fecha = now.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
    const hora  = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

    if (formData.id) {
      // — EDITAR ticket existente
      setTickets(prev => prev.map(t => t.id === formData.id
        ? { ...t, title: formData.title, description: formData.description, departamento: formData.departamento,
            historial: [...(t.historial||[]), { accion: 'Ticket editado', autor: user?.name||'Administrador', fecha, hora }] }
        : t
      ));
    } else {
      // — CREAR nuevo ticket
      setTickets(prev => [{
        ...formData,
        id: `T-${1000 + prev.length + 1}`,
        status: 'todo',
        creadoPor: user?.name || 'Administrador',
        asignadoA: null,
        date: formData.date || fecha,
        time: formData.time || hora,
        historial: [{ accion: `Ticket creado y asignado al depto. ${formData.departamento}`, autor: user?.name||'Administrador', fecha, hora }]
      }, ...prev]);
    }
    setIsModalOpen(false);
    setFormData(defaultForm);
  };

  const handleCloseTicket = (id) => {
    const now = new Date();
    const hora  = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    const fecha = now.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
    setTickets(prev => prev.map(t => t.id === id
      ? { ...t, status: 'done', historial: [...(t.historial||[]), { accion: 'Ticket cerrado', autor: user?.name||'Sistema', fecha, hora }] }
      : t
    ));
    setSelectedTicket(null);
  };

  const handleAssign = (ticket) => {
    if (!assignTarget) return;
    const now = new Date();
    const hora  = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    const fecha = now.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
    const updated = { ...ticket, asignadoA: assignTarget,
      historial: [...(ticket.historial||[]), { accion: `Ticket asignado a ${assignTarget}`, autor: user?.name||'Gerente', fecha, hora }]
    };
    setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
    setSelectedTicket(updated);
    setShowAssignPanel(false);
    setAssignTarget('');
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (t.asignadoA||'').toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = filterDept ? t.departamento === filterDept : true;
    return matchSearch && matchDept;
  });


  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* ── HEADER Y BOTÓN NUEVO ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-medium text-navy-950 tracking-tight">Soporte y Tareas</h2>
          <p className="text-sm text-navy-600 mt-1">Gestión avanzada de tickets y requerimientos internos</p>
        </div>
        <button 
          onClick={() => { setFormData(defaultForm); setIsModalOpen(true); }}
          className="btn-gold whitespace-nowrap flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nuevo Ticket
        </button>
      </div>

      {/* ── BUSCADOR Y FILTROS ── */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-shrink-0">
        <div className="relative w-full md:w-96">
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Buscar por ID, título o asignado..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 placeholder-gray-400 transition-all bg-gray-50 hover:bg-white shadow-inner"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none">
            <option value="">Todos los departamentos</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* ── TABLERO KANBAN ── */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {COLUMNS.map(col => {
          const colTickets = filteredTickets.filter(t => t.status === col.id);
          
          return (
            <div 
              key={col.id} 
              className={`flex-shrink-0 w-80 lg:w-80 flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden shadow-sm`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Cabecera de la columna */}
              <div className={`px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-t-4 ${col.color}`}>
                <h3 className="font-bold text-navy-900 text-sm">{col.label}</h3>
                <span className="bg-gray-200 text-navy-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {colTickets.length}
                </span>
              </div>
              
              {/* Contenedor de Tarjetas - Animated */}
              <AnimatedColumn className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
                {colTickets.length === 0 ? (
                  <div key="empty" className="h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-xs font-medium text-gray-400">
                    Soltar tickets aquí
                  </div>
                ) : (
                  colTickets.map(ticket => (
                    <TicketCard 
                      key={ticket.id} 
                      ticket={ticket} 
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={(t) => setSelectedTicket(t)}
                    />
                  ))
                )}
              </AnimatedColumn>
            </div>
          );
        })}
      </div>

      {/* ── MODAL NUEVO TICKET ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/50 pt-[72px] px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] shadow-card-lg overflow-hidden animate-slide-up flex flex-col">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="font-display font-medium text-navy-950 text-xl">{formData.id ? 'Editar Ticket' : 'Crear Nuevo Ticket'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-navy-950">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              <div className="space-y-1.5">
                <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Asunto o Título</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm" placeholder="Ej. Falla en el sistema de cobro" />
              </div>
              
              <div className="space-y-1.5">
                <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Departamento Asignado *</label>
                <select value={formData.departamento} onChange={e => setFormData({...formData, departamento: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm appearance-none">
                  {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Fecha Límite</label>
                  <input type="date" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Hora Límite</label>
                  <input type="time" value={formData.time || ''} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm" />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Descripción del Requerimiento</label>
                <textarea rows="4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border-2 border-gray-300 rounded-md px-4 py-2.5 text-navy-950 placeholder-gray-400 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all bg-white shadow-sm resize-none" placeholder="Describe detalladamente lo que sucede..."></textarea>
              </div>

              <div className="space-y-1.5">
                <label className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Evidencia Multimedia (Opcional)</label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-gold/5 hover:border-gold transition-colors cursor-pointer group">
                  <input type="file" multiple accept="image/*,video/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <svg className="w-8 h-8 text-gray-400 group-hover:text-gold mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
                  <p className="text-sm font-bold text-navy-900 group-hover:text-gold transition-colors">Haz clic o arrastra tus archivos aquí</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">Soporta imágenes (JPG, PNG) y videos (MP4) hasta 50MB</p>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-5 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 border border-gray-200 text-navy-600 rounded-sm text-sm font-bold tracking-wide uppercase hover:bg-gray-100 transition-colors">Cancelar</button>
              <button onClick={handleSaveTicket} className="btn-gold">Guardar Ticket</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE DETALLE DEL TICKET ── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 px-4 pt-20 pb-6 sm:px-6 animate-fade-in" onClick={() => { setSelectedTicket(null); setShowAssignPanel(false); }}>
          <div className="bg-white rounded-xl w-full max-w-3xl h-[88vh] shadow-2xl overflow-hidden animate-slide-up flex flex-col" onClick={e => e.stopPropagation()}>

            {/* ── BARRA SUPERIOR FIJA ── */}
            <div className="flex-shrink-0 bg-navy-950 px-6 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black tracking-widest text-gold uppercase bg-white/10 px-2.5 py-1 rounded">
                    {selectedTicket.id}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded">
                    {selectedTicket.departamento}
                  </span>
                  <span className="inline-flex items-center bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded">
                    {COLUMNS.find(c => c.id === selectedTicket.status)?.label}
                  </span>
                </div>
                <button
                  onClick={() => { setSelectedTicket(null); setShowAssignPanel(false); }}
                  className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all flex-shrink-0"
                  title="Cerrar vista"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <h2 className="text-lg font-display font-semibold text-white leading-snug">{selectedTicket.title}</h2>
            </div>

            {/* ── CUERPO DIVIDIDO ── */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

              {/* Columna Principal: scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div>
                  <h4 className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase mb-2">Descripción del Requerimiento</h4>
                  <p className="bg-gray-50 p-4 rounded-md border border-gray-100 text-navy-600 text-sm leading-relaxed">{selectedTicket.description}</p>
                </div>
                <div>
                  <h4 className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase mb-2">Archivos Adjuntos</h4>
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 hover:border-gold hover:text-gold cursor-pointer transition-colors">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="w-20 h-20 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 hover:border-gold hover:text-gold cursor-pointer transition-colors">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna Secundaria: detalles + asignación + historial */}
              <div className="w-full md:w-72 bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                  <h4 className="font-label font-bold text-navy-950 text-[10px] tracking-wider uppercase">Detalles del Ticket</h4>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide block mb-1">Asignado a</span>
                      {selectedTicket.asignadoA ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-navy-900 text-white flex items-center justify-center text-xs font-bold border-2 border-gold/30">{selectedTicket.asignadoA.charAt(0)}</div>
                          <span className="text-sm font-bold text-navy-900">{selectedTicket.asignadoA}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Sin asignar</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide block mb-1">Creado por</span>
                      <span className="text-sm font-bold text-navy-900">{selectedTicket.creadoPor}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide block mb-1">Fecha / Hora</span>
                      <span className="text-sm font-bold text-navy-900">{selectedTicket.date} · {selectedTicket.time}</span>
                    </div>
                  </div>

                  {isGerenteOf(selectedTicket) && selectedTicket.status !== 'done' && (
                    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                      {/* Header del panel */}
                      <div className="bg-navy-950 px-4 py-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">Asignar a persona</span>
                      </div>
                      {/* Lista de personas */}
                      <div className="bg-white divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {dbUsers.length === 0 ? (
                          <div className="px-4 py-6 text-center">
                            <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            <p className="text-xs text-gray-400">Cargando usuarios...</p>
                          </div>
                        ) : (
                          dbUsers.map(u => {
                            const fullName = `${u.name}${u.apellido ? ' ' + u.apellido : ''}`;
                            const isSelected = assignTarget === fullName;
                            return (
                              <button
                                key={u.id}
                                onClick={() => setAssignTarget(fullName)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                                  isSelected ? 'bg-navy-950 text-white' : 'hover:bg-gray-50 text-navy-800'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                                  isSelected ? 'bg-gold text-navy-950' : 'bg-gray-200 text-navy-700'
                                }`}>
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold truncate">{fullName}</p>
                                  <p className={`text-[10px] font-medium truncate ${
                                    isSelected ? 'text-white/60' : 'text-gray-400'
                                  }`}>
                                    {u.puesto || u.role} · {u.departamento || '—'}
                                  </p>
                                </div>
                                {isSelected && (
                                  <svg className="w-4 h-4 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                      {/* Botón confirmar */}
                      <div className="p-3 bg-gray-50 border-t border-gray-100">
                        <button
                          onClick={() => handleAssign(selectedTicket)}
                          disabled={!assignTarget}
                          className="w-full bg-navy-950 hover:bg-navy-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white disabled:text-gray-400 font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all text-sm tracking-wide"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          {assignTarget ? `Asignar a ${assignTarget.split(' ')[0]}` : 'Selecciona una persona'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-navy-950 mb-3">Historial de Actividad</p>
                    <div className="space-y-0">
                      {(selectedTicket.historial || []).slice().reverse().map((h, i, arr) => (
                        <div key={i} className="flex gap-3 pb-4">
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-gold border-2 border-white shadow flex-shrink-0 mt-0.5" />
                            {i < arr.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-navy-800 leading-snug">{h.accion}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{h.autor} · {h.fecha} {h.hora}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── FOOTER: solo Editar ── */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-between">
              <button
                onClick={() => {
                  setFormData({ id: selectedTicket.id, title: selectedTicket.title, description: selectedTicket.description, departamento: selectedTicket.departamento, date: selectedTicket.date, time: selectedTicket.time });
                  setSelectedTicket(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg text-navy-700 hover:border-gold hover:text-gold transition-all text-sm font-bold uppercase tracking-wide"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Editar Ticket
              </button>
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                {selectedTicket.status === 'done' ? '✓ Completado' : `${(selectedTicket.historial||[]).length} actividad(es)`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── COMPONENTE COLUMNA CON AUTO-ANIMATE ──
function AnimatedColumn({ children, className, ...props }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) autoAnimate(ref.current, { duration: 250, easing: 'ease-out' }); }, []);
  return <div ref={ref} className={className} {...props}>{children}</div>;
}

// ── COMPONENTE DE TARJETA KANBAN ──
const STATUS_DOT = {
  todo: 'bg-slate-400', inProgress: 'bg-blue-500', review: 'bg-amber-500', done: 'bg-emerald-500'
};

function TicketCard({ ticket, onDragStart, onDragEnd, onClick }) {
  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(e, ticket); }}
      onDragEnd={onDragEnd}
      onClick={() => onClick(ticket)}
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-gold/40 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] font-black text-white bg-navy-950 px-2 py-0.5 rounded tracking-widest">{ticket.id}</span>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${STATUS_DOT[ticket.status] || 'bg-gray-300'}`} />
      </div>
      <h4 className="font-bold text-navy-900 text-sm leading-snug mb-2 group-hover:text-gold transition-colors line-clamp-2">{ticket.title}</h4>
      <div className="flex items-center justify-between mt-3">
        <span className="inline-flex items-center gap-1 bg-gray-100 text-navy-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-gray-200">
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
          {ticket.departamento}
        </span>
        {ticket.asignadoA ? (
          <div className="w-6 h-6 rounded-full bg-navy-800 text-white flex items-center justify-center text-[10px] font-bold border border-gold/30" title={ticket.asignadoA}>
            {ticket.asignadoA.charAt(0)}
          </div>
        ) : (
          <span className="text-[10px] text-gray-400 italic">Sin asignar</span>
        )}
      </div>
      <p className="text-[10px] text-gray-400 font-medium mt-2">{ticket.date} · {ticket.time}</p>
    </div>
  );
}


