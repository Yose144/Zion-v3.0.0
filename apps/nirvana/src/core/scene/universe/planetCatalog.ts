/**
 * Katalog planet — jediný zdroj pravdy o dráhách, velikostech a vstupech.
 *
 * Vznikl vytažením z `SolarSystem.tsx`, aby `LinkEngine` (kamera) nemusel
 * importovat renderer a nevznikl kruhový import. Scéna i engine teď čtou
 * stejná čísla: když se změní `orbitRadius` nebo `speed`, kamera doletí tam,
 * kde planeta skutečně je.
 */

export interface PlanetDef {
  id: string;
  name: string;
  tex: string;
  /** Vzdálenost ve astronomických jednotkách (1 AU = dráha Země). */
  au: number;
  size: number;
  /** Úhlová rychlost oběhu rad/s. */
  speed: number;
  /** Rotace rad/s. */
  spin: number;
  /** Fallback + lehký nádech. */
  tint: string;
  ring?: boolean;
  /** Axiální náklon v radiánech (Uranus ~98°, Venuše retrográdní). */
  tiltZ?: number;
  /** Interaktivní planeta = vstup do hry (`/mars`, `/venus`, `/mercury`, `/park`). */
  game?: 'mars' | 'venus' | 'park' | 'mercury';
  /** Co se stane po kliknutí — text na chipu. */
  cta?: { cs: string; en: string };
}

/**
 * Komprese drah: lineární AU by dalo Neptun 903 jednotek daleko, kde už není
 * vidět nic než prázdno. `r = 30 · AU^0.55` drží pořadí i poměry „blíž = těsněji“,
 * ale celá soustava se vejde do ~200 jednotek — tedy do záběru, kde je vidět
 * víc planet najednou. Země vychází přesně na 30 (EARTH_ORBIT_R).
 */
export const ORBIT_SCALE = 30;
export const ORBIT_EXP = 0.55;
export function orbitRadius(au: number): number {
  return ORBIT_SCALE * Math.pow(au, ORBIT_EXP);
}

/**
 * Dráhy: reálné AU poměry komprimované výše. Rychlosti: Kepler ∝ r^-1.5,
 * Země = 0,02. Velikosti: reálné poměry (Jupiter 11,2× Země) × 0,45.
 * tiltZ: skutečný axiální sklon v radiánech.
 */
export const PLANETS: PlanetDef[] = [
  { id: 'mercury', name: 'Merkur', tex: 'mercury', au: 0.387, size: 0.62, speed: 0.082, spin: 0.006, tint: '#b0a89c', tiltZ: 0.001, game: 'mercury', cta: { cs: 'souboj →', en: 'duel →' } },
  {
    id: 'venus',
    name: 'Venuše',
    tex: 'venus_atmosphere',
    au: 0.723,
    size: 0.92,
    speed: 0.033,
    spin: -0.002,
    tint: '#e8c98a',
    tiltZ: 3.09,
    game: 'venus',
    cta: { cs: 'okruh →', en: 'circuit →' },
  },
  {
    id: 'mars',
    name: 'Mars',
    tex: 'mars',
    au: 1.524,
    size: 0.74,
    speed: 0.011,
    spin: 0.024,
    tint: '#c1622f',
    tiltZ: 0.44,
    game: 'mars',
    cta: { cs: 'aréna →', en: 'arena →' },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    tex: 'jupiter',
    au: 5.203,
    size: 3.6,
    speed: 0.0017,
    spin: 0.06,
    tint: '#d8b58c',
    tiltZ: 0.05,
    game: 'park',
    cta: { cs: 'pouť →', en: 'fair →' },
  },
  { id: 'saturn', name: 'Saturn', tex: 'saturn', au: 9.537, size: 3.0, speed: 0.00067, spin: 0.055, tint: '#e3cf9f', ring: true, tiltZ: 0.47 },
  { id: 'uranus', name: 'Uran', tex: 'uranus', au: 19.19, size: 1.5, speed: 0.00024, spin: -0.04, tint: '#9fd8dc', tiltZ: 1.71 },
  { id: 'neptune', name: 'Neptun', tex: 'neptune', au: 30.07, size: 1.45, speed: 0.00012, spin: 0.04, tint: '#4d6fd1', tiltZ: 0.49 },
];

export const JUPITER = PLANETS[3]!;

/** Index planety v katalogu — používá ho `planetPosition` i fokus. */
export function planetIndex(id: string): number {
  return PLANETS.findIndex((p) => p.id === id);
}
