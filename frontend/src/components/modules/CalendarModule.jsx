import { useState, useEffect, useMemo, useRef } from 'react';
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
  getBusyUsersInRange,
  formatBusyUserHint,
  getRsvpForUser,
} from '../../utils/meetingSchedule';
import { useCatalog } from '../../hooks/useCatalog';
import { useMeetingVoiceRecorder } from '../../hooks/useMeetingVoiceRecorder';
import MeetingVoiceMinuteModal from '../MeetingVoiceMinuteModal';
import MeetingVoiceCaptureOverlay from '../voice/MeetingVoiceCaptureOverlay';
import MeetingSayaCaptureCard from '../voice/MeetingSayaCaptureCard';
import SayaBrandMark from '../voice/SayaBrandMark';
import { localDateYMD } from '../../utils/localDate';
import BosaGoldButton from '../BosaGoldButton';
import { isSuperadminUser } from '../../utils/permissions';

function userFullName(u) {
  return `${u?.name || ''} ${u?.apellido || ''}`.trim();
}

function sortUsersByName(users) {
  return [...users].sort((a, b) =>
    userFullName(a).localeCompare(userFullName(b), 'es', { sensitivity: 'base' }),
  );
}

function userMatchesSearch(u, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [
    userFullName(u),
    u?.email,
    u?.departamento,
    u?.puesto,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function formatMeetingClock(iso) {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatMeetingTimeRange(startIso, endIso) {
  return `${formatMeetingClock(startIso)} – ${formatMeetingClock(endIso)}`;
}

function formatMeetingDuration(startIso, endIso) {
  const mins = Math.max(0, Math.round((new Date(endIso) - new Date(startIso)) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function getLocationShort(type) {
  return MEETING_LOCATION_OPTIONS.find((o) => o.value === type)?.short ?? 'Sala';
}

const RSVP_OPTIONS = [
  { value: 'going', label: 'Asistiré', hint: 'Confirmo que estaré' },
  { value: 'declined', label: 'No asistiré', hint: 'No podré asistir' },
  { value: 'late', label: 'Llegaré tarde', hint: 'Asisto, pero después', tilted: true },
];

const RSVP_META = {
  going: { label: 'Asistiré', short: 'Confirmado', color: '#059669', bg: 'rgba(16,185,129,0.12)' },
  declined: { label: 'No asistiré', short: 'No asiste', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  late: { label: 'Llegaré tarde', short: 'Tarde', color: '#b45309', bg: 'rgba(245,158,11,0.15)' },
};

function MeetingRsvpIcon({ status, className = 'h-6 w-6' }) {
  if (status === 'declined') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (status === 'late') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function isInvitedAttendee(meeting, userId) {
  if (!meeting || userId == null) return false;
  return (meeting.attendees || []).some((id) => Number(id) === Number(userId));
}

function MeetingLocationIcon({ type, className = 'h-3.5 w-3.5' }) {
  if (type === 'virtual') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
    </svg>
  );
}

function meetingInvolvesUser(meeting, userId) {
  if (!meeting || userId == null || userId === '') return false;
  const id = Number(userId);
  if (Number(meeting.created_by) === id) return true;
  return Array.isArray(meeting.attendees) && meeting.attendees.some((attendeeId) => Number(attendeeId) === id);
}

function activeUsersList(users) {
  return users.filter((u) => u.is_active !== 0 && u.is_active !== false);
}

export default function CalendarModule({ onMinuteSaved } = {}) {
  const { user } = useAuth();
  const { departments } = useCatalog();
  const [meetings, setMeetings] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(() => localDateYMD());
  
  // Filtros de vista principal
  const [filterUser, setFilterUser] = useState('all');
  const [teamUserSearch, setTeamUserSearch] = useState('');

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

  const proposedMeetingRange = useMemo(() => {
    if (!formData.date || !formData.start_time || !formData.end_time) return null;
    if (compareTimes(formData.end_time, formData.start_time) <= 0) return null;
    return {
      start: `${formData.date}T${formData.start_time}:00`,
      end: `${formData.date}T${formData.end_time}:00`,
    };
  }, [formData.date, formData.start_time, formData.end_time]);

  const busyUsersById = useMemo(() => {
    if (!proposedMeetingRange) return new Map();
    return getBusyUsersInRange(
      meetings,
      proposedMeetingRange.start,
      proposedMeetingRange.end,
      editingMeetingId,
    );
  }, [meetings, proposedMeetingRange, editingMeetingId]);

  useEffect(() => {
    if (busyUsersById.size === 0) return;
    setFormData((prev) => {
      const pruned = prev.attendees.filter((id) => !busyUsersById.has(Number(id)));
      if (pruned.length === prev.attendees.length) return prev;
      return { ...prev, attendees: pruned };
    });
  }, [busyUsersById, formData.date, formData.start_time, formData.end_time]);
  const [modalDeptFilter, setModalDeptFilter] = useState('');
  const [modalAttendeeSearch, setModalAttendeeSearch] = useState('');

  const voiceRecorder = useMeetingVoiceRecorder();
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceCaptureOpen, setVoiceCaptureOpen] = useState(false);
  const [voiceCaptureError, setVoiceCaptureError] = useState('');
  const [voiceMinuteOpen, setVoiceMinuteOpen] = useState(false);
  const [voiceMinuteDraft, setVoiceMinuteDraft] = useState(null);
  const [voiceMinuteBrief, setVoiceMinuteBrief] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceTranscriptSegments, setVoiceTranscriptSegments] = useState([]);
  const [voiceExistingMinuteId, setVoiceExistingMinuteId] = useState(null);
  const [voiceRecordingAudioPath, setVoiceRecordingAudioPath] = useState(null);
  const [voiceRecordingAudioUrl, setVoiceRecordingAudioUrl] = useState(null);
  const [voiceRecordingBlob, setVoiceRecordingBlob] = useState(null);
  const [whisperConfigured, setWhisperConfigured] = useState(null);
  const [rsvpDraft, setRsvpDraft] = useState({ status: '', comment: '' });
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [rsvpError, setRsvpError] = useState('');

  useEffect(() => {
    fetchMeetings();
    fetchUsers();
    axios.get('/api/meetings/voice/status').then((r) => {
      setWhisperConfigured(!!r.data?.whisperConfigured);
    }).catch(() => setWhisperConfigured(false));
  }, []);

  useEffect(() => {
    if (!selectedMeeting || !user) {
      setRsvpDraft({ status: '', comment: '' });
      setRsvpError('');
      return;
    }
    const mine = getRsvpForUser(selectedMeeting, user.id);
    setRsvpDraft({
      status: mine?.status || '',
      comment: mine?.comment || '',
    });
    setRsvpError('');
  }, [selectedMeeting?.id, selectedMeeting?.rsvps, user?.id]);

  const refreshMeetingsAndSelection = async (meetingId) => {
    try {
      const { data } = await axios.get('/api/meetings');
      const list = Array.isArray(data) ? data : [];
      setMeetings(list);
      if (meetingId != null) {
        const updated = list.find((m) => Number(m.id) === Number(meetingId));
        if (updated) setSelectedMeeting(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRsvp = async () => {
    if (!selectedMeeting || !rsvpDraft.status) {
      setRsvpError('Elige si asistirás, no asistirás o si llegarás tarde.');
      return;
    }
    setRsvpSaving(true);
    setRsvpError('');
    try {
      await axios.patch(`/api/meetings/${selectedMeeting.id}/rsvp`, {
        status: rsvpDraft.status,
        comment: rsvpDraft.comment,
      });
      await refreshMeetingsAndSelection(selectedMeeting.id);
    } catch (err) {
      setRsvpError(err?.response?.data?.error || 'No se pudo guardar tu respuesta.');
    } finally {
      setRsvpSaving(false);
    }
  };

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
    setModalAttendeeSearch('');
    setEditingMeetingId(null);
  };

  const canEditMeeting = (m) =>
    m &&
    user &&
    (Number(m.created_by) === Number(user.id) ||
      user.role === 'superadmin' ||
      user.role === 'administrator');

  const canDeleteMeeting = (m) =>
    m && user && (Number(m.created_by) === Number(user.id) || isSuperadminUser(user));

  const canAccessMeeting = (m) =>
    m &&
    user &&
    (canEditMeeting(m) || meetingInvolvesUser(m, user.id));

  const uploadVoiceAndGenerateMinute = async (meetingId, blob, browserTranscript, captureMode) => {
    const fd = new FormData();
    if (blob && blob.size > 0) {
      const type = (blob.type || '').toLowerCase();
      const ext = type.includes('mp4') || type.includes('m4a') || type.includes('aac')
        ? 'm4a'
        : type.includes('ogg')
          ? 'ogg'
          : 'webm';
      fd.append('audio', blob, `reunion-${meetingId}.${ext}`);
    }
    if (browserTranscript?.trim()) {
      fd.append('transcript', browserTranscript.trim());
    }
    if (captureMode) {
      fd.append('capture_mode', captureMode);
    }
    const { data } = await axios.post(`/api/meetings/${meetingId}/generate-minute-from-voice`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    });
    return data;
  };

  const handleVoiceStopAndProcess = async () => {
    if (!selectedMeeting || !voiceRecorder.isRecording) return;
    setVoiceCaptureError('');
    let blob;
    let browserTranscript;
    try {
      ({ blob, browserTranscript } = await voiceRecorder.stopRecording({ keepStream: false }));
    } catch (err) {
      console.error(err);
      setVoiceCaptureError(err.message || 'No se pudo finalizar la grabación.');
      return;
    }

    if (!blob?.size) {
      setVoiceCaptureError(
        'No se capturó audio. Graba al menos unos segundos y vuelve a intentar (permite el micrófono en el navegador).',
      );
      return;
    }

    setVoiceProcessing(true);
    try {
      setVoiceRecordingBlob(blob);
      const mode = selectedMeeting.location_type === 'virtual' ? 'virtual' : 'sala_juntas';
      const data = await uploadVoiceAndGenerateMinute(selectedMeeting.id, blob, browserTranscript, mode);
      setVoiceCaptureOpen(false);
      setVoiceMinuteDraft(data.draft);
      setVoiceMinuteBrief(data.minute_brief || data.draft?.minute_brief || null);
      setVoiceTranscript(data.transcript || '');
      setVoiceTranscriptSegments(Array.isArray(data.transcript_segments) ? data.transcript_segments : []);
      setVoiceExistingMinuteId(data.existing_minute_id ?? null);
      setVoiceRecordingAudioPath(data.audio_path || null);
      const serverAudioUrl = data.audio_url || null;
      const serverAudioOk = Number(data.audio_size) > 64;
      setVoiceRecordingAudioUrl(serverAudioOk && serverAudioUrl ? serverAudioUrl : null);
      setVoiceMinuteOpen(true);
      if (data.whisperConfigured != null) setWhisperConfigured(!!data.whisperConfigured);
    } catch (err) {
      console.error(err);
      setVoiceCaptureError(err.response?.data?.message || err.message || 'No se pudo generar la minuta.');
    } finally {
      setVoiceProcessing(false);
    }
  };

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
    setModalAttendeeSearch('');
    setSelectedMeeting(null);
    setIsModalOpen(true);
  };
  const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const sortedActiveUsers = useMemo(
    () => sortUsersByName(activeUsersList(dbUsers)),
    [dbUsers],
  );

  const teamUsersForFilter = useMemo(
    () => sortedActiveUsers.filter((u) => userMatchesSearch(u, teamUserSearch)),
    [sortedActiveUsers, teamUserSearch],
  );

  const filteredMeetings = useMemo(() => {
    const searchQuery = teamUserSearch.trim();

    return meetings.filter((m) => {
      if (filterUser !== 'all') {
        return meetingInvolvesUser(m, filterUser);
      }
      if (searchQuery) {
        if (teamUsersForFilter.length === 0) return false;
        return teamUsersForFilter.some((u) => meetingInvolvesUser(m, u.id));
      }
      return true;
    });
  }, [meetings, filterUser, teamUserSearch, teamUsersForFilter]);

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
      const isToday = localDateYMD() === dateStr;
      
      days.push(
        <div
          key={d}
          onClick={() => setSelectedDay(dateStr)}
          onDoubleClick={() => {
            setEditingMeetingId(null);
            setModalDeptFilter('');
            setModalAttendeeSearch('');
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

  const selectedDayMeetings = useMemo(
    () =>
      filteredMeetings
        .filter((m) => m.start_time.startsWith(selectedDay))
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    [filteredMeetings, selectedDay],
  );

  const filteredUsersForModal = useMemo(
    () =>
      sortUsersByName(
        sortedActiveUsers.filter(
          (u) =>
            (!modalDeptFilter || u.departamento === modalDeptFilter) &&
            userMatchesSearch(u, modalAttendeeSearch),
        ),
      ),
    [sortedActiveUsers, modalDeptFilter, modalAttendeeSearch],
  );

  const selectableUsersForModal = useMemo(
    () => filteredUsersForModal.filter((u) => !busyUsersById.has(Number(u.id))),
    [filteredUsersForModal, busyUsersById],
  );

  const isAllSelected =
    selectableUsersForModal.length > 0 &&
    selectableUsersForModal.every((u) => formData.attendees.includes(u.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setFormData({
        ...formData,
        attendees: formData.attendees.filter((id) => !selectableUsersForModal.some((u) => u.id === id)),
      });
    } else {
      const newAttendees = [...new Set([...formData.attendees, ...selectableUsersForModal.map((u) => u.id)])];
      setFormData({ ...formData, attendees: newAttendees });
    }
  };

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 lg:mb-8 gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-display font-light text-navy-950 uppercase tracking-widest">Calendario Corporativo</h2>
          <div className="flex flex-col gap-2 mt-2 sm:mt-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Disponibilidad por persona</span>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="relative min-w-0 flex-1 sm:max-w-xs md:max-w-sm">
                <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={teamUserSearch}
                  onChange={(e) => {
                    setTeamUserSearch(e.target.value);
                    if (e.target.value.trim()) setFilterUser('all');
                  }}
                  placeholder="Buscar por nombre, correo o departamento…"
                  className="w-full pl-11 pr-4 py-2.5 rounded-full border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 placeholder-gray-400 transition-all bg-gray-50 hover:bg-white shadow-inner"
                  aria-label="Buscar persona en calendario"
                />
              </div>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold text-sm text-navy-900 bg-gray-50 hover:bg-white transition-all outline-none min-w-0 flex-1 sm:max-w-[280px]"
              >
                <option value="all">Todo el equipo (A–Z)</option>
                {teamUsersForFilter.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userFullName(u)}
                    {u.departamento ? ` · ${u.departamento}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {teamUserSearch.trim() && teamUsersForFilter.length === 0 ? (
              <p className="text-[10px] text-gray-500">Ningún nombre coincide con la búsqueda.</p>
            ) : teamUserSearch.trim() && filterUser === 'all' ? (
              <p className="text-[10px] text-gray-500">
                Mostrando reuniones de {teamUsersForFilter.length}{' '}
                {teamUsersForFilter.length === 1 ? 'persona' : 'personas'} que coinciden.
              </p>
            ) : null}
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
           <BosaGoldButton
             icon="schedule"
             onClick={() => {
               resetForm();
               setIsModalOpen(true);
             }}
             className="w-full sm:!w-auto lg:py-2.5"
             aria-label="Nueva reunión"
           >
             Nueva reunión
           </BosaGoldButton>
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
          <div className="calendar-day-agenda">
            <div className="calendar-day-agenda__header">
              <div>
                <h3 className="calendar-day-agenda__title">Agenda del día</h3>
                <p className="calendar-day-agenda__date">
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-MX', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </div>
              <span className="calendar-day-agenda__count">
                {selectedDayMeetings.length}{' '}
                {selectedDayMeetings.length === 1 ? 'reunión' : 'reuniones'}
              </span>
            </div>

            <div className="calendar-day-agenda__list">
              {selectedDayMeetings.length === 0 ? (
                <div className="calendar-day-agenda__empty">
                  <div className="calendar-day-agenda__empty-icon" aria-hidden>
                    <svg className="h-6 w-6 text-gold/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white/80">Sin reuniones</p>
                  <p className="mt-1 text-xs text-white/40">Este día está libre en tu calendario.</p>
                </div>
              ) : (
                selectedDayMeetings.map((m, i) => {
                  const isActive = selectedMeeting?.id === m.id;
                  const isVirtual = m.location_type === 'virtual';
                  return (
                    <button
                      key={m.id ?? i}
                      type="button"
                      onClick={() => setSelectedMeeting(m)}
                      className={`calendar-day-agenda__item${isActive ? ' calendar-day-agenda__item--active' : ''}${isVirtual ? ' calendar-day-agenda__item--virtual' : ''}`}
                    >
                      <div className="calendar-day-agenda__timeline" aria-hidden>
                        <span className="calendar-day-agenda__dot" />
                        {i < selectedDayMeetings.length - 1 ? (
                          <span className="calendar-day-agenda__line" />
                        ) : null}
                      </div>
                      <div className="calendar-day-agenda__card">
                        <div className="calendar-day-agenda__time-row">
                          <span className="calendar-day-agenda__time">
                            {formatMeetingTimeRange(m.start_time, m.end_time)}
                          </span>
                          <span className="calendar-day-agenda__duration">
                            {formatMeetingDuration(m.start_time, m.end_time)}
                          </span>
                        </div>
                        <h4 className="calendar-day-agenda__meeting-title">{m.title}</h4>
                        <div className="calendar-day-agenda__meta">
                          <span className="calendar-day-agenda__location">
                            <MeetingLocationIcon type={m.location_type} />
                            {getLocationShort(m.location_type)}
                          </span>
                          <span className="calendar-day-agenda__attendees">
                            {m.attendees?.length
                              ? `${m.attendees.length} ${m.attendees.length === 1 ? 'invitado' : 'invitados'}`
                              : 'Sin invitados'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Agendar / Editar reunión */}
      {isModalOpen && (
        <div
          className="meeting-sheet-overlay animate-fade-in z-[60]"
          onClick={() => {
            setIsModalOpen(false);
            resetForm();
          }}
          role="presentation"
        >
          <div
            className="meeting-sheet meeting-sheet--form animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-meeting-title"
          >
            <div className="meeting-sheet__hero shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="meeting-sheet__pill meeting-sheet__pill--gold">Calendario</span>
                  <h2 id="schedule-meeting-title" className="meeting-sheet__hero-title mt-2">
                    {editingMeetingId ? 'Editar reunión' : 'Nueva reunión'}
                  </h2>
                  <p className="meeting-sheet__hero-subtitle">
                    {editingMeetingId
                      ? 'Actualiza los datos y guarda los cambios.'
                      : 'Completa el horario, invitados y detalles opcionales.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="meeting-sheet__close"
                  aria-label="Cerrar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitMeeting} className="flex min-h-0 flex-1 flex-col">
              <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
                <p className="meeting-sheet__section-label">Título</p>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label htmlFor="meeting-title-input" className="sr-only">
                      Título de la reunión
                    </label>
                    <input
                      id="meeting-title-input"
                      required
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="meeting-sheet__input font-semibold"
                      placeholder="Ej. Revisión semanal de obra"
                    />
                  </div>
                </div>

                <p className="meeting-sheet__section-label">Modalidad</p>
                <div className="meeting-sheet__group">
                  {MEETING_LOCATION_OPTIONS.map((opt) => {
                    const selected = formData.location_type === opt.value;
                    const isVirtual = opt.value === 'virtual';
                    return (
                      <label
                        key={opt.value}
                        className={`meeting-sheet__radio-row${selected ? ' meeting-sheet__radio-row--selected' : ''}`}
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
                          className="sr-only"
                        />
                        <span
                          className={`meeting-sheet__modality-icon${isVirtual ? ' meeting-sheet__modality-icon--virtual' : ''}`}
                          aria-hidden
                        >
                          <MeetingLocationIcon type={opt.value} className="h-6 w-6" />
                        </span>
                        <span className="meeting-sheet__modality-text">
                          <span className="meeting-sheet__modality-label">{opt.label}</span>
                        </span>
                        <span className="meeting-sheet__modality-check" aria-hidden>
                          {selected ? (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {formData.location_type === 'sala_juntas' && formData.date && salaBusyRanges.length > 0 && (
                  <p className="meeting-sheet__hint meeting-sheet__hint--warn">
                    <span className="font-semibold">Sala ocupada: </span>
                    {salaBusyRanges.map((b, i) => (
                      <span key={b.id ?? i}>
                        {i > 0 ? ', ' : ''}
                        {formatBusyRangeLabel(b.start, b.end)}
                      </span>
                    ))}
                  </p>
                )}

                <p className="meeting-sheet__section-label">Horario</p>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label className="meeting-sheet__cell-label">Fecha</label>
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
                      className="meeting-sheet__input tabular-nums"
                    />
                  </div>
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label className="meeting-sheet__cell-label">Inicio</label>
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
                      className="meeting-sheet__select tabular-nums"
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
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <label className="meeting-sheet__cell-label">Fin</label>
                    <select
                      required
                      value={formData.end_time}
                      disabled={!formData.start_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="meeting-sheet__select tabular-nums"
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
                    <p className="meeting-sheet__hint--error">
                      No hay horarios libres en sala de juntas para esta fecha.
                    </p>
                  )}

                {!editingMeetingId && (
                  <>
                    <p className="meeting-sheet__section-label">Recurrencia</p>
                    <div className="meeting-sheet__group">
                      <div className="meeting-sheet__cell meeting-sheet__cell--field">
                        <label className="meeting-sheet__cell-label">Repetición</label>
                        <select
                          value={formData.recurrence}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              recurrence: e.target.value,
                              recurrence_until: e.target.value === 'none' ? '' : formData.recurrence_until,
                            })
                          }
                          className="meeting-sheet__select"
                        >
                          <option value="none">Sin repetición</option>
                          <option value="weekly">Semanal</option>
                          <option value="biweekly">Quincenal</option>
                          <option value="monthly">Mensual</option>
                        </select>
                      </div>
                      <div className="meeting-sheet__cell meeting-sheet__cell--field">
                        <label className="meeting-sheet__cell-label">Repetir hasta</label>
                        <input
                          type="date"
                          disabled={formData.recurrence === 'none'}
                          required={formData.recurrence !== 'none'}
                          min={formData.date}
                          value={formData.recurrence_until}
                          onChange={(e) => setFormData({ ...formData, recurrence_until: e.target.value })}
                          className="meeting-sheet__input tabular-nums"
                        />
                      </div>
                    </div>
                    {formData.recurrence !== 'none' && formData.date && formData.recurrence_until && (
                      <p className="meeting-sheet__hint meeting-sheet__hint--info">
                        Se crearán <span className="font-bold tabular-nums">{generateOccurrences(formData).length}</span>{' '}
                        reuniones en este rango
                      </p>
                    )}
                  </>
                )}

                <p className="meeting-sheet__section-label">
                  Participantes · {formData.attendees.length}
                </p>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__filters">
                    <div className="relative min-w-0">
                      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="search"
                        value={modalAttendeeSearch}
                        onChange={(e) => setModalAttendeeSearch(e.target.value)}
                        placeholder="Buscar por nombre…"
                        className="meeting-sheet__input pl-9 text-[14px]"
                        aria-label="Buscar participantes por nombre"
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={modalDeptFilter}
                        onChange={(e) => setModalDeptFilter(e.target.value)}
                        className="meeting-sheet__select min-w-0 flex-1 text-[14px]"
                      >
                        <option value="">Todos los departamentos</option>
                        {departments.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      {modalDeptFilter && (
                        <button type="button" onClick={toggleSelectAll} className="meeting-sheet__btn-sm">
                          {isAllSelected ? 'Quitar selección' : 'Seleccionar todos'}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="meeting-sheet__meta">
                    Orden alfabético · {selectableUsersForModal.length} disponible
                    {selectableUsersForModal.length === 1 ? '' : 's'}
                    {proposedMeetingRange && busyUsersById.size > 0
                      ? ` · ${busyUsersById.size} ocupado${busyUsersById.size === 1 ? '' : 's'} en este horario`
                      : ''}
                  </p>
                  {proposedMeetingRange && busyUsersById.size > 0 && (
                    <p className="meeting-sheet__hint meeting-sheet__hint--warn">
                      Las personas con otra reunión en el mismo horario no aparecen en la lista.
                    </p>
                  )}
                  {proposedMeetingRange && user && busyUsersById.has(Number(user.id)) && (
                    <p className="meeting-sheet__hint meeting-sheet__hint--error">
                      Tú ya tienes otra reunión en ese horario (
                      {formatBusyUserHint(busyUsersById.get(Number(user.id)))}).
                    </p>
                  )}
                  <div className="meeting-sheet__participants-scroll">
                    {selectableUsersForModal.length === 0 ? (
                      <p className="meeting-sheet__cell meeting-sheet__cell--empty">
                        {modalDeptFilter || modalAttendeeSearch.trim()
                          ? proposedMeetingRange && busyUsersById.size > 0
                            ? 'Nadie disponible en este horario con los filtros aplicados.'
                            : 'No hay usuarios que coincidan con los filtros.'
                          : proposedMeetingRange && busyUsersById.size > 0
                            ? 'Nadie disponible en el horario seleccionado.'
                            : 'No hay usuarios registrados.'}
                      </p>
                    ) : (
                      selectableUsersForModal.map((u) => (
                        <label key={u.id} className="meeting-sheet__participant-row">
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
                            <p className="truncate text-[15px] font-semibold text-slate-900">{userFullName(u)}</p>
                            <p className="truncate text-[13px] text-slate-500">
                              {[u.puesto, u.departamento].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <p className="meeting-sheet__section-label">Descripción</p>
                <div className="meeting-sheet__group">
                  <div className="meeting-sheet__cell meeting-sheet__cell--field">
                    <textarea
                      rows="3"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="meeting-sheet__textarea"
                      placeholder="Objetivo de la reunión, enlaces o notas internas (opcional)."
                    />
                  </div>
                </div>
              </div>

              <div className="meeting-sheet__footer shrink-0">
                <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
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
                    disabled={
                      Boolean(
                        proposedMeetingRange &&
                          user &&
                          busyUsersById.has(Number(user.id)),
                      )
                    }
                    className="voice-minute-footer__btn voice-minute-footer__btn--primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editingMeetingId ? (
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
                        Guardar cambios
                      </>
                    ) : (
                      <>
                        <svg
                          className="voice-minute-footer__icon voice-minute-footer__icon--schedule"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                          <path d="M12 14v3M9 17h6" />
                        </svg>
                        Programar reunión
                      </>
                    )}
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
        const sortedMeetingAttendees = sortUsersByName(
          (selectedMeeting.attendees || [])
            .map((id) => dbUsers.find((u) => Number(u.id) === Number(id)))
            .filter(Boolean),
        );
        const rsvpSummary = (selectedMeeting.rsvps || []).reduce(
          (acc, r) => {
            if (r.status === 'going') acc.going += 1;
            else if (r.status === 'declined') acc.declined += 1;
            else if (r.status === 'late') acc.late += 1;
            return acc;
          },
          { going: 0, declined: 0, late: 0 },
        );
        const showRsvpForm = user && isInvitedAttendee(selectedMeeting, user.id);
        const mySavedRsvp = user ? getRsvpForUser(selectedMeeting, user.id) : null;
        const rsvpDirty =
          showRsvpForm &&
          (rsvpDraft.status !== (mySavedRsvp?.status || '') ||
            String(rsvpDraft.comment || '').trim() !== String(mySavedRsvp?.comment || '').trim());

        return (
        <div
          className="meeting-sheet-overlay animate-fade-in"
          onClick={() => setSelectedMeeting(null)}
          onKeyDown={(e) => e.key === 'Escape' && setSelectedMeeting(null)}
          role="presentation"
        >
          <div
            className="meeting-sheet meeting-sheet--detail animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-summary-title"
          >
            <div className="meeting-sheet__hero shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="meeting-sheet__pill meeting-sheet__pill--gold">
                      {getLocationLabel(selectedMeeting.location_type)}
                    </span>
                    <span className="meeting-sheet__pill meeting-sheet__pill--ok">Confirmada</span>
                  </div>
                  <h3 id="meeting-summary-title" className="meeting-sheet__hero-title">
                    {selectedMeeting.title}
                  </h3>
                  {organizerLabel && (
                    <p className="text-sm text-white/60">
                      Organiza <span className="font-medium text-white/90">{organizerLabel}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <span className="meeting-sheet__meta-chip">
                      {start.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="meeting-sheet__meta-chip tabular-nums">
                      {start.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} –{' '}
                      {end.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMeeting(null)}
                  className="meeting-sheet__close"
                  aria-label="Cerrar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="meeting-sheet__body">
            <div className="meeting-sheet__scroll meeting-sheet__scroll--form">
              <p className="meeting-sheet__section-label">Detalles</p>
              <div className="meeting-sheet__group">
                <div className="meeting-sheet__cell">
                  <p className="meeting-sheet__cell-label">Modalidad</p>
                  <p className="meeting-sheet__cell-value">{getLocationLabel(selectedMeeting.location_type)}</p>
                  <p className="meeting-sheet__cell-note">
                    {selectedMeeting.location_type === 'virtual'
                      ? 'Enlace o detalles en la descripción o invitación.'
                      : 'Reserva física de la sala de juntas corporativa.'}
                  </p>
                </div>
                <div className="meeting-sheet__cell">
                  <p className="meeting-sheet__cell-label">Descripción</p>
                  <p className="meeting-sheet__cell-value meeting-sheet__cell-value--body">
                    {selectedMeeting.description?.trim() ? selectedMeeting.description.trim() : 'Sin notas ni agenda registrada.'}
                  </p>
                </div>
              </div>

              <p className="meeting-sheet__section-label">
                Participantes · {attendeeCount}
                {attendeeCount > 0 && (rsvpSummary.going + rsvpSummary.late + rsvpSummary.declined) > 0
                  ? ` · ${rsvpSummary.going} confirmados · ${rsvpSummary.late} tarde · ${rsvpSummary.declined} no asisten`
                  : ''}
              </p>
              <div className="meeting-sheet__group">
                {attendeeCount === 0 ? (
                  <div className="meeting-sheet__cell meeting-sheet__cell--empty">
                    Nadie agregado como participante todavía.
                  </div>
                ) : (
                  sortedMeetingAttendees.map((u, idx) => {
                    const rsvp = getRsvpForUser(selectedMeeting, u.id);
                    const meta = rsvp ? RSVP_META[rsvp.status] : null;
                    return (
                    <div
                      key={u.id}
                      className={`meeting-sheet__person${idx > 0 ? ' meeting-sheet__person--border' : ''}`}
                    >
                      <div className="meeting-sheet__avatar">{(u.name || '?').charAt(0).toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold text-slate-900">{userFullName(u)}</p>
                            <p className="truncate text-[13px] text-slate-500">
                              {[u.puesto, u.departamento].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                          {meta ? (
                            <span
                              className="meeting-sheet__rsvp-pill"
                              style={{ background: meta.bg, color: meta.color }}
                            >
                              {meta.short}
                            </span>
                          ) : (
                            <span className="meeting-sheet__rsvp-pill meeting-sheet__rsvp-pill--pending">
                              Pendiente
                            </span>
                          )}
                        </div>
                        {rsvp?.comment ? (
                          <p className="meeting-sheet__person-comment">&ldquo;{rsvp.comment}&rdquo;</p>
                        ) : null}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>

              {showRsvpForm && (
                <>
                  <p className="meeting-sheet__section-label">¿Podrás asistir?</p>
                  <div className="meeting-sheet__group" role="radiogroup" aria-label="Confirmación de asistencia">
                    {RSVP_OPTIONS.map((opt) => {
                      const selected = rsvpDraft.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setRsvpDraft((prev) => ({ ...prev, status: opt.value }))}
                          className={`meeting-sheet__radio-row${selected ? ' meeting-sheet__radio-row--selected' : ''}`}
                        >
                          <span
                            className={`meeting-sheet__modality-icon${opt.tilted ? ' meeting-sheet__modality-icon--virtual' : ''}`}
                            aria-hidden
                          >
                            <MeetingRsvpIcon status={opt.value} />
                          </span>
                          <span className="meeting-sheet__modality-text">
                            <span className="meeting-sheet__modality-label">{opt.label}</span>
                            <span className="block text-[12px] font-normal text-slate-500">{opt.hint}</span>
                          </span>
                          <span className="meeting-sheet__modality-check" aria-hidden>
                            {selected ? (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                    <div className="meeting-sheet__cell meeting-sheet__cell--field border-t border-slate-100">
                      <label className="meeting-sheet__cell-label" htmlFor="meeting-rsvp-comment">
                        Comentario (opcional)
                      </label>
                      <textarea
                        id="meeting-rsvp-comment"
                        rows={2}
                        value={rsvpDraft.comment}
                        onChange={(e) => setRsvpDraft((prev) => ({ ...prev, comment: e.target.value }))}
                        className="meeting-sheet__textarea text-[14px]"
                        placeholder="Ej. Salgo de otra junta a las 10:30 o no podré conectarme desde la oficina."
                      />
                    </div>
                    <div className="meeting-sheet__rsvp-actions">
                      {rsvpError ? <p className="meeting-sheet__hint meeting-sheet__hint--error mb-3">{rsvpError}</p> : null}
                      <button
                        type="button"
                        onClick={handleSaveRsvp}
                        disabled={rsvpSaving || !rsvpDraft.status || !rsvpDirty}
                        className="meeting-sheet__btn meeting-sheet__btn--primary meeting-sheet__rsvp-save"
                      >
                        {rsvpSaving ? 'Guardando…' : mySavedRsvp ? 'Actualizar respuesta' : 'Enviar respuesta'}
                      </button>
                      {!rsvpDirty && mySavedRsvp ? (
                        <p className="meeting-sheet__hint meeting-sheet__hint--info mt-3 mb-0">
                          Tu respuesta está registrada: {RSVP_META[mySavedRsvp.status]?.label || mySavedRsvp.status}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              )}

              {canAccessMeeting(selectedMeeting) && (
                <div className="saya-capture-card meeting-sheet__group overflow-hidden">
                  <div className="saya-capture-card__head">
                    <SayaBrandMark variant="compact" />
                    <p className="saya-capture-card__tagline">Graba la junta y genera la minuta automáticamente</p>
                  </div>
                  <div className="saya-capture-card__body">
                    <MeetingSayaCaptureCard
                      processing={voiceProcessing}
                      onStart={() => {
                        setVoiceCaptureError('');
                        setVoiceCaptureOpen(true);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="meeting-sheet__footer shrink-0">
              <div className="meeting-sheet__footer-actions voice-minute-sheet__footer-actions">
                <button
                  type="button"
                  onClick={() => setSelectedMeeting(null)}
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
                  Cerrar
                </button>
                {canEditMeeting(selectedMeeting) && (
                  <button
                    type="button"
                    onClick={openEditMeeting}
                    className="voice-minute-footer__btn voice-minute-footer__btn--primary"
                  >
                    <svg
                      className="voice-minute-footer__icon voice-minute-footer__icon--edit"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                    Editar
                  </button>
                )}
              </div>
              {canDeleteMeeting(selectedMeeting) && (
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
                        alert(err?.response?.data?.error || 'No se pudo eliminar la reunión.');
                      }
                    }
                  }}
                  className="meeting-sheet__btn-destructive"
                >
                  Eliminar reunión
                </button>
              )}
            </div>
            </div>
          </div>
        </div>
        );
      })()}

      <MeetingVoiceCaptureOverlay
        open={voiceCaptureOpen}
        onClose={() => {
          if (voiceRecorder.isRecording) voiceRecorder.cancelRecording();
          setVoiceCaptureOpen(false);
          setVoiceCaptureError('');
        }}
        meetingTitle={selectedMeeting?.title}
        captureMode={selectedMeeting?.location_type === 'virtual' ? 'virtual' : 'sala_juntas'}
        attendees={
          selectedMeeting
            ? sortUsersByName(
                (selectedMeeting.attendees || [])
                  .map((id) => dbUsers.find((u) => Number(u.id) === Number(id)))
                  .filter(Boolean),
              ).map((u) => userFullName(u))
            : []
        }
        voice={voiceRecorder}
        processing={voiceProcessing}
        error={voiceCaptureError}
        onStopAndProcess={handleVoiceStopAndProcess}
      />

      <MeetingVoiceMinuteModal
        open={voiceMinuteOpen}
        onClose={() => {
          setVoiceMinuteOpen(false);
          setVoiceMinuteDraft(null);
          setVoiceMinuteBrief(null);
          setVoiceTranscriptSegments([]);
          setVoiceRecordingAudioPath(null);
          setVoiceRecordingAudioUrl(null);
          setVoiceRecordingBlob(null);
        }}
        draft={voiceMinuteDraft}
        minuteBrief={voiceMinuteBrief}
        transcript={voiceTranscript}
        transcriptSegments={voiceTranscriptSegments}
        meetingId={selectedMeeting?.id}
        existingMinuteId={voiceExistingMinuteId}
        recordingAudioPath={voiceRecordingAudioPath}
        recordingAudioUrl={voiceRecordingAudioUrl}
        recordingAudioBlob={voiceRecordingBlob}
        showRecordingSection
        onSaved={() => {
          fetchMeetings();
          onMinuteSaved?.();
        }}
      />
    </div>
  );
}
