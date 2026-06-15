/** Tiempo relativo en español para feeds de actividad. */
export function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);

  if (sec < 45) return 'Hace un momento';
  const min = Math.floor(sec / 60);
  if (min < 60) return `Hace ${min} minuto${min === 1 ? '' : 's'}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Hace ${hr} hora${hr === 1 ? '' : 's'}`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `Hace ${day} día${day === 1 ? '' : 's'}`;
  const week = Math.floor(day / 7);
  if (week < 5) return `Hace ${week} semana${week === 1 ? '' : 's'}`;

  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}
