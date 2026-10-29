'use client';

import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { fmtHashrate, fmtUsd } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { CoinInfo } from '@/lib/types';

const UNITS = [
  { k: 'H/s', m: 1 },
  { k: 'KH/s', m: 1e3 },
  { k: 'MH/s', m: 1e6 },
  { k: 'GH/s', m: 1e9 },
  { k: 'TH/s', m: 1e12 },
];

/** Sensible prefilled hashrate per coin so the estimate is meaningful. */
function defaultUnit(coinId: string): number {
  if (coinId === 'prl') return 1e12;
  if (coinId === 'qtc') return 1e6;
  if (coinId === 'zion') return 1;
  return 1e3;
}

function defaultAmount(coinId: string): number {
  if (coinId === 'prl') return 24;
  if (coinId === 'qtc') return 100;
  if (coinId === 'zion') return 50;
  return 10;
}

/**
 * "Kolik vydělám" profitability card — mirrors the pool's own `est_daily`
 * model: your PPLNS window share ≈ hashrate share, so
 *   est ≈ your_hr / (pool_hr + your_hr) × ZION paid for this coin in 24h.
 * Empirical, self-correcting as upstream difficulty/rewards drift, and the
 * same math for every coin since all payouts settle in ZION.
 */
export default function CalcCard({
  coin,
  poolHashrate,
  payouts24h,
  zionUsd,
}: {
  coin: CoinInfo;
  /** Current pool hashrate for this coin in H/s. */
  poolHashrate: number;
  /** ZION paid out for this coin in the last 24h (pool stats payouts_24h). */
  payouts24h: number | null;
  /** ZION on-chain USD price for the fiat conversion. */
  zionUsd: number | null;
}) {
  const { t } = useLang();
  const [amount, setAmount] = useState<number>(defaultAmount(coin.id));
  const [unit, setUnit] = useState<number>(defaultUnit(coin.id));

  const est = useMemo(() => {
    const hr = amount * unit;
    if (!(hr > 0) || payouts24h == null || payouts24h <= 0) return null;
    return (hr / (poolHashrate + hr)) * payouts24h;
  }, [amount, unit, poolHashrate, payouts24h]);

  const fmtZion = (v: number) =>
    v >= 1000
      ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : v >= 1
        ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : v.toLocaleString(undefined, { maximumFractionDigits: 4 });

  return (
    <div className="pool-card card-glow flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Calculator size={16} className="text-rasta-gold" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">
          {t('Kalkulačka výdělku', 'Earnings calculator')}
        </h3>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="kicker">{t('tvůj hashrate', 'your hashrate')}</span>
          <input
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            className="input-wallet w-36 !font-sans !text-sm"
          />
        </label>
        <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
          {UNITS.map((u) => (
            <button
              key={u.k}
              onClick={() => setUnit(u.m)}
              className={`rounded-md px-2 py-1 text-[0.68rem] font-bold transition-colors ${
                unit === u.m
                  ? 'bg-rasta-gold/20 text-rasta-gold'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              {u.k}
            </button>
          ))}
        </div>
        <span className="pb-1.5 text-[0.7rem] text-white/35">
          ≈ {fmtHashrate(amount * unit)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="kicker">{t('odhad / den', 'est. / day')}</p>
          <p className="stat-value text-lg font-bold text-rasta-gold">
            {est != null ? `${fmtZion(est)} ZION` : '—'}
          </p>
        </div>
        <div>
          <p className="kicker">{t('odhad / měsíc', 'est. / month')}</p>
          <p className="stat-value text-lg font-bold text-white">
            {est != null ? `${fmtZion(est * 30)} ZION` : '—'}
          </p>
        </div>
        <div>
          <p className="kicker">{t('≈ USD / den', '≈ USD / day')}</p>
          <p className="stat-value text-lg font-bold text-white">
            {est != null && zionUsd ? fmtUsd(est * zionUsd) : '—'}
          </p>
        </div>
      </div>

      <p className="text-[0.65rem] leading-relaxed text-white/30">
        {est != null
          ? t(
              'Odhad = tvůj podíl pool hashrate × ZION vyplacené za coin za 24 h — stejný model jako pool-side est_daily (PPLNS). Reálné výnosy kolísají s luckem a obtížností.',
              'Estimate = your share of pool hashrate × ZION paid for the coin in 24h — the same model as the pool-side est_daily (PPLNS). Real returns vary with luck and difficulty.',
            )
          : t(
              'Odhad se zapne, jakmile pool za posledních 24 h něco za tento coin vyplatil — zatím málo dat.',
              'The estimate turns on once the pool has paid out for this coin in the last 24h — not enough data yet.',
            )}
      </p>
    </div>
  );
}
