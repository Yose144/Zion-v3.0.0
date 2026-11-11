/**
 * ARÉNA — mapy.
 *
 * Quake aréna se nedělá z assetů, ale z krabic: každá je AABB, takže fyzika
 * i raycast jsou jen testy na intervaly. Výchozí `mars` je původní mapa
 * (tři úrovně, plošina, lišty, sloupy); od 2026-11-11 jsou v datech i dvě
 * **stylizované** mapy podle Q3: `q3dm3` (Toxicity — most, dvě komory,
 * výškové lišty) a `q3dm6` (Camping Grounds — tři patra, centrální věž,
 * křídla).
 *
 * Nejsou to 1:1 kopie originálních .bsp — ty nejsou v GPL zdroji a repozitář
 * žádné mapové assety nemá. Je to **stejný půdorys v hrubých obrysech**
 * (střednímost, komory, věž, křídla), postavený z krabic, aby seděl na
 * fyziku, navigaci i boty beze změny enginu.
 *
 * Souřadnice: y nahoru, aréna od −20 do 20 v x i z (každá mapa si drží
 * stejné meze, aby kamera a HUD nemusely mít druhou pravdu).
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

export interface ArenaSpawn {
  x: number;
  z: number;
  /** Výška spawnu — na vyvýšené plošině (most, věž) není nula. */
  y?: number;
  /** Kam se hráč dívá (yaw v radiánech). */
  yaw: number;
}

export interface ArenaPickup {
  id: string;
  kind: 'health' | 'armor' | 'ammo' | 'powerup' | 'mega' | 'shard';
  /** U `powerup`: který bonus to je (`quad` ×3 dmg, `haste` +30 % rychlosti). */
  powerup?: 'quad' | 'haste';
  x: number;
  y: number;
  z: number;
  /** Sekundy, za jak dlouho se předmět vrátí. */
  respawn: number;
}

export type ArenaMapId = 'mars' | 'q3dm3' | 'q3dm6';

/**
 * Paleta mapy. Barvy povrchů i světel drží data, ne renderer — jinak by
 * každá nová mapa vypadala jako Mars (pískově oranžová) a nešlo by poznat,
 * že jde o jiné místo.
 */
export interface ArenaPalette {
  ground: string;
  rock: string;
  metal: string;
  trim: string;
  /** Barva oblohy (pozadí scény). */
  sky: string;
  /** Barva mlhy + rozsah (near/far v metrech). */
  fog: string;
  fogNear: number;
  fogFar: number;
  ambient: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
  point: string;
}

export interface ArenaMap {
  id: ArenaMapId;
  name: { cs: string; en: string };
  note: { cs: string; en: string };
  boxes: ArenaBox[];
  playerSpawn: ArenaSpawn;
  botSpawns: ArenaSpawn[];
  pickups: ArenaPickup[];
  palette: ArenaPalette;
}

const WALL_H = 7;
const ARENA = 20;

// ── Mars (původní mapa, výchozí) ───────────────────────────────────────

