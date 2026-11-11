/**
 * NEPTUN — HLUBINA. Data světa, ne kód hry.
 *
 * Planeta je plynný obr s nejrychlejšími větry v soustavě (až 2 100 km/h),
 * takže „sestup" není do vody, ale **atmosférou**: horní metanový opar,
 * amoniakové krystaly, vodní clona, iontová tma a tichá hlubina. Čísla
 * (hloubky, síla větru, barvy) bydlí tady, aby se nerozešla mezi simulací,
 * scénou, HUD a testy.
 *
 * Světla a víry jsou **statické a deterministické**. Kdyby se losovaly při
 * každém načtení, dva lidé (nebo test a hráč) by neletěli stejnou mapou.
 */

import type { Localized } from '@/core/i18n';

/** Dno, kam se dá doletět. Pod ním už hra nemá co nabídnout. */
export const DEPTH_BOTTOM = 900;
/** Šířka „uličky", ve které se dá klesat. Mimo ni tlak ohne plášť. */
export const LANE = 26;

/**
 * Pět vrstev atmosféry. `wind` je maximální síla v m/s, `wave` vlnová délka
 * (čím menší, tím rychleji se vítr stáčí), `drain` energie lucerny na metr.
 */
export interface Deck {
  id: string;
  from: number;
  to: number;
  name: Localized;
  note: Localized;
  /** Barva mlhy v téhle hloubce. */
  tint: string;
  wind: number;
  wave: number;
  drain: number;
}

export const DECKS: Deck[] = [
  {
    id: 'haze',
    from: 0,
    to: 170,
    name: { cs: 'Metanový opar', en: 'Methane haze', es: 'Bruma de metano' },
    note: {
      cs: 'Modrý závoj, který Neptunovi dává barvu. Světlo ještě existuje.',
      en: 'The blue veil that gives Neptune its colour. Light still exists here.',
      es: 'El velo azul que da color a Neptuno. Aquí todavía hay luz.',
    },
    tint: '#2f6bd8',
    wind: 4.5,
    wave: 34,
    drain: 0.1,
  },
  {
    id: 'ammonia',
    from: 170,
    to: 360,
    name: { cs: 'Amoniakové krystaly', en: 'Ammonia crystals', es: 'Cristales de amoníaco' },
    note: {
      cs: 'Ledové jehly letí vodorovně. Kdo se nechá unést, narazí na stěnu proudu.',
      en: 'Ice needles fly sideways. Whoever stops steering hits the wall of the jet.',
      es: 'Agujas de hielo vuelan de lado. Quien deja de corregir choca con la pared del chorro.',
    },
    tint: '#2a5ac6',
    wind: 6.5,
    wave: 28,
    drain: 0.115,
  },
  {
    id: 'water',
    from: 360,
    to: 540,
    name: { cs: 'Vodní clona', en: 'Water veil', es: 'Velo de agua' },
    note: {
      cs: 'Vrstva, kde se rodí blesky. Hučení větru je tu nejhlasitější — a pak ustane.',
      en: 'The layer where lightning is born. The wind roars loudest here — and then stops.',
      es: 'La capa donde nace el relámpago. El viento ruge más fuerte aquí — y luego calla.',
    },
    tint: '#23449f',
    wind: 8,
    wave: 24,
    drain: 0.13,
  },
  {
    id: 'ion',
    from: 540,
    to: 720,
    name: { cs: 'Iontová tma', en: 'Ion dark', es: 'Oscuridad iónica' },
    note: {
      cs: 'Světlo lucerny už nestačí na stěny, jen na vlastní ruce. Víry tu mají jméno.',
      en: 'Lantern light no longer reaches the walls, only your own hands. The vortices have names here.',
      es: 'La luz del farol ya no alcanza las paredes, solo tus manos. Aquí los vórtices tienen nombre.',
    },
    tint: '#182f7a',
    wind: 9.5,
    wave: 20,
    drain: 0.145,
  },
  {
    id: 'abyss',
    from: 720,
    to: DEPTH_BOTTOM,
    name: { cs: 'Tichá hlubina', en: 'The silent deep', es: 'La profundidad silenciosa' },
    note: {
      cs: 'Nejrychlejší větry soustavy náhle nejsou slyšet. Ticho ale není totéž co mír.',
      en: 'The fastest winds in the system are suddenly inaudible. Silence is not the same as peace.',
      es: 'Los vientos más rápidos del sistema callan de golpe. El silencio no es lo mismo que la paz.',
    },
    tint: '#0d1740',
    wind: 10.5,
    wave: 18,
    drain: 0.16,
  },
];

