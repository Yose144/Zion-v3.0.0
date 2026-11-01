import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'books',
  title: { cs: 'Knihovna', en: 'Library' },
  summary: {
    cs: 'Kánon — čtrnáct knih, každá s vlastním indexem a anglickou mutací.',
    en: 'The canon — fourteen books, each with its own index and English edition.',
  },
  icon: 'book',
  order: 60,
  layer: 'L4',
  ring: { x: -2.8, z: -0.55, hue: 44 },
  auth: 'none',
  windows: [{ id: 'index', title: { cs: 'Rejstřík', en: 'Index' }, size: 'lg' }],
  /* Katalog je generovaný z `canon/books` při buildu — žádné síťové čtení. */
  reads: [],
  status: 'live',
});
