'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/core/i18n';

interface ChainStats {
  block_height?: number;
  difficulty?: number;
  total_connections?: number;
}

function readStats(payload: unknown): ChainStats | null {
  if (!payload || typeof payload !== 'object') return null;
  const rec = payload as ChainStats;
  if (typeof rec.block_height !== 'number') return null;
  return rec;
}

export function ChainPortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState<ChainStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/chain/stats', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<unknown>;
      })
      .then((body) => {
        if (!live) return;
        const parsed = readStats(body);
        if (!parsed) setFailed(true);
        else setStats(parsed);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const title = lang === 'cs' ? 'Řetěz' : 'Chain';

  return (
    <aside className="portal" role="dialog" aria-label={title}>
      <header className="portal-head">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      {failed && <p>{t('chainEmpty')}</p>}
      {!failed && !stats && <p>…</p>}
      {stats && (
        <ul>
          <li>
            {t('height')} <strong>{stats.block_height}</strong>
          </li>
          {typeof stats.difficulty === 'number' && (
            <li>
              {lang === 'cs' ? 'obtížnost' : 'difficulty'} <strong>{stats.difficulty}</strong>
            </li>
          )}
          {typeof stats.total_connections === 'number' && (
            <li>
              {stats.total_connections} {t('peers')}
            </li>
          )}
        </ul>
      )}
    </aside>
  );
}
