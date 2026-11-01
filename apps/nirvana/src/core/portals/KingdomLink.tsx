'use client';

import { useI18n } from '@/core/i18n';

/**
 * ODKAZ DO KINGDOM KLIENTA.
 *
 * Nirvana má vlastní okna (rychlý přehled ve scéně), ale skutečná práce —
 * explorer, obchod, knihovna, účet — patří Kingdom klientovi. Tenhle odkaz
 * je druhá cesta: okno zůstává, tohle otevře plnou verzi ve stejném portálu.
 *
 * Session je společná (cookie `.zionterranova.com`), takže člověk přistane
 * přihlášený; odkaz proto vede na nový tab a nic se nepropsává.
 */

export const KINGDOM_BASE = process.env.NEXT_PUBLIC_KINGDOM_URL ?? 'https://kingdom.zionterranova.com';

/** Portál v Nirvaně → portál v Kingdomu. Když id chybí, odkaz se nevykreslí. */
export const KINGDOM_PORTALS: Record<string, string> = {
  chain: 'chain',
  pool: 'pool',
  market: 'market',
  books: 'books',
  account: 'account',
  hiran: 'hiran',
  issobella: 'issobella',
  harbor: 'freeworld',
};

export function KingdomLink({ portalId }: { portalId: string }) {
  const { lang } = useI18n();
  const target = KINGDOM_PORTALS[portalId];
  if (!target) return null;
  return (
    <a
      className="kingdom-link"
      href={`${KINGDOM_BASE}/portal/${target}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {lang === 'cs' ? 'otevřít v Kingdomu' : 'open in Kingdom'} ↗
    </a>
  );
}