/** Vrstva podle hloubky (0 = opar, 4 = hlubina). */
export function deckIndexAt(depth: number): number {
  const safe = Math.max(0, Math.min(DEPTH_BOTTOM, depth));
  for (let i = 0; i < DECKS.length; i += 1) {
    if (safe < DECKS[i].to) return i;
  }
  return DECKS.length - 1;
}

export function deckAt(depth: number): Deck {
  return DECKS[deckIndexAt(depth)];
}

/**
 * Vítr v dané hloubce: dvě sinusoidy (základ + vyšší harmonická), aby se
 * stáčel nepravidelně. Vrací **vodorovnou rychlost v m/s**, ne zrychlení —
 * simulace ji bere jako cílovou odchylku, proti které hráč kormidluje.
 */
export function windAt(depth: number): number {
  const deck = deckAt(depth);
  const phase = (depth - deck.from) / deck.wave;
  const wave = Math.sin(phase) * 0.74 + Math.sin(phase * 2.7 + 1.1) * 0.26;
  return deck.wind * wave;
}

/**
 * Spotřeba lucerny **za metr** sestupu (ne za sekundu).
 *
 * Per-sekundová spotřeba dělala z `W` jednoznačně nejlepší volbu — kdo letí
 * rychleji, je na dně dřív a zaplatí méně. Za metr je lucerna rozpočet na
 * **vzdálenost**: rychlost rozhoduje jen o riziku (víry a stěna), ne o ceně.
 */
export function drainAt(depth: number): number {
  return deckAt(depth).drain;
}

/** Sbíratelné světlo — vrchol v hloubce, vodorovná poloha v uličce. */
export interface Mote {
  id: number;
  depth: number;
  x: number;
}

/**
 * Patnáct světel. Rozmístění je schválně „do stran" — kdo je chce všechny,
 * musí křižovat proud, takže lucerna sice vydrží, ale cesta je delší.
 * V poslední třetině jsou blíž sobě, protože tam už je tma.
 */
export const MOTES: Mote[] = [
  { id: 1, depth: 70, x: -6 },
  { id: 2, depth: 120, x: 5 },
  { id: 3, depth: 175, x: 13 },
  { id: 4, depth: 230, x: -10 },
  { id: 5, depth: 285, x: -18 },
  { id: 6, depth: 340, x: 2 },
  { id: 7, depth: 395, x: 16 },
  { id: 8, depth: 450, x: 9 },
  { id: 9, depth: 505, x: -8 },
  { id: 10, depth: 560, x: -20 },
  { id: 11, depth: 615, x: -4 },
  { id: 12, depth: 670, x: 14 },
  { id: 13, depth: 725, x: 20 },
  { id: 14, depth: 780, x: -12 },
  { id: 15, depth: 840, x: 0 },
];

/**
 * Víry. Vypadají jako tmavé prstence, táhnou ke středu a berou lucerně
 * energii; plášť poškodí jen okraj. `spin` je směr otáčení pro scénu.
 */
export interface Vortex {
  id: number;
  depth: number;
  x: number;
  radius: number;
  spin: number;
}

export const VORTICES: Vortex[] = [
  { id: 1, depth: 150, x: -16, radius: 6.5, spin: 1 },
  { id: 2, depth: 300, x: 14, radius: 6, spin: -1 },
  { id: 3, depth: 470, x: -2, radius: 7, spin: 1 },
  { id: 4, depth: 640, x: 6, radius: 6.5, spin: -1 },
  { id: 5, depth: 810, x: -18, radius: 7, spin: 1 },
];

// ── čísla hry (jedno místo, odkud je čte simulace i HUD) ──────────────

export const START_ENERGY = 100;
export const MAX_ENERGY = 140;
export const START_HULL = 100;

/** Kolik lucerna dostane z jednoho světla. */
export const MOTE_ENERGY = 18;
/** Poloměr sebrání (metry; hloubka i šířka). */
export const MOTE_RADIUS = 6.5;

export const VORTEX_ENERGY = 17;
export const VORTEX_HULL = 9;

/** Tlak o stěnu proudu (za sekundu, když jsi mimo uličku). */
export const WALL_HULL = 15;

export const SINK_BASE = 11;
export const SINK_DIVE = 7;
export const SINK_BRAKE = 6;
export const SINK_MIN = 2.5;
/** Jak rychle se klesání dorovnává (1/s). */
export const SINK_RESPONSE = 8;

export const STEER_MAX = 15;
export const STEER_RESPONSE = 3.4;
export const VX_MAX = 19;

/** Skóre: metr hloubky, světlo, a bonus za dno. */
export const MOTE_SCORE = 90;
export const BOTTOM_BONUS = 500;
