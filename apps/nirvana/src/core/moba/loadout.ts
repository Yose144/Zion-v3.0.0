/**
 * Poslední volba hrdiny, aspektu a battle spellu.
 *
 * Lobby rychlou hru skládá bez formuláře na `/earth`. Bez tohohle by
 * `join` odešel bez hrdiny a server posadil nulu, i když si ho člověk
 * na Prvním světě vybral.
 */

import type { BattleSpellId } from './sim';
import type { AspectId } from './spells';

const KEY = 'nirvana.moba.loadout';

export interface MobaLoadout {
  heroId: number;
  aspect: AspectId;
  battleSpell: BattleSpellId;
}

const DEFAULT_LOADOUT: MobaLoadout = {
  heroId: 0,
  aspect: 'a',
  battleSpell: 'flicker',
};

function isSpell(value: unknown): value is BattleSpellId {
  return value === 'flicker' || value === 'heal' || value === 'purify';
}

export function loadMobaLoadout(): MobaLoadout {
  if (typeof window === 'undefined') return DEFAULT_LOADOUT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LOADOUT;
    const data = JSON.parse(raw) as Partial<MobaLoadout>;
    const heroId = typeof data.heroId === 'number' && Number.isFinite(data.heroId) ? data.heroId : 0;
    return {
      heroId: Math.max(0, Math.min(202, Math.round(heroId))),
      aspect: data.aspect === 'b' ? 'b' : 'a',
      battleSpell: isSpell(data.battleSpell) ? data.battleSpell : 'flicker',
    };
  } catch {
    return DEFAULT_LOADOUT;
  }
}

export function saveMobaLoadout(next: MobaLoadout): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // privátní režim bez storage — rychlá hra použije výchozího hrdinu
  }
}
