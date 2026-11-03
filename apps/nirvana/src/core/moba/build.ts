/**
 * DOPORUČENÝ BUILD — adaptivní rychlý nákup.
 *
 * V Mobile Legends se nabízí „next item" podle role i podle toho, jak zápas
 * stojí. Tady je to čistá funkce (žádný stav, žádný React), takže se dá
 * testovat a nemůže se rozejít s UI.
 */

import type { ItemId, TalentRole } from './sim';

/** Pořadí podle archetypu, když je zápas vyrovnaný. */
const BASE: Record<TalentRole, ItemId[]> = {
  aggressive: ['blade', 'boots', 'blink', 'aegis', 'lotus', 'crown'],
  support: ['aegis', 'barrier', 'boots', 'lotus', 'crown', 'blade'],
  control: ['boots', 'barrier', 'blade', 'lotus', 'crown', 'aegis'],
};

/** Když prohráváš, kup přežití dřív než damage. */
const DEFENSIVE: ItemId[] = ['aegis', 'cloak', 'boots', 'lotus', 'barrier', 'blade'];

/** Když vedeš, tlač damage a zavírej zápas. */
const OFFENSIVE: ItemId[] = ['blade', 'boots', 'crown', 'warblade', 'blink', 'aegis'];

export type Standing = 'ahead' | 'even' | 'behind';

/** `standing` = rozdíl zabití týmu (kladný = vedeš). */
export function standingFrom(kills: { ally: number; enemy: number }): Standing {
  const diff = kills.ally - kills.enemy;
  if (diff >= 3) return 'ahead';
  if (diff <= -3) return 'behind';
  return 'even';
}

/**
 * Další item, který hráč ještě nemá. `owned` jsou id v inventáři,
 * `role` archetyp z kouzel.
 */
export function recommendNextItem(
  role: TalentRole,
  owned: readonly ItemId[],
  standing: Standing = 'even',
): ItemId | null {
  const order = standing === 'behind' ? DEFENSIVE : standing === 'ahead' ? OFFENSIVE : BASE[role];
  for (const id of order) {
    if (!owned.includes(id)) return id;
  }
  // fallback: cokoli, co ještě nemá
  for (const id of BASE[role]) {
    if (!owned.includes(id)) return id;
  }
  return null;
}
