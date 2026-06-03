import { KNOWLEDGE_ITEMS } from '../../data/knowledgeHub';

function CardIcon({ theme }) {
  if (theme === 'gold') {
    return (
      <svg className="knowledge-hub__card-icon" viewBox="0 0 48 48" fill="none" aria-hidden>
        <path
          d="M24 8v32M8 24h32"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.35"
        />
        <path
          d="M14 18h20l-2 16H16l-2-16zM18 14h12l2 4H16l2-4z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (theme === 'muted') {
    return (
      <svg className="knowledge-hub__card-icon" viewBox="0 0 48 48" fill="none" aria-hidden>
        <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1.75" opacity="0.4" />
        <path d="M20 18l10 6-10 6V18z" fill="currentColor" opacity="0.5" />
      </svg>
    );
  }
  return (
    <svg className="knowledge-hub__card-icon" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M10 14h28v22a2 2 0 01-2 2H12a2 2 0 01-2-2V14z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 18h28M16 10h16v4H16v-4z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M16 26h16M16 31h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

function KnowledgeCard({ item }) {
  const themeClass = `knowledge-hub__card--${item.theme}`;
  const isLink = item.available && item.href;

  const inner = (
    <>
      <div className="knowledge-hub__card-bg" aria-hidden />
      <CardIcon theme={item.theme} />
      <div className="knowledge-hub__card-body">
        {item.comingSoon ? (
          <span className="knowledge-hub__badge">Próximamente</span>
        ) : (
          <span className="knowledge-hub__badge knowledge-hub__badge--live">Acceso directo</span>
        )}
        <h3 className="knowledge-hub__card-title">{item.title}</h3>
        <p className="knowledge-hub__card-subtitle">{item.subtitle}</p>
      </div>
      {isLink ? (
        <span className="knowledge-hub__card-action" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </span>
      ) : null}
    </>
  );

  if (isLink) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`knowledge-hub__card ${themeClass}`}
      >
        {inner}
      </a>
    );
  }

  return (
    <div className={`knowledge-hub__card ${themeClass} knowledge-hub__card--disabled`} aria-disabled="true">
      {inner}
    </div>
  );
}

export default function KnowledgeModule() {
  return (
    <div className="knowledge-hub">
      <header className="knowledge-hub__header">
        <p className="knowledge-hub__eyebrow">Centro de recursos</p>
        <h1 className="knowledge-hub__title">Knowledge</h1>
        <p className="knowledge-hub__intro">
          Accesos rápidos a herramientas y materiales de BOSA. Toca una tarjeta para abrir el enlace en una nueva pestaña.
        </p>
      </header>

      <div className="knowledge-hub__grid">
        {KNOWLEDGE_ITEMS.map((item) => (
          <KnowledgeCard key={item.id} item={item} />
        ))}
      </div>

      <p className="knowledge-hub__footnote">
        Los accesos Synology requieren credenciales corporativas. Si un enlace no abre, contacta a sistemas.
      </p>
    </div>
  );
}
