/**
 * FLOTILA Z MARKETU — lodě, které se dají hrát.
 *
 * Modely vznikly konverzí STL skládaček z `apps/MarketPlace/public/shop/models/`
 * (`scripts/ops/starfighter-glb.py`). Ten skript je normalizuje na **délku 1,0**
 * a srovná nos na +Z, takže tenhle soubor řeší už jen měřítko do scény,
 * letové vlastnosti a trysky.
 *
 * Proč data a ne kód: čísla se ladí podle pocitu z letu, ne podle geometrie.
 * Kdyby byla rozesetá po scéně, nedá se porovnat, čím se loď od lodi liší.
 */

export interface ShipSpec {
  id: string;
  /** Jméno z marketu (produkt se jmenuje stejně). */
  name: string;
  role: { cs: string; en: string };
  /** Herní GLB — `/models/fleet/<id>.glb`, délka trupu = 1,0. */
  glb: string;
  /**
   * Zjednodušená verze pro **cizí** lodě v místnosti (~30 % trojúhelníků).
   * Naměřeno: šest pilotů v plné kvalitě = 109 755 tris ze stropu 120 000,
   * takže na mobilu nezbývala rezerva. Vlastní loď zůstává plná.
   */
  glbLod: string;
  /** Délka trupu ve světových jednotkách (Nabukano má 2,0). */
  scale: number;
  /** Cestovní rychlost, jednotky/s. */
  maxSpeed: number;
  /** Jak rychle se rychlost blíží cíli (1/s). */
  accel: number;
  /** Zatáčení kolem svislé osy, rad/s. */
  turn: number;
  /** Klopení, rad/s. */
  pitch: number;
  /** Násobek rychlosti při boostu. */
  boost: number;
  /**
   * Trysky v modelovém prostoru (nos = +Z, délka trupu = 1).
   * Světlo do scény dodává `FleetScene` — v modelu jsou jen tmavé kryty.
   */
  engines: Array<[number, number, number]>;
}

export const SHIPS: ShipSpec[] = [
  {
    id: 'awing',
    name: 'A-Wing',
    role: { cs: 'průzkumník · nejrychlejší', en: 'scout · fastest' },
    glb: '/models/fleet/awing.glb',
    glbLod: '/models/fleet/lod/awing.glb',
    scale: 0.5,
    maxSpeed: 11,
    accel: 6,
    turn: 1.15,
    pitch: 1,
    boost: 1.75,
    engines: [
      [-0.09, 0, -0.4],
      [0.09, 0, -0.4],
    ],
  },
  {
    id: 'xwing',
    name: 'X-Wing',
    role: { cs: 'stíhač · vyvážený', en: 'fighter · balanced' },
    glb: '/models/fleet/xwing.glb',
    glbLod: '/models/fleet/lod/xwing.glb',
    scale: 0.5,
    maxSpeed: 9.5,
    accel: 5.5,
    turn: 0.95,
    pitch: 0.85,
    boost: 1.7,
    engines: [
      [-0.11, 0.02, -0.42],
      [-0.04, 0.02, -0.42],
      [0.04, 0.02, -0.42],
      [0.11, 0.02, -0.42],
    ],
  },
  {
    id: 'bwing',
    name: 'B-Wing',
    role: { cs: 'těžký · pomalý, ale pevný', en: 'heavy · slow but steady' },
    glb: '/models/fleet/bwing.glb',
    glbLod: '/models/fleet/lod/bwing.glb',
    scale: 0.52,
    maxSpeed: 7,
    accel: 3.8,
    turn: 0.62,
    pitch: 0.6,
    boost: 1.45,
    engines: [
      [0, -0.04, -0.4],
      [0, 0.06, -0.34],
    ],
  },
  {
    id: 'ikaruga',
    name: 'Ikaruga',
    role: { cs: 'prototyp · hravý', en: 'prototype · playful' },
    glb: '/models/fleet/ikaruga.glb',
    glbLod: '/models/fleet/lod/ikaruga.glb',
    scale: 0.5,
    maxSpeed: 10,
    accel: 6,
    turn: 1.05,
    pitch: 0.95,
    boost: 1.8,
    engines: [
      [0, 0, -0.44],
    ],
  },
  {
    id: 'snowspeeder',
    name: 'Snowspeeder',
    role: { cs: 'bitevník · obratný u země', en: 'gunship · nimble low' },
    glb: '/models/fleet/snowspeeder.glb',
    glbLod: '/models/fleet/lod/snowspeeder.glb',
    scale: 0.48,
    maxSpeed: 8,
    accel: 5,
    turn: 0.85,
    pitch: 0.9,
    boost: 1.5,
    engines: [
      [-0.13, 0, -0.4],
      [0.13, 0, -0.4],
    ],
  },
  {
    id: 'tiefighter',
    name: 'TIE Fighter',
    role: { cs: 'přesila · rychlý a křehký', en: 'interceptor · fast and thin' },
    glb: '/models/fleet/tiefighter.glb',
    glbLod: '/models/fleet/lod/tiefighter.glb',
    scale: 0.46,
    maxSpeed: 10.5,
    accel: 6.2,
    turn: 1.1,
    pitch: 1,
    boost: 1.65,
    engines: [[0, 0, -0.46]],
  },
  {
    id: 'falcon',
    name: 'Millennium Falcon',
    role: { cs: 'nákladní · pomalý, ale vydrží', en: 'freighter · slow but steady' },
    glb: '/models/fleet/falcon.glb',
    glbLod: '/models/fleet/lod/falcon.glb',
    scale: 0.62,
    maxSpeed: 9,
    accel: 4.5,
    turn: 0.75,
    pitch: 0.7,
    boost: 1.55,
    engines: [
      [-0.07, 0, -0.4],
      [0, 0, -0.42],
      [0.07, 0, -0.4],
    ],
  },
  {
    id: 'tieinterceptor',
    name: 'TIE Interceptor',
    role: { cs: 'eskorta · nejobratnější', en: 'escort · most agile' },
    glb: '/models/fleet/tieinterceptor.glb',
    glbLod: '/models/fleet/lod/tieinterceptor.glb',
    scale: 0.46,
    maxSpeed: 11.5,
    accel: 6.4,
    turn: 1.25,
    pitch: 1.05,
    boost: 1.8,
    engines: [[0, 0, -0.46]],
  },
];

export function shipById(id: string): ShipSpec {
  // `SHIPS[1]` je X-Wing; `!` kvůli `noUncheckedIndexedAccess` v nirvana-net
  return SHIPS.find((ship) => ship.id === id) ?? SHIPS[1]!;
}

/** Výchozí loď — X-Wing, protože je nejznámější a nejlépe se s ním startuje. */
export const DEFAULT_SHIP = 'xwing';
