import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'issobella',
  title: { cs: 'Issobella', en: 'Issobella' },
  summary: {
    cs: 'L6 — orbitální stanice a DeSci papers s on-chain kotvou.',
    en: 'L6 — orbital stations and DeSci papers with an on-chain anchor.',
  },
  icon: 'orbit',
  order: 80,
  layer: 'L6',
  ring: { x: 1.05, z: -2.6, hue: 172 },
  auth: 'none',
  windows: [{ id: 'papers', title: { cs: 'Papers', en: 'Papers' }, size: 'lg' }],
  reads: [
    { id: 'health', service: 'issobella', path: '/api/issobella/health', cache: 60 },
    { id: 'papers', service: 'issobella', path: '/api/issobella/papers', cache: 60 },
    /* Základ cesty; portál připojuje `?id=`, protože id je vstup od člověka. */
    { id: 'paper', service: 'issobella', path: '/api/issobella/papers', cache: 60 },
    { id: 'proof', service: 'issobella', path: '/api/issobella/papers', cache: 60 },
  ],
  status: 'live',
});