const MARS_BOXES: ArenaBox[] = [
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

  // schodiště na plošinu (z +): stupně stoupají k plošině a poslední
  // navazuje přímo na její hranu (dřív mezi nimi byla 0,6 m mezera)
  { x: 0, y: 0, z: 6.5, w: 6, h: 1.5, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: 7.5, w: 6, h: 1.0, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: 8.5, w: 6, h: 0.5, d: 1, kind: 'metal' },
  // schodiště na plošinu (z −)
  { x: 0, y: 0, z: -6.5, w: 6, h: 1.5, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: -7.5, w: 6, h: 1.0, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: -8.5, w: 6, h: 0.5, d: 1, kind: 'metal' },

  // boční lišty (dostupné skokem z plošiny: 2,0 → 3,0 = 1 m)
  { x: -14, y: 2.4, z: 0, w: 6, h: 0.6, d: 10, kind: 'metal' },
  { x: 14, y: 2.4, z: 0, w: 6, h: 0.6, d: 10, kind: 'metal' },
  { x: -14, y: 3.0, z: 0, w: 6.2, h: 0.1, d: 10.2, kind: 'trim' },
  { x: 14, y: 3.0, z: 0, w: 6.2, h: 0.1, d: 10.2, kind: 'trim' },
  // lávky z plošiny na lišty — bez nich se na lišty dá jen skokem přes
  // prázdno (5 m), což boti po mřížce nikdy neudělají
  { x: -8.5, y: 2, z: 0, w: 5, h: 0.6, d: 2, kind: 'metal' },
  { x: 8.5, y: 2, z: 0, w: 5, h: 0.6, d: 2, kind: 'metal' },

  // čtyři sloupy
  { x: -8, y: 0, z: -8, w: 1.6, h: 5.5, d: 1.6, kind: 'rock' },
  { x: 8, y: 0, z: -8, w: 1.6, h: 5.5, d: 1.6, kind: 'rock' },
  { x: -8, y: 0, z: 8, w: 1.6, h: 5.5, d: 1.6, kind: 'rock' },
  { x: 8, y: 0, z: 8, w: 1.6, h: 5.5, d: 1.6, kind: 'rock' },

  // kryt u zdí (dá se za ním schovat)
  { x: -16, y: 0, z: -6, w: 2, h: 1.6, d: 6, kind: 'rock' },
  { x: 16, y: 0, z: 6, w: 2, h: 1.6, d: 6, kind: 'rock' },
];

const MARS_PICKUPS: ArenaPickup[] = [
  { id: 'h1', kind: 'health', x: -16, y: 0, z: 12, respawn: 18 },
  { id: 'h2', kind: 'health', x: 16, y: 0, z: -12, respawn: 18 },
  { id: 'a1', kind: 'armor', x: 0, y: 2, z: 0, respawn: 30 },
  // náboje (Q3 ammo box; tady dvě, aby obě strany měly šanci)
  { id: 'm1', kind: 'ammo', x: -16, y: 0, z: -12, respawn: 22 },
  { id: 'm2', kind: 'ammo', x: 16, y: 0, z: 12, respawn: 22 },
  /*
   * Powerupy a mega (2026-11-11): stejné Q3 rytmy jako v sólu a od protokolu
   * 37 je má i multiplayer — server drží buffy a posílá je ve snapshotu.
   */
  { id: 'q1', kind: 'powerup', powerup: 'quad', x: 14, y: 3.1, z: 0, respawn: 60 },
  { id: 'ha1', kind: 'powerup', powerup: 'haste', x: -14, y: 3.1, z: 0, respawn: 45 },
  { id: 'mh1', kind: 'mega', x: 0, y: 2, z: 4, respawn: 35 },
  // armor shardy (Q3 +5): čtyři místa, aby se dalo „doarmorovat" cestou
  { id: 's1', kind: 'shard', x: -4, y: 2, z: -4, respawn: 12 },
  { id: 's2', kind: 'shard', x: 4, y: 2, z: -4, respawn: 12 },
  { id: 's3', kind: 'shard', x: -14, y: 3.1, z: -4, respawn: 12 },
  { id: 's4', kind: 'shard', x: 14, y: 3.1, z: 4, respawn: 12 },
];

// ── Q3DM3 · Toxicity (stylizovaná) ─────────────────────────────────────
//
// Půdorys: centrální most (top 2) přes celou šířku, dvě komory na severu
// a jihu, výškové lišty po stranách. **Pravidlo pro navigaci:** každá
// krabice, která sahá na zem (minY < 1,6), musí nechat po stranách uličku
// aspoň 2 m — jinak se mapa rozpůlí a boti se na druhou stranu nedostanou
// (přesně to odhalil `test/arena-maps.mjs`). Lišty proto začínají ve výšce 2.

