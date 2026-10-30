/**
 * Work list for the Nirvana shell. A portal is wired when this app
 * renders it against a live API. Stubs stay listed so the old hostname
 * has a home here before DNS moves.
 */

export type PortalStatus = 'stub' | 'wired';

export interface Portal {
  id: string;
  layer: string;
  title: { cs: string; en: string };
  sourceApp: string;
  api: string;
  status: PortalStatus;
}

export const PORTALS: Portal[] = [
  {
    id: 'world',
    layer: 'L4',
    title: { cs: 'Svět', en: 'World' },
    sourceApp: 'apps/OasisWeb',
    api: '/api/oasis/worlds',
    status: 'wired',
  },
  {
    id: 'chain',
    layer: 'L1',
    title: { cs: 'Řetěz', en: 'Chain' },
    sourceApp: 'apps/website-v2.9',
    api: '/api/chain/stats',
    status: 'wired',
  },
  {
    id: 'mine',
    layer: 'L1',
    title: { cs: 'Těžba', en: 'Mining' },
    sourceApp: 'apps/pool-ui',
    api: '/api/pool/coins',
    status: 'wired',
  },
  {
    id: 'market',
    layer: 'L4',
    title: { cs: 'Trh', en: 'Market' },
    sourceApp: 'apps/MarketPlace',
    api: '/api/market/products',
    status: 'wired',
  },
  {
    id: 'books',
    layer: 'canon',
    title: { cs: 'Knihy', en: 'Books' },
    sourceApp: 'apps/website-v2.9',
    api: '/api/books',
    status: 'wired',
  },
  {
    id: 'harbor',
    layer: 'L5',
    title: { cs: 'Přístav', en: 'Harbor' },
    sourceApp: 'apps/IntroPage/freeworld',
    api: '/api/harbor',
    status: 'wired',
  },
  {
    id: 'issobella',
    layer: 'L6',
    title: { cs: 'Issobella', en: 'Issobella' },
    sourceApp: 'apps/website-v2.9',
    api: 'issobella tracker',
    status: 'stub',
  },
  {
    id: 'account',
    layer: 'ZIS',
    title: { cs: 'Účet', en: 'Account' },
    sourceApp: 'apps/identity',
    api: '/api/auth/me',
    status: 'wired',
  },
  {
    id: 'gate',
    layer: 'apex',
    title: { cs: 'Brána', en: 'Gate' },
    sourceApp: 'apps/IntroPage',
    api: 'apex static',
    status: 'stub',
  },
];

export function portalById(id: string): Portal | undefined {
  return PORTALS.find((p) => p.id === id);
}
