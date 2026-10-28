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

/** Coinbase maturity — payouts wait for this many confirmations. */
const MATURITY = 100;

function luckClass(luck: number | null | undefined): string {
  if (luck == null) return 'text-white/30';
  if (luck >= 110) return 'text-green';
  if (luck <= 90) return 'text-gold';
  return 'text-white/70';
}

export default function BlocksPage() {
  const { t, lang } = useLang();
  const [coin, setCoin] = useState<CoinId | ''>('');
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [tip, setTip] = useState<number | null>(null);

  useEffect(() => {
    const load = () =>
      fetchBlocks(coin || undefined).then(({ rows, tip }) => {
        setRows(rows);
        setTip(tip);
      });
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [coin]);

  return (
    <div className="pt-8">
      <header className="page-hero">
        <p className="rasta-hero-kicker">
          <Blocks size={12} /> {t('Found blocks', 'Found blocks')}
        </p>
        <h1>{t('Bloky', 'Blocks')}</h1>
        <p className="page-hero-sub">
          {t(
            'Každý nalezený blok s confirmation statusem a pool luck — nativní coiny těží přímo proti našemu nodu.',
            'Every block found with confirmation status and pool luck — native coins mine directly against our node.',
          )}
        </p>
        <div className="mt-4 flex justify-center gap-2">
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
      </header>

      <div className="pool-card mt-6 overflow-x-auto">
        <table className="pool-table">
          <thead>
            <tr>
              <th>coin</th>
              <th>{t('výška', 'height')}</th>
              <th>hash</th>
              <th>{t('miner', 'miner')}</th>
              <th>diff</th>
              <th title={t('>100 % = štěstí, <100 % = smůla', '>100% = lucky, <100% = unlucky')}>
                luck %
              </th>
              <th>{t('stav', 'status')}</th>
              <th>{t('maturity', 'maturity')}</th>
              <th>{t('čas', 'time')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => {
              const st = STATUS[b.status] ?? STATUS.pending;
              const confs =
                tip != null && b.height > 0 ? Math.max(0, tip - b.height + 1) : null;
              const maturing =
                b.status !== 'orphaned' && confs != null && confs < MATURITY;
              return (
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
                  <td
                    className={luckClass(b.luck_pct)}
                    title={
                      b.shares_since_prev
                        ? `${t('shares od předchozího bloku', 'shares since prev block')}: ${fmtInt(b.shares_since_prev)}`
                        : undefined
                    }
                  >
                    {b.luck_pct == null ? '—' : `${Math.round(b.luck_pct)}%`}
                  </td>
                  <td>
                    <span className={`pill ${st.cls}`}>
                      <span className="dot" />
                      {lang === 'cs' ? st.cs : st.en}
                    </span>
                  </td>
                  <td className={maturing ? 'text-gold' : 'text-white/30'}>
                    {b.status === 'orphaned' || confs == null
                      ? '—'
                      : maturing
                        ? `${confs}/${MATURITY}`
                        : `✓ ${fmtInt(confs)}`}
                  </td>
                  <td className="text-dim">{fmtAgo(b.ts, lang)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
