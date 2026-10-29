'use client';

import { useEffect, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { fetchPayouts } from '@/lib/api';
import { fmtAgo, fmtAmount, fmtInt, shortAddr, PAYOUT_STATUS_CLASS, payoutStatusLabel } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { CoinId, PayoutRow } from '@/lib/types';

const COIN_COLOR: Record<string, string> = {
  zion: 'text-gold',
  qtc: 'text-cyan',
  prl: 'text-purple',
};

const EXPLORER_TX = 'https://app.zionterranova.com/explorer/search?q=';

export default function PayoutsPage() {
  const { t, lang } = useLang();
  const [coin, setCoin] = useState<CoinId | ''>('');
  const [rows, setRows] = useState<PayoutRow[]>([]);

  useEffect(() => {
    fetchPayouts(coin || undefined, 500).then(setRows);
  }, [coin]);

  // Paid volume per hour (API caps at 500 rows ≈ a few hours at the pool's
  // payout cadence — hourly buckets are the honest granularity for it).
  // Only ZION-denominated rows count; external-coin legs carry own units.
  const hourTotals = (() => {
    const map = new Map<string, number>();
    for (const p of rows) {
      if (!p.ts || p.unit !== 'ZION') continue;
      const hour = new Date(p.ts * 1000).toISOString().slice(0, 13) + ':00';
      map.set(hour, (map.get(hour) ?? 0) + p.amount);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-24);
  })();
  const hourMax = Math.max(0, ...hourTotals.map(([, v]) => v));

  return (
    <div className="pt-8">
      <header className="page-hero">
        <p className="rasta-hero-kicker">
          <HandCoins size={12} /> {t('Transparentní feed', 'Transparent feed')}
        </p>
        <h1>{t('Výplaty', 'Payouts')}</h1>
        <p className="page-hero-sub">
          {t(
            'PPLNS okno, nativní coin výplaty a každá tx on-chain — fee 1 %, žádné skryté srážky.',
            'PPLNS window, native-coin payouts and every tx on-chain — 1% fee, no hidden deductions.',
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

      {/* Policy cards */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="pool-card">
          <p className="kicker">{t('Model', 'Model')}</p>
          <p className="mt-2 text-sm font-bold text-white">PPLNS</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            {t(
              'Odměna se dělí podle sharů v posledním okně — žádný hop-proof, férové pro dlouhodobé minery.',
              'Rewards split by shares in the last window — hop-proof and fair for loyal miners.',
            )}
          </p>
        </div>
        <div className="pool-card">
          <p className="kicker">{t('Výplata vždy v nativním coinu', 'Always native-coin payouts')}</p>
          <p className="mt-2 text-sm font-bold text-white">ZION · QTC · PRL</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            {t(
              'Žádná auto-konverze. Dávky jedou periodicky po dosažení minima per coin.',
              'No auto-conversion. Batches run periodically once the per-coin minimum is hit.',
            )}
          </p>
        </div>
        <div className="pool-card">
          <p className="kicker">{t('Fee split', 'Fee split')}</p>
          <p className="mt-2 text-sm font-bold text-white">1% pool + 5% + 5%</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            {t(
              'Z každé odměny jde 5 % na humanitarian a 5 % na issobella fond — napsané v protokolu, ne v marketingu.',
              'Every reward routes 5% to humanitarian and 5% to the issobella fund — in-protocol, not marketing.',
            )}
          </p>
        </div>
      </div>

      {/* Payout volume — ZION rows, hourly buckets */}
      {hourTotals.length > 1 && (
        <div className="pool-card card-glow mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">
              {t('vyplaceno ZION / hod', 'ZION paid / hour')}
            </h3>
            <span className="stat-value text-[0.7rem] text-white/35">
              {hourTotals.length} h
            </span>
          </div>
          <div className="flex h-20 items-end gap-1">
            {hourTotals.map(([hour, v]) => (
              <div
                key={hour}
                className="group relative flex-1 rounded-t-sm bg-gradient-to-t from-rasta-gold/15 to-rasta-gold/60 transition-colors hover:to-rasta-gold"
                style={{ height: `${Math.max(4, (v / (hourMax || 1)) * 100)}%` }}
                title={`${hour.slice(5)}: ${fmtAmount(v, 'ZION')} ZION`}
              >
                <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.6rem] font-bold text-rasta-gold opacity-0 transition-opacity group-hover:opacity-100">
                  {fmtAmount(v, 'ZION')}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[0.6rem] text-white/25">
            <span>{hourTotals[0]?.[0].slice(5)}</span>
            <span>{hourTotals[hourTotals.length - 1]?.[0].slice(5)}</span>
          </div>
        </div>
      )}

      <div className="pool-card mt-6 overflow-x-auto">
        <table className="pool-table">
          <thead>
            <tr>
              <th>coin</th>
              <th>{t('čas', 'time')}</th>
              <th>{t('adresa', 'address')}</th>
              <th>{t('částka', 'amount')}</th>
              <th>{t('stav', 'status')}</th>
              <th>tx</th>
              <th>{t('konf.', 'conf.')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={i}>
                <td className={`font-bold ${COIN_COLOR[p.coin] ?? 'text-white'}`}>
                  {p.coin.toUpperCase()}
                </td>
                <td className="text-dim">{p.ts ? fmtAgo(p.ts, lang) : '—'}</td>
                <td className="text-white">{shortAddr(p.address)}</td>
                <td className="text-white">{fmtAmount(p.amount, p.unit)}</td>
                <td>
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PAYOUT_STATUS_CLASS[p.status]}`}
                  >
                    {payoutStatusLabel(p.status, t)}
                  </span>
                </td>
                <td className="text-dim">
                  {p.tx ? (
                    p.coin === 'zion' ? (
                      <a
                        href={`${EXPLORER_TX}${p.tx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-white/30 underline-offset-2 hover:text-white"
                      >
                        {shortAddr(p.tx)}
                      </a>
                    ) : (
                      shortAddr(p.tx)
                    )
                  ) : (
                    '—'
                  )}
                </td>
                <td className={p.confirmed ? 'text-green' : 'text-gold'}>
                  {p.status === 'queued' ? '—' : fmtInt(p.confirmations)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
