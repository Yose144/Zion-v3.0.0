/**
 * MARS ARENA — mapa.
 *
 * Quake aréna se nedělá z assetů, ale z krabic: každá je AABB, takže fyzika
 * i raycast jsou jen teste na intervaly. Tři úrovně (podlaha / plošina /
 * lišty), dvě schodiště, čtyři sloupy, tři spawny botů a pickupy.
 *
 * Souřadnice: y nahoru, aréna od −20 do 20 v x i z.
 */

export interface ArenaBox {
  /** Střed ve x/z, spodek v y. */
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  /** Barva povrchu — písek, kámen, kov. */
  kind: 'ground' | 'rock' | 'metal' | 'trim';
}

const WALL_H = 7;
const ARENA = 20;

export const ARENA_BOXES: ArenaBox[] = [
  // podlaha
  { x: 0, y: -1, z: 0, w: ARENA * 2, h: 1, d: ARENA * 2, kind: 'ground' },

  // zdi (vnější plášť)
  { x: 0, y: 0, z: -ARENA, w: ARENA * 2, h: WALL_H, d: 1, kind: 'rock' },
  { x: 0, y: 0, z: ARENA, w: ARENA * 2, h: WALL_H, d: 1, kind: 'rock' },
  { x: -ARENA, y: 0, z: 0, w: 1, h: WALL_H, d: ARENA * 2, kind: 'rock' },
  { x: ARENA, y: 0, z: 0, w: 1, h: WALL_H, d: ARENA * 2, kind: 'rock' },

  // centrální plošina (top ve 2)
  { x: 0, y: 0, z: 0, w: 12, h: 2, d: 12, kind: 'metal' },
  { x: 0, y: 2, z: 0, w: 12.6, h: 0.12, d: 12.6, kind: 'trim' },

  // schodiště na plošinu (z +)
  { x: 0, y: 0, z: 7.2, w: 6, h: 0.5, d: 1.2, kind: 'metal' },
  { x: 0, y: 0, z: 8.4, w: 6, h: 1.0, d: 1.2, kind: 'metal' },
  { x: 0, y: 0, z: 9.6, w: 6, h: 1.5, d: 1.2, kind: 'metal' },
  // schodiště na plošinu (z −)
  { x: 0, y: 0, z: -7.2, w: 6, h: 0.5, d: 1.2, kind: 'metal' },
  { x: 0, y: 0, z: -8.4, w: 6, h: 1.0, d: 1.2, kind: 'metal' },
  { x: 0, y: 0, z: -9.6, w: 6, h: 1.5, d: 1.2, kind: 'metal' },

  // boční lišty (dostupné skokem z plošiny)
  { x: -14, y: 2.6, z: 0, w: 6, h: 0.6, d: 10, kind: 'metal' },
  { x: 14, y: 2.6, z: 0, w: 6, h: 0.6, d: 10, kind: 'metal' },
  { x: -14, y: 3.2, z: 0, w: 6.2, h: 0.1, d: 10.2, kind: 'trim' },
  { x: 14, y: 3.2, z: 0, w: 6.2, h: 0.1, d: 10.2, kind: 'trim' },

  // čtyři sloupy
  { x: -8, y: 0, z: -8, w: 1.6, h: 5.5, d: 1.6, kind: 'rock' },
  { x: 8, y: 0, z: -8, w: 1.6, h: 5.5, d: 1.6, kind: 'rock' },
  { x: -8, y: 0, z: 8, w: 1.6, h: 5.5, d: 1.6, kind: 'rock' },
  { x: 8, y: 0, z: 8, w: 1.6, h: 5.5, d: 1.6, kind: 'rock' },

  // kryt u zdí (dá se za ním schovat)
  { x: -16, y: 0, z: -6, w: 2, h: 1.6, d: 6, kind: 'rock' },
  { x: 16, y: 0, z: 6, w: 2, h: 1.6, d: 6, kind: 'rock' },
];

export interface ArenaSpawn {
  x: number;
  z: number;
  /** Kam se hráč dívá (yaw v radiánech). */
  yaw: number;
}

export const PLAYER_SPAWN: ArenaSpawn = { x: 0, z: 16.5, yaw: 0 };

export const BOT_SPAWNS: ArenaSpawn[] = [
  { x: -15, z: -15, yaw: 0.8 },
  { x: 15, z: -15, yaw: -0.8 },
  { x: 0, z: -15, yaw: 0 },
];

export interface ArenaPickup {
  id: string;
  kind: 'health' | 'armor' | 'ammo';
  x: number;
  y: number;
  z: number;
  /** Sekundy, za jak dlouho se předmět vrátí. */
  respawn: number;
}

export const ARENA_PICKUPS: ArenaPickup[] = [
  { id: 'h1', kind: 'health', x: -16, y: 0, z: 12, respawn: 18 },
  { id: 'h2', kind: 'health', x: 16, y: 0, z: -12, respawn: 18 },
  { id: 'a1', kind: 'armor', x: 0, y: 2, z: 0, respawn: 30 },
  // náboje na MG (Q3 má ammo boxy; tady jsou dvě, aby obě strany měly šanci)
  { id: 'm1', kind: 'ammo', x: -16, y: 0, z: -12, respawn: 22 },
  { id: 'm2', kind: 'ammo', x: 16, y: 0, z: 12, respawn: 22 },
];

/** Stěny jako data pro raycast (jen to, co blokuje střelu). */
export const ARENA_SOLIDS = ARENA_BOXES;

export const FRAG_LIMIT = 10;
export const MATCH_SECONDS = 180;
