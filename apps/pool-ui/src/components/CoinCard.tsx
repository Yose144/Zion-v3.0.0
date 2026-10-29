'use client';

import { ArrowRight } from 'lucide-react';
import { fmtDifficulty, fmtHashrate, fmtInt, fmtUsd } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { CoinInfo, CoinStats } from '@/lib/types';
import type { MarketPrice } from '@/lib/price';
import Sparkline from '@/components/Sparkline';
import CoinLogo from '@/components/CoinLogo';
import { loadSeries, pushSample, type SeriesPoint } from '@/components/AreaChart';
import { COINGECKO_ID, fetchPriceHistory } from '@/lib/price';
import { useEffect, useState } from 'react';

const ACCENT: Record<string, string> = {
  gold: '#fcd116',
  cyan: '#078930',
  purple: '#e41e2b',
  green: '#00ff41',
};

function LegPill({ leg }: { leg: CoinInfo['legs'][number] }) {
  const cls =
    leg.status === 'live'
      ? leg.kind === 'native'
        ? 'pill-native'
        : 'pill-bridged'
      : leg.status === 'sync'
        ? 'pill-sync'
        : 'pill-down';
  return (
    <span className={`pill ${cls}`}>
      <span className="dot" />
      {leg.kind === 'native' ? 'native' : 'upstream'}
    </span>
  );
}

export default function CoinCard({
  coin,
  stats,
  networkDiff,
  price,
}: {
  coin: CoinInfo;
  stats: CoinStats | undefined;
  networkDiff?: number | null;
  price?: MarketPrice | null;
}) {
  const { t } = useLang();
  // Sparkline fed by the same localStorage key the stats page pushes
  // into (pool-hr-<coin>) — shows history once stats has been visited.
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  useEffect(() => {
    setSeries(loadSeries(`pool-hr-${coin.id}`));
  }, [coin.id]);

  // 24h USD price chart — CoinGecko market history for listed coins;
  // ZION accumulates the live on-chain Uni V3 price locally instead.
  const [priceSeries, setPriceSeries] = useState<SeriesPoint[]>([]);
  const cgId = COINGECKO_ID[coin.id as keyof typeof COINGECKO_ID];
  useEffect(() => {
    if (cgId) {
      fetchPriceHistory(cgId)
        .then((pts) => setPriceSeries(pts.map((p) => ({ t: p.ts / 1000, v: p.usd }))))
        .catch(() => {});
    } else {
      setPriceSeries(loadSeries(`price-usd-${coin.id}`));
    }
  }, [coin.id, cgId]);

  // Accumulate ZION's on-chain price so its sparkline fills in over time.
  useEffect(() => {
    if (coin.id === 'zion' && price?.usd) {
      setPriceSeries(pushSample('price-usd-zion', price.usd));
    }
  }, [coin.id, price]);

  return (
    <div
      className="pool-card pool-card-accent card-glow flex flex-col gap-4"
      style={{ ['--card-accent' as string]: ACCENT[coin.accent] }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <a href={`/coin/${coin.id}/`} className="transition-opacity hover:opacity-80">
              <CoinLogo logo={coin.logo} ticker={coin.ticker} accent={coin.accent} size={38} />
            </a>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <a
                  href={`/coin/${coin.id}/`}
                  className="text-xl font-black text-white transition-colors hover:text-rasta-gold"
                >
                  {coin.ticker}
                </a>
                <span className="truncate text-xs text-white/40">{coin.name}</span>
              </div>
              <p className="mt-0.5 text-[0.72rem] text-white/45">{coin.algorithm}</p>
            </div>
          </div>
          {price && (
            <p className="stat-value mt-1.5 flex items-baseline gap-1.5 text-sm font-bold text-white">
              {fmtUsd(price.usd)}
              {price.change_24h != null && (
                <span
                  className={`text-[0.68rem] font-semibold ${
                    price.change_24h >= 0 ? 'text-rasta-green' : 'text-rasta-red'
                  }`}
                >
                  {price.change_24h >= 0 ? '+' : ''}
                  {price.change_24h.toFixed(1)}%
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {coin.legs.map((l, i) => (
            <LegPill key={i} leg={l} />
          ))}
        </div>
      </div>

      {(series.length > 1 || priceSeries.length > 1) && (
        <div className="card-spark -my-1 flex flex-col gap-2">
          {priceSeries.length > 1 && (
            <div>
              <p className="kicker mb-1 flex items-center gap-1 !text-[0.55rem]">
                {t('cena · 24 h', 'price · 24 h')}
              </p>
              <Sparkline
                data={priceSeries.map((p) => ({ ts: p.t, hps: p.v }))}
                color="#ffffff"
                height={40}
              />
            </div>
          )}
          {series.length > 1 && (
            <div>
              <p className="kicker mb-1 flex items-center gap-1 !text-[0.55rem]">
                {t('pool hashrate', 'pool hashrate')}
              </p>
              <Sparkline
                data={series.map((p) => ({ ts: p.t, hps: p.v }))}
                color={ACCENT[coin.accent]}
                height={44}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="kicker">{t('Pool hashrate', 'Pool hashrate')}</p>
          <p className="stat-value text-lg font-bold" style={{ color: ACCENT[coin.accent] }}>
            {stats ? fmtHashrate(stats.hashrate) : '—'}
          </p>
        </div>
        <div>
          <p className="kicker">{t('Mineři', 'Miners')}</p>
          <p className="stat-value text-lg font-bold text-white">
            {stats ? fmtInt(stats.miners_online) : '—'}
          </p>
        </div>
        <div>
          <p className="kicker">{t('Difficulty', 'Difficulty')}</p>
          <p className="stat-value text-white">
            {networkDiff != null ? fmtDifficulty(networkDiff) : '—'}
          </p>
        </div>
        <div>
          <p className="kicker">{t('Bloky / 24h', 'Blocks / 24h')}</p>
          <p className="stat-value text-white">
            {stats ? fmtInt(stats.blocks_24h) : '—'}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-white/8 pt-3 text-[0.72rem]">
        <span className="text-white/40">
          :{coin.port} · {t('min výplata', 'min payout')} {coin.min_payout} {coin.payout_unit} · fee {coin.fee_bps / 100}%
        </span>
        <a
          href={`/start/#${coin.id}`}
          className="inline-flex items-center gap-1 font-semibold no-underline"
          style={{ color: ACCENT[coin.accent] }}
        >
          {t('Připojit', 'Connect')} <ArrowRight size={13} />
        </a>
      </div>
    </div>
  );
}
