/**
 * The six founding L5 Free World communities — shared between the
 * planetary map and the community/registry sections.
 */

export type FreeWorldSiteStatus = 'development' | 'preparation' | 'vision';

export interface FreeWorldSite {
  key: string;
  name: string;
  lat: number;
  lon: number;
  status: FreeWorldSiteStatus;
  href: string;
  /** Approximate founding allocation (ZION) shown on markers/details. */
  allocationZion: number;
}

export const FREE_WORLD_SITES: FreeWorldSite[] = [
  {
    key: 'genesis-garden',
    name: 'Genesis Garden',
    lat: 37.17,
    lon: -8.62,
    status: 'development',
    href: '/terranova/genesis',
    allocationZion: 500_000_000,
  },
  {
    key: 'dharma-temple',
    name: 'Dharma Temple',
    lat: 28.66,
    lon: -17.87,
    status: 'preparation',
    href: '/terranova/dharma-temple',
    allocationZion: 500_000_000,
  },
  {
    key: 'te-piko-ora',
    name: 'Te Pīko Ora',
    lat: -16.83,
    lon: -151.44,
    status: 'vision',
    href: '/terranova/te-piko-ora',
    allocationZion: 500_000_000,
  },
  {
    key: 'golden-republic-bohemia',
    name: 'Golden Republic Bohemia',
    lat: 50.05,
    lon: 15.45,
    status: 'vision',
    href: '/terranova/golden-republic-bohemia',
    allocationZion: 500_000_000,
  },
  {
    key: 'bodhi-lanka',
    name: 'Bodhi Lanka',
    lat: 7.87,
    lon: 80.65,
    status: 'vision',
    href: '/terranova/bodhi-lanka',
    allocationZion: 500_000_000,
  },
  {
    key: 'lumi',
    name: 'LUMI · Nová Amerika',
    lat: 9.75,
    lon: -83.75,
    status: 'vision',
    href: '/terranova/nova-amerika',
    allocationZion: 500_000_000,
  },
];

export const SITE_STATUS_COLOR: Record<FreeWorldSiteStatus, string> = {
  development: '#fcd116', // gold — active build
  preparation: '#06b6d4', // cyan — in preparation
  vision: '#a855f7', // purple — planned
};
