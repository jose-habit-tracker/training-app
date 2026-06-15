// Spacing tokens extracted from LifeOS (habit-tracker/styles.css)
// Values are contextual, not a rigid scale — mirrored exactly.

export const Spacing = {
  // Base atoms
  xxs: 3,
  xs: 4,
  s: 6,
  sm: 8,
  md: 10,
  base: 12,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32,
  section: 48,    // header top padding

  // Semantic aliases
  cardPadding: 16,        // panel / card interior
  statCardPadding: 15,    // stat card interior
  sectionHorizontal: 24, // lateral margin for panels/items
  itemMarginTop: 8,       // between list items
  panelMarginTop: 18,     // between panels/cards
  blockPaddingH: 9,       // timeline block horizontal
  blockPaddingB: 16,      // timeline block bottom
  inputPaddingV: 11,      // input vertical
  inputPaddingH: 12,      // input horizontal
  buttonPaddingV: 10,     // button vertical
  buttonPaddingH: 12,     // button horizontal
  miniBtnPaddingV: 8,     // mini-button vertical
  miniBtnPaddingH: 12,    // mini-button horizontal
  tabBarPadding: 6,       // tab bar inner padding

  // Gap scale
  gapXxs: 4,   // very tight (action icons)
  gapXs: 6,    // form fields, subtask rows
  gapSm: 8,    // secondary grids
  gapMd: 10,   // primary grids (grid-2, grid-3)
  gapLg: 12,   // large gap between sections
  gapXl: 18,   // hero / header sections
} as const;

// Border radius tokens (from LifeOS)
export const Radius = {
  xs: 9,        // block emoji bg
  sm: 10,       // mood btn, subtask row
  md: 13,       // inputs, buttons, timeline blocks
  lg: 14,       // more cards, day buttons
  xl: 16,       // quick actions, metric cards, form cards
  card: 18,     // panels, cards, stat cards
  modal: 18,    // modals / auth cards
  sheet: 24,    // time picker sheet (top)
  pill: 999,    // pills, mini-buttons, tab pills
  circle: 9999, // perfect circles (delete btn)
} as const;
