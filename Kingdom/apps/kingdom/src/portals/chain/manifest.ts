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
  ring: { x: 0, z: 2.75, hue: 196 },
  auth: 'none',
  windows: [{ id: 'overview', title: { cs: 'Přehled', en: 'Overview' }, size: 'md' }],
  reads: [
    { id: 'stats', service: 'chain', path: '/api/blockchain/stats', cache: 20 },
    { id: 'blocks', service: 'chain', path: '/api/blockchain/blocks?limit=8', cache: 15 },
    { id: 'transactions', service: 'chain', path: '/api/blockchain/transactions?limit=8', cache: 15 },
    /* Základ cesty; portál připojuje `?addr=`, protože adresa je vstup od člověka. */
    { id: 'address', service: 'chain', path: '/api/blockchain/address', cache: 30, timeoutMs: 15000 },
  ],
  status: 'live',
});
