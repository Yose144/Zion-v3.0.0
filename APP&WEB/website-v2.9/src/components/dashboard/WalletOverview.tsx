'use client';

/**
 * WalletOverview — shows wallet balance, UTXO count, send/receive actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { Wallet, Send, Download, RefreshCw, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';

interface WalletOverviewProps {
  address: string;
}

interface BalanceData {
  balance_zion: number;
  balance_atomic: number;
  utxo_count: number;
}

export default function WalletOverview({ address }: WalletOverviewProps) {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSend, setShowSend] = useState(false);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blockchain/address/${address}`);
      if (!res.ok) throw new Error('Failed to fetch balance');
      const data = await res.json();
      setBalance({
        balance_zion: data.balance_zion ?? data.balance ?? 0,
        balance_atomic: data.balance_atomic ?? 0,
        utxo_count: data.utxo_count ?? data.utxos?.length ?? 0,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return (
    <div className="space-y-6">
      {/* Balance card */}
      <div className="relative overflow-hidden rounded-2xl border border-zion-cyan/20 bg-gradient-to-br from-black/80 to-zion-purple/5 p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-zion-cyan/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-zion-cyan" />
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Balance</h3>
            </div>
            <button
              onClick={fetchBalance}
              disabled={loading}
              className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-zion-cyan" />
              <span className="text-sm text-gray-500">Loading balance...</span>
            </div>
          ) : error ? (
            <div className="py-4 text-sm text-zion-purple-400">{error}</div>
          ) : (
            <>
              <div className="text-4xl font-bold text-white mb-1">
                {balance?.balance_zion.toFixed(8) || '0.00000000'}
                <span className="text-lg text-zion-gold ml-2">ZION</span>
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                <span>UTXOs: <span className="text-gray-300 font-mono">{balance?.utxo_count ?? 0}</span></span>
                <span>Atomic: <span className="text-gray-300 font-mono">{balance?.balance_atomic ?? 0}</span></span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <a
          href="/wallet"
          className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-zion-cyan/30 hover:bg-zion-cyan/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zion-cyan/10 border border-zion-cyan/20">
            <Send className="h-5 w-5 text-zion-cyan" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Send</p>
            <p className="text-[10px] text-gray-500">Transfer ZION</p>
          </div>
        </a>
        <a
          href="/wallet"
          className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-zion-gold/30 hover:bg-zion-gold/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zion-gold/10 border border-zion-gold/20">
            <Download className="h-5 w-5 text-zion-gold" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Receive</p>
            <p className="text-[10px] text-gray-500">Share address</p>
          </div>
        </a>
      </div>

      {/* Address card */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Your Address</p>
        <p className="font-mono text-xs text-gray-300 break-all">{address}</p>
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`/explorer?address=${address}`}
          className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-zion-cyan/80 transition-colors"
        >
          <ArrowUpRight className="h-3.5 w-3.5" /> View on Explorer
        </a>
        <a
          href="/wallet"
          className="inline-flex items-center gap-1.5 text-xs text-zion-gold hover:text-zion-gold/80 transition-colors"
        >
          <ArrowUpRight className="h-3.5 w-3.5" /> Full Wallet
        </a>
      </div>
    </div>
  );
}
