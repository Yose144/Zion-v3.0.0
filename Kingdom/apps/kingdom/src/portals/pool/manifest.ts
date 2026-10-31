import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'pool',
  title: { cs: 'Kovárna', en: 'Forge' },
  summary: {
    cs: 'Mince, upstream nohy a stav těžby na poolu.',
    en: 'Coins, upstream legs and mining state on the pool.',
  },
  icon: 'anvil',
  order: 20,
  layer: 'L1',
  ring: { x: 12.4, z: -3.1, hue: 34 },
  auth: 'none',
  windows: [{ id: 'coins', title: { cs: 'Mince', en: 'Coins' }, size: 'lg' }],
  reads: [
    { id: 'coins', service: 'pool', path: '/public/v1/coins', cache: 30 },
  ],
  status: 'live',
});
