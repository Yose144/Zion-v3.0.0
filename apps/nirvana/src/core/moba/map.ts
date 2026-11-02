/**
 * MOBA „PRVNÍ SVĚT" — mapa prvního světa OASIS na Zemi.
 *
 * **Tři linky a tři uzly L5.** Linky jdou po povrchu Země od modrého
 * (ZION) k červenému (Opoziční) Nexu. Mezi nimi stojí tři uzly L5 —
 * Kailash, Uluru a Ekam — a kdo u nich chvíli stojí, **přebírá je pro svůj
 * tým** a ten dostane drobný bonus k poškození. To je jediné pravidlo, které
 * hru odlišuje od klasické MOBA: mapa není kulisa, ale síť komunit.
 *
 * Souřadnice jsou v metrech na rovině (x = západ–východ, z = sever–jih).
 */

export type Team = 'blue' | 'red';
export type LaneId = 'top' | 'mid' | 'bottom';

export interface Lane {
  id: LaneId;
  z: number;
  /** Výchozí x modré/červené brány. */
  from: number;
  to: number;
}

export const MAP_HALF_X = 46;
export const MAP_HALF_Z = 34;

export const LANES: Lane[] = [
  { id: 'top', z: -18, from: -36, to: 36 },
  { id: 'mid', z: 0, from: -36, to: 36 },
  { id: 'bottom', z: 18, from: -36, to: 36 },
];

export interface Structure {
  id: string;
  team: Team;
  kind: 'tower' | 'nexus';
  x: number;
  z: number;
  hp: number;
  range: number;
  damage: number;
  attackMs: number;
}

export const NEXUS_HP = 4000;
export const TOWER_HP = 1700;

export const STRUCTURES: Structure[] = [
  // ── modrá (ZION) ────────────────────────────────────────────────────
  { id: 'blue-nexus', team: 'blue', kind: 'nexus', x: -42, z: 0, hp: NEXUS_HP, range: 9, damage: 54, attackMs: 1100 },
  ...LANES.flatMap((lane): Structure[] => [
    { id: `blue-tower-inner-${lane.id}`, team: 'blue', kind: 'tower', x: -24, z: lane.z, hp: TOWER_HP, range: 10, damage: 66, attackMs: 1050 },
    { id: `blue-tower-outer-${lane.id}`, team: 'blue', kind: 'tower', x: -12, z: lane.z, hp: TOWER_HP, range: 10, damage: 66, attackMs: 1050 },
    { id: `red-tower-inner-${lane.id}`, team: 'red', kind: 'tower', x: 24, z: lane.z, hp: TOWER_HP, range: 10, damage: 66, attackMs: 1050 },
    { id: `red-tower-outer-${lane.id}`, team: 'red', kind: 'tower', x: 12, z: lane.z, hp: TOWER_HP, range: 10, damage: 66, attackMs: 1050 },
  ]),
  // ── červená (Opozice) ───────────────────────────────────────────────
  { id: 'red-nexus', team: 'red', kind: 'nexus', x: 42, z: 0, hp: NEXUS_HP, range: 9, damage: 54, attackMs: 1100 },
];

/**
 * Tři uzly L5 na mapě. `key` sedí na `FREE_WORLD_MISSIONS`, aby šel uzel
 * proklikat na komunitní stránku (a aby se mapa neopisovala ručně).
 */
export interface NodeSite {
  key: string;
  name: string;
  x: number;
  z: number;
}

export const NODE_SITES: NodeSite[] = [
  { key: 'kailash', name: 'Kailash', x: -12, z: -26 },
  { key: 'uluru', name: 'Uluru', x: 12, z: 26 },
  { key: 'ekam', name: 'Ekam', x: 0, z: -28 },
];

/** Jak dlouho musí tým u uzlu stát (ms), aby ho převzal. */
export const NODE_CAPTURE_MS = 2600;
/** Bonus k poškození za každý vlastněný uzel. */
export const NODE_BONUS_PER_SITE = 0.05;

export const SPAWNS = {
  blue: { x: -38, z: 0 },
  red: { x: 38, z: 0 },
} as const;

