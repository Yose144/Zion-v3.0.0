'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { fetchOverview } from '@/lib/api';
import {
  fmtDifficulty,
  fmtDuration,
  fmtHashrate,
  fmtInt,
} from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { PoolOverview } from '@/lib/types';

const ACCENT: Record<string, string> = {
  gold: '#ffd700',
  cyan: '#06b6d4',
  purple: '#c084fc',
  green: '#4ade80',
};

export default function StatsPage() {
  const { t } = useLang();
  const [ov, setOv] = useState<PoolOverview | null>(null);

  useEffect(() => {
    fetchOverview().then(setOv);
    const iv = setInterval(() => fetchOverview().then(setOv), 15_000);
    return () => clearInterval(iv);
  }, []);

  if (!ov) return <div className="pt-20 text-center text-white/40">…</div>;

  return (
    <div className="pt-10">
      <p className="kicker">{t('Telemetrie', 'Telemetry')}</p>
      <h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-white">
        <Activity className="text-zion-cyan" size={26} />
        {t('Statistiky poolu', 'Pool stats')}
      </h1>
      <p className="mt-2 text-sm text-white/50">
        {t('Uptime', 'Uptime')}: <span className="stat-value text-white">{fmtDuration(ov.uptime_s)}</span>
      </p>

      <div className="mt-8 flex flex-col gap-5">
        {ov.coins.map((c) => {
          const s = ov.stats[c.id];
          if (!s) return null;
          const acc = s.shares_1h.accepted;
          const rej = s.shares_1h.rejected;
          const rejPct = acc + rej > 0 ? (rej / (acc + rej)) * 100 : 0;
          return (
            <div
              key={c.id}
              className="pool-card pool-card-accent"
              style={{ ['--card-accent' as string]: ACCENT[c.accent] }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-black text-white">
                  {c.ticker} <span className="text-xs font-normal text-white/40">{c.algorithm}</span>
                </h2>
                <div className="flex gap-2">
                  {c.legs.map((l, i) => (
                    <span
                      key={i}
                      className={`pill ${l.status === 'live' ? (l.kind === 'native' ? 'pill-native' : 'pill-bridged') : l.status === 'sync' ? 'pill-sync' : 'pill-down'}`}
                    >
                      <span className="dot" />
                      {l.kind} {l.job_age_ms != null ? `${(l.job_age_ms / 1000).toFixed(1)}s` : ''} · {(l.share_pct * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
                {[
                  { k: t('pool hashrate', 'pool hashrate'), v: fmtHashrate(s.hashrate) },
                  { k: t('síť', 'network'), v: s.network_hashrate != null ? fmtHashrate(s.network_hashrate) : '—' },
                  { k: t('mineři', 'miners'), v: fmtInt(s.miners_online) },
                  { k: t('workers', 'workers'), v: fmtInt(s.workers_online) },
                  { k: 'diff', v: fmtDifficulty(s.network_difficulty) },
                  { k: t('bloky 24h', 'blocks 24h'), v: fmtInt(s.blocks_24h) },
                  { k: t('rej 1h', 'rej 1h'), v: `${rejPct.toFixed(2)}%` },
                ].map((x, i) => (
                  <div key={i}>
                    <p className="kicker">{x.k}</p>
                    <p className="stat-value mt-0.5 text-sm font-bold text-white">{x.v}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[0.68rem] text-white/30">
        {t(
          'Data z veřejného pool API · refresh 15 s',
          'Data from the public pool API · 15s refresh',
        )}
      </p>
    </div>
  );
}
