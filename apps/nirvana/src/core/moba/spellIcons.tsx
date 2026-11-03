'use client';

/**
 * IKONY KOUZEL — jeden glyf pro každou školu.
 *
 * Proč vektorové glyfy a ne emoji: emoji vypadají na každém systému jinak,
 * nejdou obarvit barvou postavy a v HUD tvoří nekonzistentní řadu. Tohle je
 * jeden `<svg>` s `currentColor` — barvu dodá kouzlo.
 *
 * Školy jsou v `spells.ts`; když se přidá dvanáctá, doplní se sem jeden řádek
 * a TypeScript si vynutí i zbytek (`Record<SpellSchool, ...>`).
 */

import type { SpellSchool } from './spells';

const PATHS: Record<SpellSchool, string[]> = {
  // štít
  ward: ['M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z', 'M9 12l2 2 4-4'],
  // plamen
  fire: ['M12 3c3 3 5 5.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-5 0 1.5.5 2.5 1.5 3 .5-2 1-4 1.5-7z'],
  // šíp
  arrow: ['M4 20L20 4', 'M20 4h-6', 'M20 4v6'],
  // meč
  blade: ['M13 4l7 7-9 9-4-4 6-12z', 'M7 15l-3 3', 'M11 5l8 8'],
  // hvězda
  cosmic: ['M12 3l2 5.5 5.5 2-5.5 2L12 19l-2-6.5-5.5-2 5.5-2L12 3z'],
  // oko
  mind: ['M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  // list
  nature: ['M20 4C10 4 4 10 4 20c10 0 16-6 16-16z', 'M8 16c2-4 5-6.5 8-7.5'],
  // blesk
  storm: ['M13 2L5 13h5l-1 9 8-11h-5l1-9z'],
  // nota
  song: ['M9 18V6l10-2v12', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  // srpek
  shadow: ['M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z'],
  // tlapa
  beast: [
    'M6 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M12 20c-4 0-6-3-6-6 0-2 3-4 6-4s6 2 6 4c0 3-2 6-6 6z',
  ],
};

export function SpellIcon({
  school,
  color,
  size = 20,
}: {
  school: SpellSchool;
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
      {PATHS[school].map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  );
}
