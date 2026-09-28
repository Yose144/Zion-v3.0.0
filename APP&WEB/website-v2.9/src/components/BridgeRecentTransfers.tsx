'use client';

/**
 * BridgeRecentTransfers — live L1→Base lock transactions on /wallet/bridge.
 *
 * Reads /api/bridge/transactions (server-side scans getBridgeLocks on the L1
 * RPC) and /api/bridge/status for relay liveness. Renders pending/finalized
 * state with a confirmation progress bar toward the 60-block finality window.
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { ArrowRight, CheckCircle2, Clock, RefreshCw, Radio } from 'lucide-react';

const FINALITY_BLOCKS = 60;
const POLL_MS = 30_000;

interface BridgeLockTx {
  txid: string;
  block_height: number;
  sender: string;
  recipient_chain: string;
  recipient: string;
  amount_zion: string;
  confirmations: number;
  finalized: boolean;
  status: 'finalized' | 'pending';
}

const COPY = {
  recent: { cs: 'Poslední bridge transakce', en: 'Recent bridge transactions' },
  relayOnline: { cs: 'Relay online', en: 'Relay online' },
  relayOffline: { cs: 'Relay offline', en: 'Relay offline' },
  empty: { cs: 'Žádné bridge transakce v posledních blocích.', en: 'No bridge transactions in recent blocks.' },
  pending: { cs: 'Čeká na finalitu', en: 'Awaiting finality' },
  finalized: { cs: 'Finalizováno', en: 'Finalized' },
  confs: { cs: 'konfirmací', en: 'confirmations' },
  error: { cs: 'Nepodařilo se načíst bridge transakce.', en: 'Failed to load bridge transactions.' },
};

function shortAddr(a: string): string {
  return a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;
}

export default function BridgeRecentTransfers() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [txs, setTxs] = useState<BridgeLockTx[]>([]);
  const [relayOnline, setRelayOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [txRes, statusRes] = await Promise.all([
        fetch('/api/bridge/transactions?limit=10', { cache: 'no-store' }),
        fetch('/api/bridge/status', { cache: 'no-store' }),
      ]);
      if (txRes.ok) {
        const data = await txRes.json();
        setTxs(Array.isArray(data?.transactions) ? data.transactions : []);
        setFailed(false);
      } else {
        setFailed(true);
      }
      if (statusRes.ok) {
        const s = await statusRes.json();
        setRelayOnline(Boolean(s?.relay_metrics_online));
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-zion-cyan" />
          {COPY.recent[cs ? 'cs' : 'en']}
        </h2>
        <div className="flex items-center gap-3">
          {relayOnline !== null && (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
              relayOnline
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                : 'border-amber-400/40 bg-amber-400/10 text-amber-300'
            }`}>
              <Radio className="h-3 w-3" />
              {relayOnline ? COPY.relayOnline[cs ? 'cs' : 'en'] : COPY.relayOffline[cs ? 'cs' : 'en']}
            </span>
          )}
          <button
            onClick={() => void load()}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {failed && (
        <p className="text-sm text-red-400">{COPY.error[cs ? 'cs' : 'en']}</p>
      )}

      {!failed && !loading && txs.length === 0 && (
        <p className="text-sm text-gray-500">{COPY.empty[cs ? 'cs' : 'en']}</p>
      )}

      {loading && txs.length === 0 && !failed && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="zion-rainbow-sub p-3 animate-pulse">
              <div className="h-4 w-2/3 rounded bg-white/10" />
            </div>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {txs.map((tx) => {
          const pct = Math.min(100, Math.round((tx.confirmations / FINALITY_BLOCKS) * 100));
          return (
            <li key={tx.txid} className="zion-rainbow-sub p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm text-white font-mono">
                    {tx.amount_zion} ZION <ArrowRight className="inline h-3 w-3 text-zion-cyan" /> {tx.recipient_chain}
                  </p>
                  <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                    {shortAddr(tx.sender)} → {shortAddr(tx.recipient)}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  tx.finalized
                    ? 'bg-emerald-400/10 border border-emerald-400/40 text-emerald-300'
                    : 'bg-amber-400/10 border border-amber-400/40 text-amber-300'
                }`}>
                  {tx.finalized ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {tx.finalized ? COPY.finalized[cs ? 'cs' : 'en'] : `${tx.confirmations}/${FINALITY_BLOCKS} ${COPY.confs[cs ? 'cs' : 'en']}`}
                </span>
              </div>
              {!tx.finalized && (
                <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-zion-cyan to-zion-gold transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
