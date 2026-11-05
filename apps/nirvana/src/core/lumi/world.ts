/**
 * KŘÍDLA — nový svět na Uranu.
 *
 * Inspirace je přiznaná: *Sky: Children of the Light* — dítě světla, pláštěnka,
 * proud vzduchu, rozptýlená světla a cesta, která není o vítězství, ale o tom,
 * co si odnesеш. Nejsou tu nepřátelé ani časový limit, jen sedm světel
 * a svatyně na konci oblohy.
 *
 * Co je v tomhle souboru: **data světa**. Fyzika je v `flight.ts`, kreslení
 * v `LumiScene.tsx`. Drží se to oddělené, aby se dala simulace testovat
 * v Node bez WebGL — a aby se pozice světel nemusela opsat do scény znovu.
 *
 * Souřadnice: hřiště je 100 × 100 jednotek (`x` doprava, `y` nahoru), `z`
 * je jen hloubka kulis. Stejná čísla používá simulace i kamera.
 */

export const LUMI_WIDTH = 100;
export const LUMI_HEIGHT = 100;

export interface LumiIsland {
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

/**
 * Text světa ve třech jazycích. `es` je nepovinné — `tx()` v i18n padá na `en`,
 * takže částečný překlad nikdy nezobrazí prázdno.
 */
export interface LumiText {
  cs: string;
  en: string;
  es?: string;
}

export interface LumiLight {
  id: number;
  x: number;
  y: number;
  z: number;
  /** Text, který se objeví po sebrání — kousek příběhu. */
  fragment: LumiText;
}

export interface LumiCurrent {
  id: string;
  x: number;
  y: number;
  r: number;
  /** Síla proudění (kladné = nahoru). */
  lift: number;
}

/** Sedm světel = sedm kusů příběhu. Počet je záměrně malý: cesta má trvat pár minut. */
export const LUMI_LIGHTS: LumiLight[] = [
  {
    id: 1,
    x: 18,
    y: 26,
    z: 0,
    fragment: {
      cs: 'Nejdřív jsem si myslel, že létám proto, že mám křídla. Pak jsem zjistil, že křídla jsou jen to, co zbylo, když mě někdo podržel.',
      en: 'At first I thought I flew because I had wings. Later I learned wings are only what remains after someone held you up.',
        es: 'Al principio creía que volaba porque tenía alas. Después aprendí que las alas son solo lo que queda cuando alguien te sostuvo.',
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
        es: 'La luz no es mía. Solo pasa a través. Quien se la queda se apaga antes que quien la entrega.',
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
        es: 'En Urano el planeta rodó de lado. Me dijeron que fue un error. Pero lo que está arriba lo decide quien mira.',
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
        es: 'Conocí a otro niño de luz. No hablamos. Volamos uno al lado del otro, y fue más que una conversación.',
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
        es: 'Cada luz que recoges duele un poco. No porque la tomes, sino porque ya sabes que tendrás que entregarla.',
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
        es: 'A lo más alto no se llega por la fuerza. Se llega cuando dejas de empujar.',
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
        es: 'La luz que guardas para otros brilla más lejos que la que guardas para ti.',
    },
  },
];

/** Svatyně na konci — otevře se, až když máš všech sedm. */
export const LUMI_SHRINE = { x: 82, y: 86, r: 7 } as const;



/** Proudy vzduchu — jediné „palivo" kromě pláštěnky. */
export const LUMI_CURRENTS: LumiCurrent[] = [
  { id: 'c1', x: 26, y: 30, r: 7, lift: 34 },
  { id: 'c2', x: 54, y: 46, r: 8, lift: 40 },
  { id: 'c3', x: 40, y: 70, r: 9, lift: 44 },
  { id: 'c4', x: 68, y: 54, r: 7, lift: 36 },
];

/** Plošiny — nejsou nutné k dohrání, ale dávají světu hloubku a odpočinek. */
export const LUMI_ISLANDS: LumiIsland[] = [
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
export const LUMI_INTRO = {
  cs: 'Lumi je děvčátko s lucernou. V ledové obloze Uranu zůstalo sedm světel a nikdo neříká, co udělat — jen lucerna ví cestu. Odnes je do svatyně na konci oblohy.',
  en: 'Lumi is the girl with the lantern. Seven lights remain in the ice sky of Uranus and nobody says what to do — only the lantern knows the way. Carry them to the shrine at the edge of the sky.',
        es: 'Lumi es la niña con la linterna. En el cielo de hielo de Urano quedan siete luces y nadie dice qué hacer: solo la linterna conoce el camino. Llévalas al santuario al borde del cielo.',
};

export const LUMI_FINISH = {
  cs: 'Světlo se vrátilo do oblohy. Lucerna zhasla a Lumi zůstala ve tmě sama se sebou — a to je víc než dost.',
  en: 'The light returned to the sky. The lantern went out and Lumi stood in the dark with herself — and that is more than enough.',
        es: 'La luz volvió al cielo. La linterna se apagó y Lumi se quedó a solas en la oscuridad — y eso es más que suficiente.',
};

/**
 * Cesty. Stejná obloha, jiný rozptyl: `calm` je ta první (světla blízko
 * sebe, proudy štědré), `wind` je pro ty, kdo už vědí, jak pláštěnka drží —
 * světla jsou výš a dál, proudy užší a mezi nimi delší prázdno.
 *
 * Data jsou tady, ne ve scéně: testy díky tomu ověří, že každá cesta má
 * sedm světel a že se dají doletět (žádné světlo mimo mapu).
 */
export type LumiPathId = 'calm' | 'wind' | 'light';

export interface LumiPath {
  id: LumiPathId;
  name: LumiText;
  note: LumiText;
  lights: LumiLight[];
  currents: LumiCurrent[];
  islands: LumiIsland[];
  shrine: { x: number; y: number; r: number };
  intro: LumiText;
}

/** Texty světel jsou společné oběma cestám — příběh se nemění podle obtížnosti. */
const CALM_CURRENTS: LumiCurrent[] = LUMI_CURRENTS;
const CALM_ISLANDS: LumiIsland[] = LUMI_ISLANDS;

const WIND_LIGHTS: LumiLight[] = LUMI_LIGHTS.map((light, index) => ({
  ...light,
  // druhá cesta rozhází světla víc do šířky i výšky
  x: Math.min(LUMI_WIDTH - 8, Math.max(8, light.x + (index % 2 === 0 ? 14 : -10))),
  y: Math.min(LUMI_HEIGHT - 10, light.y + 14 + (index % 3) * 4),
}));

const WIND_CURRENTS: LumiCurrent[] = [
  { id: 'w1', x: 16, y: 40, r: 5, lift: 46 },
  { id: 'w2', x: 36, y: 62, r: 5, lift: 50 },
  { id: 'w3', x: 58, y: 36, r: 5, lift: 48 },
  { id: 'w4', x: 74, y: 72, r: 6, lift: 54 },
  { id: 'w5', x: 46, y: 88, r: 6, lift: 56 },
];

const WIND_ISLANDS: LumiIsland[] = [
  { id: 'start', x: 8, y: 8, r: 7, z: 0, tone: '#9fd8dc' },
  { id: 'w1', x: 24, y: 44, r: 4.5, z: -8, tone: '#b9e6e8' },
  { id: 'w2', x: 44, y: 66, r: 4, z: -15, tone: '#cfe9ea' },
  { id: 'w3', x: 66, y: 40, r: 4.5, z: -10, tone: '#a9d6dc' },
  { id: 'w4', x: 78, y: 74, r: 4, z: -6, tone: '#c3e3e6' },
  { id: 'shrine', x: 88, y: 90, r: 6, z: 0, tone: '#e8f6f4' },
];

/**
 * Třetí cesta — **Cesta světla**. Není to delší trasa, je to jiný tvar:
 * světla stoupají ve spirále vzhůru, proudy jsou vysoko a úzké, mezi nimi
 * dlouhé prázdno. Odemyká se až po dohrání obou předchozích cest, aby
 * nový hráč nezačínal tím nejtěžším.
 */
const LIGHT_LIGHTS: LumiLight[] = LUMI_LIGHTS.map((light, index) => ({
  ...light,
  // spirála: x i y plynule rostou, aby cesta vedla jedním tahem nahoru
  x: 14 + index * 11,
  y: 12 + index * 12,
}));

const LIGHT_CURRENTS: LumiCurrent[] = [
  { id: 'l1', x: 18, y: 26, r: 4.5, lift: 50 },
  { id: 'l2', x: 40, y: 44, r: 4.5, lift: 54 },
  { id: 'l3', x: 62, y: 62, r: 4.5, lift: 58 },
  { id: 'l4', x: 80, y: 80, r: 5, lift: 62 },
];

const LIGHT_ISLANDS: LumiIsland[] = [
  { id: 'start', x: 8, y: 8, r: 7, z: 0, tone: '#9fd8dc' },
  { id: 'l1', x: 30, y: 30, r: 4, z: -10, tone: '#cfe9ea' },
  { id: 'l2', x: 52, y: 52, r: 4, z: -16, tone: '#b9e6e8' },
  { id: 'l3', x: 72, y: 72, r: 4, z: -8, tone: '#a9d6dc' },
  { id: 'shrine', x: 92, y: 92, r: 6, z: 0, tone: '#e8f6f4' },
];

export const LUMI_PATHS: Record<LumiPathId, LumiPath> = {
  calm: {
    id: 'calm',
    name: { cs: 'Klidná cesta', en: 'The calm way' },
    note: { cs: 'světla blízko sebe, proudy štědré', en: 'lights close together, generous currents' },
    lights: LUMI_LIGHTS,
    currents: CALM_CURRENTS,
    islands: CALM_ISLANDS,
    shrine: LUMI_SHRINE,
    intro: LUMI_INTRO,
  },
  wind: {
    id: 'wind',
    name: { cs: 'Větrná cesta', en: 'The windy way' },
    note: { cs: 'výš a dál, užší proudy, delší prázdno', en: 'higher and farther, narrower currents, longer gaps' },
    lights: WIND_LIGHTS,
    currents: WIND_CURRENTS,
    islands: WIND_ISLANDS,
    shrine: { x: 88, y: 90, r: 6 },
    intro: {
      cs: 'Větrná cesta vede výš, než kam dohlédneš ze startu. Proudy jsou užší a mezi nimi je delší prázdno — lucerna tu není na ozdobu.',
      en: 'The windy way climbs higher than you can see from the start. The currents are narrower and the gaps between them longer — the lantern is not decoration here.',
        es: 'El camino del viento sube más alto de lo que ves al empezar. Las corrientes son más estrechas y los huecos entre ellas más largos: aquí la linterna no es un adorno.',
    },
  },
  light: {
    id: 'light',
    name: { cs: 'Cesta světla', en: 'The way of light' },
    note: { cs: 'spirála vzhůru, úzké proudy, dlouhé prázdno', en: 'a spiral upward, narrow currents, long gaps' },
    lights: LIGHT_LIGHTS,
    currents: LIGHT_CURRENTS,
    islands: LIGHT_ISLANDS,
    shrine: { x: 92, y: 92, r: 6 },
    intro: {
      cs: 'Cesta světla vede nahoru ve spirále. Proudy jsou vysoko a úzké, mezi nimi je prázdno, které musíš přečkat. Sem se nechodí pro rychlost — chodí se sem, když už víš, že lucerna vydrží.',
      en: 'The way of light climbs in a spiral. The currents sit high and narrow, with empty air between them you have to endure. You do not come here for speed — you come when you already know the lantern will last.',
        es: 'El camino de la luz sube en espiral. Las corrientes están altas y estrechas, y entre ellas hay un vacío que hay que resistir. Aquí no se viene por velocidad: se viene cuando ya sabes que la linterna aguantará.',
    },
  },
};

/**
 * Denní obloha (L-7).
 *
 * Každý den se sedm světel posune, ale **deterministicky**: stejný den (UTC)
 * = stejná obloha pro všechny — což je podmínka, aby se dva lidé ve společném
 * letu potkali u stejných světel. `Math.random()` by tuhle vlastnost zabil,
 * proto se seed bere z data.
 *
 * Co se nehýbe: id světel, jejich texty, proudy, ostrovy i svatyně. Mění se
 * jen poloha, a to v pásu ±9 jednotek kolem základní pozice z `LUMI_LIGHTS`.
 */
function hashSeed(text: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/** Pseudonáhodné číslo 0–1 z hashe — deterministické napříč prohlížeči. */
function unit(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x / 0xffffffff;
}

/** `YYYY-MM-DD` v UTC — společná hodnota pro všechny klienty. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

const DAY_RANGE = 9;
const dailyCache = new Map<string, LumiLight[]>();

/**
 * Světla cesty pro daný den. Bez data = dnešek (UTC).
 *
 * Vrací **nová** pole (ne objekty z `LUMI_PATHS`), aby si simulace ani scéna
 * nemohly přepsat základní data.
 */
export function lightsFor(pathId: LumiPathId, date: Date = new Date()): LumiLight[] {
  const path = LUMI_PATHS[pathId] ?? LUMI_PATHS.calm;
  const day = dayKey(date);
  const key = `${path.id}:${day}`;
  const cached = dailyCache.get(key);
  if (cached) return cached;

  const seed = hashSeed(key);
  const shrine = path.shrine;
  const shifted = path.lights.map((light) => {
    const dx = (unit(seed, light.id * 2) - 0.5) * 2 * DAY_RANGE;
    const dy = (unit(seed, light.id * 2 + 1) - 0.5) * 2 * DAY_RANGE;
    let x = Math.min(LUMI_WIDTH - 10, Math.max(10, light.x + dx));
    let y = Math.min(LUMI_HEIGHT - 10, Math.max(10, light.y + dy));

    // Světlo nesmí spadnout do svatyně — hráč by ho „sebral" až u cíle
    // a poslední kus cesty by byl bez hledání.
    const away = Math.hypot(x - shrine.x, y - shrine.y);
    const keepOut = shrine.r + 6;
    if (away < keepOut) {
      const k = away === 0 ? 1 : (keepOut + 2) / away;
      x = Math.min(LUMI_WIDTH - 8, Math.max(8, shrine.x + (x - shrine.x) * k));
      y = Math.min(LUMI_HEIGHT - 8, Math.max(8, shrine.y + (y - shrine.y) * k));
    }

    return { ...light, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });

  // Cache drží jen dnešek a včerejšek — dlouhý běh serveru nemá růst.
  if (dailyCache.size > 12) dailyCache.clear();
  dailyCache.set(key, shifted);
  return shifted;
}

/** Cesta s **dnešní** oblohou. Jediné místo, kudy se k datům chodí. */
export function pathData(id: LumiPathId, date: Date = new Date()): LumiPath {
  const path = LUMI_PATHS[id] ?? LUMI_PATHS.calm;
  return { ...path, lights: lightsFor(path.id, date) };
}

/**
 * Kapitoly mezi cestami (L-8).
 *
 * Každá cesta má **dozvuk**: text, který se ukáže po doletu a zůstane
 * v deníku. Není to odměna ani skóre — je to důvod, proč jít znovu.
 * Drží se tady (data), ne ve stránce, aby se text nedal „zapomenout"
 * v JSX a aby ho viděly testy.
 */
export interface LumiChapter {
  /** Id kapitoly = id cesty, po které se odemkne. */
  id: LumiPathId;
  title: LumiText;
  text: LumiText;
}

export const LUMI_CHAPTERS: Record<LumiPathId, LumiChapter> = {
  calm: {
    id: 'calm',
    title: { cs: 'První světlo', en: 'The first light' },
    text: {
      cs: 'Doletěla jsi. Světlo v dlani bylo těžší, než vypadalo, a poprvé bylo ticho, které nebylo prázdné. Lucerna se zakymácela — a v obloze se objevilo další místo, kam se dá letět.',
      en: 'You made it. The light in your palm was heavier than it looked, and for the first time the silence was not empty. The lantern swayed — and another place appeared in the sky to fly to.',
        es: 'Lo lograste. La luz en tu palma pesaba más de lo que parecía, y por primera vez el silencio no estaba vacío. La linterna se meció — y en el cielo apareció otro lugar al que volar.',
    },
  },
  wind: {
    id: 'wind',
    title: { cs: 'Výš než strach', en: 'Higher than fear' },
    text: {
      cs: 'Vítr už tě nevede, jen ti stojí v cestě — a ty letíš dál. Mezi proudy je prázdno, které se nedá obejít; dá se jen přečkat. Zjistila jsi, že lucerna vydrží, i když si nejsi jistá.',
      en: 'The wind no longer leads you, it only stands in the way — and you keep flying. Between the currents there is emptiness you cannot go around; you can only outlast it. You learned the lantern holds even when you are not sure.',
        es: 'El viento ya no te guía, solo se interpone — y tú sigues volando. Entre las corrientes hay un vacío que no se puede rodear; solo se puede resistir. Aprendiste que la linterna aguanta incluso cuando no estás seguro.',
    },
  },
  light: {
    id: 'light',
    title: { cs: 'Světlo, které zůstává', en: 'The light that stays' },
    text: {
      cs: 'Doletěla jsi na konec spirály. Sedmé světlo nesvítí víc než první — jen je jiné, protože už víš, co jsi cestou nechala za sebou. Svatyně se otevírá zevnitř.',
      en: 'You reached the end of the spiral. The seventh light does not shine brighter than the first — it is only different, because you now know what you left behind on the way. The shrine opens from the inside.',
        es: 'Llegaste al final de la espiral. La séptima luz no brilla más que la primera: es solo distinta, porque ahora sabes lo que dejaste atrás en el camino. El santuario se abre desde dentro.',
    },
  },
};

/** Kapitola, která patří k doletěné cestě. */
export function chapterAfter(pathId: LumiPathId): LumiChapter {
  return LUMI_CHAPTERS[pathId] ?? LUMI_CHAPTERS.calm;
}

/**
 * Úvod cesty podle toho, co už hráč doletěl.
 *
 * Vracející se hráč nedostane stejný text: obloha se posunula (L-7) a hra to
 * přizná. První průchod = základní intro z `LUMI_PATHS`.
 */
export function introFor(pathId: LumiPathId, paths: string[] = []): { text: LumiText; returning: boolean } {
  const path = LUMI_PATHS[pathId] ?? LUMI_PATHS.calm;
  const returning = paths.includes(path.id);
  if (!returning) return { text: path.intro, returning: false };

  const again: Record<LumiPathId, LumiText> = {
    calm: {
      cs: 'Tuhle cestu už znáš. Světla se posunula a proudy tečou jinudy — obloha si tě pamatuje, ale nechce ti to usnadnit.',
      en: 'You know this way already. The lights have shifted and the currents run elsewhere — the sky remembers you, but it will not make it easier.',
        es: 'Ya conoces este camino. Las luces se han movido y las corrientes van por otro lado: el cielo te recuerda, pero no te lo pondrá más fácil.',
    },
    wind: {
      cs: 'Vracíš se výš. Vítr je dnes jinde než minule; kdo spoléhá na paměť, doletí dřív, kdo na odvahu, dál.',
      en: 'You return higher. The wind is elsewhere than last time; whoever trusts memory arrives sooner, whoever trusts courage arrives farther.',
        es: 'Vuelves más alto. El viento está hoy en otro sitio; quien confía en la memoria llega antes, quien confía en el valor llega más lejos.',
    },
    light: {
      cs: 'Spirála je pořád stejná a ty taky — jen světla se posunula. Cesta není těžší, jen méně známá.',
      en: 'The spiral is the same and so are you — only the lights have moved. The way is not harder, just less known.',
        es: 'La espiral es la misma y tú también: solo se han movido las luces. El camino no es más difícil, solo menos conocido.',
    },
  };

  return { text: again[path.id] ?? path.intro, returning: true };
}

/** Dárek na konci: nechat si, nebo darovat. Texty i odměna. */
export const LUMI_GIFT = {
  keep: {
    label: { cs: 'Nechat si světlo', en: 'Keep the light' },
    text: {
      cs: 'Světlo zůstalo u tebe. Je teplé a tiché — a nikomu jinému nesvítí.',
      en: 'The light stayed with you. It is warm and quiet — and it shines for no one else.',
        es: 'La luz se quedó contigo. Es cálida y silenciosa — y no brilla para nadie más.',
    },
  },
  give: {
    label: { cs: 'Darovat světlo', en: 'Give the light away' },
    text: {
      cs: 'Položil jsi světlo do svatyně a odešel bez něj. V oblaze zůstalo o jedno světlo víc, než když jsi přišel.',
      en: 'You set the light down in the shrine and left without it. The sky holds one more light than when you came.',
        es: 'Dejaste la luz en el santuario y te fuiste sin ella. El cielo tiene una luz más que cuando llegaste.',
    },
  },
} as const;

/** Bonus za darování — odměna je jen číslo, ne síla. */
export const LUMI_GIFT_BONUS = 150;
