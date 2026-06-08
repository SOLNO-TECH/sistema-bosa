export const MEETING_LOCATION_OPTIONS = [
  { value: 'sala_juntas', label: 'Sala de juntas', short: 'Sala' },
  { value: 'virtual', label: 'Reunión virtual', short: 'Virtual' },
];

export function getLocationLabel(type) {
  return MEETING_LOCATION_OPTIONS.find((o) => o.value === type)?.label ?? 'Sala de juntas';
}

/** Etiqueta de lugar para minuta / PDF según modalidad. */
export function meetingPlaceLabelForType(locationType) {
  if (locationType === 'virtual') return 'Reunión virtual';
  const base = getLocationLabel(locationType);
  return base === 'Sala de juntas' ? 'Sala de juntas corporativo' : base;
}

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const STEP_MINUTES = 30;

export function buildTimeSlots() {
  const slots = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    for (const m of [0, 30]) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

export function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function compareTimes(a, b) {
  return a.localeCompare(b);
}

export function parseLocalRange(date, startTime, endTime) {
  return {
    start: new Date(`${date}T${startTime}:00`),
    end: new Date(`${date}T${endTime}:00`),
  };
}

function rangesOverlapMs(s1, e1, s2, e2) {
  return s1 < e2 && s2 < e1;
}

export function getSalaBusyRanges(meetings, date, excludeMeetingId = null) {
  return meetings
    .filter((m) => {
      if ((m.location_type || 'sala_juntas') !== 'sala_juntas') return false;
      if (excludeMeetingId != null && Number(m.id) === Number(excludeMeetingId)) return false;
      return (m.start_time || '').slice(0, 10) === date;
    })
    .map((m) => ({
      id: m.id,
      title: m.title,
      start: new Date(m.start_time),
      end: new Date(m.end_time),
    }));
}

export function isRangeConflictingWithBusy(busyRanges, start, end) {
  const s = start.getTime();
  const e = end.getTime();
  return busyRanges.some((b) => rangesOverlapMs(s, e, b.start.getTime(), b.end.getTime()));
}

export function isStartSlotDisabled(busyRanges, date, slot) {
  const endSlot = addMinutesToTime(slot, STEP_MINUTES);
  const { start, end } = parseLocalRange(date, slot, endSlot);
  return isRangeConflictingWithBusy(busyRanges, start, end);
}

export function isEndSlotDisabled(busyRanges, date, startSlot, endSlot) {
  if (compareTimes(endSlot, startSlot) <= 0) return true;
  const { start, end } = parseLocalRange(date, startSlot, endSlot);
  return isRangeConflictingWithBusy(busyRanges, start, end);
}

export function formatBusyRangeLabel(start, end) {
  const fmt = (d) =>
    d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${fmt(start)} – ${fmt(end)}`;
}

function parseMeetingAttendeeIds(meeting) {
  const raw = meeting?.attendees;
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];
  } catch {
    return [];
  }
}

export function getMeetingParticipantIds(meeting) {
  const ids = new Set(parseMeetingAttendeeIds(meeting));
  if (meeting?.created_by) ids.add(Number(meeting.created_by));
  return ids;
}

function userCountsAsBusyInMeeting(meeting, userId) {
  if (!getMeetingParticipantIds(meeting).has(Number(userId))) return false;
  const rsvp = (meeting.rsvps || []).find((r) => Number(r.user_id) === Number(userId));
  return rsvp?.status !== 'declined';
}

export function getRsvpForUser(meeting, userId) {
  return (meeting?.rsvps || []).find((r) => Number(r.user_id) === Number(userId)) || null;
}

export function getOverlappingMeetings(meetings, startIso, endIso, excludeMeetingId = null) {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || s >= e) return [];

  return meetings.filter((m) => {
    if (excludeMeetingId != null && Number(m.id) === Number(excludeMeetingId)) return false;
    const ms = new Date(m.start_time).getTime();
    const me = new Date(m.end_time).getTime();
    return ms < e && s < me;
  });
}

/** Mapa userId → reunión que lo mantiene ocupado en el rango propuesto. */
export function getBusyUsersInRange(meetings, startIso, endIso, excludeMeetingId = null) {
  const busy = new Map();
  for (const meeting of getOverlappingMeetings(meetings, startIso, endIso, excludeMeetingId)) {
    for (const uid of getMeetingParticipantIds(meeting)) {
      if (!userCountsAsBusyInMeeting(meeting, uid)) continue;
      if (!busy.has(uid)) {
        busy.set(uid, {
          meetingId: meeting.id,
          title: meeting.title,
          start: meeting.start_time,
          end: meeting.end_time,
        });
      }
    }
  }
  return busy;
}

export function formatBusyUserHint(info) {
  if (!info) return 'Ocupado en otro horario';
  const start = new Date(info.start);
  const end = new Date(info.end);
  const when = formatBusyRangeLabel(start, end);
  return info.title ? `En "${info.title}" · ${when}` : `Ocupado · ${when}`;
}
