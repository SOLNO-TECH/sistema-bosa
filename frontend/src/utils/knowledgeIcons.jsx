/** Iconos lineales 48×48 — mismo estilo que las tarjetas Knowledge originales. */
export const KNOWLEDGE_ICON_IDS = [
  'folder',
  'cloud',
  'video',
  'link',
  'database',
  'users',
  'calendar',
  'chart',
  'book',
  'shield',
  'mail',
  'building',
  'toolbox',
  'globe',
  'camera',
];

const ICON_META = {
  folder: { label: 'Carpeta / documentos' },
  cloud: { label: 'Nube / almacenamiento' },
  video: { label: 'Video / guía' },
  link: { label: 'Enlace externo' },
  database: { label: 'Servidor / datos' },
  users: { label: 'Equipo / personas' },
  calendar: { label: 'Calendario' },
  chart: { label: 'Reportes / métricas' },
  book: { label: 'Manual / lectura' },
  shield: { label: 'Seguridad' },
  mail: { label: 'Correo' },
  building: { label: 'Empresa / sede' },
  toolbox: { label: 'Herramientas' },
  globe: { label: 'Web / portal' },
  camera: { label: 'Multimedia' },
};

export function knowledgeIconLabel(id) {
  return ICON_META[id]?.label || 'Icono';
}

export function KnowledgeIconSvg({ id, className = '' }) {
  const props = {
    className,
    viewBox: '0 0 48 48',
    fill: 'none',
    'aria-hidden': true,
  };

  switch (id) {
    case 'cloud':
      return (
        <svg {...props}>
          <path d="M24 8v32M8 24h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
          <path
            d="M14 18h20l-2 16H16l-2-16zM18 14h12l2 4H16l2-4z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'video':
      return (
        <svg {...props}>
          <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1.75" opacity="0.4" />
          <path d="M20 18l10 6-10 6V18z" fill="currentColor" opacity="0.5" />
        </svg>
      );
    case 'link':
      return (
        <svg {...props}>
          <path
            d="M18 30l-3-3a5 5 0 017-7l2 2M30 18l3 3a5 5 0 01-7 7l-2-2"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path d="M20 28l8-8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.65" />
        </svg>
      );
    case 'database':
      return (
        <svg {...props}>
          <ellipse cx="24" cy="14" rx="12" ry="5" stroke="currentColor" strokeWidth="1.75" />
          <path d="M12 14v10c0 2.8 5.4 5 12 5s12-2.2 12-5V14" stroke="currentColor" strokeWidth="1.75" />
          <path d="M12 24v10c0 2.8 5.4 5 12 5s12-2.2 12-5V24" stroke="currentColor" strokeWidth="1.75" opacity="0.65" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <circle cx="18" cy="18" r="5" stroke="currentColor" strokeWidth="1.75" />
          <circle cx="32" cy="20" r="4" stroke="currentColor" strokeWidth="1.75" opacity="0.65" />
          <path
            d="M10 36c0-4.4 3.6-8 8-8s8 3.6 8 8M26 36c0-3 2-5.6 4.8-6.6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...props}>
          <path d="M10 14h28v24a2 2 0 01-2 2H12a2 2 0 01-2-2V14z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M10 20h28M16 10v4M32 10v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M16 28h6M16 34h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...props}>
          <path d="M10 36V14M10 36h28" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M16 30V24M24 30V18M32 30V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'book':
      return (
        <svg {...props}>
          <path
            d="M12 10h11a4 4 0 014 4v26H16a4 4 0 00-4 4V10z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="M23 10h11v30H27a4 4 0 00-4-4V14a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" opacity="0.65" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...props}>
          <path
            d="M24 8l14 6v10c0 9-6 14-14 16-8-2-14-7-14-16V14l14-6z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="M18 24l4 4 8-8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...props}>
          <path d="M8 14h32v20H8V14z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M8 16l16 12L40 16" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" opacity="0.65" />
        </svg>
      );
    case 'building':
      return (
        <svg {...props}>
          <path d="M14 38V18l10-6 10 6v20" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M18 38V28h4v10M26 38V24h4v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
        </svg>
      );
    case 'toolbox':
      return (
        <svg {...props}>
          <path d="M10 22h28v14a2 2 0 01-2 2H12a2 2 0 01-2-2V22z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M18 22v-4a6 6 0 0112 0v4" stroke="currentColor" strokeWidth="1.75" />
          <path d="M22 28h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.65" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...props}>
          <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1.75" />
          <path d="M10 24h28M24 10c4 4 6 8 6 14s-2 10-6 14M24 10c-4 4-6 8-6 14s2 10 6 14" stroke="currentColor" strokeWidth="1.5" opacity="0.65" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...props}>
          <path d="M10 18h6l3-4h10l3 4h6v18H10V18z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <circle cx="24" cy="27" r="6" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      );
    case 'folder':
    default:
      return (
        <svg {...props}>
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
}

export const KNOWLEDGE_ICONS = KNOWLEDGE_ICON_IDS.map((id) => ({
  id,
  label: knowledgeIconLabel(id),
}));
