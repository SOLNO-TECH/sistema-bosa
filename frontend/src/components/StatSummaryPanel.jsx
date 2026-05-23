export function StatIcon({ type, className = 'w-[18px] h-[18px]' }) {
  const props = {
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  switch (type) {
    case 'visible':
      return (
        <svg {...props}>
          <path d="M2.25 12c0-4.556 4.03-8.25 9.75-8.25S21.75 7.444 21.75 12s-4.03 8.25-9.75 8.25S2.25 16.556 2.25 12z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'pending':
      return (
        <svg {...props}>
          <path d="M12 6v6h4.5" />
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'progress':
      return (
        <svg {...props}>
          <path d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-12 0h12m-12 0l3-3m9 3l-3-3" />
        </svg>
      );
    case 'done':
      return (
        <svg {...props}>
          <path d="M9 12.75L11.25 15 15 9.75" />
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'cancelled':
      return (
        <svg {...props}>
          <path d="M15 9.75L9.75 15M9.75 9.75l5.25 5.25" />
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'avisos':
      return (
        <svg {...props}>
          <path d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
        </svg>
      );
    case 'sent':
      return (
        <svg {...props}>
          <path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      );
    case 'read':
      return (
        <svg {...props}>
          <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'rate':
      return (
        <svg {...props}>
          <path d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
      );
    default:
      return null;
  }
}

export function StatCard({
  config,
  value,
  proportionBase = 0,
  referenceKey = 'total',
  displayValue,
  progressPct,
  footerLabel,
  showProportionBadge = true,
}) {
  const num = Number(value) || 0;
  const hasValue = num > 0 || (displayValue && displayValue !== '0' && displayValue !== '0%');
  const isReference = config.key === referenceKey;

  const pct = progressPct ?? (
    isReference
      ? (hasValue ? 100 : 0)
      : (proportionBase > 0 ? Math.round((num / proportionBase) * 100) : 0)
  );

  const shown = displayValue ?? String(num);
  const barLabel = footerLabel ?? (isReference ? 'Cobertura' : 'Proporción');

  return (
    <article className="group relative flex min-w-[160px] shrink-0 snap-start flex-col bg-white md:min-w-0 border border-gray-200/90 shadow-[0_1px_2px_rgba(10,25,48,0.04)] transition-shadow duration-200 hover:shadow-[0_4px_14px_rgba(10,25,48,0.07)]">
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: config.bar }} aria-hidden />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent opacity-80" aria-hidden />

      <div className="flex flex-1 flex-col px-4 py-3.5 pl-5">
        <div className="flex items-center justify-between gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-gray-200/90 bg-gray-50/80 text-navy-800"
            style={{ color: config.accent }}
          >
            <StatIcon type={config.icon} />
          </div>
          {!isReference && showProportionBadge && proportionBase > 0 && pct > 0 && (
            <span className="text-[9px] font-semibold tabular-nums tracking-wide text-navy-500 border border-gray-200 px-1.5 py-0.5 rounded-sm bg-gray-50">
              {pct}%
            </span>
          )}
        </div>

        <p className="mt-3 font-label text-[9px] font-bold uppercase tracking-[0.22em] text-navy-600">
          {config.label}
        </p>
        <p className="mt-1 text-[2rem] font-display font-medium leading-none tabular-nums text-navy-950 tracking-tight">
          {shown}
        </p>
        <p className="mt-1.5 text-[10px] text-navy-500 leading-snug">{config.subtitle}</p>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-navy-400">{barLabel}</span>
            {hasValue && !isReference && proportionBase > 0 && (
              <span className="text-[9px] font-medium tabular-nums text-navy-600">{pct}% del total</span>
            )}
          </div>
          <div className="h-[3px] w-full bg-gray-100 overflow-hidden">
            <div
              className="h-full transition-all duration-700 ease-out"
              style={{
                width: `${hasValue ? Math.max(isReference ? 8 : 4, pct) : 0}%`,
                background: config.bar,
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function StatSummaryPanel({
  title,
  subtitle,
  badge,
  items,
  proportionBase = 0,
  referenceKey = 'total',
  columnsClass = 'md:grid-cols-2 lg:grid-cols-5',
  headerIcon = 'chart',
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-navy-950/[0.03] via-white to-gold/[0.06]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center border border-gold/30 bg-navy-950 text-gold">
            {headerIcon === 'megaphone' ? (
              <StatIcon type="avisos" className="w-4 h-4" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-navy-800">{title}</h3>
            {subtitle ? <p className="text-[11px] text-navy-500 mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
        {badge ? (
          <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-widest text-gold border border-gold/30 px-2 py-1 bg-gold/5">
            {badge}
          </span>
        ) : null}
      </div>
      <div className={`flex gap-0 overflow-x-auto snap-x snap-mandatory md:grid ${columnsClass} md:overflow-visible divide-x divide-gray-100`}>
        {items.map((item) => (
          <StatCard
            key={item.config.key}
            config={item.config}
            value={item.value}
            displayValue={item.displayValue}
            progressPct={item.progressPct}
            footerLabel={item.footerLabel}
            proportionBase={item.proportionBase ?? proportionBase}
            referenceKey={referenceKey}
            showProportionBadge={item.showProportionBadge ?? true}
          />
        ))}
      </div>
    </section>
  );
}
