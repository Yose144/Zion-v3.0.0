/**
 * The L5 Free World community sites — shared between the planetary
 * map and the community/registry sections. Six founding communities
 * carry a funded allocation; later sites (e.g. Uluru) start as
 * vision-stage with no committed allocation.
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
    status: 'preparation',
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
    status: 'preparation',
    href: '/terranova/te-piko-ora',
    allocationZion: 500_000_000,
  },
  {
    key: 'golden-republic-bohemia',
    name: 'Golden Republic Bohemia',
    lat: 50.05,
    lon: 15.45,
    status: 'preparation',
    href: '/terranova/golden-republic-bohemia',
    allocationZion: 500_000_000,
  },
  {
    key: 'bodhi-lanka',
    name: 'Bodhi Lanka',
    lat: 7.87,
    lon: 80.65,
    status: 'preparation',
    href: '/terranova/bodhi-lanka',
    allocationZion: 500_000_000,
  },
  {
    key: 'lumi',
    name: 'LUMI · Nová Amerika',
    lat: 9.75,
    lon: -83.75,
    status: 'preparation',
    href: '/terranova/nova-amerika',
    allocationZion: 500_000_000,
  },
  {
    // Aboriginal Australia — the Dreamtime/songlines heritage from the
    // antipodes. Vision stage: no funded allocation or on-site community
    // yet; the node is a relationship, not a construction site.
    key: 'uluru',
    name: 'Uluru',
    lat: -25.34,
    lon: 131.04,
    status: 'vision',
    href: '/terranova/uluru',
    allocationZion: 0,
  },
];

export const SITE_STATUS_COLOR: Record<FreeWorldSiteStatus, string> = {
  development: '#fcd116', // gold — reserved for active build phase
  preparation: '#06b6d4', // cyan — in preparation
  vision: '#a855f7', // purple — planned
};
