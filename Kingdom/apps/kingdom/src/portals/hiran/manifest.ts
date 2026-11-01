import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'hiran',
  title: { cs: 'Věž', en: 'Tower' },
  summary: {
    cs: 'Hiran — AI vrstva. Stav inference a rozhovor nad kanonickými dokumenty.',
    en: 'Hiran — the AI layer. Inference status and a chat over the canonical docs.',
  },
  icon: 'tower',
  order: 70,
  layer: 'L3',
  ring: { x: 2.8, z: 0.5, hue: 320 },
  auth: 'none',
  windows: [{ id: 'status', title: { cs: 'Stav', en: 'Status' }, size: 'md' }],
  reads: [{ id: 'probe', service: 'hiran', path: '/api/ai-chat', cache: 30 }],
  writes: [
    {
      id: 'chat',
      title: { cs: 'Otázka Hiranovi', en: 'Ask Hiran' },
      auth: 'session',
      service: 'hiran',
      path: '/api/ai-chat',
    },
  ],
  status: 'live',
});
