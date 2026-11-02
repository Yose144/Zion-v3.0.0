'use client';

import type { SpellSlot } from './spells';

/**
 * MAPA KLÁVES PRO KOUZLA — jeden zdroj pravdy pro hru i pro UI.
 *
 * Proč to není Q/W/E/R: **`W` je pohyb vpřed** (WASD). Dokud bylo kouzlo
 * i pohyb na `KeyW`, chůze vpřed neustále frontovala kouzlo W — na desktopu
 * to znamenalo samočinné sesílání a na mobilu nešlo udělat tlačítko W,
 * protože by hrdinu zároveň poslalo dopředu.
 *
 * Slot se jmenuje pořád `W` (je to identita kouzla v sim/snapshotu/protokolu),
 * ale **klávesa je `F`**. UI musí zobrazovat `SPELL_LABEL`, ne `slot`.
 */
export const SPELL_KEY: Record<SpellSlot, string> = {
  Q: 'KeyQ',
  W: 'KeyF',
  E: 'KeyE',
  R: 'KeyR',
};

/** Co hráč uvidí na tlačítku / v HUD. */
export const SPELL_LABEL: Record<SpellSlot, string> = {
  Q: 'Q',
  W: 'F',
  E: 'E',
  R: 'R',
};

/** Opačná mapa pro `keydown` — kód klávesy → slot. */
export const SPELL_BY_KEY: Record<string, SpellSlot> = Object.fromEntries(
  (Object.entries(SPELL_KEY) as [SpellSlot, string][]).map(([slot, code]) => [code, slot]),
) as Record<string, SpellSlot>;
