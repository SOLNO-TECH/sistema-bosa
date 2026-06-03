/**
 * Capa visual “Pro”: oculta contenido premium detrás de blur + mensaje de desbloqueo.
 * No renderizar datos sensibles dentro de `children` si deben permanecer ocultos.
 */
export default function SayaProLock({
  title = 'Contenido Saya AI Pro',
  subtitle = 'Activa este módulo para ver el análisis inteligente de tu reunión.',
  compact = false,
  className = '',
  children,
}) {
  return (
    <div
      className={`saya-pro-lock${compact ? ' saya-pro-lock--compact' : ''}${className ? ` ${className}` : ''}`.trim()}
    >
      {children ? (
        <div className="saya-pro-lock__veil" aria-hidden="true">
          {children}
        </div>
      ) : null}
      <div className="saya-pro-lock__panel" role="status">
        <span className="saya-pro-lock__badge">Pro</span>
        <span className="saya-pro-lock__icon" aria-hidden="true">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </span>
        <p className="saya-pro-lock__title">{title}</p>
        <p className="saya-pro-lock__sub">{subtitle}</p>
      </div>
    </div>
  );
}
