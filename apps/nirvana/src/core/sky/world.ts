/**
 * KŘÍDLA — nový svět na Uranu.
 *
 * Inspirace je přiznaná: *Sky: Children of the Light* — dítě světla, pláštěnka,
 * proud vzduchu, rozptýlená světla a cesta, která není o vítězství, ale o tom,
 * co si odnesеш. Nejsou tu nepřátelé ani časový limit, jen sedm světel
 * a svatyně na konci oblohy.
 *
 * Co je v tomhle souboru: **data světa**. Fyzika je v `flight.ts`, kreslení
 * v `SkyScene.tsx`. Drží se to oddělené, aby se dala simulace testovat
 * v Node bez WebGL — a aby se pozice světel nemusela opsat do scény znovu.
 *
 * Souřadnice: hřiště je 100 × 100 jednotek (`x` doprava, `y` nahoru), `z`
 * je jen hloubka kulis. Stejná čísla používá simulace i kamera.
 */

export const SKY_WIDTH = 100;
export const SKY_HEIGHT = 100;

export interface SkyIsland {
  id: string;
  x: number;
  y: number;
  /** Poloměr plošiny — slouží i pro kolizi, když na ni přistaneš. */
  r: number;
  /** Hloubka kulisy (menší = dál). */
  z: number;
  /** Textura/odstín krychle — led, mech, kámen. */
  tone: string;
}

export interface SkyLight {
  id: number;
  x: number;
  y: number;
  z: number;
  /** Text, který se objeví po sebrání — kousek příběhu. */
  fragment: { cs: string; en: string };
}

export interface SkyCurrent {
  id: string;
  x: number;
  y: number;
  r: number;
  /** Síla proudění (kladné = nahoru). */
  lift: number;
}

/** Sedm světel = sedm kusů příběhu. Počet je záměrně malý: cesta má trvat pár minut. */
export const SKY_LIGHTS: SkyLight[] = [
  {
    id: 1,
    x: 18,
    y: 26,
    z: 0,
    fragment: {
      cs: 'Nejdřív jsem si myslel, že létám proto, že mám křídla. Pak jsem zjistil, že křídla jsou jen to, co zbylo, když mě někdo podržel.',
      en: 'At first I thought I flew because I had wings. Later I learned wings are only what remains after someone held you up.',
    },
  },
  {
    id: 2,
    x: 31,
    y: 44,
    z: 1.5,
    fragment: {
      cs: 'Světlo není moje. Jen prochází. Kdo si ho nechá, zhasne dřív než ten, kdo ho podá dál.',
      en: 'The light is not mine. It only passes through. Whoever keeps it goes dark sooner than whoever hands it on.',
    },
  },
  {
    id: 3,
    x: 48,
    y: 58,
    z: -1,
    fragment: {
      cs: 'Na Uranu se planeta převrátila na bok. Řekli mi, že to je chyba. Ale co je nahoře, rozhoduje ten, kdo se dívá.',
      en: 'On Uranus the planet rolled onto its side. They told me it was a mistake. But what counts as up is decided by whoever looks.',
    },
  },
  {
    id: 4,
    x: 62,
    y: 40,
    z: 2,
    fragment: {
      cs: 'Potkal jsem jiné dítě světla. Nemluvili jsme. Letěli jsme vedle sebe a bylo to víc než rozhovor.',
      en: 'I met another child of light. We did not speak. We flew side by side, and it was more than a conversation.',
    },
  },
  {
    id: 5,
    x: 72,
    y: 66,
    z: -2,
    fragment: {
      cs: 'Každé světlo, které sebereš, trochu bolí. Ne proto, že bys ho bral, ale protože už víš, že ho budeš muset vydat.',
      en: 'Every light you gather hurts a little. Not because you take it, but because you already know you will have to give it away.',
    },
  },
  {
    id: 6,
    x: 45,
    y: 78,
    z: 0.5,
    fragment: {
      cs: 'Nejvýš se neletí silou. Nejvýš se doletí tím, že přestaneš tlačit.',
      en: 'You do not reach the highest place by force. You get there by stopping the pushing.',
    },
  },
  {
    id: 7,
    x: 22,
    y: 62,
    z: -3,
    fragment: {
      cs: 'Světlo, které držíš pro druhé, svítí dál než to, které držíš pro sebe.',
      en: 'The light you keep for others shines farther than the light you keep for yourself.',
    },
  },
];

/** Svatyně na konci — otevře se, až když máš všech sedm. */
export const SKY_SHRINE = { x: 82, y: 86, r: 7 } as const;

/** Proudy vzduchu — jediné „palivo" kromě pláštěnky. */
export const SKY_CURRENTS: SkyCurrent[] = [
  { id: 'c1', x: 26, y: 30, r: 7, lift: 34 },
  { id: 'c2', x: 54, y: 46, r: 8, lift: 40 },
  { id: 'c3', x: 40, y: 70, r: 9, lift: 44 },
  { id: 'c4', x: 68, y: 54, r: 7, lift: 36 },
];

/** Plošiny — nejsou nutné k dohrání, ale dávají světu hloubku a odpočinek. */
export const SKY_ISLANDS: SkyIsland[] = [
  { id: 'start', x: 8, y: 8, r: 7, z: 0, tone: '#9fd8dc' },
  { id: 'i1', x: 22, y: 20, r: 6, z: -6, tone: '#b9e6e8' },
  { id: 'i2', x: 38, y: 36, r: 5, z: -14, tone: '#cfe9ea' },
  { id: 'i3', x: 56, y: 52, r: 7, z: -9, tone: '#a9d6dc' },
  { id: 'i4', x: 70, y: 34, r: 5, z: -18, tone: '#c3e3e6' },
  { id: 'i5', x: 30, y: 66, r: 6, z: -12, tone: '#b2dee2' },
  { id: 'i6', x: 62, y: 74, r: 5, z: -5, tone: '#cbe8ea' },
  { id: 'shrine', x: 82, y: 86, r: 7, z: 0, tone: '#e8f6f4' },
];

/** Úvodní a závěrečný text — rámují cestu, ne každé světlo. */
export const SKY_INTRO = {
  cs: 'V ledové obloze Uranu zůstalo sedm světel. Nikdo neříká, co udělat. Odnes je do svatyně na konci oblohy.',
  en: 'Seven lights remain in the ice sky of Uranus. Nobody tells you what to do. Carry them to the shrine at the edge of the sky.',
};

export const SKY_FINISH = {
  cs: 'Světlo se vrátilo do oblohy. Nezůstalo ti nic než to, co sis odnesl — a to je víc než dost.',
  en: 'The light returned to the sky. Nothing stayed with you but what you carried inside — and that is more than enough.',
};
