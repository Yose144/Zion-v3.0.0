import { Vec3 } from '../math/vec3';

/**
 * Engine-agnostic world/sector/dimension type.
 * Keep this file free of React, Three.js, DOM, or browser APIs.
 */

export type WorldLayer = 1 | 2 | 3 | 4 | 5;

export type WorldCategory =
  | 'star-system'
  | 'planet'
  | 'sector'
  | 'dimension'
  | 'world';

export interface World {
  /** UPPER_SNAKE_CASE id — maps to MD filename. */
  id: string;

  /** Localized display name. */
  name: string;

  /** Classification for the UI and galaxy generator. */
  category: WorldCategory;

  /** OASIS narrative layer (1–5). */
  layer: WorldLayer;

  /** Free-text galactic/space location. */
  location: string;

  /** Short mood / tagline. */
  vibe: string;

  /** One-paragraph summary. */
  summary: string;

  /** Keywords for filters and search. */
  tags: string[];

  /** Optional star system this world belongs to. */
  starSystem?: string;

  /** Optional normalized 3D coordinate in the galaxy map. */
  galaxyPosition?: Vec3;

  /** Optional Golden Egg clue number. */
  goldenEggClue?: number;
}

export interface GalaxyConfig {
  name: string;
  seed: string;
  starSystems: World['id'][];
}
