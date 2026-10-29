'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Wallet } from 'lucide-react';
import AreaChart, { pushSample, type SeriesPoint } from '@/components/AreaChart';
import MinerSearch from '@/components/MinerSearch';
import { fetchMiner, fetchMinerHistory } from '@/lib/api';
import {
  fmtAgo,
  fmtAmount,
  fmtDuration,
  fmtHashrate,
  fmtInt,
  shortAddr,
  PAYOUT_STATUS_CLASS,
  payoutStatusLabel,
} from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { CoinId, MinerStats } from '@/lib/types';

const ACCENT: Record<string, string> = {
  zion: '#fcd116',
  qtc: '#078930',
  prl: '#e41e2b',
};

export default function MinerClient({
  coin,
  wallet,
}: {
  coin: string;
  wallet: string;
}) {
  const { t, lang } = useLang();
  const [m, setM] = useState<MinerStats | null | undefined>(undefined);
  const [hrHistory, setHrHistory] = useState<SeriesPoint[]>([]);
  const [serverHist, setServerHist] = useState<SeriesPoint[]>([]);

  useEffect(() => {
    setM(undefined);
    setServerHist([]);
    const key = `miner-hr-${coin}-${wallet.slice(0, 24)}`;
    const tick = () =>
      fetchMiner(coin as CoinId, wallet).then((stats) => {
        setM(stats);
        if (stats) setHrHistory(pushSample(key, stats.hashrate));
      });
    // Server-side wallet history (schema v6) — when present it wins over
    // the localStorage series because it survives restarts and other
    // devices. Empty while the endpoint predates deployment.
    const pullHistory = () =>
      fetchMinerHistory(coin as CoinId, wallet).then((samples) => {
        if (samples.length) {
          setServerHist(samples.map((s) => ({ t: s.ts * 1000, v: s.hps })));
        }
      });
    tick();
    pullHistory();
    const iv = setInterval(tick, 15_000);
    const ivHist = setInterval(pullHistory, 60_000);
    return () => {
      clearInterval(iv);
      clearInterval(ivHist);
    };
  }, [coin, wallet]);

  if (m === undefined) {
    return <div className="pt-20 text-center text-white/40">…</div>;
  }

  if (m === null) {
    return (
      <div className="pt-10">
        <div className="pool-card mx-auto max-w-xl text-center">
          <AlertTriangle className="mx-auto text-zion-gold" size={28} />
          <h1 className="mt-3 text-lg font-bold text-white">
            {t('Miner nenalezen', 'Miner not found')}
          </h1>
          <p className="mt-2 break-all font-mono text-xs text-white/45">
            {coin} · {wallet}
          </p>
          <p className="mt-3 text-xs text-white/50">
            {t(
              'Adresa zatím nemá žádné přijaté shary, nebo neexistuje.',
              'This address has no accepted shares yet, or does not exist.',
            )}
          </p>
        </div>
        <div className="mx-auto mt-6 max-w-xl">
          <MinerSearch />
        </div>
      </div>
    );
  }

  const acc = m.shares_24h.accepted;
  const rej = m.shares_24h.rejected;
  const rejPct = acc + rej > 0 ? (rej / (acc + rej)) * 100 : 0;

  return (
    <div className="pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Wallet size={20} className="text-zion-gold" />
          <div>
            <p className="kicker">
              {coin.toUpperCase()} · {t('miner', 'miner')}
            </p>
            <h1 className="break-all font-mono text-sm font-bold text-white md:text-base">
              {wallet}
            </h1>
          </div>
        </div>
        <span className={`pill ${m.active ? 'pill-live' : 'pill-down'}`}>
          <span className="dot" />
          {m.active ? t('online', 'online') : t('offline', 'offline')}
        </span>
      </div>

      {/* KPI */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            k: t('Hashrate', 'Hashrate'),
            v: fmtHashrate(m.hashrate),
            c: ACCENT[coin] ?? '#fcd116',
          },
          {
            k: t('Odhad / den', 'Est. daily'),
            v: m.est_daily != null ? fmtAmount(m.est_daily, m.unit) : '—',
            c: '#00ff41',
          },
          {
            k: t('Podíl okna', 'Window share'),
            v: `${(m.window_share * 100).toFixed(3)}%`,
            c: '#fff',
          },
          {
            k: t('Workers', 'Workers'),
            v: String(m.workers.length),
            c: '#fff',
          },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="pool-card"
          >
            <p className="kicker">{s.k}</p>
            <p className="stat-value mt-1 text-xl font-bold" style={{ color: s.c }}>
              {s.v}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Hashrate chart — server-side wallet history (schema v6) when
          present, else the localStorage series accumulated live. */}
      <div className="pool-card mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="kicker">
            {serverHist.length
              ? t('Hashrate — 24h (server)', 'Hashrate — 24h (server)')
              : t('Hashrate — poslední 4h', 'Hashrate — last 4h')}
          </p>
          <p className="text-[0.62rem] text-white/35">
            {t(
              `acc ${fmtInt(acc)} · rej ${fmtInt(rej)} · ${rejPct.toFixed(2)}%`,
              `acc ${fmtInt(acc)} · rej ${fmtInt(rej)} · ${rejPct.toFixed(2)}%`,
            )}
          </p>
        </div>
        <AreaChart
          data={serverHist.length ? serverHist : hrHistory}
          color={ACCENT[coin] ?? '#fcd116'}
          height={120}
          fmt={(v) => fmtHashrate(v)}
          emptyLabel={t(
            'Graf se plní každých 15 s živými daty…',
            'Chart fills with live data every 15s…',
          )}
        />
      </div>

      {/* Balances + workers */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="pool-card">
          <p className="kicker mb-3">{t('Výdělky a bilance', 'Earnings & balance')}</p>
          {/* Payout progress — pending vs min threshold as a bar, the
              classic "kdy mi to přijde" surface every pro pool shows. */}
          {m.min_payout != null && m.min_payout > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-[0.68rem] text-white/45">
                <span>{t('Postup k výplatě', 'Progress to payout')}</span>
                <span className="font-bold text-white/80">
                  {Math.min(100, (m.pending / m.min_payout) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rasta-gold/70 to-rasta-gold transition-all duration-700"
                  style={{ width: `${Math.min(100, (m.pending / m.min_payout) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {[
            {
              k: t('Čeká na výplatu', 'Pending payout'),
              v: m.min_payout != null
                ? `${fmtAmount(m.pending, m.unit)} / ${fmtAmount(m.min_payout, m.unit)}`
                : fmtAmount(m.pending, m.unit),
            },
            ...(m.immature > 0
              ? [{ k: t('Nedozrálé', 'Immature'), v: fmtAmount(m.immature, m.unit) }]
              : []),
            {
              k: t('Výplata za', 'Payout in'),
              v:
                m.payout_eta_s != null
                  ? m.payout_eta_s === 0
                    ? t('další dávka', 'next batch')
                    : `~${fmtDuration(m.payout_eta_s)}`
                  : '—',
            },
            {
              k: t('Celkem vyplaceno', 'Total paid'),
              v: fmtAmount(m.total_paid, m.unit),
            },
            {
              k: t('Odhad / den', 'Est. daily'),
              v: m.est_daily != null ? fmtAmount(m.est_daily, m.unit) : '—',
            },
            ...(m.est_per_block != null
              ? [{
                  k: t('Odhad / blok', 'Est. per block'),
                  v: fmtAmount(m.est_per_block, m.unit),
                }]
              : []),
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between border-b border-white/6 py-2.5 last:border-0">
              <span className="text-xs text-white/50">{r.k}</span>
              <span className="stat-value text-sm font-bold text-white">{r.v}</span>
            </div>
          ))}
        </div>

        <div className="pool-card lg:col-span-2">
          <p className="kicker mb-3">{t('Workers', 'Workers')}</p>
          <div className="overflow-x-auto">
            <table className="pool-table">
              <thead>
                <tr>
                  <th>{t('jméno', 'name')}</th>
                  <th>algo</th>
                  <th>hashrate</th>
                  <th>acc</th>
                  <th>rej</th>
                  <th>acc%</th>
                  <th>{t('naposledy', 'last seen')}</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxHr = Math.max(1, ...m.workers.map((w) => w.hashrate));
                  return m.workers.map((w) => {
                  const wAcc =
                    w.shares_accepted + w.shares_rejected > 0
                      ? (w.shares_accepted / (w.shares_accepted + w.shares_rejected)) * 100
                      : 100;
                  return (
                    <tr key={w.name}>
                      <td>
                        <a
                          href={`/miner/${coin}/${wallet}/${encodeURIComponent(w.name)}/`}
                          className="text-white/70 underline decoration-white/15 underline-offset-2 transition hover:text-rasta-gold"
                        >
                          {w.name}
                        </a>
                      </td>
                      <td className="text-dim">{w.algorithm}</td>
                      <td style={{ color: ACCENT[coin] }}>
                        {fmtHashrate(w.hashrate)}
                        <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(3, (w.hashrate / maxHr) * 100)}%`,
                              background: ACCENT[coin] ?? '#fcd116',
                              opacity: 0.7,
                            }}
                          />
                        </div>
                      </td>
                      <td className="text-green">{fmtInt(w.shares_accepted)}</td>
                      <td className={w.shares_rejected > 0 ? 'text-red' : 'text-dim'}>
                        {fmtInt(w.shares_rejected)}
                      </td>
                      <td className={wAcc < 97 ? 'text-gold' : 'text-dim'}>
                        {wAcc.toFixed(1)}%
                      </td>
                      <td className="text-dim">{fmtAgo(w.last_seen, lang)}</td>
                    </tr>
                  );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payouts */}
      <div className="pool-card mt-5">
        <p className="kicker mb-3">{t('Výplaty', 'Payouts')}</p>
        {m.payouts.length === 0 ? (
          <p className="text-xs text-white/40">
            {t('Zatím žádné — výplaty jedou dávkově po dosažení minima.', 'None yet — payouts batch once the minimum is reached.')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="pool-table">
              <thead>
                <tr>
                  <th>{t('čas', 'time')}</th>
                  <th>{t('částka', 'amount')}</th>
                  <th>{t('stav', 'status')}</th>
                  <th>tx</th>
                  <th>{t('konf.', 'conf.')}</th>
                </tr>
              </thead>
              <tbody>
                {m.payouts.map((p, i) => (
                  <tr key={i}>
                    <td className="text-dim">{p.ts ? fmtAgo(p.ts, lang) : '—'}</td>
                    <td className="text-white">{fmtAmount(p.amount, p.unit)}</td>
                    <td>
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PAYOUT_STATUS_CLASS[p.status]}`}
                      >
                        {payoutStatusLabel(p.status, t)}
                      </span>
                    </td>
                    <td className="text-dim">{p.tx ? shortAddr(p.tx) : '—'}</td>
                    <td className={p.confirmed ? 'text-green' : 'text-gold'}>
                      {p.status === 'queued' ? '—' : fmtInt(p.confirmations)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
