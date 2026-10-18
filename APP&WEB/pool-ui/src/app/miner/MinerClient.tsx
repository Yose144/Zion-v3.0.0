'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Wallet } from 'lucide-react';
import Sparkline from '@/components/Sparkline';
import MinerSearch from '@/components/MinerSearch';
import { fetchMiner } from '@/lib/api';
import {
  fmtAgo,
  fmtAmount,
  fmtHashrate,
  fmtInt,
  shortAddr,
} from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { CoinId, MinerStats } from '@/lib/types';

const ACCENT: Record<string, string> = {
  zion: '#ffd700',
  qtc: '#06b6d4',
  prl: '#c084fc',
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

  useEffect(() => {
    setM(undefined);
    fetchMiner(coin as CoinId, wallet).then(setM);
    const iv = setInterval(
      () => fetchMiner(coin as CoinId, wallet).then(setM),
      15_000,
    );
    return () => clearInterval(iv);
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

      {/* KPI */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            k: t('Hashrate', 'Hashrate'),
            v: fmtHashrate(m.hashrate),
            c: ACCENT[coin] ?? '#ffd700',
          },
          {
            k: t('Shary 24h (acc)', 'Shares 24h (acc)'),
            v: fmtInt(acc),
            c: '#4ade80',
          },
          {
            k: t('Reject rate', 'Reject rate'),
            v: `${rejPct.toFixed(2)}%`,
            c: rejPct > 3 ? '#f87171' : '#fff',
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

      {/* Hashrate chart */}
      <div className="pool-card mt-5">
        <p className="kicker mb-2">{t('Hashrate — poslední 4h', 'Hashrate — last 4h')}</p>
        <Sparkline data={m.hashrate_history} color={ACCENT[coin] ?? '#ffd700'} />
      </div>

      {/* Balances + workers */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="pool-card">
          <p className="kicker mb-3">{t('Bilance', 'Balance')}</p>
          {[
            {
              k: t('Nedozrálé (immature)', 'Immature'),
              v: fmtAmount(m.immature, m.unit),
            },
            {
              k: t('Čeká na výplatu', 'Pending payout'),
              v: fmtAmount(m.pending, m.unit),
            },
            {
              k: t('Celkem vyplaceno', 'Total paid'),
              v: fmtAmount(m.total_paid, m.unit),
            },
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
                  <th>{t('naposledy', 'last seen')}</th>
                </tr>
              </thead>
              <tbody>
                {m.workers.map((w) => (
                  <tr key={w.name}>
                    <td className="text-white">{w.name}</td>
                    <td className="text-dim">{w.algorithm}</td>
                    <td style={{ color: ACCENT[coin] }}>{fmtHashrate(w.hashrate)}</td>
                    <td className="text-green">{fmtInt(w.shares_accepted)}</td>
                    <td className={w.shares_rejected > 0 ? 'text-red' : 'text-dim'}>
                      {fmtInt(w.shares_rejected)}
                    </td>
                    <td className="text-dim">{fmtAgo(w.last_seen, lang)}</td>
                  </tr>
                ))}
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
                  <th>tx</th>
                  <th>{t('konf.', 'conf.')}</th>
                </tr>
              </thead>
              <tbody>
                {m.payouts.map((p, i) => (
                  <tr key={i}>
                    <td className="text-dim">{fmtAgo(p.ts, lang)}</td>
                    <td className="text-white">{fmtAmount(p.amount, p.unit)}</td>
                    <td className="text-dim">{shortAddr(p.tx)}</td>
                    <td className={p.confirmed ? 'text-green' : 'text-gold'}>
                      {p.confirmed ? fmtInt(p.confirmations) : t('čeká', 'pending')}
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
