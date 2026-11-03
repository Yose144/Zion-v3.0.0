import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'mining',
  title: { cs: 'Mining', en: 'Mining' },
  summary: {
    cs: 'Lokální těžař v desktop klientovi — rig, pool, hashrate, nastavení.',
    en: 'Local miner inside the desktop client — rig, pool, hashrate, settings.',
  },
  icon: 'anvil',
  order: 25,
  layer: 'L1',
  ring: { x: 1.35, z: 2.45, hue: 110 },
  auth: 'none',
  windows: [{ id: 'rig', title: { cs: 'Rig', en: 'Rig' }, size: 'lg' }],
  reads: [],
  status: 'live',
});
