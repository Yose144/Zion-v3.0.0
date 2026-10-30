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
 */

export type PortalStatus = 'stub' | 'wired';
export type SceneSlot = 'core' | 'surface' | 'ring' | 'orbit' | 'gate' | 'ship';
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
    id: 'issobella',
    layer: 'L6',
    title: { cs: 'Issobella', en: 'Issobella' },
    sourceApp: 'apps/website-v2.9',
    api: 'issobella tracker',
    status: 'stub',
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
