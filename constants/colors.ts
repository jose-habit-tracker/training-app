
// ─── Light theme ─────────────────────────────────────────────────────────────
const light = {
  background: '#f2f2f7',
  card: '#ffffff',
  accent: '#30d158',
  accentSoft: '#e8faf0',
  danger: '#ff3b30',
  dangerSoft: '#ffecea',
  text: '#1c1c1e',
  text2: '#3a3a3c',
  text3: '#8e8e93',
  border: 'rgba(0,0,0,0.08)',
  glassBg: 'rgba(255,255,255,0.55)',
  glassBorder: 'rgba(255,255,255,0.55)',
  shadow: 'rgba(0,0,0,0.045)',
  ripple: 'rgba(0,0,0,0.12)',
  // Category colors (same across themes)
  catTrabajo: '#4A6FA5',
  catSalud: '#4E8C6A',
  catEstudio: '#7258A0',
  catComida: '#9A7240',
  catPersonal: '#A05860',
  // Training-specific accent
  orange: '#ff9f0a',
  blue: '#0a84ff',
  purple: '#bf5af2',
  teal: '#5ac8fa',
  yellow: '#ffd60a',
} as const;

// ─── Dark theme ───────────────────────────────────────────────────────────────
const dark = {
  background: '#0c0d10',
  card: '#1c1d21',
  accent: '#30d158',
  accentSoft: 'rgba(48,209,88,0.18)',
  danger: '#ff453a',
  dangerSoft: 'rgba(255,69,58,0.15)',
  text: '#f5f5f7',
  text2: '#d1d1d6',
  text3: '#8e8e93',
  border: 'rgba(255,255,255,0.10)',
  glassBg: 'rgba(28,29,33,0.55)',
  glassBorder: 'rgba(255,255,255,0.10)',
  shadow: 'rgba(0,0,0,0.24)',
  ripple: 'rgba(255,255,255,0.18)',
  catTrabajo: '#4A6FA5',
  catSalud: '#4E8C6A',
  catEstudio: '#7258A0',
  catComida: '#9A7240',
  catPersonal: '#A05860',
  orange: '#ff9f0a',
  blue: '#0a84ff',
  purple: '#bf5af2',
  teal: '#5ac8fa',
  yellow: '#ffd60a',
} as const;

// ─── Nude theme ───────────────────────────────────────────────────────────────
const nude = {
  background: '#f6efe3',
  card: '#fdf9f2',
  accent: '#b97a55',
  accentSoft: '#eadfce',
  danger: '#c0392b',
  dangerSoft: 'rgba(192,57,43,0.12)',
  text: '#3d342a',
  text2: '#5c4f40',
  text3: '#9a8c78',
  border: 'rgba(90,70,40,0.10)',
  glassBg: 'rgba(253,249,242,0.60)',
  glassBorder: 'rgba(90,70,40,0.10)',
  shadow: 'rgba(90,70,40,0.08)',
  ripple: 'rgba(90,70,40,0.12)',
  catTrabajo: '#4A6FA5',
  catSalud: '#4E8C6A',
  catEstudio: '#7258A0',
  catComida: '#9A7240',
  catPersonal: '#A05860',
  orange: '#ff9f0a',
  blue: '#0a84ff',
  purple: '#bf5af2',
  teal: '#5ac8fa',
  yellow: '#ffd60a',
} as const;

// Use a structural interface so light/dark don't conflict on literal string types
export interface ThemeColors {
  background: string;
  card: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  text: string;
  text2: string;
  text3: string;
  border: string;
  glassBg: string;
  glassBorder: string;
  shadow: string;
  ripple: string;
  catTrabajo: string;
  catSalud: string;
  catEstudio: string;
  catComida: string;
  catPersonal: string;
  orange: string;
  blue: string;
  purple: string;
  teal: string;
  yellow: string;
}

export type ThemeName = 'light' | 'dark' | 'nude';

export const themes = { light, dark, nude } as const;

export function getColors(name: ThemeName): ThemeColors {
  return themes[name];
}

// Elevation tokens — Android-first, cross-platform.
// elevation drives Android shadows; on iOS depth is handled by glassBg + border.
export const Shadows = {
  card:      { elevation: 8  },
  cardHover: { elevation: 12 },
  button:    { elevation: 6  },
  soft:      { elevation: 3  },
} as const;

// Session type colors (consistent regardless of theme)
export const SessionColors: Record<string, string> = {
  running_easy: '#30d158',
  running_threshold: '#0a84ff',
  running_long: '#5ac8fa',
  running_intervals: '#ff453a',
  swimming: '#64d2ff',
  gym_strength: '#bf5af2',
  gym_hyrox: '#ff9f0a',
  hyrox_simulation: '#ff6b35',
  rest: '#48484a',
  active_recovery: '#32d74b',
};
