'use client';

import { useEffect, useState } from 'react';
import { Blocks } from 'lucide-react';
import { fetchBlocks, fetchCoinStats } from '@/lib/api';
import LuckEffortCard from '@/components/LuckEffortCard';
import { fmtAgo, fmtDifficulty, fmtInt, shortAddr } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { BlockRow, CoinId, CoinStats } from '@/lib/types';

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
  const [zionStats, setZionStats] = useState<CoinStats | null>(null);

  useEffect(() => {
    const load = () =>
      fetchBlocks(coin || undefined).then(({ rows, tip }) => {
        setRows(rows);
        setTip(tip);
      });
    const loadStats = () => fetchCoinStats('zion').then(setZionStats);
    load();
    loadStats();
    const iv = setInterval(() => {
      load();
      loadStats();
    }, 20_000);
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

      {/* ZION round telemetry — effort gauge + rolling luck (own strip
          below covers the trend view) */}
      {(coin === '' || coin === 'zion') && (
        <LuckEffortCard
          stats={zionStats}
          blocks={rows.filter((b) => b.coin === 'zion')}
          showStrip={false}
        />
      )}

      {/* Luck trend — last blocks' luck% as colored bars (>100% = lucky) */}
      {(() => {
        const lucky = rows.filter((b) => b.luck_pct != null).slice(0, 40).reverse();
        if (lucky.length < 3) return null;
        const max = Math.max(...lucky.map((b) => b.luck_pct ?? 0), 200);
        return (
          <div className="pool-card card-glow mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">
                {t('luck trend — posledních', 'luck trend — last')} {lucky.length} {t('bloků', 'blocks')}
              </h3>
              <span className="text-[0.65rem] text-white/35">
                {t('>100 % štěstí · <100 % smůla', '>100% lucky · <100% unlucky')}
                {' · '}
                <b className={(() => {
                  const avg = lucky.reduce((a, b) => a + (b.luck_pct ?? 0), 0) / lucky.length;
                  return avg >= 100 ? 'text-rasta-green' : 'text-rasta-gold';
                })()}>
                  Ø luck {(lucky.reduce((a, b) => a + (b.luck_pct ?? 0), 0) / lucky.length).toFixed(0)}%
                </b>
                {' · '}
                {(() => {
                  // Average effort — actual/expected shares per block, the
                  // HeroMiners KPI. 100% = pool works exactly on schedule.
                  const eff = lucky
                    .filter(
                      (b) =>
                        (b.network_difficulty ?? 0) > 0 &&
                        (b.share_difficulty ?? 0) > 0 &&
                        (b.shares_since_prev ?? 0) > 0,
                    )
                    .map(
                      (b) =>
                        ((b.shares_since_prev ?? 0) /
                          ((b.network_difficulty ?? 1) / (b.share_difficulty ?? 1))) *
                        100,
                    );
                  if (!eff.length) return null;
                  const avg = eff.reduce((a, x) => a + x, 0) / eff.length;
                  return (
                    <b className={avg <= 100 ? 'text-rasta-green' : 'text-rasta-gold'}>
                      Ø effort {avg.toFixed(0)}%
                    </b>
                  );
                })()}
              </span>
            </div>
            <div className="relative flex h-16 items-end gap-[2px]">
              {/* 100% reference line */}
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/20"
                style={{ bottom: `${(100 / max) * 100}%` }}
              />
              {lucky.map((b, i) => {
                const l = b.luck_pct ?? 0;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-[2px] transition-opacity hover:opacity-80 ${
                      l >= 100
                        ? 'bg-gradient-to-t from-rasta-green/30 to-rasta-green/80'
                        : 'bg-gradient-to-t from-rasta-red/25 to-rasta-red/70'
                    }`}
                    style={{ height: `${Math.max(4, (l / max) * 100)}%` }}
                    title={`#${fmtInt(b.height)}: ${Math.round(l)}% — ${fmtAgo(b.ts, lang)}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

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
