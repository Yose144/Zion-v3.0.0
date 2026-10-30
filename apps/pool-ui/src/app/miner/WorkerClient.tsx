'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Cpu } from 'lucide-react';
import AreaChart, { thinSeries, type SeriesPoint } from '@/components/AreaChart';
import RangeTabs from '@/components/RangeTabs';
import { fetchMiner, fetchMinerHistory } from '@/lib/api';
import { fmtAgo, fmtHashrate, fmtInt, shortAddr } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { CoinId, WorkerRow } from '@/lib/types';

const ACCENT: Record<string, string> = {
  zion: '#fcd116',
  qtc: '#078930',
  prl: '#e41e2b',
};

const ONLINE_S = 600; // pool's online window

export default function WorkerClient({
  coin,
  wallet,
  worker,
}: {
  coin: string;
  wallet: string;
  worker: string;
}) {
  const { t, lang } = useLang();
  const [w, setW] = useState<WorkerRow | null | undefined>(undefined);
  const [hist, setHist] = useState<SeriesPoint[]>([]);
  const [quality, setQuality] = useState<{ t: number; acc: number; rej: number }[]>([]);
  const [hrRange, setHrRange] = useState(24); // hours — 24h / 7d(168)

  useEffect(() => {
    setW(undefined);
    const tick = () =>
      fetchMiner(coin as CoinId, wallet).then((m) => {
        if (!m) return setW(null);
        setW(m.workers.find((x) => x.name === worker) ?? null);
      });
    // SeriesPoint.t is unix SECONDS — same unit the backend emits.
    const pullHistory = () =>
      fetchMinerHistory(coin as CoinId, wallet, hrRange * 60, worker).then((samples) => {
        if (samples.length) {
          setHist(thinSeries(samples.map((s) => ({ t: s.ts, v: s.hps }))));
          setQuality(
            samples.map((s) => ({ t: s.ts, acc: s.accepted, rej: s.rejected })),
          );
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
  }, [coin, wallet, worker, hrRange]);

  if (w === undefined) {
    return <div className="pt-20 text-center text-white/40">…</div>;
  }

  const back = `/miner/${coin}/${wallet}/`;

  if (w === null) {
    return (
      <div className="pt-10">
        <div className="pool-card mx-auto max-w-xl text-center">
          <Cpu className="mx-auto text-zion-gold" size={26} />
          <h1 className="mt-3 text-lg font-bold text-white">
            {t('Worker nenalezen', 'Worker not found')}
          </h1>
          <p className="mt-2 break-all font-mono text-xs text-white/45">{worker}</p>
          <p className="mt-3 text-xs text-white/50">
            {t(
              'Worker s tímto jménem zatím neposlal žádný share, nebo je offline déle než den.',
              'No worker with this name has submitted shares, or it went offline over a day ago.',
            )}
          </p>
          <a href={back} className="mt-4 inline-block text-xs font-semibold text-rasta-gold">
            ← {t('zpět na wallet', 'back to wallet')}
          </a>
        </div>
      </div>
    );
  }

  const nowS = Date.now() / 1000;
  const online = nowS - w.last_seen < ONLINE_S;
  const wAcc =
    w.shares_accepted + w.shares_rejected > 0
      ? (w.shares_accepted / (w.shares_accepted + w.shares_rejected)) * 100
      : 100;
  const lastQ = quality[quality.length - 1];
  const prevQ = quality.length > 1 ? quality[quality.length - 2] : null;
  const recentRej =
    lastQ && prevQ ? Math.max(0, lastQ.rej - prevQ.rej) : 0;

  return (
    <div className="pt-10">
      <a
        href={back}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/50 transition hover:text-rasta-gold"
      >
        <ArrowLeft size={13} /> {t('wallet', 'wallet')}
      </a>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Cpu size={20} className="text-zion-gold" />
          <div>
            <p className="kicker">
              {coin.toUpperCase()} · {t('worker', 'worker')} · {shortAddr(wallet)}
            </p>
            <h1 className="break-all font-mono text-sm font-bold text-white md:text-base">
              {w.name}
            </h1>
          </div>
        </div>
        <span className={`pill ${online ? 'pill-live' : 'pill-down'}`}>
          <span className="dot" />
          {online ? t('online', 'online') : t('offline', 'offline')}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { k: t('Hashrate', 'Hashrate'), v: fmtHashrate(w.hashrate), c: ACCENT[coin] ?? '#fcd116' },
          { k: t('Accept rate', 'Accept rate'), v: `${wAcc.toFixed(1)}%`, c: wAcc < 97 ? '#fcd116' : '#00ff41' },
          { k: t('Accepted', 'Accepted'), v: fmtInt(w.shares_accepted), c: '#00ff41' },
          {
            k: t('Rejected', 'Rejected'),
            v: fmtInt(w.shares_rejected),
            c: w.shares_rejected > 0 ? '#e41e2b' : '#fff',
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

      <div className="pool-card mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="kicker">
            {hist.length
              ? t(
                  `Hashrate — ${hrRange >= 48 ? `${hrRange / 24}d` : `${hrRange}h`} (server)`,
                  `Hashrate — ${hrRange >= 48 ? `${hrRange / 24}d` : `${hrRange}h`} (server)`,
                )
              : t('Hashrate', 'Hashrate')}
          </p>
          <div className="flex items-center gap-3">
            <p className="text-[0.62rem] text-white/35">
              {t('algo', 'algo')} {w.algorithm} · {t('naposledy', 'last seen')} {fmtAgo(w.last_seen, lang)}
              {recentRej > 0 ? ` · +${recentRej} rej/min` : ''}
            </p>
            {hist.length > 0 && (
              <RangeTabs value={hrRange} onChange={setHrRange} ranges={[24, 168]} />
            )}
          </div>
        </div>
        <AreaChart
          data={hist}
          color={ACCENT[coin] ?? '#fcd116'}
          height={120}
          fmt={(v) => fmtHashrate(v)}
          emptyLabel={t(
            'Worker nemá ještě naměřenou historii (60s vzorky, 7d retence)…',
            'No sampled history yet (60s samples, 7d retention)…',
          )}
        />
      </div>

      {/* Share quality — derived from cumulative counters in the history
          samples; last point delta shows the most recent rejections. */}
      {quality.length > 1 && (
        <div className="pool-card mt-5">
          <p className="kicker mb-3">{t('Kvalita sharů (posledních 24 vzorků)', 'Share quality (last 24 samples)')}</p>
          <div className="flex h-16 items-end gap-[2px]">
            {quality.slice(-24).map((q, i, arr) => {
              const prev = i > 0 ? arr[i - 1] : null;
              const dAcc = prev ? Math.max(0, q.acc - prev.acc) : 0;
              const dRej = prev ? Math.max(0, q.rej - prev.rej) : 0;
              const tot = dAcc + dRej;
              const rejFrac = tot > 0 ? dRej / tot : 0;
              const h = tot > 0 ? Math.max(8, Math.min(64, tot / 4)) : 4;
              return (
                <div
                  key={q.t}
                  title={`${new Date(q.t * 1000).toLocaleTimeString()} — +${dAcc} acc / +${dRej} rej`}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}px`,
                    background:
                      rejFrac > 0.05
                        ? '#e41e2b'
                        : rejFrac > 0
                          ? '#fcd116'
                          : 'rgba(0,255,65,0.55)',
                  }}
                />
              );
            })}
          </div>
          <p className="mt-2 text-[0.62rem] text-white/35">
            {t(
              'Zelená = čisté minuty, zlatá = občasný reject, červená = >5 % rejectů.',
              'Green = clean minutes, gold = occasional reject, red = >5% rejects.',
            )}
          </p>
        </div>
      )}
    </div>
  );
}
