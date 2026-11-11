/**
 * PLUTO — SRDCE NA OKRAJI. Data světa.
 *
 * Pluto je poslední světlo před mezihvězdím: Slunce je odtud jen hvězda,
 * povrch je zmrzlý dusík a „srdce" (Sputnik Planitia) je světlá pláň.
 * Hra z toho dělá jednu mechaniku — **teplo**. Lucerna hřeje jen blízko
 * světla; kdo jde dál, zamrzne. Lampař proto musí postupovat po lampách,
 * ne běžet na konec mapy.
 *
 * Pozice jsou statické a deterministické: dva lidé (a test) jdou stejnou
 * plání. Vzdálenosti mezi lampami jsou schválně nerovné — nejdelší skok
 * je rozhodnutí, ne náhoda.
 */

export interface Lamp {
  id: number;
  x: number;
  z: number;
  name: { cs: string; en: string; es?: string };
}

/** Přistávací modul — start, cíl návratu a první teplo. */
export const SHUTTLE = { x: 0, z: 60, radius: 7.5 };

/** Devět lamp ve tvaru srdce; prostřední je ta poslední („srdce srdce"). */
export const LAMPS: Lamp[] = [
  { id: 1, x: 0, z: 38, name: { cs: 'Předpolí', en: 'Forefield', es: 'Antecampo' } },
  { id: 2, x: -24, z: 20, name: { cs: 'Levý břeh', en: 'Left shore', es: 'Orilla izquierda' } },
  { id: 3, x: 24, z: 20, name: { cs: 'Pravý břeh', en: 'Right shore', es: 'Orilla derecha' } },
  { id: 4, x: -46, z: -6, name: { cs: 'Západní trhlina', en: 'West rift', es: 'Fisura oeste' } },
  { id: 5, x: 46, z: -6, name: { cs: 'Východní trhlina', en: 'East rift', es: 'Fisura este' } },
  { id: 6, x: 0, z: -10, name: { cs: 'Střed', en: 'The middle', es: 'El centro' } },
  { id: 7, x: -28, z: -34, name: { cs: 'Severní hřeben', en: 'North ridge', es: 'Cresta norte' } },
  { id: 8, x: 28, z: -34, name: { cs: 'Severní hrana', en: 'North edge', es: 'Borde norte' } },
  { id: 9, x: 0, z: -50, name: { cs: 'Srdce', en: 'The heart', es: 'El corazón' } },
];

/** Hranice pochůzky (metry od středu). Dál je jen tma a sníh. */
export const WORLD = 86;

// ── pohyb ────────────────────────────────────────────────────────────
export const SPEED = 6.4;
/** Jak rychle se rychlost přibližuje vstupu (1/s). */
export const MOVE_RESPONSE = 6.5;
/** Doběh, když pustíš klávesy — na ledě to klouže. */
export const ICE_RESPONSE = 2.2;

// ── teplo ────────────────────────────────────────────────────────────
export const WARMTH_MAX = 100;
export const WARMTH_START = 100;
/** Základní ztráta tepla za sekundu (než se přidá vzdálenost a soumrak). */
export const DRAIN_BASE = 1.5;
/** Kolik přidá každý metr od nejbližšího tepla. */
export const DRAIN_PER_M = 0.13;
/** Strop ztráty (aby se z metrů nestalo nepřekonatelné). */
export const DRAIN_MAX = 9;
/** Dobíjení u světla. */
export const REGEN = 10;
/** Poloměr, kde ještě hřeje (modul i lampa). */
export const WARM_RADIUS = 6;
/**
 * Soumrak. Slunce nad Plutem klesá, takže ztráta roste s časem — i u modulu.
 * Bez toho by šlo stát na místě navěky a hra by neměla konec (reálně to
 * první sehrávka dělala: 300 s a 100 tepla).
 */
export const DUSK_BASE = 2;
export const DUSK_PER_S = 0.05;

// ── lampy ────────────────────────────────────────────────────────────
/** Jak blízko musíš stát, aby šla lampa zapálit. */
export const LAMP_RADIUS = 4.5;
/** Jak dlouho se drží lucerna u knotu. */
export const LIGHT_TIME = 1.5;
/** Teplo, které zapálení vrátí. */
export const LAMP_WARMTH = 20;

// ── skóre ────────────────────────────────────────────────────────────
export const LAMP_SCORE = 100;
export const COMPLETE_BONUS = 300;
export const WARMTH_SCORE = 3;

/** Kolik lamp musí svítit, aby srdce vzplálo. */
export const LAMP_COUNT = LAMPS.length;
