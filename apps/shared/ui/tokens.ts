/**
 * ZION canonical design tokens — TS mirror of tokens.css.
 * Keep in sync with ./tokens.css (F3b).
 */

/** Brand slot → default (rasta) rgb triplet. Slot names are historical. */
export const ZION_COLORS = {
  'zion-gold': '252 209 22',   // #fcd116 Rasta Gold
  'zion-purple': '228 30 43',  // #e41e2b Rasta Red
  'zion-cyan': '6 105 40',     // #066928 Rasta Green
  'zion-blue': '13 13 13',     // #0d0d0d Rasta Black
  bg: '0 0 0',
  fg: '255 255 255',
} as const;

export const RASTA_HEX = {
  red: '#e41e2b',
  gold: '#fcd116',
  green: '#066928',
  dark: '#1a1a1a',
  black: '#0d0d0d',
} as const;

export const ZION_THEMES = ['default', 'cyber', 'matrix-light'] as const;
export type ZionTheme = (typeof ZION_THEMES)[number];
