/**
 * Cronograma — placeholder hasta lanzamiento del módulo.
 */
export default function CronogramaModule() {
  return (
    <div className="module-coming-soon">
      <div className="module-coming-soon__card">
        <div className="module-coming-soon__visual" aria-hidden>
          <svg className="module-coming-soon__icon" viewBox="0 0 80 80" fill="none">
            <rect x="8" y="14" width="64" height="52" rx="8" stroke="currentColor" strokeWidth="2" opacity="0.35" />
            <path d="M16 28h20M16 38h32M16 48h24M16 58h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <path d="M52 22v44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="52" cy="32" r="5" fill="currentColor" opacity="0.45" />
            <circle cx="52" cy="48" r="5" fill="currentColor" opacity="0.65" />
          </svg>
        </div>
        <span className="module-coming-soon__badge">Próximamente</span>
        <h1 className="module-coming-soon__title">Cronograma</h1>
        <p className="module-coming-soon__text">
          Aquí podrás ver el cronograma operativo del equipo en una vista clara por fechas y responsables.
        </p>
        <p className="module-coming-soon__hint">Estamos preparando esta sección para una próxima actualización de BOSA Hub.</p>
      </div>
    </div>
  );
}
