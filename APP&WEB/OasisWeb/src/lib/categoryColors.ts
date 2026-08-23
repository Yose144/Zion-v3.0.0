import type { WorldCategory } from '../domain/types/world';

/**
 * Shared OASIS world-category color palette.
 *
 * The rasta triad (green/gold/red) is intentionally reserved for the central
 * TreeOfLife. Every other world, node and galactic effect uses this diverse,
 * non-rasta cosmic palette so the universe reads as realistic and colourful.
 */
export const CATEGORY_COLORS: Record<WorldCategory, string> = {
  'star-system': '#f97316', // vivid orange (stellar)
  planet: '#3b82f6',        // royal blue (planet)
  sector: '#8b5cf6',        // violet (sector)
  world: '#06b6d4',         // cyan (world)
  dimension: '#ec4899',     // pink (dimension)
};

export const CATEGORY_RGB: Record<WorldCategory, string> = {
  'star-system': '249, 115, 22',
  planet: '59, 130, 246',
  sector: '139, 92, 246',
  world: '6, 182, 212',
  dimension: '236, 72, 153',
};

export const CATEGORY_LABELS: Record<WorldCategory, string> = {
  'star-system': 'Star System',
  planet: 'Planet',
  sector: 'Sector',
  world: 'World',
  dimension: 'Dimension',
};

/** Galactic layer accent colours (distinct from the category palette). */
export const LAYER_COLORS: Record<number, { color: string; rgb: string }> = {
  1: { color: '#f59e0b', rgb: '245, 158, 11' }, // Core Galaxy
  2: { color: '#3b82f6', rgb: '59, 130, 246' }, // Inner Rim
  3: { color: '#06b6d4', rgb: '6, 182, 212' },  // Temporal
  4: { color: '#a855f7', rgb: '168, 85, 247' }, // Mythic
  5: { color: '#f472b6', rgb: '244, 114, 182' }, // Creative
};

/** The TreeOfLife-only rasta triad. Kept in one place for clarity. */
export const RASTA = {
  green: '#078930',
  gold: '#fcd116',
  red: '#e41e2b',
} as const;
