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
  ring: { x: 2.45, z: -1.25, hue: 34 },
  auth: 'none',
  windows: [{ id: 'coins', title: { cs: 'Mince', en: 'Coins' }, size: 'lg' }],
  reads: [
    { id: 'coins', service: 'pool', path: '/public/v1/coins', cache: 30 },
    { id: 'miners', service: 'pool', path: '/public/v1/miners?limit=32', cache: 30 },
    { id: 'history', service: 'pool', path: '/public/v1/history?limit=60', cache: 60 },
    { id: 'payouts', service: 'pool', path: '/public/v1/payouts?limit=12', cache: 60 },
    { id: 'coinStats', service: 'pool', path: '/public/v1/coins/zion/stats', cache: 60 },
    { id: 'blocks', service: 'pool', path: '/public/v1/blocks?limit=8', cache: 60 },
    /* Základ cesty; peněženka je vstup od člověka, portál připojuje `/<addr>`. */
    { id: 'miner', service: 'pool', path: '/public/v1/miner/zion', cache: 30 },
  ],
  status: 'live',
});
