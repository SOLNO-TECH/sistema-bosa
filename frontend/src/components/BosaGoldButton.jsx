/**
 * Botón dorado BOSA (mismo estilo que Grabar reunión / Crear ticket).
 * variant="primary" → gradiente gold · variant="muted" → secundario blanco
 * active en filtros fuerza estilo primary aunque variant sea muted.
 */
const ICONS = {
  schedule: (
    <>
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <path d="M12 14v3M9 17h6" />
    </>
  ),
  ticket: (
    <>
      <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
      <path d="M15 4v3h3" />
      <path d="M12 11v6M9 14h6" />
    </>
  ),
  task: (
    <>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  notice: (
    <>
      <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
      <path d="M10 12h6M10 16h4" />
    </>
  ),
  minute: (
    <>
      <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
      <path d="M15 4v3h3" />
      <path d="M9 13l2 2 4-4.5" />
    </>
  ),
  user: (
    <>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  depto: (
    <>
      <path d="M3 21h18" />
      <path d="M6 21V9l6-3 6 3v12" />
      <path d="M9 21v-6h6v6" />
      <path d="M10 12h1M13 12h1M10 15h1M13 15h1" />
    </>
  ),
  role: (
    <>
      <path d="M12 3l8 4v5c0 5.25-3.5 9.15-8 10-4.5-.85-8-4.75-8-10V7l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  save: (
    <>
      <path d="M8 4h7l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z" />
      <path d="M15 4v3h3" />
      <path d="M9 14l2 2 4-4.5" />
    </>
  ),
  'bell-all': (
    <>
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </>
  ),
  'bell-unread': (
    <>
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </>
  ),
};

export default function BosaGoldButton({
  icon,
  children,
  variant = 'primary',
  active = false,
  className = '',
  type = 'button',
  disabled = false,
  ...rest
}) {
  const isGold = variant === 'primary' || active;
  const base = isGold
    ? 'meeting-sheet__minute-btn bosa-gold-btn'
    : 'voice-minute-footer__btn voice-minute-footer__btn--secondary bosa-gold-btn bosa-gold-btn--muted';

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${base} inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
      {...rest}
    >
      {icon && ICONS[icon] ? (
        <span className={`bosa-gold-btn__icon-wrap bosa-gold-btn__icon-wrap--${icon}`} aria-hidden>
          <svg
            className="bosa-gold-btn__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {ICONS[icon]}
          </svg>
        </span>
      ) : null}
      {children}
    </button>
  );
}
