import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';

const DEPARTAMENTOS = [
  'Obra Civil', 'Proyectos', 'Diseño', 'Acabados', 'Eléctricos',
  'HVAC', 'Hidrosanitarios', 'Sistemas', 'Contabilidad', 'Finanzas',
  'Recursos Humanos', 'Jurídico', 'Compras', 'Costos', 'Operaciones',
  'Mantenimiento', 'Almacén', 'Marketing', 'Restaurantes', 'Berry Yum'
];

export default function CalendarModule() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  
  // Filtros de vista principal
  const [filterUser, setFilterUser] = useState('all');

  // Estado del formulario
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '',
    end_time: '',
    attendees: [],
    recurrence: 'none',
    recurrence_until: '',
  });
  const [modalDeptFilter, setModalDeptFilter] = useState('');

  useEffect(() => {
    fetchMeetings();
    fetchUsers();
  }, []);

  const fetchMeetings = async () => {
    try {
      const { data } = await axios.get('/api/meetings');
      setMeetings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('/api/users');
      setDbUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  // Genera todas las ocurrencias según la recurrencia configurada
  const generateOccurrences = (form) => {
    const baseStart = `${form.date}T${form.start_time}`;
    const baseEnd = `${form.date}T${form.end_time}`;

    if (form.recurrence === 'none' || !form.recurrence_until) {
      return [{ start: baseStart, end: baseEnd }];
    }

    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const occurrences = [];
    const current = new Date(`${form.date}T00:00:00`);
    const limit = new Date(`${form.recurrence_until}T23:59:59`);
    const MAX = 200; // límite de seguridad

    while (current <= limit && occurrences.length < MAX) {
      const dateStr = fmt(current);
      occurrences.push({
        start: `${dateStr}T${form.start_time}`,
        end: `${dateStr}T${form.end_time}`,
      });

      if (form.recurrence === 'weekly')      current.setDate(current.getDate() + 7);
      else if (form.recurrence === 'biweekly') current.setDate(current.getDate() + 14);
      else if (form.recurrence === 'monthly')  current.setMonth(current.getMonth() + 1);
      else break;
    }
    return occurrences;
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    const occurrences = generateOccurrences(formData);

    try {
      await Promise.all(occurrences.map(occ =>
        axios.post('/api/meetings', {
          title: formData.title,
          description: formData.description,
          date: formData.date,
          start_time: occ.start,
          end_time: occ.end,
          attendees: formData.attendees,
        })
      ));
      fetchMeetings();
      setIsModalOpen(false);
      resetForm();
      // Push de confirmación
      try {
        const d = new Date(`${formData.date}T${formData.start_time}`);
        const when = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' ' + formData.start_time;
        PushEvents.meetingCreated(formData.title, when);
      } catch (_) {
        PushEvents.meetingCreated(formData.title);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', date: '', start_time: '', end_time: '', attendees: [], recurrence: 'none', recurrence_until: '' });
    setModalDeptFilter('');
  };

  const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  // Filtrar reuniones por usuario seleccionado (ver disponibilidad individual)
  const filteredMeetings = meetings.filter(m => {
    if (filterUser === 'all') return true;
    const userId = parseInt(filterUser);
    return m.created_by === userId || (m.attendees && m.attendees.includes(userId));
  });

  const renderCalendar = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const totalDays = daysInMonth(month, year);
    const startDay = firstDayOfMonth(month, year);
    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`pad-${i}`} className="h-14 lg:h-32 border border-gray-100 bg-gray-50/30"></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayMeetings = filteredMeetings.filter(m => m.start_time.startsWith(dateStr));
      const isSelected = selectedDay === dateStr;
      const isToday = new Date().toISOString().startsWith(dateStr);
      
      days.push(
        <div
          key={d}
          onClick={() => setSelectedDay(dateStr)}
          onDoubleClick={() => {
            setSelectedDay(dateStr);
            setFormData(prev => ({ ...prev, date: dateStr }));
            setIsModalOpen(true);
          }}
          className={`h-14 lg:h-32 border border-gray-100 p-1 lg:p-2 overflow-y-auto cursor-pointer transition-all relative ${
            isSelected ? 'bg-gold/10' : 'hover:bg-navy-50/10'
          }`}
        >
          <div className="flex flex-col items-center lg:items-start">
            <span className={`text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full ${
              isToday ? 'bg-gold text-navy-950' : 
              isSelected ? 'bg-navy-950 text-white' : 'text-navy-900/40 uppercase tracking-tighter'
            }`}>
              {d}
            </span>
            {/* Mobile indicator (dots) */}
            <div className="flex gap-0.5 mt-1 lg:hidden">
              {dayMeetings.slice(0, 3).map((_, i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-gold shadow-sm" />
              ))}
              {dayMeetings.length > 3 && <div className="w-1 h-1 rounded-full bg-navy-400" />}
            </div>
          </div>

          {/* Desktop Content */}
          <div className="mt-1 space-y-1 hidden lg:block">
            {dayMeetings.map((m, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setSelectedMeeting(m); }}
                className="w-full text-left text-[9px] bg-navy-950 text-white p-1 rounded border-l-2 border-gold truncate font-bold uppercase tracking-tight hover:bg-gold hover:text-navy-950 transition-colors"
                title={m.title}
              >
                {m.title} <span className="font-normal opacity-70 normal-case tracking-normal">{new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const selectedDayMeetings = filteredMeetings.filter(m => m.start_time.startsWith(selectedDay));

  // Lógica de selección de participantes
  const filteredUsersForModal = dbUsers.filter(u => !modalDeptFilter || u.departamento === modalDeptFilter);
  const isAllSelected = filteredUsersForModal.length > 0 && filteredUsersForModal.every(u => formData.attendees.includes(u.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setFormData({
        ...formData,
        attendees: formData.attendees.filter(id => !filteredUsersForModal.some(u => u.id === id))
      });
    } else {
      const newAttendees = [...new Set([...formData.attendees, ...filteredUsersForModal.map(u => u.id)])];
      setFormData({...formData, attendees: newAttendees});
    }
  };

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 lg:mb-8 gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-display font-light text-navy-950 uppercase tracking-widest">Calendario Corporativo</h2>
          <div className="flex items-center gap-3 mt-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Disponibilidad:</span>
            <select 
              value={filterUser} 
              onChange={e => setFilterUser(e.target.value)}
              className="bg-white border border-gray-200 rounded px-2 py-1 text-[10px] font-black text-navy-900 outline-none focus:border-gold shadow-sm uppercase tracking-tighter"
            >
              <option value="all">TODO EL EQUIPO</option>
              {dbUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} {u.apellido}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
           <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
             <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-3 lg:p-2 hover:bg-gray-50 text-navy-950 transition-colors">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
             </button>
             <div className="flex-1 px-4 py-2 border-x border-gray-100 font-black text-navy-950 min-w-[120px] lg:min-w-[150px] text-center text-[10px] lg:text-xs uppercase tracking-[0.2em]">
               {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
             </div>
             <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-3 lg:p-2 hover:bg-gray-50 text-navy-950 transition-colors">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
             </button>
           </div>
           <button onClick={() => setIsModalOpen(true)} className="btn-gold flex items-center justify-center gap-2 py-3 lg:py-2 text-[10px] lg:text-xs font-black uppercase tracking-widest rounded-xl">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
             Nueva Reunión
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lado del Calendario */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden h-fit">
          <div className="grid grid-cols-7 bg-navy-950 text-white text-[9px] lg:text-[10px] font-black tracking-[0.2em] uppercase py-4 border-b border-navy-900">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d} className="text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {renderCalendar()}
          </div>
        </div>

        {/* Lado de Agenda (Muy importante para móvil) */}
        <div className="lg:col-span-1 space-y-4">
           <div className="bg-navy-950 rounded-2xl p-5 shadow-2xl border border-gold/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Agenda del Día</h3>
                <span className="text-gold text-[9px] font-black uppercase tracking-widest bg-gold/10 px-2 py-1 rounded border border-gold/20">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString([], { day: '2-digit', month: 'short' }).toUpperCase()}
                </span>
              </div>
              
              <div className="space-y-3 max-h-[300px] lg:max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {selectedDayMeetings.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-white/10 rounded-xl">
                    <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Sin reuniones agendadas</p>
                  </div>
                ) : (
                  selectedDayMeetings.map((m, i) => (
                    <button 
                      key={i} 
                      onClick={() => setSelectedMeeting(m)}
                      className="w-full group text-left p-4 bg-white/5 hover:bg-gold rounded-xl border border-white/10 hover:border-gold transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gold group-hover:text-navy-950 text-[10px] font-black tracking-widest">
                          {new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                      <h4 className="text-white group-hover:text-navy-950 text-xs font-black uppercase leading-tight mb-2 line-clamp-2">{m.title}</h4>
                      <p className="text-white/40 group-hover:text-navy-950/60 text-[9px] font-bold uppercase tracking-tighter">
                        {m.attendees?.length || 0} Participantes
                      </p>
                    </button>
                  ))
                )}
              </div>
           </div>
        </div>
      </div>

      {/* Modal Nueva Reunión */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            <div className="bg-navy-950 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-display font-medium text-white tracking-wide uppercase">Agendar Reunión</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-white/60 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreateMeeting} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Título de la Reunión</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} 
                  className="w-full border-2 border-gray-200 bg-white rounded-lg px-4 py-3 text-navy-950 placeholder:text-gray-300 focus:border-gold focus:ring-4 focus:ring-gold/10 outline-none transition-all text-sm font-bold" 
                  placeholder="Ej. REVISIÓN SEMANAL DE OBRA" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Fecha</label>
                  <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full border-2 border-gray-200 bg-white rounded-lg px-4 py-3 text-navy-950 focus:border-gold focus:ring-4 focus:ring-gold/10 outline-none transition-all text-sm font-bold" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Inicio</label>
                    <input required type="time" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})}
                      className="w-full border-2 border-gray-200 bg-white rounded-lg px-2 py-3 text-navy-950 focus:border-gold focus:ring-4 focus:ring-gold/10 outline-none transition-all text-xs font-bold" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Fin</label>
                    <input required type="time" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})}
                      className="w-full border-2 border-gray-200 bg-white rounded-lg px-2 py-3 text-navy-950 focus:border-gold focus:ring-4 focus:ring-gold/10 outline-none transition-all text-xs font-bold" />
                  </div>
                </div>
              </div>

              {/* ── Recurrencia ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg border border-gold/20 bg-gold/5">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Repetición</label>
                  <select
                    value={formData.recurrence}
                    onChange={e => setFormData({ ...formData, recurrence: e.target.value, recurrence_until: e.target.value === 'none' ? '' : formData.recurrence_until })}
                    className="w-full border-2 border-gray-200 bg-white rounded-lg px-3 py-3 text-navy-950 focus:border-gold focus:ring-4 focus:ring-gold/10 outline-none transition-all text-xs font-bold uppercase"
                  >
                    <option value="none">Sin repetición</option>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Repetir hasta</label>
                  <input
                    type="date"
                    disabled={formData.recurrence === 'none'}
                    required={formData.recurrence !== 'none'}
                    min={formData.date}
                    value={formData.recurrence_until}
                    onChange={e => setFormData({ ...formData, recurrence_until: e.target.value })}
                    className="w-full border-2 border-gray-200 bg-white rounded-lg px-3 py-3 text-navy-950 focus:border-gold focus:ring-4 focus:ring-gold/10 outline-none transition-all text-xs font-bold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  />
                </div>
                {formData.recurrence !== 'none' && formData.date && formData.recurrence_until && (
                  <p className="sm:col-span-2 text-[10px] text-navy-700 font-bold uppercase tracking-widest">
                    Se crearán {generateOccurrences(formData).length} reuniones
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Participantes</label>
                <div className="flex gap-2">
                  <select 
                    value={modalDeptFilter} 
                    onChange={e => setModalDeptFilter(e.target.value)}
                    className="flex-1 border-2 border-gray-200 bg-white rounded-lg px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
                  >
                    <option value="">TODOS LOS DEPTOS.</option>
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                  </select>
                  {modalDeptFilter && (
                    <button 
                      type="button" 
                      onClick={toggleSelectAll}
                      className="px-3 py-2 bg-gray-100 text-navy-900 text-[9px] font-black uppercase rounded-lg hover:bg-gold hover:text-navy-950 transition-all whitespace-nowrap"
                    >
                      {isAllSelected ? 'DESELEC.' : 'TODOS'}
                    </button>
                  )}
                </div>
                <div className="border-2 border-gray-100 rounded-xl max-h-40 overflow-y-auto p-2 divide-y divide-gray-50 bg-gray-50/50">
                  {filteredUsersForModal.length === 0 ? (
                    <p className="text-center py-6 text-[10px] text-gray-400 uppercase font-bold tracking-widest">Sin usuarios registrados</p>
                  ) : (
                    filteredUsersForModal.map(u => (
                      <label key={u.id} className="flex items-center gap-3 py-3 hover:bg-white px-2 rounded-lg cursor-pointer transition-all">
                        <input type="checkbox" checked={formData.attendees.includes(u.id)} onChange={e => {
                          const newAt = e.target.checked ? [...formData.attendees, u.id] : formData.attendees.filter(id => id !== u.id);
                          setFormData({...formData, attendees: newAt});
                        }} className="accent-gold w-5 h-5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-navy-950 truncate uppercase">{u.name} {u.apellido}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">{u.puesto} · {u.departamento}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Descripción</label>
                <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} 
                  className="w-full border-2 border-gray-200 bg-white rounded-lg px-4 py-3 text-navy-950 placeholder:text-gray-300 focus:border-gold focus:ring-4 focus:ring-gold/10 outline-none transition-all resize-none text-sm font-medium" 
                  placeholder="Opcional..."></textarea>
              </div>
              <button type="submit" className="w-full btn-gold py-4 mt-2 text-xs font-black uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-gold/20">Programar Reunión</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resumen de Reunión */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/90 backdrop-blur-md p-4 animate-fade-in" onClick={() => setSelectedMeeting(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="bg-navy-950 px-6 py-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">Resumen de Reunión</span>
                <button onClick={() => setSelectedMeeting(null)} className="text-white/40 hover:text-white transition-colors p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <h3 className="text-xl font-display font-medium text-white leading-tight uppercase tracking-wide">{selectedMeeting.title}</h3>
            </div>
            
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Fecha</p>
                  <p className="text-xs font-black text-navy-950">{new Date(selectedMeeting.start_time).toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Horario</p>
                  <p className="text-xs font-black text-navy-950">
                    {new Date(selectedMeeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedMeeting.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Descripción</p>
                <p className="text-xs text-navy-800 leading-relaxed bg-navy-50/20 p-4 rounded-xl border border-navy-100/30 italic">
                  {selectedMeeting.description || 'SIN DETALLES ADICIONALES REGISTRADOS.'}
                </p>
              </div>

              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Participantes ({selectedMeeting.attendees?.length || 0})</p>
                <div className="space-y-2">
                  {selectedMeeting.attendees?.map(id => {
                    const u = dbUsers.find(user => user.id === id);
                    return u ? (
                      <div key={id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-navy-950 text-gold flex items-center justify-center text-[10px] font-black border-2 border-gold/10">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-navy-950 uppercase truncate">{u.name} {u.apellido}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">{u.puesto} · {u.departamento}</p>
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 pt-2 space-y-5">
              <button 
                onClick={() => setSelectedMeeting(null)}
                className="w-full py-4 bg-navy-950 text-gold text-[11px] font-black uppercase tracking-[0.25em] rounded-xl hover:bg-navy-900 active:scale-[0.98] transition-all shadow-xl shadow-navy-950/20 border border-gold/20 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cerrar Resumen
              </button>
              
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 py-2 px-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Confirmada</span>
                </div>
                
                <button
                  onClick={async () => {
                    if (window.confirm('¿Deseas cancelar y eliminar esta reunión?')) {
                      try {
                        const tName = selectedMeeting.title;
                        await axios.delete(`/api/meetings/${selectedMeeting.id}`);
                        fetchMeetings();
                        setSelectedMeeting(null);
                        PushEvents.meetingDeleted(tName);
                      } catch (err) { console.error(err); }
                    }
                  }}
                  className="px-4 py-2 border-2 border-red-100 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-50 hover:border-red-200 transition-all flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
