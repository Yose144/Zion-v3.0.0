'use client';

import Link from 'next/link';
import { useI18n } from '@/core/i18n';
import { GAME_LINKS } from '@/core/games/links';

/**
 * HERNÍ DOCK — čtyři karty, na které jde kliknout z vesmíru.
 *
 * Proč zvlášť a ne jen v konzoli: hry jsou samostatné stránky (`/park`, `/mars`,
 * `/venus`, `/avatars`), ne portály ve scéně. Dřív se na ně dalo dostat jen
 * přes pouť a člověk to musel vědět — teď jsou vidět pořád.
 */
export function GamesDock() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <nav className="games-dock" aria-label={cs ? 'Hry' : 'Games'}>
      <span className="games-dock-label">{cs ? 'Hrát' : 'Play'}</span>
      {GAME_LINKS.map((game) => (
        <Link
          key={game.id}
          href={game.href}
          className="games-card"
          style={{ ['--game-tone' as string]: game.tone }}
        >
          <span className="games-card-glyph" aria-hidden>
            {game.glyph}
          </span>
          <span className="games-card-text">
            <strong>{game.title[lang]}</strong>
            <em>{game.note[lang]}</em>
          </span>
          <span className="games-card-go" aria-hidden>
            →
          </span>
        </Link>
      ))}
      {/* Lobby je rozcestník, ne hra — proto vlastní odkaz na konci lišty. */}
      <Link href="/multiplayer" className="games-card is-lobby">
        <span className="games-card-glyph" aria-hidden>
          🌐
        </span>
        <span className="games-card-text">
          <strong>{cs ? 'Online' : 'Online'}</strong>
          <em>{cs ? 'kdo právě hraje' : 'who is playing'}</em>
        </span>
        <span className="games-card-go" aria-hidden>
          →
        </span>
      </Link>
    </nav>
  );
}
