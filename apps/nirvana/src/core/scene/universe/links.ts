/**
 * Re-export design tokenů linek.
 *
 * Kanonické místo je `@/core/design/links` (jeden jazyk pro celou aplikaci,
 * ne jen vesmír). Tenhle soubor zůstává, aby staré importy `./links`
 * fungovaly — nový kód importuj z `@/core/design/links`.
 */
export {
  LINK_COLOR,
  LINK_WIDTH,
  LINK_RADIUS,
  LINK_OPACITY,
  LINK_ACTIVE_OPACITY,
  LINK_KINDS,
  orbitWidth,
  type LinkVariant,
} from '@/core/design/links';
