'use client';

import { useEffect, useState } from 'react';
import { Blocks } from 'lucide-react';
import { fetchBlocks } from '@/lib/api';
import { fmtAgo, fmtInt, shortAddr } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { BlockRow, CoinId } from '@/lib/types';

const COIN_COLOR: Record<string, string> = {
  zion: 'text-gold',
  qtc: 'text-cyan',
  prl: 'text-purple',
};

const STATUS: Record<string, { cls: string; cs: string; en: string }> = {
  confirmed: { cls: 'text-green', cs: 'potvrzen', en: 'confirmed' },
  pending: { cls: 'text-gold', cs: 'čeká', en: 'pending' },
  orphaned: { cls: 'text-red', cs: 'orphan', en: 'orphaned' },
};

export default function BlocksPage() {
  const { t, lang } = useLang();
  const [coin, setCoin] = useState<CoinId | ''>('');
  const [rows, setRows] = useState<BlockRow[]>([]);

  useEffect(() => {
    fetchBlocks(coin || undefined).then(setRows);
    const iv = setInterval(() => fetchBlocks(coin || undefined).then(setRows), 20_000);
    return () => clearInterval(iv);
  }, [coin]);

  return (
    <div className="pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">{t('Found blocks', 'Found blocks')}</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-white">
            <Blocks className="text-zion-gold" size={26} /> {t('Bloky', 'Blocks')}
          </h1>
        </div>
        <div className="flex gap-2">
          {(['', 'zion', 'qtc', 'prl'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCoin(c)}
              className={`pill ${coin === c ? 'pill-native' : ''}`}
            >
              {c === '' ? 'ALL' : c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="pool-card mt-6 overflow-x-auto">
        <table className="pool-table">
          <thead>
            <tr>
              <th>coin</th>
              <th>{t('výška', 'height')}</th>
              <th>hash</th>
              <th>{t('miner', 'miner')}</th>
              <th>worker</th>
              <th>{t('effort', 'effort')}</th>
              <th>{t('stav', 'status')}</th>
              <th>{t('čas', 'time')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={`${b.coin}-${b.height}-${i}`}>
                <td className={`font-bold ${COIN_COLOR[b.coin] ?? 'text-white'}`}>
                  {b.coin.toUpperCase()}
                </td>
                <td className="text-white">{fmtInt(b.height)}</td>
                <td className="text-dim">{shortAddr(b.hash)}</td>
                <td className="text-dim">{shortAddr(b.miner)}</td>
                <td className="text-white">{b.worker}</td>
                <td className="text-dim">
                  {b.effort_pct != null ? `${b.effort_pct}%` : '—'}
                </td>
                <td className={STATUS[b.status].cls}>
                  {lang === 'cs' ? STATUS[b.status].cs : STATUS[b.status].en}
                </td>
                <td className="text-dim">{fmtAgo(b.ts, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
