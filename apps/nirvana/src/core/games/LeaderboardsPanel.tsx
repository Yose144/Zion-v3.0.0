'use client';

/**
 * Žebříčky všech her — jedno okno, dostupné z každého povrchu.
 *
 * Proč přes HUD a ne pod každou hrou: tabule patří ke hře, ale hráč je chce
 * porovnávat. Kdyby byla jen v menu, musel by do každého menu zvlášť.
 *
 * Okno je záměrně bez peněz a bez identity: jméno je přezdívka z prohlížeče,
 * skóre je číslo od serveru. Nic se tu nesměňuje.
 */

import { useEffect } from 'react';
import { useI18n, tx } from '@/core/i18n';
import { GAME_ORDER, GAME_TITLES, useScores } from '@/core/progress/boards';

export function LeaderboardsPanel({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const { scores, loading, refresh } = useScores();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // pozadí se nesmí posouvat, když je otevřené okno
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="boards-backdrop" role="dialog" aria-modal="true" aria-label={cs ? 'Žebříčky' : 'Leaderboards'} onClick={onClose}>
      <div className="boards-panel" onClick={(event) => event.stopPropagation()}>
        <header className="boards-head">
          <div>
            <strong>{cs ? 'Žebříčky' : 'Leaderboards'}</strong>
            <span>{cs ? 'top 5 · všechny hry' : 'top 5 · all games'}</span>
          </div>
          <div className="boards-actions">
            <button type="button" className="arena-link" onClick={refresh} disabled={loading}>
              {loading ? (cs ? 'načítám…' : 'loading…') : cs ? 'obnovit' : 'refresh'}
            </button>
            <button type="button" className="boards-close" onClick={onClose} aria-label={cs ? 'Zavřít' : 'Close'}>
              ×
            </button>
          </div>
        </header>

        <div className="boards-grid">
          {GAME_ORDER.map((game) => {
            const rows = (scores[game] ?? []).slice(0, 5);
            return (
              <section key={game} className="boards-card">
                <header>
                  <span aria-hidden>{GAME_TITLES[game].glyph}</span>
                  <strong>{tx(GAME_TITLES[game], lang)}</strong>
                </header>
                {rows.length === 0 ? (
                  <p className="boards-empty">{cs ? 'volné' : 'open'}</p>
                ) : (
                  <ol>
                    {rows.map((row, index) => (
                      <li key={`${row.name}-${row.at}-${index}`}>
                        <span className="boards-rank">{index + 1}</span>
                        <span className="boards-name">{row.name}</span>
                        <span className="boards-score">{row.score.toLocaleString(cs ? 'cs-CZ' : 'en-US')}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>

        <p className="boards-foot">
          {cs
            ? 'Skóre posílá každá hra po dohrání. Jméno je přezdívka z prohlížeče — bez účtu, bez peněz.'
            : 'Every game submits its score when it ends. The name is a browser nickname — no account, no money.'}
        </p>
      </div>
    </div>
  );
}
