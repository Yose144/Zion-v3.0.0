import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'freeworld',
  title: { cs: 'Přístav', en: 'Harbor' },
  summary: {
    cs: 'Fond L5, granty a projekty komunit — čtení z free-world služby.',
    en: 'L5 fund, grants and community projects — read from the free-world service.',
  },
  icon: 'anchor',
  order: 40,
  layer: 'L5',
  ring: { x: 0, z: -2.85, hue: 150 },
  auth: 'none',
  windows: [
    { id: 'fund', title: { cs: 'Fond', en: 'Fund' }, size: 'md' },
    { id: 'grants', title: { cs: 'Granty', en: 'Grants' }, size: 'lg' },
    { id: 'projects', title: { cs: 'Projekty', en: 'Projects' }, size: 'lg' },
  ],
  reads: [
    { id: 'fund', service: 'freeworld', path: '/api/free-world/fund/balance', cache: 60 },
    { id: 'grants', service: 'freeworld', path: '/api/free-world/grants', cache: 120 },
    { id: 'projects', service: 'freeworld', path: '/api/free-world/projects', cache: 120 },
  ],
  status: 'live',
});
