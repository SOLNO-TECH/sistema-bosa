const BOSA_TIME_ZONE = 'America/Mexico_City';

function localDateYMD(date = new Date(), timeZone = BOSA_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

function parseYMD(ymd) {
  if (!ymd) return null;
  const parts = String(ymd).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

module.exports = {
  BOSA_TIME_ZONE,
  localDateYMD,
  parseYMD,
};
