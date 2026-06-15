/**
 * Avatar con foto de perfil si existe (avatar_url), si no iniciales.
 */
export default function UserAvatar({
  name = '',
  apellido = '',
  avatarUrl = '',
  size = 'md',
  className = '',
}) {
  const label = [name, apellido].filter(Boolean).join(' ').trim() || '?';
  const initials =
    (name?.charAt(0) || '') + (apellido?.charAt(0) || name?.charAt(1) || '');
  const rawUrl = String(avatarUrl || '').trim();
  const src = rawUrl
    ? rawUrl.startsWith('http') || rawUrl.startsWith('/')
      ? rawUrl
      : `/api/uploads/${rawUrl.replace(/^\/+/, '')}`
    : '';

  const sizes = {
    xs: 'h-7 w-7 text-[10px] ring-1',
    sm: 'h-9 w-9 text-xs ring-2',
    md: 'h-11 w-11 text-sm ring-2',
    lg: 'h-14 w-14 text-base ring-2',
    xl: 'h-16 w-16 text-lg ring-2',
  };
  const sizeClass = sizes[size] || sizes.md;

  if (src) {
    return (
      <img
        key={src}
        src={src}
        alt={label}
        title={label}
        className={`rounded-full object-cover bg-navy-100 ring-gold/50 shadow-md shrink-0 ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <span
      title={label}
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-navy-900 to-navy-950 font-bold text-gold ring-gold/40 shadow-md shrink-0 ${sizeClass} ${className}`}
      aria-hidden={!label}
    >
      {(initials || '?').toUpperCase().slice(0, 2)}
    </span>
  );
}
