import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'market',
  title: { cs: 'Tržiště', en: 'Market' },
  summary: {
    cs: 'Výloha obchodu. Pokladna, platba a doprava zůstávají na marketu.',
    en: 'Shop window. Checkout, payment and shipping stay on the market.',
  },
  icon: 'bag',
  order: 30,
  layer: 'L4',
  ring: { x: -11.2, z: 4.6, hue: 268 },
  auth: 'none',
  windows: [{ id: 'shelf', title: { cs: 'Výloha', en: 'Shelf' }, size: 'lg' }],
  reads: [
    { id: 'products', service: 'market', path: '/api/shop/products?pageSize=8', cache: 120 },
  ],
  status: 'live',
});
