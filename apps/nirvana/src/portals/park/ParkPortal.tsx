'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/core/i18n';
import { PARK_GAMES } from '@/core/park/games';
import { emptyScores, type ParkScores } from '@/core/park/scores';

/** Okno pouti ve vesmíru — pozvánka, tabule a cesta na místo. */
export function ParkPortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const cs = lang === 'cs';
  const [scores, setScores] = useState<ParkScores>(emptyScores());

  useEffect(() => {
    let live = true;
    fetch('/api/park/scores', { cache: 'no-store' })
      .then(async (res) => (res.ok ? ((await res.json()) as { scores?: ParkScores }) : null))
      .then((body) => {
        if (live && body?.scores) setScores(body.scores);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  return (
    <aside className="portal" role="dialog" aria-label={cs ? 'Pouť' : 'Fair'}>
      <header className="portal-head">
        <h2>{cs ? 'Jupiter Station' : 'Jupiter Station'}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>

      <p className="muted">
        {cs
          ? 'Pouť na oběžné dráze: tři arkádové skříně, ruské kolo a tabule. Hraje se o žetony, ne o peníze.'
          : 'A fair in orbit: three arcade cabinets, a ferris wheel and a board. You play for tokens, not money.'}
      </p>

      <ul>
        {PARK_GAMES.map((game) => (
          <li key={game.id}>
            {game.title[cs ? 'cs' : 'en']}{' '}
            <strong>{scores[game.id]?.[0]?.score ?? 0}</strong>
          </li>
        ))}
      </ul>

      <div className="hiran-actions">
        <button type="button" onClick={() => router.push('/park')}>
          {cs ? 'Vstoupit na pouť' : 'Enter the fair'}
        </button>
      </div>
    </aside>
  );
}
