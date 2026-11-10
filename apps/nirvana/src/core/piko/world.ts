/**
 * TE PĪKO ORA — laguna Raiatea, jeden svět pro dvě vodní hry.
 *
 * Tenhle soubor drží **data a matematiku**, ne vykreslování: kde je břeh, kudy
 * vede kurz kánoe, jak vysoko je hladina a jaký je tvar vlny. Scéna i simulace
 * čtou odsud, takže se nemůže stát, že by vlna ve hře byla jinde než vlna
 * na obrazovce (stejná past jako u dráhy Venuše a planety Jupiter).
 *
 * Souřadnice: `x` = východ–západ, `z` = moře (–) a břeh (+). Hráč stojí
 * na pláži u `z ≈ 16` a dívá se na otevřenou lagunu k útesu.
 */

export type PikoMode = 'canoe' | 'surf';

export interface PikoPoint {
  x: number;
  z: number;
}

/** Meze laguny — za nimi je útes (zeď) a pláž (mělčina). */
export const LAGOON = {
  minX: -72,
  maxX: 72,
  /** Hrana útesu; dál je otevřený oceán. */
  reefZ: -84,
  /** Počátek pláže — dál už je souš. */
  beachZ: 24,
} as const;

/** Kde stojí hráč na začátku (na vodě kousek od břehu). */
export const START: PikoPoint = { x: 0, z: 16 };

/**
 * Kurz kánoe — šest bójí, které se objíždějí v pořadí.
 *
 * Není to okruh kolem dokola: cesta jde od břehu k útesu, podél něj a zpátky.
 * Hráč se tak musí otáčet, ne jen držet plyn — otočka je půlka hry.
 */
export const PIKO_GATES: PikoPoint[] = [
  { x: -16, z: 2 },
  { x: -34, z: -26 },
  { x: -10, z: -56 },
  { x: 26, z: -52 },
  { x: 40, z: -14 },
  { x: 12, z: 12 },
];

/** Poloměr, ve kterém se bóje počítá jako projetá (m). */
export const GATE_RADIUS = 7;

/** Surf zóna — vlny se lámou tady, ne u břehu. */
export const SURF_ZONE = { from: -60, to: 18 } as const;

/**
 * Výška hladiny v daném bodě a čase.
 *
 * Stejnou funkci používá shader (přes uniformy), houpačka kánoe i surfař.
 * Kdyby si scéna počítala vlastní vlny, loď by se vznášela proti vodě.
 */
export function waveHeightAt(x: number, z: number, t: number): number {
  const span = Math.max(1, LAGOON.beachZ - LAGOON.reefZ);
  const open = Math.min(1, Math.max(0, (LAGOON.beachZ - z) / span));
  const amp = 0.1 + open * 0.26;
  return (
    Math.sin(x * 0.11 + t * 1.15) * amp +
    Math.sin(z * 0.17 - t * 0.9) * amp * 0.62 +
    Math.sin((x + z) * 0.06 + t * 0.55) * amp * 0.34
  );
}

/**
 * Kam až dojede vlna, kterou hráč jede (0..1).
 *
 * Simulace počítá ujeté metry, scéna z nich potřebuje **světovou polohu**
 * hřebene. Převod je jedna funkce, ne dvě kopie — jinak by se vlna a surfař
 * rozešli přesně ve chvíli, kdy se hra láme do finiše.
 */
export function waveProgressZ(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return SURF_ZONE.from + (SURF_ZONE.to - SURF_ZONE.from) * clamped;
}

/** Barvy světa — scéna i CSS je mají z jednoho místa. */
export const PIKO_COLORS = {
  deep: '#0d4f63',
  shallow: '#2fb8ad',
  foam: '#eaf9f5',
  sand: '#e8d3a4',
  wetSand: '#b99f74',
  thatch: '#bca477',
  wood: '#6e5233',
  palm: '#3f7a3a',
  mountain: '#315243',
  sun: '#ffd9a0',
  sky: '#f0b98a',
} as const;

/** Druhá hra používá stejnou tabuli — skóre obou módů je srovnatelné. */
export const PIKO_MAX_SCORE = 1200;
