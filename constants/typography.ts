import { TextStyle } from 'react-native';

// React Native uses the platform system font by default (Roboto on Android, SF Pro on iOS).
// No explicit fontFamily needed — undefined = system font on both platforms.
export const FontFamily = {
  system: undefined,
  mono: 'monospace', // 'monospace' resolves correctly on both Android and iOS
} as const;

// ─── Size scale (extracted from LifeOS styles.css) ───────────────────────────
export const FontSize = {
  xs: 9,        // mood labels
  s: 10.5,      // block meta, tiny labels
  sm: 11,       // section titles, panel labels, progress text
  base: 12,     // tab buttons, stat labels, block time
  md: 13,       // buttons, insight text, inputs, empty state
  body: 14,     // block names, general body
  lg: 17,       // day numbers
  xl: 20,       // metric card values
  xxl: 26,      // stat numbers
  xxxl: 29,     // header title
  hero: 46,     // timer display
} as const;

// ─── Weight scale ─────────────────────────────────────────────────────────────
// React Native accepts 100-900 as strings.
// LifeOS uses non-standard 750/850/950 → clamped to nearest RN value.
export const FontWeight = {
  regular: '400',
  bold: '700',
  semibold: '600',   // ~750 in LifeOS
  heavy: '800',      // 800 in LifeOS
  label: '800',      // 850 in LifeOS (labels, buttons, block names)
  black: '900',      // numbers, strong titles
} as const satisfies Record<string, TextStyle['fontWeight']>;

// ─── Preset text styles (ready to spread into StyleSheet) ────────────────────
export const TextStyles = {
  // Navigation / headers
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.black,
    letterSpacing: -0.7,
    lineHeight: 29,
  } satisfies TextStyle,

  // Section header labels (ALL CAPS)
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.65,
    lineHeight: 11,
  } satisfies TextStyle,

  // Card / block primary text
  blockName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.label,
    lineHeight: 17,
    letterSpacing: 0,
  } satisfies TextStyle,

  // Sub-labels under blocks
  blockTime: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.regular,
    lineHeight: 17,
  } satisfies TextStyle,

  // Stat numbers (26px, 900)
  statNum: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.black,
    letterSpacing: -0.8,
    lineHeight: 28,
  } satisfies TextStyle,

  // Stat labels below numbers
  statLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.regular,
    lineHeight: 17,
  } satisfies TextStyle,

  // Button labels
  button: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.label,
    lineHeight: 13,
    letterSpacing: 0,
  } satisfies TextStyle,

  // Tab bar buttons
  tabLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.heavy,
    lineHeight: 12,
  } satisfies TextStyle,

  // Input text and body copy
  body: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: 20,
  } satisfies TextStyle,

  // Insight / secondary body
  insight: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold, // '750' is non-standard in RN; clamped to '700'
    lineHeight: 19,
  } satisfies TextStyle,

  // Captions and tiny labels
  caption: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    lineHeight: 16,
  } satisfies TextStyle,

  // Metric card large value
  metricValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    lineHeight: 22,
    letterSpacing: 0,
  } satisfies TextStyle,

  // Hero timer
  timer: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.black,
    letterSpacing: -1.2,
    lineHeight: 46,
  } satisfies TextStyle,
} as const;