const Q3DM3_BOXES: ArenaBox[] = [
  { x: 0, y: -1, z: 0, w: 36, h: 1, d: 36, kind: 'ground' },
  // zdi
  { x: 0, y: 0, z: -18, w: 36, h: 8, d: 1, kind: 'rock' },
  { x: 0, y: 0, z: 18, w: 36, h: 8, d: 1, kind: 'rock' },
  { x: -18, y: 0, z: 0, w: 1, h: 8, d: 36, kind: 'rock' },
  { x: 18, y: 0, z: 0, w: 1, h: 8, d: 36, kind: 'rock' },

  // severní komora (mega) a jižní komora (armor), otevřené do středu
  { x: -6, y: 0, z: 13.5, w: 1.2, h: 3.2, d: 7, kind: 'rock' },
  { x: 6, y: 0, z: 13.5, w: 1.2, h: 3.2, d: 7, kind: 'rock' },
  { x: 0, y: 0, z: 17, w: 13, h: 3.2, d: 1.2, kind: 'rock' },
  { x: -6, y: 0, z: -13.5, w: 1.2, h: 3.2, d: 7, kind: 'rock' },
  { x: 6, y: 0, z: -13.5, w: 1.2, h: 3.2, d: 7, kind: 'rock' },
  { x: 0, y: 0, z: -17, w: 13, h: 3.2, d: 1.2, kind: 'rock' },

  // centrální most (top 2) + tři schody z každé strany
  { x: 0, y: 0, z: 0, w: 20, h: 2, d: 4, kind: 'metal' },
  { x: 0, y: 2, z: 0, w: 20.4, h: 0.12, d: 4.4, kind: 'trim' },
  { x: -10.5, y: 0, z: 0, w: 1, h: 1.5, d: 6, kind: 'metal' },
  { x: -11.5, y: 0, z: 0, w: 1, h: 1.0, d: 6, kind: 'metal' },
  { x: -12.5, y: 0, z: 0, w: 1, h: 0.5, d: 6, kind: 'metal' },
  { x: 10.5, y: 0, z: 0, w: 1, h: 1.5, d: 6, kind: 'metal' },
  { x: 11.5, y: 0, z: 0, w: 1, h: 1.0, d: 6, kind: 'metal' },
  { x: 12.5, y: 0, z: 0, w: 1, h: 0.5, d: 6, kind: 'metal' },

  // výškové lišty po stranách (top 2,6) — nad zemí, takže nechávají uličku
  // u schodů na most (x 12,5) volnou
  { x: -15.5, y: 2, z: 0, w: 5, h: 0.6, d: 10, kind: 'metal' },
  { x: 15.5, y: 2, z: 0, w: 5, h: 0.6, d: 10, kind: 'metal' },
  { x: -15.5, y: 2.6, z: 0, w: 5.2, h: 0.1, d: 10.2, kind: 'trim' },
  { x: 15.5, y: 2.6, z: 0, w: 5.2, h: 0.1, d: 10.2, kind: 'trim' },
  // schody na lišty (pět 0,5 m stupňů na severním/jižním konci lišty —
  // mimo pás mostu, takže neucpou boční uličku k mostu)
  { x: 15.5, y: 0, z: 5.5, w: 3, h: 2.5, d: 1, kind: 'metal' },
  { x: 15.5, y: 0, z: 6.5, w: 3, h: 2.0, d: 1, kind: 'metal' },
  { x: 15.5, y: 0, z: 7.5, w: 3, h: 1.5, d: 1, kind: 'metal' },
  { x: 15.5, y: 0, z: 8.5, w: 3, h: 1.0, d: 1, kind: 'metal' },
  { x: 15.5, y: 0, z: 9.5, w: 3, h: 0.5, d: 1, kind: 'metal' },
  { x: -15.5, y: 0, z: -5.5, w: 3, h: 2.5, d: 1, kind: 'metal' },
  { x: -15.5, y: 0, z: -6.5, w: 3, h: 2.0, d: 1, kind: 'metal' },
  { x: -15.5, y: 0, z: -7.5, w: 3, h: 1.5, d: 1, kind: 'metal' },
  { x: -15.5, y: 0, z: -8.5, w: 3, h: 1.0, d: 1, kind: 'metal' },
  { x: -15.5, y: 0, z: -9.5, w: 3, h: 0.5, d: 1, kind: 'metal' },

  // sloupy a kryt
  { x: -10, y: 0, z: -10, w: 1.5, h: 2.6, d: 1.5, kind: 'rock' },
  { x: 10, y: 0, z: -10, w: 1.5, h: 2.6, d: 1.5, kind: 'rock' },
  { x: -10, y: 0, z: 10, w: 1.5, h: 2.6, d: 1.5, kind: 'rock' },
  { x: 10, y: 0, z: 10, w: 1.5, h: 2.6, d: 1.5, kind: 'rock' },
  // vysoké pylony (mimo uličku |x| ≥ 13) — dávají mapě výšku a orientaci
  { x: -12, y: 0, z: -8, w: 1.5, h: 4.2, d: 1.5, kind: 'metal' },
  { x: 12, y: 0, z: -8, w: 1.5, h: 4.2, d: 1.5, kind: 'metal' },
  { x: -12, y: 0, z: 8, w: 1.5, h: 4.2, d: 1.5, kind: 'metal' },
  { x: 12, y: 0, z: 8, w: 1.5, h: 4.2, d: 1.5, kind: 'metal' },
  // bedny u vstupu do komor (nízké krytí, ne v uličce)
  { x: -8.5, y: 0, z: 10.5, w: 1.4, h: 1.1, d: 1.4, kind: 'rock' },
  { x: 8.5, y: 0, z: 10.5, w: 1.4, h: 1.1, d: 1.4, kind: 'rock' },
  { x: -8.5, y: 0, z: -10.5, w: 1.4, h: 1.1, d: 1.4, kind: 'rock' },
  { x: 8.5, y: 0, z: -10.5, w: 1.4, h: 1.1, d: 1.4, kind: 'rock' },
  // koruny komor (trim nad pruhem těla — navigaci neblokují)
  { x: -6, y: 3.2, z: 13.5, w: 1.4, h: 0.15, d: 7.2, kind: 'trim' },
  { x: 6, y: 3.2, z: 13.5, w: 1.4, h: 0.15, d: 7.2, kind: 'trim' },
  { x: 0, y: 3.2, z: 17, w: 13.2, h: 0.15, d: 1.4, kind: 'trim' },
  { x: -6, y: 3.2, z: -13.5, w: 1.4, h: 0.15, d: 7.2, kind: 'trim' },
  { x: 6, y: 3.2, z: -13.5, w: 1.4, h: 0.15, d: 7.2, kind: 'trim' },
  { x: 0, y: 3.2, z: -17, w: 13.2, h: 0.15, d: 1.4, kind: 'trim' },
];

