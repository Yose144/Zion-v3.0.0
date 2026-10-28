'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { fetchBlocks, fetchHistory, fetchOverview, type HistorySample } from '@/lib/api';
import {
  fmtDifficulty,
  fmtDuration,
  fmtHashrate,
  fmtInt,
} from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { BlockRow, CoinId, PoolOverview } from '@/lib/types';
import AreaChart, { pushSample, type SeriesPoint } from '@/components/AreaChart';

const ACCENT: Record<string, string> = {
  gold: '#fcd116',
  cyan: '#078930',
  purple: '#e41e2b',
  green: '#00ff41',
};

export default function StatsPage() {
  const { t } = useLang();
  const [ov, setOv] = useState<PoolOverview | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [histories, setHistories] = useState<Record<string, SeriesPoint[]>>({});
  const [minersHist, setMinersHist] = useState<Record<string, SeriesPoint[]>>({});
  const historiesRef = useRef(histories);
  historiesRef.current = histories;

  useEffect(() => {
    const tick = () =>
      fetchOverview().then((o) => {
        setOv(o);
        // Per-coin series: server-side /public/v1/history (60s samples,
        // 24h retention) is authoritative when present; otherwise keep
        // accumulating into localStorage as a rolling fallback.
        const next = { ...historiesRef.current };
        for (const c of o.coins) {
          const s = o.stats[c.id];
          if (!s) continue;
          next[c.id] = pushSample(`pool-hr-${c.id}`, s.hashrate);
        }
        setHistories(next);
      });
    tick();
    const iv = setInterval(tick, 15_000);
    return () => clearInterval(iv);
  }, []);

  // Server-side history (pool restart resets it — localStorage above is
  // the fallback so charts still populate on a fresh backend).
  useEffect(() => {
    const pull = () =>
      fetchHistory()
        .then((s: HistorySample[]) => {
          if (!s.length) return;
          const zionSeries: SeriesPoint[] = s.map((p) => ({
            t: p.ts * 1000,
            v: p.hashrate,
          }));
          setHistories((h) => ({ ...h, zion: zionSeries }));
          // Per-coin miners-online series from the same server snapshots.
          const perCoin: Record<string, SeriesPoint[]> = {};
          for (const p of s) {
            for (const [coin, n] of Object.entries(p.online_by_coin ?? {})) {
              (perCoin[coin] ??= []).push({ t: p.ts * 1000, v: n });
            }
          }
          setMinersHist(perCoin);
        })
        .catch(() => {});
    pull();
    const iv = setInterval(pull, 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    fetchBlocks().then((b) => setBlocks(b.rows));
    const iv = setInterval(() => fetchBlocks().then((b) => setBlocks(b.rows)), 30_000);
    return () => clearInterval(iv);
  }, []);

  if (!ov) return <div className="pt-20 text-center text-white/40">…</div>;

  const totalHashrate = ov.coins.reduce(
    (sum, c) => sum + (ov.stats[c.id]?.hashrate ?? 0),
    0,
  );
  const totalMiners = ov.coins.reduce(
    (sum, c) => sum + (ov.stats[c.id]?.miners_online ?? 0),
    0,
  );

  // blocks per day histogram (last 14 days, all coins)
  const dayBuckets: { day: string; count: number }[] = [];
  if (blocks.length) {
    const now = Date.now();
    const map = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400_000);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    blocks.forEach((b) => {
      const k = new Date(b.ts * 1000).toISOString().slice(0, 10);
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
    });
    map.forEach((count, day) => dayBuckets.push({ day, count }));
  }

  return (
    <div className="pt-10">
      <p className="kicker">{t('Telemetrie', 'Telemetry')}</p>
      <h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-white">
        <Activity className="text-zion-cyan" size={26} />
        {t('Statistiky poolu', 'Pool stats')}
      </h1>

      {/* Pool-wide KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: t('celkový hashrate', 'total hashrate'), v: fmtHashrate(totalHashrate) },
          { k: t('mineři online', 'miners online'), v: fmtInt(totalMiners) },
          { k: t('coinů', 'coins'), v: String(ov.coins.length) },
          { k: t('nalezené bloky', 'blocks found'), v: fmtInt(blocks.length) },
        ].map((x, i) => (
          <div key={i} className="pool-card p-4">
            <p className="kicker">{x.k}</p>
            <p className="stat-value mt-1 text-lg font-bold text-white">{x.v}</p>
          </div>
        ))}
      </div>

      {/* Protocol reward split (89/5/5/1) — from /public/v1/coins fees */}
      {ov.fees && (
        <div className="pool-card mt-3 p-4">
          <div className="mb-2 flex justify-between text-[0.65rem] text-white/40">
            <span>{t('rozdělení odměny za blok', 'block reward split')}</span>
            <span>{t('pool fee', 'pool fee')} {ov.fees.pool_fee_pct}%</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-rasta-green" style={{ width: `${ov.fees.miner_pct}%` }} />
            <div className="h-full bg-zion-gold" style={{ width: `${ov.fees.humanitarian_pct}%` }} />
            <div className="h-full bg-zion-cyan" style={{ width: `${ov.fees.issobella_pct}%` }} />
            <div className="h-full bg-rasta-red/70" style={{ width: `${ov.fees.pool_fee_pct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-white/50">
            <span><span className="text-rasta-green">●</span> {ov.fees.miner_pct}% {t('mineři (PPLNS)', 'miners (PPLNS)')}</span>
            <span><span className="text-zion-gold">●</span> {ov.fees.humanitarian_pct}% {t('humanitární fond', 'humanitarian fund')}</span>
            <span><span className="text-zion-cyan">●</span> {ov.fees.issobella_pct}% Issobella</span>
            <span><span className="text-rasta-red/70">●</span> {ov.fees.pool_fee_pct}% {t('pool fee', 'pool fee')}</span>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-5">
        {ov.coins.map((c) => {
          const s = ov.stats[c.id];
          if (!s) return null;
          const acc = s.shares_1h.accepted;
          const rej = s.shares_1h.rejected;
          const rejPct = acc + rej > 0 ? (rej / (acc + rej)) * 100 : 0;
          const accPct = acc + rej > 0 ? (acc / (acc + rej)) * 100 : 100;
          const history = histories[c.id] ?? [];
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
                  { k: 'workers', v: fmtInt(s.workers_online) },
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

              {/* share accept/reject bar */}
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[0.65rem] text-white/40">
                  <span>
                    {t('shares', 'shares')}: {fmtInt(acc)}{' '}
                    {t('accepted', 'accepted')} / {fmtInt(rej)}{' '}
                    {t('rejected', 'rejected')}
                  </span>
                  <span>{accPct.toFixed(1)}% ok</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-l-full bg-rasta-green transition-all"
                    style={{ width: `${accPct}%` }}
                  />
                  <div
                    className="h-full bg-rasta-red/70 transition-all"
                    style={{ width: `${100 - accPct}%` }}
                  />
                </div>
              </div>

              {/* hashrate history chart (client-accumulated) */}
              <div className="mt-4">
                <p className="kicker mb-2">
                  {t('hashrate historie', 'hashrate history')}
                </p>
                <AreaChart
                  data={history}
                  color={ACCENT[c.accent]}
                  height={110}
                  fmt={(v) => fmtHashrate(v)}
                  emptyLabel={t(
                    'Graf se plní živými daty během sledování stránky…',
                    'Chart fills with live data while this page is open…',
                  )}
                />
              </div>

              {/* miners-online history (server-side, persists restarts) */}
              {(minersHist[c.id]?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="kicker mb-2">
                    {t('mineři online · 24h', 'miners online · 24h')}
                  </p>
                  <AreaChart
                    data={minersHist[c.id]}
                    color={ACCENT[c.accent]}
                    height={70}
                    fmt={(v) => fmtInt(v)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Blocks-per-day histogram */}
      {dayBuckets.some((d) => d.count > 0) && (
        <div className="pool-card mt-6 p-5">
          <p className="kicker mb-3">
            {t('bloky za 14 dní', 'blocks · 14 days')}
          </p>
          <div className="flex h-24 items-end gap-1">
            {dayBuckets.map((d) => {
              const max = Math.max(...dayBuckets.map((x) => x.count), 1);
              return (
                <div
                  key={d.day}
                  className="group relative flex-1 rounded-t bg-gradient-to-t from-rasta-green/60 to-rasta-gold/60 transition hover:from-rasta-green hover:to-rasta-gold"
                  style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 3 : 1 }}
                  title={`${d.day}: ${d.count}`}
                >
                  <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-1.5 py-0.5 text-[0.6rem] text-white opacity-0 transition group-hover:opacity-100">
                    {d.day.slice(5)} · {d.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-[0.68rem] text-white/30">
        {t(
          'Data z veřejného pool API · refresh 15 s · historie se ukládá lokálně',
          'Data from the public pool API · 15s refresh · history stored locally',
        )}
      </p>
    </div>
  );
}
