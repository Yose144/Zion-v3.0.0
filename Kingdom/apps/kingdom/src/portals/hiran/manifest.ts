import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'hiran',
  title: { cs: 'Věž', en: 'Tower' },
  summary: {
    cs: 'Hiran — AI vrstva. Stav inference; rozhovor přijde ve F4.',
    en: 'Hiran — the AI layer. Inference status; chat arrives in F4.',
  },
  icon: 'tower',
  order: 70,
  layer: 'L3',
  ring: { x: 2.8, z: 0.5, hue: 320 },
  auth: 'none',
  windows: [{ id: 'status', title: { cs: 'Stav', en: 'Status' }, size: 'md' }],
  reads: [{ id: 'probe', service: 'hiran', path: '/api/ai-chat', cache: 30 }],
  status: 'placeholder',
});