const Q3DM3_PICKUPS: ArenaPickup[] = [
  { id: 'q1', kind: 'powerup', powerup: 'quad', x: -5, y: 2, z: 0, respawn: 60 },
  { id: 'mh1', kind: 'mega', x: 0, y: 0, z: 14, respawn: 35 },
  { id: 'a1', kind: 'armor', x: 0, y: 0, z: -14, respawn: 30 },
  { id: 'ha1', kind: 'powerup', powerup: 'haste', x: -16, y: 2.6, z: 0, respawn: 45 },
  { id: 'h1', kind: 'health', x: -16, y: 0, z: 12, respawn: 18 },
  { id: 'h2', kind: 'health', x: 16, y: 0, z: -12, respawn: 18 },
  { id: 'm1', kind: 'ammo', x: -14, y: 0, z: 12, respawn: 22 },
  { id: 'm2', kind: 'ammo', x: 14, y: 0, z: -12, respawn: 22 },
  { id: 's1', kind: 'shard', x: -6, y: 2, z: 0, respawn: 12 },
  { id: 's2', kind: 'shard', x: 6, y: 2, z: 0, respawn: 12 },
  { id: 's3', kind: 'shard', x: -8, y: 0, z: -6, respawn: 12 },
  { id: 's4', kind: 'shard', x: 8, y: 0, z: 6, respawn: 12 },
];

