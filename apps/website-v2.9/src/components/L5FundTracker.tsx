'use client';

/**
 * L5FundTracker — live L5 humanitarian fund tracker.
 *
 * Polls `/api/free-world/fund/balance` (proxied to the L5 service) every
 * 30s and renders the accumulated/disbursed totals plus the last scanned
 * L1 block. The tracker counts the protocol-level 5% flow into the fund
 * address — disbursement remains DAO-gated.
 */

import { useCallback, useState } from 'react';
import { Activity, Coins, Layers, Send } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';
import { fwApi, type FwFundBalance } from '@/lib/freeworld-api';

const copy = {
  accumulated: { cs: 'Nasbíráno do fondu', en: 'Accumulated into fund' },
  disbursed: { cs: 'Vyplaceno', en: 'Disbursed' },
  lastBlock: { cs: 'Poslední sledovaný blok', en: 'Last scanned block' },
  updated: { cs: 'Aktualizováno', en: 'Updated' },
  online: { cs: 'Tracker online', en: 'Tracker online' },
  offline: { cs: 'Tracker offline', en: 'Tracker offline' },
  perDay: { cs: '≈ přírůstek / den', en: '≈ accrual / day' },
};

const FLOWERS_PER_ZION = 1_000_000;

export function formatZion(flowers: number, cs: boolean, digits = 0) {
  const zion = flowers / FLOWERS_PER_ZION;
  return new Intl.NumberFormat(cs ? 'cs-CZ' : 'en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(zion);
}

export default function L5FundTracker() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [data, setData] = useState<FwFundBalance | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  const poll = useCallback(async () => {
    try {
      setData(await fwApi.fundBalance());
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  usePolling(poll, 30_000);

  const updatedAt = data?.updated_at
    ? new Date(data.updated_at).toLocaleTimeString(cs ? 'cs-CZ' : 'en-US')
    : null;

  return (
    <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
          L5 Tracker
        </p>
        {online !== null && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
              online
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                : 'border-red-400/30 bg-red-400/10 text-red-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {online ? copy.online[cs ? 'cs' : 'en'] : copy.offline[cs ? 'cs' : 'en']}
          </span>
        )}
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 text-zion-gold" />
            {copy.accumulated[cs ? 'cs' : 'en']}
          </p>
          <p className="text-2xl font-bold text-zion-gold">
            {data ? `${formatZion(data.total_accumulated, cs)} ZION` : '—'}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {copy.perDay[cs ? 'cs' : 'en']}: ~{(270 * 1440).toLocaleString(cs ? 'cs-CZ' : 'en-US')} ZION
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5 text-zion-cyan" />
            {copy.disbursed[cs ? 'cs' : 'en']}
          </p>
          <p className="text-2xl font-bold text-white">
            {data ? `${formatZion(data.total_disbursed, cs)} ZION` : '—'}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">DAO · timelock · guardian multisig</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-zion-purple" />
            {copy.lastBlock[cs ? 'cs' : 'en']}
          </p>
          <p className="text-2xl font-bold text-white font-mono">
            {data ? data.last_block_height.toLocaleString(cs ? 'cs-CZ' : 'en-US') : '—'}
          </p>
          {updatedAt && (
            <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
              <Activity className="h-3 w-3" /> {copy.updated[cs ? 'cs' : 'en']} {updatedAt}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
