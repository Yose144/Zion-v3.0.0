/**
 * The L5 Free World community sites — shared between the planetary
 * map and the community/registry sections. Six founding communities
 * carry a funded 500M allocation; María del Camino (the vessel node)
 * carries a 300M founding reserve; Uluru + Boa Esperança + Kailash stay
 * vision-stage with no committed allocation — and Ekam is the only
 * node already built (2008), held as a relationship, not a project.
 */

export type FreeWorldSiteStatus = 'development' | 'preparation' | 'vision' | 'built';

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
    lat: 39.678848,
    lon: -8.477842,
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
    // Ekam (Oneness Temple), Varadaiahpalem, Andhra Pradesh — the only
    // node that already stands (built 2008). The template the other
    // nodes learn from; a relationship, not a ZION construction.
    key: 'ekam',
    name: 'Ekam · Oneness Temple',
    lat: 13.42,
    lon: 79.67,
    status: 'built',
    href: '/terranova/ekam',
    allocationZion: 0,
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
  {
    // The vessel node — a sailing ship connecting all fixed nodes across
    // the oceans. Marker sits at the Galician home port (Pontevedra ría,
    // on the coastal Camino); the node itself is the route, not the point.
    key: 'maria-del-camino',
    name: 'María del Camino',
    lat: 42.43,
    lon: -8.65,
    status: 'preparation',
    href: '/terranova/maria-del-camino',
    allocationZion: 300_000_000,
  },
  {
    // Cape of Good Hope — the seam of two oceans and the turning point
    // of the Great Route; home of humanity's oldest lineage (Khoisan).
    // Vision stage: a relationship node like Uluru — no funded allocation.
    key: 'boa-esperanca',
    name: 'Boa Esperança',
    lat: -34.35,
    lon: 18.47,
    status: 'vision',
    href: '/terranova/boa-esperanca',
    allocationZion: 0,
  },
  {
    // Mt. Kailash / Gang Rinpoche — the only mountain never climbed; the
    // desert of purification and the council of masters at the primordial
    // fire. Vision stage like Uluru and Boa: a relationship node held by
    // the custodians of four traditions — no parcel, no construction.
    key: 'kailash',
    name: 'Kailash',
    lat: 31.07,
    lon: 81.31,
    status: 'vision',
    href: '/terranova/kailash',
    allocationZion: 0,
  },
];

export const SITE_STATUS_COLOR: Record<FreeWorldSiteStatus, string> = {
  development: '#fcd116', // gold — reserved for active build phase
  preparation: '#06b6d4', // cyan — in preparation
  vision: '#a855f7', // purple — planned
  built: '#f5f5f4', // marble white — already standing (Ekam)
};