// ── Q3DM6 · Camping Grounds (stylizovaná) ──────────────────────────────
//
// Půdorys: třípatrová centrální věž, dvě křídla (top 2,5), mostky z křídel
// k věži a schodiště na severu i jihu. Ulička mezi mostkem a křídlem
// (`|x| ≈ 10–12`) je jediná suchá cesta okolo věže — proto mostky končí
// na x ±10 a křídla začínají na ±12.

const Q3DM6_BOXES: ArenaBox[] = [
  { x: 0, y: -1, z: 0, w: 40, h: 1, d: 40, kind: 'ground' },
  { x: 0, y: 0, z: -20, w: 40, h: 10, d: 1, kind: 'rock' },
  { x: 0, y: 0, z: 20, w: 40, h: 10, d: 1, kind: 'rock' },
  { x: -20, y: 0, z: 0, w: 1, h: 10, d: 40, kind: 'rock' },
  { x: 20, y: 0, z: 0, w: 1, h: 10, d: 40, kind: 'rock' },

  // centrální věž: spodek (top 3) + horní kubus (top 5)
  { x: 0, y: 0, z: 0, w: 10, h: 3, d: 10, kind: 'metal' },
  { x: 0, y: 3, z: 0, w: 6, h: 2, d: 6, kind: 'metal' },
  { x: 0, y: 3, z: 0, w: 10.4, h: 0.1, d: 10.4, kind: 'trim' },
  { x: 0, y: 5, z: 0, w: 6.4, h: 0.1, d: 6.4, kind: 'trim' },
  // schody na spodek věže (jih) — šest stupňů po 0,5 m (stepHeight 0,55)
  { x: 0, y: 0, z: 5.5, w: 9, h: 3.0, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: 6.5, w: 9, h: 2.5, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: 7.5, w: 9, h: 2.0, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: 8.5, w: 9, h: 1.5, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: 9.5, w: 9, h: 1.0, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: 10.5, w: 9, h: 0.5, d: 1, kind: 'metal' },
  // schody na spodek věže (sever)
  { x: 0, y: 0, z: -5.5, w: 9, h: 3.0, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: -6.5, w: 9, h: 2.5, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: -7.5, w: 9, h: 2.0, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: -8.5, w: 9, h: 1.5, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: -9.5, w: 9, h: 1.0, d: 1, kind: 'metal' },
  { x: 0, y: 0, z: -10.5, w: 9, h: 0.5, d: 1, kind: 'metal' },
  // stupně na horní kubus (na střeše věže, 3,5 → 4,0 → 5,0 skokem)
  { x: 4.5, y: 3, z: 0, w: 1, h: 0.5, d: 4, kind: 'metal' },
  { x: 3.5, y: 3, z: 0, w: 1, h: 1.0, d: 4, kind: 'metal' },

  // křídla (top 2,5) + schody uvnitř křídla
  { x: -15.5, y: 0, z: 0, w: 7, h: 2.5, d: 14, kind: 'metal' },
  { x: 15.5, y: 0, z: 0, w: 7, h: 2.5, d: 14, kind: 'metal' },
  // schody na křídla: pět stupňů po 0,5 m na severním konci každého křídla
  { x: -15.5, y: 0, z: 7.5, w: 5, h: 2.5, d: 1, kind: 'metal' },
  { x: -15.5, y: 0, z: 8.5, w: 5, h: 2.0, d: 1, kind: 'metal' },
  { x: -15.5, y: 0, z: 9.5, w: 5, h: 1.5, d: 1, kind: 'metal' },
  { x: -15.5, y: 0, z: 10.5, w: 5, h: 1.0, d: 1, kind: 'metal' },
  { x: -15.5, y: 0, z: 11.5, w: 5, h: 0.5, d: 1, kind: 'metal' },
  { x: 15.5, y: 0, z: -7.5, w: 5, h: 2.5, d: 1, kind: 'metal' },
  { x: 15.5, y: 0, z: -8.5, w: 5, h: 2.0, d: 1, kind: 'metal' },
  { x: 15.5, y: 0, z: -9.5, w: 5, h: 1.5, d: 1, kind: 'metal' },
  { x: 15.5, y: 0, z: -10.5, w: 5, h: 1.0, d: 1, kind: 'metal' },
  { x: 15.5, y: 0, z: -11.5, w: 5, h: 0.5, d: 1, kind: 'metal' },
  // mostky z křídel k věži (top 2,5) — končí na ±10, aby zůstala ulička
  { x: -7.5, y: 0, z: 0, w: 5, h: 2.5, d: 4, kind: 'metal' },
  { x: 7.5, y: 0, z: 0, w: 5, h: 2.5, d: 4, kind: 'metal' },

  // kryty a sloupy (mimo uličku |x| 10–12)
  { x: -8.5, y: 0, z: 14.5, w: 2, h: 3, d: 2, kind: 'rock' },
  { x: 8.5, y: 0, z: 14.5, w: 2, h: 3, d: 2, kind: 'rock' },
  { x: -8.5, y: 0, z: -14.5, w: 2, h: 3, d: 2, kind: 'rock' },
  { x: 8.5, y: 0, z: -14.5, w: 2, h: 3, d: 2, kind: 'rock' },
  { x: 0, y: 0, z: 16, w: 6, h: 1.4, d: 1.6, kind: 'rock' },
  { x: 0, y: 0, z: -16, w: 6, h: 1.4, d: 1.6, kind: 'rock' },
];

