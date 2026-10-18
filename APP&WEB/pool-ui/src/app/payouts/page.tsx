'use client';

import { useEffect, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { fetchPayouts } from '@/lib/api';
import { fmtAgo, fmtAmount, fmtInt, shortAddr } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { CoinId, PayoutRow } from '@/lib/types';

const COIN_COLOR: Record<string, string> = {
  zion: 'text-gold',
  qtc: 'text-cyan',
  prl: 'text-purple',
};

export default function PayoutsPage() {
  const { t, lang } = useLang();
  const [coin, setCoin] = useState<CoinId | ''>('');
  const [rows, setRows] = useState<PayoutRow[]>([]);

  useEffect(() => {
    fetchPayouts(coin || undefined).then(setRows);
  }, [coin]);

  return (
    <div className="pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">{t('Transparentní feed', 'Transparent feed')}</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-white">
            <HandCoins className="text-zion-gold" size={26} /> {t('Výplaty', 'Payouts')}
          </h1>
        </div>
        <div className="flex gap-2">
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
      </div>

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

      <div className="pool-card mt-6 overflow-x-auto">
        <table className="pool-table">
          <thead>
            <tr>
              <th>coin</th>
              <th>{t('čas', 'time')}</th>
              <th>{t('adresa', 'address')}</th>
              <th>{t('částka', 'amount')}</th>
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
                <td className="text-dim">{fmtAgo(p.ts, lang)}</td>
                <td className="text-white">{shortAddr(p.address)}</td>
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
    </div>
  );
}
