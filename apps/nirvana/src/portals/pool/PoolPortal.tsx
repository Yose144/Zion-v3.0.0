'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/core/i18n';

interface CoinRow {
  coin: string;
}

interface ZionStats {
  miners_online?: number;
  hashrate?: { live?: number } | null;
}

function readPayload(payload: unknown): { coins: CoinRow[]; zion: ZionStats | null } {
  if (!payload || typeof payload !== 'object') return { coins: [], zion: null };
  const rec = payload as { coins?: unknown; zion?: unknown };
  const coins = Array.isArray(rec.coins)
    ? rec.coins.filter(
        (row): row is CoinRow =>
          !!row && typeof row === 'object' && typeof (row as { coin?: unknown }).coin === 'string',
      )
    : [];
  const zion =
    rec.zion && typeof rec.zion === 'object' ? (rec.zion as ZionStats) : null;
  return { coins, zion };
}

export function PoolPortal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<CoinRow[] | null>(null);
  const [zion, setZion] = useState<ZionStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/pool/coins', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<unknown>;
      })
      .then((body) => {
        if (!live) return;
        const parsed = readPayload(body);
        setRows(parsed.coins);
        setZion(parsed.zion);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <aside className="portal" role="dialog" aria-label={t('pool')}>
      <header className="portal-head">
        <h2>{t('pool')}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      {failed && <p>{t('poolEmpty')}</p>}
      {!failed && rows == null && <p>…</p>}
      {rows && rows.length === 0 && !failed && <p>{t('poolEmpty')}</p>}
      {zion && (
        <p>
          ZION
          {zion.miners_online != null && (
            <span>
              {' '}
              · {zion.miners_online} {t('miners')}
            </span>
          )}
          {zion.hashrate?.live != null && <span> · {Math.round(zion.hashrate.live)} H/s</span>}
        </p>
      )}
      {rows && rows.length > 0 && (
        <ul>
          {rows.map((row) => (
            <li key={row.coin}>
              <strong>{row.coin.toUpperCase()}</strong>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