const Q3DM6_PICKUPS: ArenaPickup[] = [
  { id: 'q1', kind: 'powerup', powerup: 'quad', x: 0, y: 5, z: 0, respawn: 60 },
  { id: 'mh1', kind: 'mega', x: -15.5, y: 2.5, z: -5, respawn: 35 },
  { id: 'a1', kind: 'armor', x: 15.5, y: 2.5, z: 0, respawn: 30 },
  { id: 'ha1', kind: 'powerup', powerup: 'haste', x: 0, y: 0, z: 13.5, respawn: 45 },
  { id: 'h1', kind: 'health', x: 0, y: 0, z: -13.5, respawn: 18 },
  { id: 'h2', kind: 'health', x: -14, y: 0, z: -8, respawn: 18 },
  { id: 'm1', kind: 'ammo', x: -15.5, y: 0, z: -11, respawn: 22 },
  { id: 'm2', kind: 'ammo', x: 15.5, y: 0, z: 11, respawn: 22 },
  { id: 's1', kind: 'shard', x: -8, y: 0, z: 8, respawn: 12 },
  { id: 's2', kind: 'shard', x: 8, y: 0, z: 8, respawn: 12 },
  { id: 's3', kind: 'shard', x: -8, y: 0, z: -8, respawn: 12 },
  { id: 's4', kind: 'shard', x: 8, y: 0, z: -8, respawn: 12 },
];

// ── palety ─────────────────────────────────────────────────────────────

/** Mars: písek, rez a teplé světlo — původní vzhled. */
const MARS_PALETTE: ArenaPalette = {
  ground: '#8a3d22',
  rock: '#a44a26',
  metal: '#6d5560',
  trim: '#ffc077',
  sky: '#421d0e',
  fog: '#5a2611',
  fogNear: 34,
  fogFar: 130,
  ambient: '#ffcaa0',
  hemiSky: '#ffb27a',
  hemiGround: '#3a1408',
  sun: '#ffd9b0',
  point: '#ff8f5c',
};

/** Q3DM3 (Toxicity): industriální zeleň a studené světlo. */
const Q3DM3_PALETTE: ArenaPalette = {
  ground: '#3d4a3c',
  rock: '#56614f',
  metal: '#495b63',
  trim: '#a6e6c9',
  sky: '#10191a',
  fog: '#1b2a29',
  fogNear: 30,
  fogFar: 120,
  ambient: '#bfe3d6',
  hemiSky: '#8fd8c0',
  hemiGround: '#16211d',
  sun: '#d6fff0',
  point: '#5ad1a8',
};

