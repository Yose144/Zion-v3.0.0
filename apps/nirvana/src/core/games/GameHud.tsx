'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useAuth } from '@/core/session/AuthProvider';
import { useNet } from '@/core/net/useNet';
import { loadProfile } from '@/core/park/profile';
import { GAME_LINKS } from './links';
import { useWallet } from './useWallet';

/**
 * HERNÍ HUD — jedno místo, kde je vidět, kde jsi, co můžeš mačkat a co máš.
 *
 * Na vesmíru je to spodní lišta (dřív `GamesDock`), na herních stránkách
 * kompaktní proužek vlevo dole, aby nekolidoval s jejich vlastním HUD
 * (zdraví/rychlost) ani s tabulí vpravo nahoře.
 *
 * Čísla, která ukazuje: žetony (localStorage), online (chat presence),
 * ZION zůstatek (z uzlu přes `/api/wallet/balance` — viz `useWallet`).
 */

const SURFACES = ['/', '/park', '/mars', '/venus', '/avatars'];

const CONTROLS: Record<string, { cs: string; en: string }> = {
  '/': { cs: 'tažení myší = orbita · kolečko = přiblížení · klik na planetu = hra', en: 'drag = orbit · wheel = zoom · click a planet = game' },
  '/park': { cs: 'vyber skříň · ve hrách šipky/WASD a klik', en: 'pick a cabinet · arrows/WASD and click in games' },
  '/mars': { cs: 'WASD · mezerník skok · 1/2/3 zbraň · klik střelba', en: 'WASD · space jump · 1/2 weapon · click fire' },
  '/venus': { cs: 'W/S plyn a brzda · A/D zatáčení', en: 'W/S throttle and brake · A/D steer' },
  '/avatars': { cs: 'klikni postavu · pak Uložit', en: 'click a figure · then Save' },
};

export function GameHud() {
  const pathname = usePathname() ?? '/';
  const { lang } = useI18n();
  const { user } = useAuth();
  const { online } = useNet();
  const wallet = useWallet();
  const [tokens, setTokens] = useState<number | null>(null);

  useEffect(() => {
    // profil čte localStorage — až po mountu, ať SSR nesedí na jiném čísle
    const timer = setTimeout(() => setTokens(loadProfile().tokens), 250);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const refresh = () => setTokens(loadProfile().tokens);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  if (!SURFACES.includes(pathname)) return null;

  const dock = pathname === '/';
  const controls = CONTROLS[pathname]?.[lang] ?? '';
  const name =
    user?.avatar3d?.callsign ??
    user?.displayName ??
    (user ? `${user.primaryAddress.slice(0, 8)}…` : null);
  const zion =
    wallet.state === 'ready' && wallet.zion !== null
      ? wallet.zion.toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : wallet.state === 'loading'
        ? '…'
        : '—';

  return (
    <nav className={`game-hud${dock ? ' is-dock' : ' is-compact'}`} aria-label={lang === 'cs' ? 'Hry a účet' : 'Games and account'}>
      <div className="game-hud-tabs">
        {GAME_LINKS.map((game) => (
          <Link
            key={game.id}
            href={game.href}
            className={`game-hud-tab${pathname === game.href ? ' is-active' : ''}`}
            style={{ ['--game-tone' as string]: game.tone }}
            aria-current={pathname === game.href ? 'page' : undefined}
          >
            <span aria-hidden>{game.glyph}</span>
            <span className="game-hud-tab-text">{game.title[lang]}</span>
          </Link>
        ))}
      </div>

      {controls && <span className="game-hud-controls">{controls}</span>}

      <div className="game-hud-stats">
        <span className="game-hud-chip" title={lang === 'cs' ? 'žetony z pouti' : 'fair tokens'}>
          <em aria-hidden>◎</em> {tokens === null ? '—' : tokens}
        </span>
        <span className="game-hud-chip" title={lang === 'cs' ? 'hráči online' : 'players online'}>
          <em aria-hidden>◉</em> {online}
        </span>
        <span
          className={`game-hud-chip is-zion${wallet.state === 'unavailable' ? ' is-down' : ''}`}
          title={wallet.address ?? (lang === 'cs' ? 'přihlas se pro zůstatek' : 'sign in for your balance')}
        >
          <em aria-hidden>⬢</em> {zion} ZION
        </span>
        {name ? (
          <span className="game-hud-chip is-who" title={user?.primaryAddress ?? ''}>
            {name}
          </span>
        ) : (
          <a href="/#portal=account" className="game-hud-chip is-signin">
            {lang === 'cs' ? 'přihlásit' : 'sign in'}
          </a>
        )}
      </div>
    </nav>
  );
}
