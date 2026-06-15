/** Zona horaria operativa BOSA (México). */
export const BOSA_TIME_ZONE = 'America/Mexico_City';

/** YYYY-MM-DD en zona BOSA — no usar toISOString() para “hoy”. */
export function localDateYMD(date = new Date(), timeZone = BOSA_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

/** Parsea YYYY-MM-DD como mediodía local (evita saltos por UTC). */
export function parseYMD(ymd) {
  if (!ymd) return null;
  const parts = String(ymd).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Datetime SQLite/API (UTC sin Z) → Date. */
export function parseDbDateTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.includes('T')) {
    const normalized = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}Z`;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateShort(ymd, locale = 'es-MX') {
  const d = parseYMD(ymd);
  return d ? d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }) : ymd;
}

/** Texto legible del tramo de la tarea en el calendario operativo. */
export function formatTaskScheduleLabel(startYmd, endYmd, locale = 'es-MX') {
  const start = formatDateShort(startYmd, locale);
  const end = formatDateShort(endYmd, locale);
  if (!start && !end) return '';
  if (!start) return `Concluye el día ${end}`;
  if (!end) return `Tarea creada el día ${start}`;
  if (start === end) return `Tarea creada y concluye el día ${start}`;
  return `Tarea creada el día ${start} y concluye el día ${end}`;
}
