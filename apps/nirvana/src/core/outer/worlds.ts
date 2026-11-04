/**
 * VNĚJŠÍ PLANETY — Uran, Neptun, Pluto.
 *
 * Tři světy, které byly do 2026-11-04 jen koule bez vchodu. Každý má vlastní
 * route (`/uranus`, `/neptune`, `/pluto`), vlastní scénu a vlastní dosier —
 * ne jen text v panelu. Data jsou jedna tabulka, aby se čísla nerozešla mezi
 * scénou, panel a stránkou.
 *
 * Fakta jsou ze zveřejněných hodnot NASA (JPL, planetary fact sheet); části
 * označené jako `lore` jsou jazyk ZIONu, ne astronomie — v UI jsou oddělené,
 * aby se to nepletlo.
 */

export type OuterWorldId = 'uranus' | 'neptune' | 'pluto';

export interface OuterWorld {
  id: OuterWorldId;
  name: string;
  /** Podtitul, který nese náladu světa. */
  epithet: { cs: string; en: string };
  /** Textura v `public/textures`; `null` = kreslí se proceduralně. */
  texture: string | null;
  tint: string;
  /** Axiální sklon ve stupních (Uran je na boku). */
  tilt: number;
  /** Prstence — jen Uran je má výrazné. */
  rings: boolean;
  radius: number;
  facts: { label: { cs: string; en: string }; value: { cs: string; en: string } }[];
  /** Proč to místo v ZIONu existuje. */
  lore: { cs: string; en: string };
  next: OuterWorldId | null;
}

export const OUTER_WORLDS: Record<OuterWorldId, OuterWorld> = {
  uranus: {
    id: 'uranus',
    name: 'Uran',
    epithet: { cs: 'Ledový archiv', en: 'The ice archive' },
    texture: '/textures/2k_uranus.jpg',
    tint: '#9fd8dc',
    tilt: 97.8,
    rings: true,
    radius: 1.7,
    facts: [
      { label: { cs: 'Vzdálenost', en: 'Distance' }, value: { cs: '19,2 AU · 2,87 mld km', en: '19.2 AU · 2.87 bn km' } },
      { label: { cs: 'Den', en: 'Day' }, value: { cs: '17,2 hodiny', en: '17.2 hours' } },
      { label: { cs: 'Rok', en: 'Year' }, value: { cs: '84 pozemských let', en: '84 Earth years' } },
      { label: { cs: 'Sklon osy', en: 'Axial tilt' }, value: { cs: '97,8° — planeta na boku', en: '97.8° — the planet lies on its side' } },
      { label: { cs: 'Teplota', en: 'Temperature' }, value: { cs: '−224 °C, nejchladnější atmosféra', en: '−224 °C, the coldest atmosphere' } },
      { label: { cs: 'Měsíce', en: 'Moons' }, value: { cs: '28 známých', en: '28 known' } },
    ],
    lore: {
      cs: 'Uran se valí po oběžné dráze na boku. Když se osa převrátí, mění se i to, co je nahoře — proto tu Nirvana drží archiv: co se jednou zapíše, zůstane zmrzlé a čitelné, i když se svět otočí.',
      en: 'Uran rolls along its orbit on its side. When the axis flips, so does what counts as up — which is why Nirvana keeps its archive here: what is written once stays frozen and legible even when the world turns over.',
    },
    next: 'neptune',
  },
  neptune: {
    id: 'neptune',
    name: 'Neptun',
    epithet: { cs: 'Hlubina', en: 'The deep' },
    texture: '/textures/2k_neptune.jpg',
    tint: '#4d6fd1',
    tilt: 28.3,
    rings: false,
    radius: 1.65,
    facts: [
      { label: { cs: 'Vzdálenost', en: 'Distance' }, value: { cs: '30,1 AU · 4,5 mld km', en: '30.1 AU · 4.5 bn km' } },
      { label: { cs: 'Den', en: 'Day' }, value: { cs: '16,1 hodiny', en: '16.1 hours' } },
      { label: { cs: 'Rok', en: 'Year' }, value: { cs: '165 pozemských let', en: '165 Earth years' } },
      { label: { cs: 'Vítr', en: 'Wind' }, value: { cs: 'až 2 100 km/h — nejrychlejší v soustavě', en: 'up to 2,100 km/h — fastest in the system' } },
      { label: { cs: 'Teplota', en: 'Temperature' }, value: { cs: '−214 °C', en: '−214 °C' } },
      { label: { cs: 'Měsíce', en: 'Moons' }, value: { cs: '16 známých (Triton)', en: '16 known (Triton)' } },
    ],
    lore: {
      cs: 'Neptun je modrý proto, že v jeho atmosféře pohlcuje červenou methan — ne proto, že by byl klidný. Vichr tam letí šestkrát rychleji než zvuk. Hlubina je místo, kde se hráč učí, že ticho není totéž co mír.',
      en: 'Neptune is blue because methane in its atmosphere absorbs red — not because it is calm. Its winds run six times faster than sound. The deep is where a player learns that silence is not the same as peace.',
    },
    next: 'pluto',
  },
  pluto: {
    id: 'pluto',
    name: 'Pluto',
    epithet: { cs: 'Srdce na okraji', en: 'The heart at the edge' },
    texture: null,
    tint: '#c9b8a8',
    tilt: 122.5,
    rings: false,
    radius: 0.9,
    facts: [
      { label: { cs: 'Vzdálenost', en: 'Distance' }, value: { cs: '39,5 AU · 5,9 mld km', en: '39.5 AU · 5.9 bn km' } },
      { label: { cs: 'Den', en: 'Day' }, value: { cs: '6,4 pozemského dne', en: '6.4 Earth days' } },
      { label: { cs: 'Rok', en: 'Year' }, value: { cs: '248 pozemských let', en: '248 Earth years' } },
      { label: { cs: 'Teplota', en: 'Temperature' }, value: { cs: '−229 °C', en: '−229 °C' } },
      { label: { cs: 'Srdce', en: 'The heart' }, value: { cs: 'Sputnik Planitia, ~1 000 km ledové pláně', en: 'Sputnik Planitia, ~1,000 km of nitrogen ice' } },
      { label: { cs: 'Měsíce', en: 'Moons' }, value: { cs: '5 (Charon téměř jako dvojče)', en: '5 (Charon is nearly a twin)' } },
    ],
    lore: {
      cs: 'Pluto není konec, je to okraj. Srdce z dusíkového ledu se pomalu přelévá a přepisuje — stejně jako každý, kdo sem dojde. Kdo se sem vrátí, nemá si odnést vítězství, ale to, co si odnést chtěl.',
      en: 'Pluto is not the end, it is the edge. A heart of nitrogen ice slowly flows and rewrites itself — like anyone who comes here. Whoever returns should not carry away a victory, but whatever they meant to keep.',
    },
    next: null,
  },
};

export const OUTER_ORDER: OuterWorldId[] = ['uranus', 'neptune', 'pluto'];
