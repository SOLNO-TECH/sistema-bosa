import SayaProLock from './SayaProLock';

export const MINUTA_TOPIC_HEAD_CLASS = [
  'voice-minute-topic-head--1',
  'voice-minute-topic-head--2',
  'voice-minute-topic-head--3',
];

const PRO_TOPIC_PLACEHOLDERS = [
  { titulo: 'Resumen y puntos tratados', lines: 4 },
  { titulo: 'Acuerdos', lines: 3 },
  { titulo: 'Compromisos y seguimiento', lines: 3 },
];

function StatChip({ label, value }) {
  return (
    <div className="voice-minute-stat">
      <p className="voice-minute-stat__value">{value}</p>
      <p className="voice-minute-stat__label">{label}</p>
    </div>
  );
}

export function ProStatsPlaceholder() {
  return (
    <div className="voice-minute-stats">
      {['Palabras', 'Acuerdos', 'Compromisos', 'Voces'].map((label) => (
        <StatChip key={label} label={label} value="•••" />
      ))}
    </div>
  );
}

export function ProExecutiveSummaryPlaceholder() {
  return (
    <section className="voice-minute-section">
      <div className="voice-minute-section__head">
        <span className="voice-minute-section__icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </span>
        <div>
          <h4 className="voice-minute-section__title">Resumen ejecutivo</h4>
          <p className="voice-minute-section__sub">Síntesis automática de lo conversado</p>
        </div>
      </div>
      <div className="space-y-2 py-1">
        <p className="saya-pro-lock__placeholder-line saya-pro-lock__placeholder-line--mid" />
        <p className="saya-pro-lock__placeholder-line" />
        <p className="saya-pro-lock__placeholder-line saya-pro-lock__placeholder-line--short" />
      </div>
    </section>
  );
}

export function ProAgreementsActionsPlaceholder() {
  return (
    <div className="voice-minute-columns">
      <section className="voice-minute-section voice-minute-section--agreements">
        <h4 className="voice-minute-section__heading voice-minute-section__heading--green">
          <span className="voice-minute-section__dot voice-minute-section__dot--green" />
          Acuerdos
        </h4>
        <div className="space-y-2">
          <p className="saya-pro-lock__placeholder-line" />
          <p className="saya-pro-lock__placeholder-line saya-pro-lock__placeholder-line--mid" />
        </div>
      </section>
      <section className="voice-minute-section voice-minute-section--actions">
        <h4 className="voice-minute-section__heading voice-minute-section__heading--amber">
          <span className="voice-minute-section__dot voice-minute-section__dot--amber" />
          Compromisos y seguimiento
        </h4>
        <div className="space-y-2">
          <p className="saya-pro-lock__placeholder-line saya-pro-lock__placeholder-line--mid" />
          <p className="saya-pro-lock__placeholder-line" />
        </div>
      </section>
    </div>
  );
}

export function ProTopicsPlaceholder() {
  return (
    <section className="voice-minute-card">
      <div className="voice-minute-card__block border-b border-slate-100">
        <p className="meeting-sheet__section-label mt-0">Temas del día (formato PDF)</p>
      </div>
      <div className="divide-y divide-slate-100">
        {PRO_TOPIC_PLACEHOLDERS.map((topic, idx) => (
          <div key={idx}>
            <div className={`voice-minute-topic-head ${MINUTA_TOPIC_HEAD_CLASS[idx] || MINUTA_TOPIC_HEAD_CLASS[0]}`}>
              Tema {idx + 1} del día · {topic.titulo}
            </div>
            <div className="voice-minute-topic-body space-y-2">
              {Array.from({ length: topic.lines }).map((_, lineIdx) => (
                <p
                  key={lineIdx}
                  className={`saya-pro-lock__placeholder-line${lineIdx % 2 === 1 ? ' saya-pro-lock__placeholder-line--short' : ''}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Bloques Pro de análisis IA (sin datos reales en el DOM). */
export function MinutaProLockedBlocks({ className = '', includeTopics = true }) {
  return (
    <div className={`space-y-4${className ? ` ${className}` : ''}`}>
      <SayaProLock
        compact
        className="saya-pro-lock--stats"
        title="Métricas de la reunión"
        subtitle="Palabras, acuerdos, compromisos y voces."
      >
        <ProStatsPlaceholder />
      </SayaProLock>

      <SayaProLock title="Resumen ejecutivo" subtitle="Síntesis automática de lo conversado en la reunión.">
        <ProExecutiveSummaryPlaceholder />
      </SayaProLock>

      <SayaProLock title="Acuerdos y compromisos" subtitle="Acuerdos y pendientes con seguimiento sugerido.">
        <ProAgreementsActionsPlaceholder />
      </SayaProLock>

      {includeTopics ? (
        <SayaProLock
          title="Temas del día · Análisis IA"
          subtitle="Resumen, acuerdos y compromisos estructurados por tema (formato PDF)."
        >
          <ProTopicsPlaceholder />
        </SayaProLock>
      ) : null}
    </div>
  );
}

/** Botón PDF bloqueado (Pro), mismo tamaño que acciones de tarjeta. */
export function MinutaPdfProLock({ className = '' }) {
  return (
    <span
      className={`minuta-pro-pdf-btn tasks-module__action-secondary gap-1.5${className ? ` ${className}` : ''}`}
      role="status"
      title="Exportar PDF — disponible en Saya AI Pro"
      aria-label="Exportar PDF, disponible en Saya AI Pro"
    >
      <svg className="h-4 w-4 shrink-0 opacity-55" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
      </svg>
      <span className="text-slate-500">PDF</span>
      <span className="minuta-pro-pdf-btn__badge">Pro</span>
    </span>
  );
}
