import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { PushEvents } from '../../utils/pushNotify';
import {
  MEETING_LOCATION_OPTIONS,
  getLocationLabel,
  buildTimeSlots,
  getSalaBusyRanges,
  isStartSlotDisabled,
  isEndSlotDisabled,
  formatBusyRangeLabel,
  compareTimes,
} from '../../utils/meetingSchedule';

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
  const [editingMeetingId, setEditingMeetingId] = useState(null);
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
    location_type: 'sala_juntas',
    attendees: [],
    recurrence: 'none',
    recurrence_until: '',
  });

  const timeSlots = useMemo(() => buildTimeSlots(), []);
  const salaBusyRanges = useMemo(() => {
    if (!formData.date || formData.location_type !== 'sala_juntas') return [];
    return getSalaBusyRanges(meetings, formData.date, editingMeetingId);
  }, [meetings, formData.date, formData.location_type, editingMeetingId]);
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

  const handleSubmitMeeting = async (e) => {
    e.preventDefault();
    try {
      if (editingMeetingId) {
        await axios.patch(`/api/meetings/${editingMeetingId}`, {
          title: formData.title,
          description: formData.description,
          start_time: `${formData.date}T${formData.start_time}`,
          end_time: `${formData.date}T${formData.end_time}`,
          attendees: formData.attendees,
          location_type: formData.location_type,
        });
      } else {
        const occurrences = generateOccurrences(formData);
        await Promise.all(
          occurrences.map((occ) =>
            axios.post('/api/meetings', {
              title: formData.title,
              description: formData.description,
              date: formData.date,
              start_time: occ.start,
              end_time: occ.end,
              attendees: formData.attendees,
              location_type: formData.location_type,
            })
          )
        );
        try {
          const d = new Date(`${formData.date}T${formData.start_time}`);
          const when =
            d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' ' + formData.start_time;
          PushEvents.meetingCreated(formData.title, when);
        } catch (_) {
          PushEvents.meetingCreated(formData.title);
        }
      }
      fetchMeetings();
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || err?.response?.data?.message || 'No se pudo guardar la reunión');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: '',
      start_time: '',
      end_time: '',
      location_type: 'sala_juntas',
      attendees: [],
      recurrence: 'none',
      recurrence_until: '',
    });
    setModalDeptFilter('');
    setEditingMeetingId(null);
  };

  const canEditMeeting = (m) =>
    m &&
    user &&
    (Number(m.created_by) === Number(user.id) ||
      user.role === 'superadmin' ||
      user.role === 'administrator');

  const meetingToFormPayload = (m) => {
    const st = m.start_time || '';
    const et = m.end_time || '';
    const datePart = st.includes('T') ? st.split('T')[0] : '';
    const timeOnly = (s) => (s.includes('T') ? s.split('T')[1] : s || '').slice(0, 5);
    return {
      title: m.title || '',
      description: m.description || '',
      date: datePart,
      start_time: timeOnly(st),
      end_time: timeOnly(et),
      attendees: Array.isArray(m.attendees) ? [...m.attendees] : [],
      location_type: m.location_type === 'virtual' ? 'virtual' : 'sala_juntas',
      recurrence: 'none',
      recurrence_until: '',
    };
  };

  const pickFirstAvailableStart = (date, locationType, excludeId) => {
    if (!date || locationType !== 'sala_juntas') return '';
    const busy = getSalaBusyRanges(meetings, date, excludeId);
    return timeSlots.find((slot) => !isStartSlotDisabled(busy, date, slot)) || '';
  };

  const pickEndAfterStart = (date, start, locationType, excludeId) => {
    if (!date || !start) return '';
    const busy = locationType === 'sala_juntas' ? getSalaBusyRanges(meetings, date, excludeId) : [];
    const candidates = timeSlots.filter((slot) => compareTimes(slot, start) > 0);
    if (locationType === 'sala_juntas') {
      return candidates.find((slot) => !isEndSlotDisabled(busy, date, start, slot)) || '';
    }
    return candidates[0] || '';
  };

  const openEditMeeting = () => {
    if (!selectedMeeting || !canEditMeeting(selectedMeeting)) return;
    setEditingMeetingId(selectedMeeting.id);
    setFormData(meetingToFormPayload(selectedMeeting));
    setModalDeptFilter('');
    setSelectedMeeting(null);
    setIsModalOpen(true);
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

    const timeShort = (iso) =>
      new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });

    for (let i = 0; i < startDay; i++) {
      days.push(
        <div key={`pad-${i}`} className="h-[5.75rem] lg:h-32 border border-gray-100 bg-gray-50/30" />
      );
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayMeetings = filteredMeetings
        .filter(m => m.start_time.startsWith(dateStr))
        .slice()
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      const isSelected = selectedDay === dateStr;
      const isToday = new Date().toISOString().startsWith(dateStr);
      
      days.push(
        <div
          key={d}
          onClick={() => setSelectedDay(dateStr)}
          onDoubleClick={() => {
            setEditingMeetingId(null);
            setModalDeptFilter('');
            const firstStart = pickFirstAvailableStart(dateStr, 'sala_juntas', null);
            setFormData({
              title: '',
              description: '',
              date: dateStr,
              start_time: firstStart,
              end_time: firstStart ? pickEndAfterStart(dateStr, firstStart, 'sala_juntas', null) : '',
              location_type: 'sala_juntas',
              attendees: [],
              recurrence: 'none',
              recurrence_until: '',
            });
            setSelectedDay(dateStr);
            setIsModalOpen(true);
          }}
          className={`h-[5.75rem] lg:h-32 border p-1 lg:p-2 cursor-pointer transition-all relative flex flex-col lg:block overflow-hidden ${
            isSelected ? 'bg-gold/10 border-gold/50' : 'border-gray-100 hover:bg-navy-50/10'
          } ${isToday && !isSelected ? 'border-gold/30 bg-gold/[0.07]' : ''}`}
        >
          <div className="flex items-center justify-between gap-0.5 lg:flex-col lg:items-start shrink-0 px-0.5 pt-0.5 lg:p-0">
            <span className={`text-[11px] font-black w-6 h-6 lg:w-5 lg:h-5 flex items-center justify-center rounded-full shrink-0 leading-none ${
              isToday ? 'bg-gold text-navy-950' :
              isSelected ? 'bg-navy-950 text-white' : 'text-navy-700/80'
            }`}>
              {d}
            </span>
            {dayMeetings.length > 0 && (
              <span className="lg:hidden text-[8px] font-bold text-navy-600 tabular-nums leading-none">
                {dayMeetings.length}
              </span>
            )}
          </div>

          {/* Móvil: filas compactas con un poco más de aire */}
          <div className="mt-1 flex-1 min-h-0 overflow-hidden lg:hidden">
            <div className="h-full max-h-[3.65rem] overflow-y-auto overflow-x-hidden [scrollbar-width:thin] space-y-0.5">
            {dayMeetings.map((m) => (
              <button
                key={m.id ?? `${m.start_time}-${m.title}`}
                type="button"
                onClick={(e) => { e.stopPropagation(); setSelectedDay(dateStr); setSelectedMeeting(m); }}
                className="w-full text-left rounded-md bg-navy-950/95 text-white px-1 py-0.5 border-l-[3px] border-gold active:opacity-90"
                title={m.title}
              >
                <span className="text-[8px] font-black text-gold tabular-nums leading-tight block">{timeShort(m.start_time)}</span>
                <span className="text-[8px] font-semibold leading-snug line-clamp-2 normal-case">
                  {m.title}
                </span>
              </button>
            ))}
            </div>
          </div>

          {/* Escritorio */}
          <div className="mt-1 space-y-1 hidden lg:block">
            {dayMeetings.map((m, i) => (
              <button
                key={m.id ?? i}
                type="button"
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

  const selectedDayMeetings = filteredMeetings
    .filter(m => m.start_time.startsWith(selectedDay))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

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
           <button
             type="button"
             onClick={() => {
               resetForm();
               setIsModalOpen(true);
             }}
             className="btn-gold flex items-center justify-center gap-2 py-3 lg:py-2 text-[10px] lg:text-xs font-black uppercase tracking-widest rounded-xl"
           >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
             Nueva Reunión
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Calendario primero en móvil (más compacto visualmente) */}
        <div className="lg:col-span-3 bg-white rounded-xl lg:rounded-2xl shadow-lg lg:shadow-xl border border-gray-100 overflow-hidden h-fit">
          <div className="grid grid-cols-7 bg-navy-950 text-white text-[8px] lg:text-[10px] font-black tracking-[0.2em] uppercase py-2 lg:py-4 border-b border-navy-900">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d} className="text-center px-0.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {renderCalendar()}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
           <div className="bg-navy-950 rounded-xl lg:rounded-2xl p-3 sm:p-4 shadow-xl border border-gold/20">
              <div className="flex items-center justify-between mb-2 gap-2">
                <h3 className="text-white text-[9px] font-black uppercase tracking-[0.2em]">Agenda del Día</h3>
                <span className="text-gold text-[8px] font-black bg-gold/10 px-1.5 py-0.5 rounded border border-gold/20 shrink-0">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).toUpperCase()}
                </span>
              </div>
              
              <div className="space-y-2 max-h-[300px] sm:max-h-[340px] lg:max-h-[500px] overflow-y-auto pr-0.5 custom-scrollbar">
                {selectedDayMeetings.length === 0 ? (
                  <div className="py-6 text-center border border-dashed border-white/10 rounded-lg">
                    <p className="text-[9px] text-white/35 font-bold uppercase tracking-widest">Sin reuniones</p>
                  </div>
                ) : (
                  selectedDayMeetings.map((m, i) => (
                    <button 
                      key={m.id ?? i} 
                      type="button"
                      onClick={() => setSelectedMeeting(m)}
                      className="w-full group text-left p-2.5 sm:p-3 bg-white/5 hover:bg-gold rounded-lg border border-white/10 hover:border-gold transition-colors flex gap-2.5 items-start"
                    >
                      <div className="w-10 shrink-0 rounded-md bg-gold/15 border border-gold/25 py-1.5 text-center group-hover:bg-navy-950">
                        <span className="block text-gold text-[10px] font-black tabular-nums leading-tight group-hover:text-gold">
                          {new Date(m.start_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-white group-hover:text-navy-950 text-[11px] font-bold uppercase leading-snug line-clamp-2">{m.title}</h4>
                        <p className="text-white/35 group-hover:text-navy-950/55 text-[8px] font-bold uppercase mt-0.5">
                          {getLocationLabel(m.location_type)} · {m.attendees?.length || 0} pers.
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
           </div>
        </div>
      </div>

      {/* Modal Agendar / Editar reunión */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
          onClick={() => {
            setIsModalOpen(false);
            resetForm();
          }}
          role="presentation"
        >
          <div
            className="flex max-h-[min(92dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-meeting-title"
          >
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-6 pb-6 sm:px-8 sm:pt-7">
              <div
                className="pointer-events-none absolute -right-20 -top-28 h-60 w-60 rounded-full bg-gold/12 blur-3xl"
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                  <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/[0.12] sm:flex">
                    <svg className="h-5 w-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">Calendario corporativo</p>
                    <h2
                      id="schedule-meeting-title"
                      className="mt-1.5 font-display text-xl font-medium leading-tight text-white sm:text-2xl"
                    >
                      {editingMeetingId ? 'Editar reunión' : 'Nueva reunión'}
                    </h2>
                    <p className="mt-1.5 text-sm text-white/55">
                      {editingMeetingId
                        ? 'Actualiza los datos y guarda los cambios.'
                        : 'Completa el horario, invitados y detalles opcionales.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Cerrar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitMeeting} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
                <section>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Título</h3>
                  <label htmlFor="meeting-title-input" className="sr-only">
                    Título de la reunión
                  </label>
                  <input
                    id="meeting-title-input"
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                    placeholder="Ej. Revisión semanal de obra"
                  />
                </section>

                <section>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Modalidad</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {MEETING_LOCATION_OPTIONS.map((opt) => {
                      const selected = formData.location_type === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                            selected
                              ? 'border-gold bg-gold/10 ring-2 ring-gold/25'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="meeting-location"
                            value={opt.value}
                            checked={selected}
                            onChange={() => {
                              const nextType = opt.value;
                              let start = formData.start_time;
                              let end = formData.end_time;
                              if (formData.date && nextType === 'sala_juntas') {
                                const busy = getSalaBusyRanges(meetings, formData.date, editingMeetingId);
                                if (!start || isStartSlotDisabled(busy, formData.date, start)) {
                                  start = pickFirstAvailableStart(formData.date, nextType, editingMeetingId);
                                }
                                if (start && (!end || isEndSlotDisabled(busy, formData.date, start, end))) {
                                  end = pickEndAfterStart(formData.date, start, nextType, editingMeetingId);
                                }
                              }
                              setFormData({ ...formData, location_type: nextType, start_time: start, end_time: end });
                            }}
                            className="h-4 w-4 accent-gold"
                          />
                          <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {formData.location_type === 'sala_juntas' && formData.date && salaBusyRanges.length > 0 && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-100">
                      <span className="font-semibold">Sala ocupada: </span>
                      {salaBusyRanges.map((b, i) => (
                        <span key={b.id ?? i}>
                          {i > 0 ? ', ' : ''}
                          {formatBusyRangeLabel(b.start, b.end)}
                        </span>
                      ))}
                    </p>
                  )}
                </section>

                <section>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Horario</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">Fecha</label>
                      <input
                        required
                        type="date"
                        value={formData.date}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          let start = formData.start_time;
                          let end = formData.end_time;
                          if (formData.location_type === 'sala_juntas') {
                            start = pickFirstAvailableStart(newDate, 'sala_juntas', editingMeetingId);
                            end = start ? pickEndAfterStart(newDate, start, 'sala_juntas', editingMeetingId) : '';
                          }
                          setFormData({ ...formData, date: newDate, start_time: start, end_time: end });
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">Inicio</label>
                      <select
                        required
                        value={formData.start_time}
                        onChange={(e) => {
                          const start = e.target.value;
                          let end = formData.end_time;
                          if (
                            !end ||
                            compareTimes(end, start) <= 0 ||
                            (formData.location_type === 'sala_juntas' &&
                              isEndSlotDisabled(
                                getSalaBusyRanges(meetings, formData.date, editingMeetingId),
                                formData.date,
                                start,
                                end
                              ))
                          ) {
                            end = pickEndAfterStart(
                              formData.date,
                              start,
                              formData.location_type,
                              editingMeetingId
                            );
                          }
                          setFormData({ ...formData, start_time: start, end_time: end });
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium tabular-nums text-slate-900 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                      >
                        <option value="" disabled>
                          {formData.location_type === 'sala_juntas' ? 'Selecciona hora disponible' : 'Selecciona hora'}
                        </option>
                        {timeSlots.map((slot) => {
                          const disabled =
                            formData.location_type === 'sala_juntas' &&
                            formData.date &&
                            isStartSlotDisabled(salaBusyRanges, formData.date, slot);
                          return (
                            <option key={slot} value={slot} disabled={disabled}>
                              {slot}
                              {disabled ? ' (ocupado)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">Fin</label>
                      <select
                        required
                        value={formData.end_time}
                        disabled={!formData.start_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium tabular-nums text-slate-900 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="" disabled>
                          {formData.start_time ? 'Selecciona hora de fin' : 'Primero elige inicio'}
                        </option>
                        {timeSlots
                          .filter((slot) => formData.start_time && compareTimes(slot, formData.start_time) > 0)
                          .map((slot) => {
                            const disabled =
                              formData.location_type === 'sala_juntas' &&
                              formData.date &&
                              isEndSlotDisabled(salaBusyRanges, formData.date, formData.start_time, slot);
                            return (
                              <option key={slot} value={slot} disabled={disabled}>
                                {slot}
                                {disabled ? ' (ocupado)' : ''}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  </div>
                  {formData.location_type === 'sala_juntas' &&
                    formData.date &&
                    !pickFirstAvailableStart(formData.date, 'sala_juntas', editingMeetingId) && (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        No hay horarios libres en sala de juntas para esta fecha.
                      </p>
                    )}
                </section>

                {!editingMeetingId && (
                  <section className="rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-amber-50/30 p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-amber-700 shadow-sm ring-1 ring-amber-100">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </span>
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900/80">Recurrencia</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-amber-900/70">Repetición</label>
                        <select
                          value={formData.recurrence}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              recurrence: e.target.value,
                              recurrence_until: e.target.value === 'none' ? '' : formData.recurrence_until,
                            })
                          }
                          className="w-full appearance-none rounded-xl border border-amber-200/80 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                        >
                          <option value="none">Sin repetición</option>
                          <option value="weekly">Semanal</option>
                          <option value="biweekly">Quincenal</option>
                          <option value="monthly">Mensual</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-amber-900/70">Repetir hasta</label>
                        <input
                          type="date"
                          disabled={formData.recurrence === 'none'}
                          required={formData.recurrence !== 'none'}
                          min={formData.date}
                          value={formData.recurrence_until}
                          onChange={(e) => setFormData({ ...formData, recurrence_until: e.target.value })}
                          className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>
                    {formData.recurrence !== 'none' && formData.date && formData.recurrence_until && (
                      <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-center text-xs font-medium text-amber-950/80 ring-1 ring-amber-100">
                        Se crearán <span className="font-bold tabular-nums">{generateOccurrences(formData).length}</span>{' '}
                        reuniones en este rango
                      </p>
                    )}
                  </section>
                )}

                <section>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Participantes</h3>
                    <span className="text-xs font-medium tabular-nums text-slate-500">
                      {formData.attendees.length}{' '}
                      {formData.attendees.length === 1 ? 'persona seleccionada' : 'personas'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={modalDeptFilter}
                      onChange={(e) => setModalDeptFilter(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-800 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                    >
                      <option value="">Todos los departamentos</option>
                      {DEPARTAMENTOS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {modalDeptFilter && (
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition-colors hover:border-gold/40 hover:bg-gold/5"
                      >
                        {isAllSelected ? 'Quitar selección' : 'Seleccionar todos'}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 max-h-44 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-1.5 ring-1 ring-slate-900/[0.02]">
                    {filteredUsersForModal.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-400">
                        {modalDeptFilter
                          ? 'No hay usuarios en este departamento.'
                          : 'No hay usuarios registrados.'}
                      </p>
                    ) : (
                      <ul className="space-y-0.5">
                        {filteredUsersForModal.map((u) => (
                          <li key={u.id}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white">
                              <input
                                type="checkbox"
                                checked={formData.attendees.includes(u.id)}
                                onChange={(e) => {
                                  const newAt = e.target.checked
                                    ? [...formData.attendees, u.id]
                                    : formData.attendees.filter((id) => id !== u.id);
                                  setFormData({ ...formData, attendees: newAt });
                                }}
                                className="h-4 w-4 rounded border-slate-300 accent-gold focus:ring-gold/30"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {u.name} {u.apellido || ''}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {[u.puesto, u.departamento].filter(Boolean).join(' · ') || '—'}
                                </p>
                              </div>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Descripción / agenda</h3>
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                    placeholder="Objetivo de la reunión, enlaces o notas internas (opcional)."
                  />
                </section>
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-8">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-[8rem]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-navy-900/10 bg-navy-950 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold shadow-md transition-colors hover:bg-navy-900 sm:min-w-[9rem]"
                  >
                    {!editingMeetingId && (
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                    {editingMeetingId ? 'Guardar cambios' : 'Programar reunión'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resumen de Reunión */}
      {selectedMeeting && (() => {
        const start = new Date(selectedMeeting.start_time);
        const end = new Date(selectedMeeting.end_time);
        const organizer = dbUsers.find((u) => Number(u.id) === Number(selectedMeeting.created_by));
        const organizerLabel = organizer ? `${organizer.name}${organizer.apellido ? ` ${organizer.apellido}` : ''}`.trim() : null;
        const attendeeCount = selectedMeeting.attendees?.length || 0;

        return (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
          onClick={() => setSelectedMeeting(null)}
          onKeyDown={(e) => e.key === 'Escape' && setSelectedMeeting(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45)] overflow-hidden animate-slide-up border border-slate-200/80 ring-1 ring-black/[0.04]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-summary-title"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-[#0f172af2] px-6 pt-7 pb-8 sm:px-8 sm:pt-8">
              <div
                className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-gold/15 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-navy-500/20 blur-2xl"
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-4">
                  <div className="mt-0.5 hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/[0.12] sm:flex">
                    <svg className="h-6 w-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/90">Resumen</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/90">
                        {getLocationLabel(selectedMeeting.location_type)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-100">
                        <svg className="h-3 w-3 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Confirmada
                      </span>
                    </div>
                    <h3 id="meeting-summary-title" className="font-display text-xl font-medium leading-snug tracking-tight text-white sm:text-2xl">
                      {selectedMeeting.title}
                    </h3>
                    {organizerLabel && (
                      <p className="text-sm text-white/55">
                        Organiza{' '}
                        <span className="font-medium text-white/90">{organizerLabel}</span>
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMeeting(null)}
                  className="shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Cerrar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="relative mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-2">
                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 sm:inline-flex">
                  <svg className="h-4 w-4 shrink-0 text-gold/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="min-w-0 truncate text-xs font-medium text-white/90">
                    {start.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="col-span-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 sm:col-span-1 sm:inline-flex sm:max-w-none">
                  <svg className="h-4 w-4 shrink-0 text-gold/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-medium tabular-nums text-white/90">
                    {start.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} —{' '}
                    {end.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="max-h-[min(52vh,28rem)] space-y-6 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Modalidad</h4>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {getLocationLabel(selectedMeeting.location_type)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedMeeting.location_type === 'virtual'
                      ? 'Enlace o detalles en la descripción o invitación.'
                      : 'Reserva física de la sala de juntas corporativa.'}
                  </p>
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Descripción</h4>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3.5">
                  <p className="text-sm leading-relaxed text-slate-700">
                    {selectedMeeting.description?.trim() ? selectedMeeting.description.trim() : 'Sin notas ni agenda registrada para esta reunión.'}
                  </p>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Participantes</h4>
                  <span className="text-xs font-medium tabular-nums text-slate-500">{attendeeCount} {attendeeCount === 1 ? 'persona' : 'personas'}</span>
                </div>
                {attendeeCount === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center text-xs text-slate-400">
                    Nadie agregado como participante todavía.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(selectedMeeting.attendees || []).map((id) => {
                      const u = dbUsers.find((user) => Number(user.id) === Number(id));
                      if (!u) return null;
                      return (
                        <li
                          key={id}
                          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm shadow-slate-900/[0.03] transition-shadow hover:shadow-md hover:shadow-slate-900/[0.05]"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy-900 to-navy-950 text-xs font-semibold text-gold ring-2 ring-gold/20">
                            {(u.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {u.name} {u.apellido || ''}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {[u.puesto, u.departamento].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <button
                  type="button"
                  onClick={() => setSelectedMeeting(null)}
                  className="order-2 inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 sm:order-1"
                >
                  Cerrar
                </button>
                {canEditMeeting(selectedMeeting) && (
                  <button
                    type="button"
                    onClick={openEditMeeting}
                    className="order-1 inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-navy-900/10 bg-navy-950 px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold shadow-md transition-all hover:bg-navy-900 sm:order-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Editar
                  </button>
                )}
              </div>
              <div className="mt-4 flex justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('¿Eliminar esta reunión? Esta acción no se puede deshacer.')) {
                      try {
                        const tName = selectedMeeting.title;
                        await axios.delete(`/api/meetings/${selectedMeeting.id}`);
                        fetchMeetings();
                        setSelectedMeeting(null);
                        PushEvents.meetingDeleted(tName);
                      } catch (err) {
                        console.error(err);
                      }
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar reunión
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
