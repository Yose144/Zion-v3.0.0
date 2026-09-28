'use client';

/**
 * TransactionHistory — shows incoming/outgoing transactions for the user's address.
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, RefreshCw, Loader2, ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react';

interface TransactionHistoryProps {
  address: string;
}

interface Tx {
  tx_hash: string;
  block_height: number;
  /** seconds since epoch (normalized from API `timestamp`) */
  timestamp: number;
  /** ZION amount (API already returns ZION, not atomic) */
  amount: number;
  fee?: number;
  from?: string;
  /** comma-separated output list on multi-output transfers */
  to?: string;
  direction?: 'in' | 'out';
  memo?: string;
}

export default function TransactionHistory({ address }: TransactionHistoryProps) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTxs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blockchain/transactions?address=${address}&limit=50`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      const list = data.transactions ?? data.txs ?? data ?? [];
      const normalized: Tx[] = (Array.isArray(list) ? list : []).map((tx: any) => ({
        tx_hash: tx.tx_hash ?? tx.tx_id ?? '',
        block_height: tx.block_height ?? 0,
        timestamp: tx.block_timestamp ?? tx.timestamp ?? 0,
        // API `amount` is ZION; `amount_zion` is atomic flowers — prefer the float.
        amount: Number(tx.amount ?? (Number(tx.amount_zion ?? 0) / 1_000_000)),
        from: tx.from,
        to: tx.to,
        direction: tx.direction,
      }));
      setTxs(normalized.filter((tx) => tx.tx_hash));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchTxs();
  }, [fetchTxs]);

  const formatAmount = (zion: number) => {
    return zion.toFixed(6);
  };

  // `to`/`from` are comma-joined output lists on multi-output transfers —
  // exact `===` almost never matches; check individual entries.
  const involvesAddress = (field: string | undefined) =>
    !!field && field.split(',').map((a) => a.trim()).includes(address);

  const formatTime = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-zion-gold" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Transaction History</h3>
        </div>
        <button
          onClick={fetchTxs}
          disabled={loading}
          className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zion-gold" />
          <span className="text-sm text-gray-500">Loading transactions...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-zion-purple/20 bg-zion-purple/5 p-4 text-sm text-zion-purple">{error}</div>
      ) : txs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <ArrowLeftRight className="h-10 w-10 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No transactions yet</p>
          <p className="text-xs text-gray-600 mt-1">Your transaction history will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {txs.map((tx) => {
            // Sender wins over recipient when the address appears on both
            // sides (UTXO change outputs list the sender as an output too).
            const isIn = tx.direction === 'in' ||
              (involvesAddress(tx.to) && !involvesAddress(tx.from) && tx.direction !== 'out');
            const amount = formatAmount(tx.amount ?? 0);
            return (
              <div
                key={tx.tx_hash}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:border-white/20 transition-colors"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isIn ? 'bg-zion-cyan/10 border border-zion-cyan/20' : 'bg-zion-purple/10 border border-zion-purple/20'
                }`}>
                  {isIn ? (
                    <ArrowDownLeft className="h-4 w-4 text-zion-cyan" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-zion-purple" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-mono font-semibold ${isIn ? 'text-zion-cyan' : 'text-zion-purple'}`}>
                      {isIn ? '+' : '-'}{amount} ZION
                    </p>
                    <span className="text-[10px] text-gray-600">{formatTime(tx.timestamp)}</span>
                  </div>
                  <p className="text-[10px] font-mono text-gray-600 truncate">
                    {tx.tx_hash.slice(0, 24)}...
                  </p>
                </div>
                <a
                  href={`/explorer?tx=${tx.tx_hash}`}
                  className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-zion-cyan transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
