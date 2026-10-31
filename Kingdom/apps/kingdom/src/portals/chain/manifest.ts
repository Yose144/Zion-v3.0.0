import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'chain',
  title: { cs: 'Řetěz', en: 'Chain' },
  summary: {
    cs: 'Výška, obtížnost, peers a mempool z primárního uzlu.',
    en: 'Height, difficulty, peers and mempool from the primary node.',
  },
  icon: 'link',
  order: 10,
  layer: 'L1',
  ring: { x: 0, z: 0, hue: 196 },
  auth: 'none',
  windows: [{ id: 'overview', title: { cs: 'Přehled', en: 'Overview' }, size: 'md' }],
  reads: [
    { id: 'stats', service: 'chain', path: '/api/blockchain/stats', cache: 20 },
  ],
  status: 'live',
});
