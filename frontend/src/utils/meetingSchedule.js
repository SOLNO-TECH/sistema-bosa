export const MEETING_LOCATION_OPTIONS = [
  { value: 'sala_juntas', label: 'Sala de juntas', short: 'Sala' },
  { value: 'virtual', label: 'Reunión virtual', short: 'Virtual' },
];

export function getLocationLabel(type) {
  return MEETING_LOCATION_OPTIONS.find((o) => o.value === type)?.label ?? 'Sala de juntas';
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
