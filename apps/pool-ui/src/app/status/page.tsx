'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { fetchBlocks, fetchOverview, fetchPayouts } from '@/lib/api';
import { fmtAgo, fmtHashrate, fmtInt } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { BlockRow, PayoutRow, PoolOverview } from '@/lib/types';

const REFRESH_MS = 15_000;

type Level = 'ok' | 'warn' | 'bad';
const LEVEL_COLOR: Record<Level, string> = {
  ok: 'var(--good, #3ddc84)',
  warn: '#fcd116',
  bad: 'var(--bad, #ff6b6b)',
};

function ageLevel(ageS: number | null, warn: number, bad: number): Level {
  if (ageS == null) return 'bad';
  if (ageS > bad) return 'bad';
  if (ageS > warn) return 'warn';
  return 'ok';
}

export default function StatusPage() {
  const { t, lang } = useLang();
  const [overview, setOverview] = useState<PoolOverview | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    let dead = false;
    const load = async () => {
      const [ov, bl, pa] = await Promise.allSettled([
        fetchOverview(),
        fetchBlocks(),
        fetchPayouts(undefined, 25),
      ]);
      if (dead) return;
      setApiOk(ov.status === 'fulfilled');
      if (ov.status === 'fulfilled') setOverview(ov.value);
      if (bl.status === 'fulfilled') setBlocks(bl.value.rows);
      if (pa.status === 'fulfilled') setPayouts(pa.value);
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { dead = true; clearInterval(id); };
  }, []);

  const now = Date.now() / 1000;
  const lastBlock = useMemo(
    () => blocks.reduce<BlockRow | null>((m, b) => (b.ts && (!m || b.ts > (m.ts ?? 0)) ? b : m), null),
    [blocks],
  );
  const lastPayout = useMemo(
    () => payouts.reduce<PayoutRow | null>((m, p) => (p.ts && (!m || p.ts > (m.ts ?? 0)) ? p : m), null),
    [payouts],
  );
  const blockAge = lastBlock?.ts ? now - lastBlock.ts : null;
  const payoutAge = lastPayout?.ts ? now - lastPayout.ts : null;

  // Avg effort over the last 20 blocks (luck_pct: 100 = on-target).
  const effort = useMemo(() => {
    const vals = blocks.filter((b) => b.status === 'confirmed' && b.luck_pct != null)
      .slice(0, 20).map((b) => b.luck_pct as number);
    return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null;
  }, [blocks]);

  const perCoin = useMemo(() => {
    const m = new Map<string, BlockRow>();
    for (const b of blocks) {
      const cur = m.get(b.coin);
      if (b.ts && (!cur || b.ts > (cur.ts ?? 0))) m.set(b.coin, b);
    }
    return Array.from(m.entries()).sort((a, b) => (b[1].ts ?? 0) - (a[1].ts ?? 0));
  }, [blocks]);

  // Pool-wide aggregates summed over per-coin stats.
  const poolHr = useMemo(
    () => (overview ? Object.values(overview.stats).reduce((a, s) => a + (s.hashrate ?? 0), 0) : null),
    [overview],
  );
  const minersOnline = useMemo(
    () => (overview ? Object.values(overview.stats).reduce((a, s) => a + (s.miners_online ?? 0), 0) : null),
    [overview],
  );

  const items: { label: string; value: string; sub?: string; level: Level }[] = [
    {
      label: t('Public API', 'Public API'),
      value: apiOk === null ? '…' : apiOk ? t('online', 'online') : '503',
      sub: overview?.uptime_s ? `uptime ${Math.floor(overview.uptime_s / 86400)}d ${Math.floor((overview.uptime_s % 86400) / 3600)}h` : '/public/v1',
      level: apiOk === null ? 'warn' : apiOk ? 'ok' : 'bad',
    },
    {
      label: t('Poslední blok', 'Last block'),
      value: blockAge != null ? fmtAgo(lastBlock!.ts!, lang) : '—',
      sub: lastBlock ? `${lastBlock.coin.toUpperCase()} #${fmtInt(lastBlock.height)}` : '',
      level: ageLevel(blockAge, 7200, 86400),
    },
    {
      label: t('Poslední výplata', 'Last payout'),
      value: payoutAge != null ? fmtAgo(lastPayout!.ts!, lang) : '—',
      sub: lastPayout ? lastPayout.coin.toUpperCase() : '',
      level: ageLevel(payoutAge, 7200, 86400),
    },
    {
      label: t('Pool hashrate', 'Pool hashrate'),
      value: poolHr != null ? fmtHashrate(poolHr) : '—',
      sub: minersOnline != null ? `${fmtInt(minersOnline)} ${t('minerů', 'miners')}` : '',
      level: (minersOnline ?? 0) > 0 ? 'ok' : 'warn',
    },
    {
      label: t('Effort (20 blk)', 'Effort (20 blk)'),
      value: effort != null ? `${effort.toFixed(0)}%` : '—',
      sub: t('100 % = on-target', '100 % = on-target'),
      level: effort != null && effort <= 150 ? 'ok' : 'warn',
    },
  ];

  return (
    <section className="section-wrap" style={{ paddingTop: '6.5rem' }}>
      <div className="flex items-center gap-2">
        <Activity size={18} className="text-rasta-gold" />
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{t('Stav poolu', 'Pool status')}</h1>
        <span className="text-[0.7rem] text-white/35">{t('live · refresh 15 s', 'live · refresh 15 s')}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((it) => (
          <div key={it.label} className="kpi-tile">
            <div className="stat-value" style={{ color: LEVEL_COLOR[it.level] }}>{it.value}</div>
            <div className="stat-label">{it.label}</div>
            {it.sub && <div className="text-[0.65rem] text-white/35">{it.sub}</div>}
          </div>
        ))}
      </div>

      {/* Per-coin last block */}
      <div className="pool-card mt-6 overflow-x-auto">
        <p className="kicker mb-3">{t('Poslední blok per coin', 'Last block per coin')}</p>
        <table className="pool-table">
          <thead>
            <tr><th>coin</th><th>{t('výška', 'height')}</th><th>{t('stáří', 'age')}</th><th>luck</th><th>{t('stav', 'status')}</th></tr>
          </thead>
          <tbody>
            {perCoin.map(([coin, b]) => {
              const age = b.ts ? now - b.ts : null;
              const lvl = ageLevel(age, 7200, 86400);
              return (
                <tr key={coin}>
                  <td className="font-bold text-white">{coin.toUpperCase()}</td>
                  <td><a href={`/blocks/`} className="text-white/70 underline decoration-white/15 underline-offset-2 hover:text-rasta-gold">#{fmtInt(b.height)}</a></td>
                  <td style={{ color: LEVEL_COLOR[lvl] }}>{b.ts ? fmtAgo(b.ts, lang) : '—'}</td>
                  <td className={b.luck_pct != null && b.luck_pct > 150 ? 'text-gold' : 'text-dim'}>
                    {b.luck_pct != null ? `${b.luck_pct.toFixed(0)}%` : '—'}
                  </td>
                  <td className="text-dim">{b.status}</td>
                </tr>
              );
            })}
            {perCoin.length === 0 && (
              <tr><td colSpan={5} className="text-center text-white/40" style={{ padding: '1.25rem' }}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[0.65rem] leading-relaxed text-white/30">
        {t(
          'Živé indikátory z veřejného API — stratum porty: 8444 (plain), 8445 (TLS), 8446 (SOLO). Detailní telemetrie pro operátory běží interně (Grafana/Prometheus).',
          'Live indicators from the public API — stratum ports: 8444 (plain), 8445 (TLS), 8446 (SOLO). Detailed operator telemetry runs internally (Grafana/Prometheus).',
        )}
      </p>
    </section>
  );
}
