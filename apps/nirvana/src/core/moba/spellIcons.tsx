'use client';

/**
 * IKONY KOUZEL — glyf podle **slotu** (Q/W/E/R), barva podle kouzla.
 *
 * Proč ne podle školy: všechny čtyři kouzla jednoho hrdiny mají stejnou školu,
 * takže by HUD ukazoval čtyři stejné ikony. Slot nese roli — Q projektil,
 * W obrana, E plošný zásah, R ultimátka — a to hráč potřebuje rozlišit.
 *
 * Proč vektorové glyfy a ne emoji: emoji vypadají na každém systému jinak
 * a nejdou obarvit barvou postavy. Tohle je jeden `<svg>` s `currentColor`.
 */

import type { SpellSlot } from './spells';

const PATHS: Record<SpellSlot, string[]> = {
  // Q — projektil (šipka)
  Q: ['M4 20L20 4', 'M20 4h-6', 'M20 4v6'],
  // W — obrana / buff (štít)
  W: ['M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z', 'M9 12l2 2 4-4'],
  // E — plošný zásah (soustředné kruhy)
  E: ['M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  // R — ultimátka (hvězda)
  R: ['M12 2l2.4 6.1 6.6 2.1-6.6 2.2L12 22l-2.4-9.6L3 10.2l6.6-2.1L12 2z'],
};

export function SpellIcon({
  slot,
  color,
  size = 20,
}: {
  slot: SpellSlot;
  color: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="moba-spell-icon"
    >
      {PATHS[slot].map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  );
}
