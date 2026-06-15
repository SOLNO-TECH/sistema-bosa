/** Paletas rápidas para tarjetas Knowledge (el superadmin puede ajustar cada color). */
export const KNOWLEDGE_COLOR_PRESETS = [
  {
    id: 'navy',
    label: 'Azul marino',
    icon: 'folder',
    bg_color: '#071221',
    bg_color_end: '#0a1930',
    text_color: '#f0f4fa',
    subtext_color: 'rgba(240,244,250,0.72)',
    icon_color: 'rgba(255,255,255,0.22)',
    badge_bg: 'rgba(255,255,255,0.14)',
    badge_text: 'rgba(255,255,255,0.85)',
  },
  {
    id: 'gold',
    label: 'Dorado BOSA',
    icon: 'cloud',
    bg_color: '#8a7355',
    bg_color_end: '#cbac80',
    text_color: '#071221',
    subtext_color: 'rgba(7,18,33,0.72)',
    icon_color: 'rgba(7,18,33,0.18)',
    badge_bg: 'rgba(7,18,33,0.12)',
    badge_text: '#071221',
  },
  {
    id: 'muted',
    label: 'Gris',
    icon: 'video',
    bg_color: '#334155',
    bg_color_end: '#64748b',
    text_color: '#f8fafc',
    subtext_color: 'rgba(248,250,252,0.75)',
    icon_color: 'rgba(255,255,255,0.2)',
    badge_bg: 'rgba(255,255,255,0.12)',
    badge_text: 'rgba(255,255,255,0.9)',
  },
  {
    id: 'emerald',
    label: 'Esmeralda',
    icon: 'chart',
    bg_color: '#064e3b',
    bg_color_end: '#10b981',
    text_color: '#ecfdf5',
    subtext_color: 'rgba(236,253,245,0.78)',
    icon_color: 'rgba(255,255,255,0.22)',
    badge_bg: 'rgba(255,255,255,0.14)',
    badge_text: '#ecfdf5',
  },
  {
    id: 'indigo',
    label: 'Índigo',
    icon: 'database',
    bg_color: '#312e81',
    bg_color_end: '#4f46e5',
    text_color: '#eef2ff',
    subtext_color: 'rgba(238,242,255,0.75)',
    icon_color: 'rgba(255,255,255,0.22)',
    badge_bg: 'rgba(255,255,255,0.14)',
    badge_text: '#eef2ff',
  },
  {
    id: 'rose',
    label: 'Vino',
    icon: 'shield',
    bg_color: '#4c0519',
    bg_color_end: '#9f1239',
    text_color: '#fff1f2',
    subtext_color: 'rgba(255,241,242,0.78)',
    icon_color: 'rgba(255,255,255,0.22)',
    badge_bg: 'rgba(255,255,255,0.14)',
    badge_text: '#fff1f2',
  },
  {
    id: 'teal',
    label: 'Teal',
    icon: 'globe',
    bg_color: '#134e4a',
    bg_color_end: '#0d9488',
    text_color: '#f0fdfa',
    subtext_color: 'rgba(240,253,250,0.78)',
    icon_color: 'rgba(255,255,255,0.22)',
    badge_bg: 'rgba(255,255,255,0.14)',
    badge_text: '#f0fdfa',
  },
  {
    id: 'amber',
    label: 'Ámbar',
    icon: 'toolbox',
    bg_color: '#78350f',
    bg_color_end: '#d97706',
    text_color: '#fffbeb',
    subtext_color: 'rgba(255,251,235,0.78)',
    icon_color: 'rgba(255,255,255,0.22)',
    badge_bg: 'rgba(255,255,255,0.14)',
    badge_text: '#fffbeb',
  },
];

export const DEFAULT_KNOWLEDGE_COLORS = KNOWLEDGE_COLOR_PRESETS[0];

export function colorsFromPreset(presetId) {
  return KNOWLEDGE_COLOR_PRESETS.find((p) => p.id === presetId) || DEFAULT_KNOWLEDGE_COLORS;
}

export function formColorsFromItem(item) {
  if (!item) return { ...DEFAULT_KNOWLEDGE_COLORS, preset: 'navy' };
  const preset = KNOWLEDGE_COLOR_PRESETS.find((p) => p.id === item.theme)?.id || 'custom';
  return {
    preset,
    icon: item.icon || DEFAULT_KNOWLEDGE_COLORS.icon,
    bg_color: item.bg_color || DEFAULT_KNOWLEDGE_COLORS.bg_color,
    bg_color_end: item.bg_color_end || DEFAULT_KNOWLEDGE_COLORS.bg_color_end,
    text_color: item.text_color || DEFAULT_KNOWLEDGE_COLORS.text_color,
    subtext_color: item.subtext_color || DEFAULT_KNOWLEDGE_COLORS.subtext_color,
    icon_color: item.icon_color || DEFAULT_KNOWLEDGE_COLORS.icon_color,
    badge_bg: item.badge_bg || DEFAULT_KNOWLEDGE_COLORS.badge_bg,
    badge_text: item.badge_text || DEFAULT_KNOWLEDGE_COLORS.badge_text,
  };
}
