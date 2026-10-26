'use client';

import { useEffect, useState } from 'react';
import { Blocks } from 'lucide-react';
import { fetchBlocks } from '@/lib/api';
import { fmtAgo, fmtDifficulty, fmtInt, shortAddr } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { BlockRow, CoinId } from '@/lib/types';

const COIN_COLOR: Record<string, string> = {
  zion: 'text-gold',
  qtc: 'text-cyan',
  prl: 'text-purple',
};

const STATUS: Record<string, { cls: string; cs: string; en: string }> = {
  confirmed: { cls: 'pill-native', cs: 'potvrzen', en: 'confirmed' },
  pending: { cls: 'pill-sync', cs: 'čeká', en: 'pending' },
  orphaned: { cls: 'pill-down', cs: 'orphan', en: 'orphaned' },
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
              <th>diff</th>
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
                <td>
                  <a
                    href={`/miner/${b.coin}/${b.miner}/`}
                    className="text-white/60 underline decoration-white/15 underline-offset-2 transition hover:text-rasta-gold"
                    title={b.miner}
                  >
                    {shortAddr(b.miner)}
                  </a>
                </td>
                <td className="text-dim">{fmtDifficulty(b.network_difficulty)}</td>
                <td>
                  <span className={`pill ${STATUS[b.status].cls}`}>
                    <span className="dot" />
                    {lang === 'cs' ? STATUS[b.status].cs : STATUS[b.status].en}
                  </span>
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
