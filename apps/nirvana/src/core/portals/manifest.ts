/**
 * Portal Contract v1 — manifest řídí i scénu i shell.
 * Nový povrch = nová položka tady + modul v `portals/`.
 * `scene.slot` říká, kde ve vesmíru portál bydlí:
 *   core    — jádro/maják planety (L1)
 *   surface — místo na povrchu Nové Země (L5, města, přístav, kovárna, knihovna)
 *   ring    — stanice na prstenci Issobelly (L6)
 *   orbit   — světy na vnitřní oběžné dráze (L4 OASIS)
 *   gate    — Brána, volně v prostoru (apex/IntroPage)
 *   ship    — na palubě lodi (účet, strojovna)
 *   sun     — Hiran usedá ve středu soustavy (L3 AI Native)
 *   park    — Jupiter Station, pouť (herní místo)
 *   sea     — archa na velrybím koridoru (L5, třináctý uzel)
 *   fleet   — nebeská flotila na oběžné dráze Nové Země (L6, pohyblivý uzel)
 *   moon    — Měsíc, Matrix na Shackletonu (zrcadlo dvanácti pozemských misí)
 */

export type PortalStatus = 'stub' | 'wired';
export type SceneSlot = 'core' | 'surface' | 'ring' | 'orbit' | 'gate' | 'ship' | 'sun' | 'park' | 'sea' | 'fleet' | 'moon';
export type SurfaceSpot = 'harbor' | 'market' | 'forge' | 'library' | 'beacon' | 'gate' | 'ring';

export interface Portal {
  id: string;
  layer: string;
  title: { cs: string; en: string };
  sourceApp: string;
  api: string;
  status: PortalStatus;
  scene: { slot: SceneSlot; spot?: SurfaceSpot };
}

export const PORTALS: Portal[] = [
  {
    id: 'world',
    layer: 'L4',
    title: { cs: 'Svět', en: 'World' },
    sourceApp: 'apps/OasisWeb',
    api: '/api/oasis/worlds',
    status: 'wired',
    scene: { slot: 'orbit' },
  },
  {
    id: 'hiran',
    layer: 'L3',
    title: { cs: 'Hiran', en: 'Hiran' },
    sourceApp: 'V31/L3/ai-native',
    api: '/api/hiran',
    status: 'wired',
    scene: { slot: 'sun' },
  },
  {
    id: 'park',
    layer: 'L4',
    title: { cs: 'Pouť', en: 'Fair' },
    sourceApp: 'apps/nirvana',
    api: 'local park',
    status: 'wired',
    scene: { slot: 'park' },
  },
  {
    id: 'chain',
    layer: 'L1',
    title: { cs: 'Řetěz', en: 'Chain' },
    sourceApp: 'apps/website-v2.9',
    api: '/api/chain/stats',
    status: 'wired',
    scene: { slot: 'core', spot: 'beacon' },
  },
  {
    id: 'pool',
    layer: 'L1',
    title: { cs: 'Těžba', en: 'Mining' },
    sourceApp: 'apps/pool-ui',
    api: '/api/pool/coins',
    status: 'wired',
    scene: { slot: 'surface', spot: 'forge' },
  },
  {
    id: 'market',
    layer: 'L4',
    title: { cs: 'Trh', en: 'Market' },
    sourceApp: 'apps/MarketPlace',
    api: '/api/market/products',
    status: 'wired',
    scene: { slot: 'surface', spot: 'market' },
  },
  {
    id: 'books',
    layer: 'canon',
    title: { cs: 'Knihy', en: 'Books' },
    sourceApp: 'apps/website-v2.9',
    api: '/api/books',
    status: 'wired',
    scene: { slot: 'surface', spot: 'library' },
  },
  {
    id: 'harbor',
    layer: 'L5',
    title: { cs: 'Přístav', en: 'Harbor' },
    sourceApp: 'apps/IntroPage/freeworld',
    api: '/api/harbor',
    status: 'wired',
    scene: { slot: 'surface', spot: 'harbor' },
  },
  {
    // Třináctý uzel L5 — archa Království srdce · Nirvana. Není to místo na
    // pevnině, proto vlastní slot 'sea': pluje velrybím koridorem.
    id: 'archa',
    layer: 'L5',
    title: { cs: 'Archa', en: 'The Ark' },
    sourceApp: 'apps/shared/scenes/KralovstviSrdce',
    api: 'concept study B3',
    status: 'wired',
    scene: { slot: 'sea' },
  },
  {
    // L6 — nebeská flotila Nabukano: pohyblivý uzel nebe. Není to pin na
    // povrchu; visí na dráze mezi Novou Zemí a prstencem Issobelly.
    id: 'fleet',
    layer: 'L6',
    title: { cs: 'Flotila', en: 'Sky fleet' },
    sourceApp: 'apps/shared/scenes (concept) · canon/books/Nabukano',
    api: 'concept — no endpoint',
    status: 'wired',
    scene: { slot: 'fleet' },
  },
  {
    // Měsíc — Matrix na Shackletonu. Není to pozemský pin: drží obraz
    // dvanácti misí nad nimi („jak nahoře, tak dole").
    id: 'matrix',
    layer: 'L5',
    title: { cs: 'Matrix', en: 'Matrix' },
    sourceApp: 'apps/shared/scenes/Matrix',
    api: 'concept — no endpoint',
    status: 'wired',
    scene: { slot: 'moon' },
  },
  {
    id: 'issobella',
    layer: 'L6',
    title: { cs: 'Issobella', en: 'Issobella' },
    sourceApp: 'apps/shared/scenes/Issobella',
    api: '/present/issobella',
    status: 'wired',
    scene: { slot: 'ring', spot: 'ring' },
  },
  {
    id: 'account',
    layer: 'ZIS',
    title: { cs: 'Účet', en: 'Account' },
    sourceApp: 'apps/identity',
    api: '/api/auth/me',
    status: 'wired',
    scene: { slot: 'ship' },
  },
  {
    id: 'gate',
    layer: 'apex',
    title: { cs: 'Brána', en: 'Gate' },
    sourceApp: 'apps/IntroPage',
    api: 'apex static',
    status: 'stub',
    scene: { slot: 'gate', spot: 'gate' },
  },
  {
    id: 'compute',
    layer: 'engine',
    title: { cs: 'Strojovna', en: 'Engine room' },
    sourceApp: 'zion-compute',
    api: 'local slot status',
    status: 'stub',
    scene: { slot: 'ship' },
  },
];

export function portalById(id: string): Portal | undefined {
  return PORTALS.find((p) => p.id === id);
}

export function wiredPortals(): Portal[] {
  return PORTALS.filter((p) => p.status === 'wired');
}
