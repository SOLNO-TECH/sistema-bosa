/**
 * Marca de crédito SOLNO — login, sidebar, etc.
 * Opcional: VITE_SOLNO_URL en .env para enlace externo.
 */
const SOLNO_URL = import.meta.env.VITE_SOLNO_URL || '';
const SOLNO_LOGO = import.meta.env.VITE_SOLNO_LOGO || '/solno-logo.png';

/** SOLNO + .mx pegados — TLD más chico, blanco, mismo renglón */
export function SolnoLogoLockup({ size = 'sm', className = '' }) {
  const sizes = {
    sm: { main: 'text-[11px]', tld: 'text-[8px]' },
    md: { main: 'text-[12px]', tld: 'text-[9px]' },
    lg: { main: 'text-base sm:text-lg', tld: 'text-[11px] sm:text-xs' },
  };
  const s = sizes[size] || sizes.sm;

  return (
    <span className={`inline-flex items-baseline leading-none ${className}`}>
      <span className={`font-display font-semibold tracking-[0.2em] text-gold/90 ${s.main}`}>SOLNO</span>
      <span className={`font-sans lowercase tracking-normal text-white/70 ${s.tld}`}>.mx</span>
    </span>
  );
}

function SolnoLogoMark({ className = '', size = 'login' }) {
  const dims = {
    login: 'h-10 w-10 sm:h-11 sm:w-11',
    sidebar: 'h-8 w-8',
    sm: 'h-[1.125rem] w-[1.125rem]',
  };
  const dim = dims[size] || dims.sm;
  return (
    <img
      src={SOLNO_LOGO}
      alt="SOLNO"
      className={`shrink-0 object-contain ${dim} ${className}`}
    />
  );
}

function SolnoLoginBrandRow({ asLink = false }) {
  const row = (
    <span className={`solno-login-brand ${asLink ? 'cursor-pointer' : ''}`}>
      <SolnoLogoMark size="login" />
      <span className="inline-flex items-baseline gap-1.5">
        <span className="font-label solno-login-brand__kicker uppercase">Desarrollado por</span>
        <SolnoLogoLockup size="md" />
      </span>
    </span>
  );

  if (asLink && SOLNO_URL) {
    return (
      <a
        href={SOLNO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block no-underline"
        title="SOLNO.mx"
      >
        {row}
      </a>
    );
  }

  return row;
}

/** Pie login: marca SOLNO */
export function SolnoLoginFooter({ className = '' }) {
  return (
    <footer className={`solno-login-footer mt-14 lg:mt-5 lg:pt-4 ${className}`}>
      <div className="flex justify-center">
        <SolnoLoginBrandRow asLink={Boolean(SOLNO_URL)} />
      </div>
    </footer>
  );
}

/** @deprecated Usar SolnoLoginFooter */
export function SolnoLoginCredit(props) {
  return <SolnoLoginFooter {...props} />;
}

/** Sidebar — pie discreto: logo + por SOLNO.mx */
export function SolnoSidebarCredit({ className = '' }) {
  const inner = (
    <span className="inline-flex items-center gap-1.5 px-1 py-0.5">
      <span className="font-label text-[8px] uppercase tracking-[0.32em] text-slate-muted/45">por</span>
      <span className="inline-flex items-center gap-0">
        <SolnoLogoMark size="sidebar" className="-mr-0.5" />
        <SolnoLogoLockup size="sm" />
      </span>
    </span>
  );

  return (
    <div className={`mt-3 flex justify-center px-1 ${className}`}>
      {SOLNO_URL ? (
        <a
          href={SOLNO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm transition-opacity hover:opacity-90"
          title="SOLNO.mx"
        >
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}

export default SolnoLogoLockup;