export interface JungleCamp {
  id: string;
  x: number;
  z: number;
  /** Typ tábora: buff za zabití. */
  type: 'small' | 'medium' | 'ancient';
  /** Čas respawnu v ms. */
  respawnMs: number;
}

export const JUNGLE_CAMPS: JungleCamp[] = [
  // Modrá strana
  { id: 'blue-small-top', x: -22, z: -10, type: 'small', respawnMs: 90000 },
  { id: 'blue-small-bot', x: -22, z: 10, type: 'small', respawnMs: 90000 },
  { id: 'blue-medium', x: -14, z: 0, type: 'medium', respawnMs: 150000 },
  // Červená strana
  { id: 'red-small-top', x: 22, z: -10, type: 'small', respawnMs: 90000 },
  { id: 'red-small-bot', x: 22, z: 10, type: 'small', respawnMs: 90000 },
  { id: 'red-medium', x: 14, z: 0, type: 'medium', respawnMs: 150000 },
  // River
  { id: 'river-dragon', x: 0, z: -24, type: 'ancient', respawnMs: 300000 },
  { id: 'river-herald', x: 0, z: 24, type: 'ancient', respawnMs: 300000 },
];

/** Minioni: 3 na linku každou vlnu. */
export const WAVE_INTERVAL_MS = 24_000;
export const WAVE_SIZE = 3;
export const MINION_HP = 240;
export const MINION_DAMAGE = 16;
export const MINION_SPEED = 3.4;
export const MINION_RANGE = 4.4;
export const MINION_ATTACK_MS = 1200;

export const MATCH_SECONDS = 480;

export function lanePoint(lane: Lane, x: number) {
  return { x, z: lane.z };
}

// ── ochrana struktur ──────────────────────────────────────────────────
//
// Pravidlo, které dělá z „projdi a rozbij Nexu" hru: **vnější věž kryje
// vnitřní a vnitřní věž kryje Nexu.** Bez toho se dá obejít celá mapa
// a položit Nexa za 40 s.
//
// Je to jediná funkce, kterou používá sim (server i sólo) i klient
// (zabarvení nedobytných věží) — kdyby pravidlo existovalo dvakrát,
// hráč by mlátil do věže, která se podle klienta dá zničit, a nic by se
// nedělo (přesně ta třída chyby „trefil jsem ho a nic").

const STRUCTURE_BY_ID = new Map(STRUCTURES.map((structure) => [structure.id, structure]));

/** Minimální tvar, který funkce potřebuje — sedí na `Tower` i na snapshot. */
export interface StructureHp {
  id: string;
  hp: number;
}

const hpOf = (towers: readonly StructureHp[], id: string) =>
  towers.find((tower) => tower.id === id)?.hp ?? 0;

/**
 * Je struktura chráněná?
 *
 * - `outer` věž není nikdy chráněná,
 * - `inner` věž je chráněná, dokud stojí její `outer` na stejném křídle,
 * - Nexus je chráněný, dokud stojí **aspoň jedna vnitřní věž** (tj. musí
 *   padnout celé jedno křídlo).
 */
export function isStructureProtected(towers: readonly StructureHp[], towerId: string): boolean {
  const structure = STRUCTURE_BY_ID.get(towerId);
  if (!structure) return false;
  if (hpOf(towers, towerId) <= 0) return false;

  if (structure.kind === 'nexus') {
    // Nexus je odemčený, jakmile padne **celá jedna lajna** (vnější i vnitřní
    // věž). Do té doby je nedobytný — jinak se dá obejít mapa a položit ho
    // za 40 sekund.
    const lanes: LaneId[] = ['top', 'mid', 'bottom'];
    const laneBroken = lanes.some(
      (lane) =>
        hpOf(towers, `${structure.team}-tower-outer-${lane}`) <= 0 &&
        hpOf(towers, `${structure.team}-tower-inner-${lane}`) <= 0,
    );
    return !laneBroken;
  }

  if (structure.id.includes('-inner-')) {
    return hpOf(towers, structure.id.replace('-inner-', '-outer-')) > 0;
  }

  return false;
}
