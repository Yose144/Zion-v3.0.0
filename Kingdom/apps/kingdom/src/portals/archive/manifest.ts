import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'archive',
  title: { cs: 'Archiv v3', en: 'Archive v3' },
  summary: {
    cs: 'Web, jak vypadal ve verzi v3.3 — jen historie. Nic se tu needituje.',
    en: 'The website as it looked in v3.3 — history only. Nothing here is edited.',
  },
  icon: 'book',
  order: 95,
  layer: 'v3.3',
  ring: { x: -2.6, z: 1.4, hue: 42 },
  auth: 'none',
  windows: [
    { id: 'archive', title: { cs: 'ZION — Nirvana v3.3', en: 'ZION — Nirvana v3.3' }, size: 'lg' },
  ],
  /* Žádná čtení: archiv je statická kopie v `public/archive/v3`, ne služba. */
  reads: [],
  status: 'live',
});
