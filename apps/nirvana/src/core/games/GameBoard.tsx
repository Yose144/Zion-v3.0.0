'use client';

/**
 * Kompaktní tabule jedné hry — pro menu každé hry.
 *
 * Záměrně malá: v panelu před zápasem má být vidět „kam se dá dostat",
 * ne soutěž odsouzená k nekonečnému scrollu. Plný přehled všech her drží
 * `LeaderboardsPanel` v HUD.
 */

import { useI18n } from '@/core/i18n';
import type { ParkGameId } from '@/core/park/games';
import { GAME_TITLES, useScores } from '@/core/progress/boards';

export function GameBoard({
  game,
  limit = 3,
  className = '',
}: {
  game: ParkGameId;
  limit?: number;
  className?: string;
}) {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const { scores, loading } = useScores();
  const rows = (scores[game] ?? []).slice(0, limit);
  const title = GAME_TITLES[game][lang];

  return (
    <section className={`game-board ${className}`.trim()} aria-label={cs ? `Tabule ${title}` : `${title} leaderboard`}>
      <header>
        <span aria-hidden>{GAME_TITLES[game].glyph}</span>
        <strong>{cs ? `Tabule · ${title}` : `${title} board`}</strong>
      </header>
      {rows.length === 0 ? (
        <p className="game-board-empty">
          {loading ? (cs ? 'načítám…' : 'loading…') : cs ? 'nikdo zatím — první místo je volné' : 'nobody yet — first place is open'}
        </p>
      ) : (
        <ol>
          {rows.map((row, index) => (
            <li key={`${row.name}-${row.at}-${index}`}>
              <span className="game-board-rank">{index + 1}</span>
              <span className="game-board-name">{row.name}</span>
              <span className="game-board-score">{row.score.toLocaleString(cs ? 'cs-CZ' : 'en-US')}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