/** Q3DM6 (Camping Grounds): soumrak, rezavý kámen, teplá lucerna. */
const Q3DM6_PALETTE: ArenaPalette = {
  ground: '#4b3a2b',
  rock: '#6b5140',
  metal: '#5a4b3f',
  trim: '#d9b273',
  sky: '#1c1410',
  fog: '#2a1d15',
  fogNear: 34,
  fogFar: 140,
  ambient: '#e8cfae',
  hemiSky: '#c9a06a',
  hemiGround: '#1b120c',
  sun: '#ffe6c2',
  point: '#ff9f5a',
};

// ── katalog map ────────────────────────────────────────────────────────

export const ARENA_MAPS: Record<ArenaMapId, ArenaMap> = {
  mars: {
    id: 'mars',
    name: { cs: 'Mars aréna', en: 'Mars arena' },
    note: { cs: 'původní mapa · tři úrovně · plošina a lišty', en: 'the original · three levels · platform & rails' },
    boxes: MARS_BOXES,
    playerSpawn: { x: 0, z: 16.5, yaw: 0 },
    botSpawns: [
      { x: -15, z: -15, yaw: 0.8 },
      { x: 15, z: -15, yaw: -0.8 },
      { x: 0, z: -15, yaw: 0 },
    ],
    pickups: MARS_PICKUPS,
    palette: MARS_PALETTE,
  },
  q3dm3: {
    id: 'q3dm3',
    name: { cs: 'Q3DM3 · Toxicity', en: 'Q3DM3 · Toxicity' },
    note: {
      cs: 'stylizovaná · centrální most, dvě komory, výškové lišty',
      en: 'stylised · central bridge, two chambers, high ledges',
    },
    boxes: Q3DM3_BOXES,
    playerSpawn: { x: 0, z: 0, y: 2.2, yaw: 0 },
    botSpawns: [
      { x: -14, z: -14, yaw: 0.8 },
      { x: 14, z: -14, yaw: -0.8 },
      { x: 0, z: -13, yaw: 0 },
    ],
    pickups: Q3DM3_PICKUPS,
    palette: Q3DM3_PALETTE,
  },
  q3dm6: {
    id: 'q3dm6',
    name: { cs: 'Q3DM6 · Camping Grounds', en: 'Q3DM6 · Camping Grounds' },
    note: {
      cs: 'stylizovaná · tři patra, centrální věž, křídla',
      en: 'stylised · three floors, central tower, wings',
    },
    boxes: Q3DM6_BOXES,
    playerSpawn: { x: -15.5, z: 6, y: 2.7, yaw: -1.2 },
    botSpawns: [
      { x: -16, z: -16, yaw: 0.8 },
      { x: 16, z: -16, yaw: -0.8 },
      { x: 0, z: -18, yaw: 0 },
    ],
    pickups: Q3DM6_PICKUPS,
    palette: Q3DM6_PALETTE,
  },
};

export const ARENA_MAP_IDS: ArenaMapId[] = ['mars', 'q3dm3', 'q3dm6'];
export const ARENA_MAP_DEFAULT = ARENA_MAPS.mars;

/** Zpětná kompatibilita: výchozí mapa pro server a starší importy. */
export const ARENA_BOXES = ARENA_MAP_DEFAULT.boxes;
export const ARENA_PICKUPS = ARENA_MAP_DEFAULT.pickups;
export const ARENA_SOLO_PICKUPS = ARENA_PICKUPS;
export const PLAYER_SPAWN = ARENA_MAP_DEFAULT.playerSpawn;
export const BOT_SPAWNS = ARENA_MAP_DEFAULT.botSpawns;
export const ARENA_SOLIDS = ARENA_BOXES;

export const FRAG_LIMIT = 10;
export const MATCH_SECONDS = 180;
