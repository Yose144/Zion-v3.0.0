/**
 * L5 Free World — 12 zakládajících misí na planetě.
 * Zrcadlo `apps/website-v2.9/src/lib/freeworld-sites.ts` (kanonický zdroj) —
 * držet synchronizované. href vede na komunitní stránku app.zionterranova.com.
 */

export type MissionStatus = 'preparation' | 'vision' | 'built';

export interface FreeWorldMission {
  key: string;
  name: string;
  lat: number;
  lon: number;
  status: MissionStatus;
  path: string;
  /** interní 3D prezentace v Nirvaně (má přednost před externím path) */
  present?: string;
}

export const MISSION_ORIGIN = 'https://app.zionterranova.com';

export const FREE_WORLD_MISSIONS: FreeWorldMission[] = [
  { key: 'genesis-garden', name: 'Genesis Garden', lat: 39.678848, lon: -8.477842, status: 'preparation', path: '/terranova/genesis', present: '/present/genesis-garden' },
  { key: 'dharma-temple', name: 'Dharma Temple', lat: 28.66, lon: -17.87, status: 'preparation', path: '/terranova/dharma-temple', present: '/present/dharma-temple' },
  { key: 'te-piko-ora', name: 'Te Pīko Ora', lat: -16.83, lon: -151.44, status: 'preparation', path: '/terranova/te-piko-ora', present: '/present/te-piko-ora' },
  { key: 'golden-republic-bohemia', name: 'Golden Republic Bohemia', lat: 50.05, lon: 15.45, status: 'preparation', path: '/terranova/golden-republic-bohemia', present: '/present/golden-republic-bohemia' },
  { key: 'bodhi-lanka', name: 'Bodhi Lanka', lat: 7.87, lon: 80.65, status: 'preparation', path: '/terranova/bodhi-lanka', present: '/present/bodhi-lanka' },
  { key: 'ekam', name: 'Ekam · Oneness Temple', lat: 13.42, lon: 79.67, status: 'built', path: '/terranova/ekam', present: '/present/ekam' },
  { key: 'lumi', name: 'LUMI · Nová Amerika', lat: 9.75, lon: -83.75, status: 'preparation', path: '/terranova/nova-amerika', present: '/present/nova-amerika' },
  { key: 'uluru', name: 'Uluru', lat: -25.34, lon: 131.04, status: 'vision', path: '/terranova/uluru' },
  { key: 'maria-del-camino', name: 'María del Camino', lat: 42.43, lon: -8.65, status: 'preparation', path: '/terranova/maria-del-camino', present: '/present/maria-del-camino' },
  { key: 'boa-esperanca', name: 'Boa Esperança', lat: -34.35, lon: 18.47, status: 'vision', path: '/terranova/boa-esperanca' },
  { key: 'kailash', name: 'Kailash', lat: 31.07, lon: 81.31, status: 'vision', path: '/terranova/kailash' },
  { key: 'amenti', name: 'Amenti · Giza', lat: 29.98, lon: 31.13, status: 'vision', path: '/terranova/amenti' },
];

export const MISSION_STATUS_COLOR: Record<MissionStatus, string> = {
  preparation: '#06b6d4', // cyan — financované komunity v přípravě
  vision: '#a855f7', // purple — vizní uzly
  built: '#f5f5f4', // marble — Ekam stojí
};
