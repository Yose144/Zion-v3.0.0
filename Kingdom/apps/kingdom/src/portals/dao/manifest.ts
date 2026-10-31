import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'dao',
  title: { cs: 'Snem', en: 'Assembly' },
  summary: {
    cs: 'Strážci, návrhy a správa protokolu na L2.',
    en: 'Guardians, proposals and protocol governance on L2.',
  },
  icon: 'vote',
  order: 50,
  layer: 'L2',
  ring: { x: 1.6, z: 2.25, hue: 214 },
  auth: 'none',
  windows: [
    { id: 'stats', title: { cs: 'Přehled', en: 'Overview' }, size: 'md' },
    { id: 'guardians', title: { cs: 'Strážci', en: 'Guardians' }, size: 'lg' },
    { id: 'proposals', title: { cs: 'Návrhy', en: 'Proposals' }, size: 'lg' },
  ],
  reads: [
    { id: 'stats', service: 'dao', path: '/api/dao/stats', cache: 60 },
    { id: 'guardians', service: 'dao', path: '/api/dao/guardians', cache: 300 },
    { id: 'proposals', service: 'dao', path: '/api/dao/proposals', cache: 60 },
  ],
  status: 'live',
});
