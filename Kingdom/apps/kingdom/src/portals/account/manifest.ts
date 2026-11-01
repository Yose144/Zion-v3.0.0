import { definePortal } from '@zion/contract';

export const manifest = definePortal({
  id: 'account',
  title: { cs: 'Účet', en: 'Account' },
  summary: {
    cs: 'Tvoje loď — session ZIS, podpis Ed25519 v prohlížeči.',
    en: 'Your ship — ZIS session, Ed25519 signing in the browser.',
  },
  icon: 'key',
  order: 90,
  layer: 'L0',
  /* Loď nemá místo ve vesmíru — cestuje s tebou, proto žádný ring. */
  auth: 'session',
  windows: [{ id: 'identity', title: { cs: 'Identita', en: 'Identity' }, size: 'md' }],
  reads: [],
  /* Jediný zápis, který Kingdom opravdu umí: podpis challenge v prohlížeči.
     Klíč zůstává v prohlížeči, sem jde jen podpis — server ho ověří u ZIS. */
  writes: [
    {
      id: 'sign-in',
      title: { cs: 'Přihlášení podpisem', en: 'Sign-in by signature' },
      auth: 'sign',
      service: 'auth',
      path: '/api/auth/login',
    },
  ],
  status: 'live',
});
