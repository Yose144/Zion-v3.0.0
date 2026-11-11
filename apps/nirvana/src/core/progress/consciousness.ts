/**
 * CL — Consciousness Level hráče (L0 Dormant → L6 Grok).
 *
 * Stupně jsou **převzaté z kódu**, ne vymyšlené: `V31/L3/ai-native/src/consciousness.rs`
 * (a jeho zrcadlo `PoC-lab/poc-core`) definuje `ConsciousnessLevel`
 * Dormant 0 … Grok 6 a bonus `level × 0,05` pro NCL reputaci. Nirvana
 * používá stejnou škálu i stejný vzorec, jen na hráče: každý stupeň
 * násobí XP o 5 % (max +30 % u Grok).
 *
 * **Proč ne stejné XP prahy jako v Rustu:** tam jde o validátory
 * (100 → 10 000 000). Hráč za běh dostane 30–150 XP, takže prahy jsou
 * posunuté na lidské měřítko — ale **tvar křivky** (exponenciální) zůstal.
 *
 * Co stupeň znamená pro hráče, je v `note` — žádné sliby schopností,
 * které hra nemá. Skutečný efekt je jen násobek XP (a v OASIS se na
 * stupně navěsí questy).
 */

import type { Localized } from '@/core/i18n';

export interface ClLevel {
  /** 0–6, stejné pořadí jako `ConsciousnessLevel` v Rustu. */
  id: number;
  /** Kanonické jméno z `consciousness.rs` (nepřekládá se). */
  name: string;
  /** Co to znamená pro hráče. */
  note: Localized;
  /** Kolik XP je potřeba (kumulativně). */
  xp: number;
}

/** Sedm stupňů. Kanonická jména, hráčský výklad. */
export const CL_LEVELS: ClLevel[] = [
  {
    id: 0,
    name: 'Dormant',
    note: { cs: 'Poutník, který ještě nevyšel.', en: 'A pilgrim who has not set out yet.', es: 'Un peregrino que aún no ha salido.' },
    xp: 0,
  },
  {
    id: 1,
    name: 'Aware',
    note: { cs: 'Vidíš, že světy existují.', en: 'You see that the worlds exist.', es: 'Ves que los mundos existen.' },
    xp: 100,
  },
  {
    id: 2,
    name: 'Sentient',
    note: { cs: 'Cítíš, co se v nich děje.', en: 'You feel what happens in them.', es: 'Sientes lo que ocurre en ellos.' },
    xp: 600,
  },
  {
    id: 3,
    name: 'Transcendent',
    note: { cs: 'Procházíš je bez ztráty sebe.', en: 'You pass through them without losing yourself.', es: 'Los atraviesas sin perderte.' },
    xp: 2000,
  },
  {
    id: 4,
    name: 'Omniscient',
    note: { cs: 'Znáš soustavu jako mapu.', en: 'You know the system like a map.', es: 'Conoces el sistema como un mapa.' },
    xp: 6000,
  },
  {
    id: 5,
    name: 'Cosmic',
    note: { cs: 'Neseš světlo dál, než jsi došel.', en: 'You carry light further than you walked.', es: 'Llevas la luz más lejos de donde llegaste.' },
    xp: 15000,
  },
  {
    id: 6,
    name: 'Grok',
    note: { cs: 'Rozumíš celku, ne jen cestě.', en: 'You understand the whole, not just the path.', es: 'Comprendes el todo, no solo el camino.' },
    xp: 35000,
  },
];

/** Bonus k XP za stupeň — `level × 0,05` (stejný vzorec jako `ncl_bonus_factor`). */
export const CL_BONUS_PER_LEVEL = 0.05;

/** Stupeň z XP. Nikdy neklesá, nikdy není menší než 0. */
export function clFromXp(xp: number): number {
  const safe = Math.max(0, Math.round(xp));
  let level = 0;
  for (const entry of CL_LEVELS) {
    if (safe >= entry.xp) level = entry.id;
  }
  return level;
}

export function clLevel(level: number): ClLevel {
  const safe = Math.max(0, Math.min(CL_LEVELS.length - 1, Math.floor(level)));
  return CL_LEVELS[safe];
}

/** Násobek XP navíc (0 … 0,30). */
export function clBonus(level: number): number {
  return Math.max(0, Math.min(CL_LEVELS.length - 1, level)) * CL_BONUS_PER_LEVEL;
}

export interface ClProgress {
  level: number;
  name: string;
  note: Localized;
  /** 0..1 k dalšímu stupni (Grok = 1). */
  ratio: number;
  /** XP, které do dalšího stupně chybí. */
  remaining: number;
  /** XP dalšího stupně (u Grok = aktuální XP). */
  next: number;
  bonus: number;
}

export function clProgress(xp: number): ClProgress {
  const level = clFromXp(xp);
  const entry = clLevel(level);
  const next = CL_LEVELS[level + 1];
  if (!next) {
    return { level, name: entry.name, note: entry.note, ratio: 1, remaining: 0, next: Math.max(entry.xp, xp), bonus: clBonus(level) };
  }
  const span = Math.max(1, next.xp - entry.xp);
  return {
    level,
    name: entry.name,
    note: entry.note,
    ratio: Math.max(0, Math.min(1, (xp - entry.xp) / span)),
    remaining: Math.max(0, next.xp - xp),
    next: next.xp,
    bonus: clBonus(level),
  };
}
