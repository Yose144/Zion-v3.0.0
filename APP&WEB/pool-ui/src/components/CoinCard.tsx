'use client';

import { ArrowRight } from 'lucide-react';
import { fmtHashrate, fmtInt } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { CoinInfo, CoinStats } from '@/lib/types';

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
}: {
  coin: CoinInfo;
  stats: CoinStats | undefined;
}) {
  const { t } = useLang();
  return (
    <div
      className="pool-card pool-card-accent flex flex-col gap-4"
      style={{ ['--card-accent' as string]: ACCENT[coin.accent] }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-white">{coin.ticker}</span>
            <span className="text-xs text-white/40">{coin.name}</span>
          </div>
          <p className="mt-0.5 text-[0.72rem] text-white/45">{coin.algorithm}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {coin.legs.map((l, i) => (
            <LegPill key={i} leg={l} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
          <p className="kicker">{t('Bloky / 24h', 'Blocks / 24h')}</p>
          <p className="stat-value text-white">
            {stats ? fmtInt(stats.blocks_24h) : '—'}
          </p>
        </div>
        <div>
          <p className="kicker">{t('Luck', 'Luck')}</p>
          <p className="stat-value text-white">
            {stats?.luck_pct != null ? `${stats.luck_pct.toFixed(0)}%` : '—'}
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
