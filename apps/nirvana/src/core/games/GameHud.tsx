'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n, tx } from '@/core/i18n';
import { useAuth } from '@/core/session/AuthProvider';
import { useNet } from '@/core/net/useNet';
import { loadProfile, type ParkProfile } from '@/core/park/profile';
import { levelProgress } from '@/core/progress/run';
import { loadJournal } from '@/core/lumi/journal';
import { SoundToggle } from '@/core/shell/SoundToggle';
import { LeaderboardsPanel } from './LeaderboardsPanel';
import { GameMenu } from './GameMenu';
import { CONTROLS, SURFACES } from './surfaces';
import { GAME_LINKS } from './links';
import { useWallet } from './useWallet';

function hud(lang: string, cs: string, en: string, es: string, pt: string, fr: string) {
  if (lang === 'cs') return cs;
  if (lang === 'es') return es;
  if (lang === 'pt') return pt;
  if (lang === 'fr') return fr;
  return en;
}

function numLocale(lang: string) {
  if (lang === 'cs') return 'cs-CZ';
  if (lang === 'fr') return 'fr-FR';
  if (lang === 'es') return 'es-ES';
  if (lang === 'pt') return 'pt-PT';
  return 'en-US';
}

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

export function GameHud() {
  const pathname = usePathname() ?? '/';
  const { lang } = useI18n();
  const { user } = useAuth();
  const { online } = useNet();
  const wallet = useWallet();
  const [profile, setProfile] = useState<ParkProfile | null>(null);
  /** Lumi: kolik světel z deníku už máš (0..7). */
  const [lumiLights, setLumiLights] = useState(0);
  const [boards, setBoards] = useState(false);

  useEffect(() => {
    // profil čte localStorage — až po mountu, ať SSR nesedí na jiném čísle
    const timer = setTimeout(() => {
      setProfile(loadProfile());
      setLumiLights(loadJournal().found.length);
    }, 250);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const refresh = () => {
      setProfile(loadProfile());
      setLumiLights(loadJournal().found.length);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  if (!SURFACES.includes(pathname)) return null;

  const dock = pathname === '/';
  const tokens = profile?.tokens ?? null;
  // `null` = profil se ještě nenačetl; ukazovat v tu chvíli „level 1"
  // by každému na půl vteřiny lhalo o pokroku.
  const level = profile ? levelProgress(profile.runs) : null;
  const controls = tx(CONTROLS[pathname], lang);
  const name =
    user?.avatar3d?.callsign ??
    user?.displayName ??
    (user ? `${user.primaryAddress.slice(0, 8)}…` : null);
  const zion =
    wallet.state === 'ready' && wallet.zion !== null
      ? wallet.zion.toLocaleString(numLocale(lang), {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : wallet.state === 'loading'
        ? '…'
        : '—';

  return (
    <>
      {/* Hamburger menu je mimo `.game-hud`, protože lištu hra schovává
          (`body[data-playing='1']`) — nastavení musí zůstat po ruce. */}
      <GameMenu />
      <nav className={`game-hud${dock ? ' is-dock' : ' is-compact'}`} aria-label={hud(lang, 'Hry a účet', 'Games and account', 'Juegos y cuenta', 'Jogos e conta', 'Jeux et compte')}>
      <div className="game-hud-tabs">
        {/* Domovská záložka — z každé hry i povrchu cesta do vesmíru.
            Bez ní na /mars, /venus, /earth… nevedla do `/` žádná cesta
            (jen browser back); zpět na Zemi je workflow, ne detail. */}
        <Link
          href="/"
          className={`game-hud-tab is-home${pathname === '/' ? ' is-active' : ''}`}
          style={{ ['--game-tone' as string]: '#fcd116' }}
          aria-current={pathname === '/' ? 'page' : undefined}
        >
          <span aria-hidden>◈</span>
          <span className="game-hud-tab-text">{hud(lang, 'Nirvana', 'Nirvana', 'Nirvana', 'Nirvana', 'Nirvana')}</span>
        </Link>
        {GAME_LINKS.map((game) => (
          <Link
            key={game.id}
            href={game.href}
            className={`game-hud-tab${pathname === game.href ? ' is-active' : ''}`}
            style={{ ['--game-tone' as string]: game.tone }}
            aria-current={pathname === game.href ? 'page' : undefined}
          >
            <span aria-hidden>{game.glyph}</span>
            <span className="game-hud-tab-text">{tx(game.title, lang)}</span>
          </Link>
        ))}
        {/* Lobby je rozcestník, ne hra — vlastní odkaz na konci řady. */}
        <Link
          href="/multiplayer"
          className={`game-hud-tab is-lobby${pathname === '/multiplayer' ? ' is-active' : ''}`}
          style={{ ['--game-tone' as string]: '#9df0e2' }}
        >
          <span aria-hidden>🌐</span>
          <span className="game-hud-tab-text">{hud(lang, 'Online', 'Online', 'En línea', 'Online', 'En ligne')}</span>
        </Link>
      </div>

      {controls && <span className="game-hud-controls">{controls}</span>}

      <div className="game-hud-stats">
        <SoundToggle label={{ on: hud(lang, 'zvuk zap', 'sound on', 'sonido', 'som', 'son'), off: hud(lang, 'zvuk vyp', 'sound off', 'silencio', 'mudo', 'muet') }} />
        <span className="game-hud-chip" title={hud(lang, 'žetony z pouti', 'fair tokens', 'fichas de la feria', 'fichas da feira', 'jetons de la fête')}>
          <em aria-hidden>◎</em> {tokens === null ? '—' : tokens}
        </span>
        <Link
          href="/lumi"
          className="game-hud-chip is-lumi"
          title={`Lumi · ${lumiLights}/7 ${hud(lang, 'světel v deníku', 'lights in the journal', 'luces en el diario', 'luzes no diário', 'lumières dans le journal')}`}
        >
          <em aria-hidden>🏮</em> {lumiLights}/7
        </Link>
        <span
          className="game-hud-chip is-level"
          title={
            level
              ? hud(
                  lang,
                  `level ${level.level} · ${profile?.runs ?? 0} dohraných her · do dalšího ${level.remaining}`,
                  `level ${level.level} · ${profile?.runs ?? 0} games · ${level.remaining} to next`,
                  `nivel ${level.level} · ${profile?.runs ?? 0} partidas · faltan ${level.remaining}`,
                  `nível ${level.level} · ${profile?.runs ?? 0} jogos · faltam ${level.remaining}`,
                  `niveau ${level.level} · ${profile?.runs ?? 0} parties · encore ${level.remaining}`,
                )
              : hud(lang, 'profil se načítá', 'loading profile', 'cargando perfil', 'a carregar o perfil', 'chargement du profil')
          }
        >
          <em aria-hidden>★</em> {level ? level.level : '—'}
        </span>
        <button
          type="button"
          className="game-hud-chip is-boards"
          title={hud(lang, 'žebříčky všech her', 'leaderboards', 'clasificaciones', 'classificações', 'classements')}
          aria-expanded={boards}
          onClick={() => setBoards(true)}
        >
          <em aria-hidden>🏆</em>
        </button>
        <span className="game-hud-chip" title={hud(lang, 'hráči online', 'players online', 'jugadores en línea', 'jogadores online', 'joueurs en ligne')}>
          <em aria-hidden>◉</em> {online}
        </span>
        <span
          className={`game-hud-chip is-zion${wallet.state === 'unavailable' ? ' is-down' : ''}`}
          title={wallet.address ?? hud(lang, 'přihlas se pro zůstatek', 'sign in for your balance', 'entra para ver el saldo', 'entra para ver o saldo', 'connecte-toi pour le solde')}
        >
          <em aria-hidden>⬢</em> {zion} ZION
        </span>
        {name ? (
          <span className="game-hud-chip is-who" title={user?.primaryAddress ?? ''}>
            {name}
          </span>
        ) : (
          <a href="/#portal=account" className="game-hud-chip is-signin">
            {hud(lang, 'přihlásit', 'sign in', 'entrar', 'entrar', 'entrer')}
          </a>
        )}
      </div>
      {boards && <LeaderboardsPanel onClose={() => setBoards(false)} />}
      </nav>
    </>
  );
}
