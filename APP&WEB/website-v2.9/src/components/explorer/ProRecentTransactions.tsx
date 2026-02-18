"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { motion } from "framer-motion";
import { ArrowRightLeft, ChevronRight, Copy, Check, Clock } from "lucide-react";

interface Transaction {
  tx_hash: string;
  type: string;
  amount: number;
  fee: number;
  block_height: number;
  timestamp: number;
  status: string;
  confirmations: number;
}

const fmtAge = (ts: number): string => {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const truncHash = (h: string, len = 8): string =>
  h ? `${h.slice(0, len)}…${h.slice(-len)}` : "—";

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="text-gray-600 hover:text-white transition ml-1.5 flex-shrink-0"
      title="Copy hash"
    >
      {ok ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    coinbase: "bg-zion-gold/15 text-zion-gold border-zion-gold/30",
    transfer: "bg-zion-cyan/15 text-zion-cyan border-zion-cyan/30",
    payout: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
  const s = styles[type] || "bg-gray-500/15 text-gray-400 border-gray-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${s}`}>
      {type === "coinbase" ? "⛏ Coinbase" : type === "transfer" ? "↔ Transfer" : type}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "pending") {
    return <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" title="Pending" />;
  }
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" title="Confirmed" />;
}

export default function ProRecentTransactions() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const fetchTxs = useCallback(async () => {
    try {
      const json = await apiClient<any>("/blockchain/transactions?limit=15");
      setTxs(json.transactions || json.items || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTxs();
    const iv = setInterval(fetchTxs, 10000);
    return () => clearInterval(iv);
  }, [fetchTxs]);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-[28px] border border-white/[0.08] bg-black/60 backdrop-blur-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-zion-cyan/10">
            <ArrowRightLeft className="h-4.5 w-4.5 text-zion-cyan" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Latest Transactions</h3>
            <p className="text-[11px] text-gray-500">Real-time transaction feed</p>
          </div>
        </div>
        <Link
          href="/explorer/transactions"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-zion-cyan transition-colors font-medium"
        >
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3 w-5" />
              <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3">Hash</th>
              <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3 hidden sm:table-cell">Type</th>
              <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3">Age</th>
              <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3 hidden md:table-cell">Block</th>
              <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3 hidden lg:table-cell">Fee</th>
              <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-3 py-3 first:px-6 last:px-6">
                        <div className="h-4 bg-white/5 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : txs.slice(0, 15).map((tx) => (
                  <tr
                    key={tx.tx_hash}
                    className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors group"
                  >
                    <td className="px-6 py-3">
                      <StatusDot status={tx.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center">
                        {tx.type === "coinbase" ? (
                          <span className="text-gray-500 font-mono text-xs">
                            {truncHash(tx.tx_hash, 10)}
                          </span>
                        ) : (
                          <Link
                            href={`/explorer/tx?hash=${tx.tx_hash}`}
                            className="text-zion-cyan hover:text-white transition font-mono text-xs"
                          >
                            {truncHash(tx.tx_hash, 10)}
                          </Link>
                        )}
                        {tx.tx_hash && !tx.tx_hash.startsWith("coinbase_") && (
                          <CopyBtn text={tx.tx_hash} />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <TypeBadge type={tx.type} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-gray-400 text-xs tabular-nums whitespace-nowrap">
                        {fmtAge(tx.timestamp)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right hidden md:table-cell">
                      {tx.block_height ? (
                        <Link
                          href={`/explorer/block?id=${tx.block_height}`}
                          className="text-gray-400 hover:text-zion-cyan transition text-xs font-mono"
                        >
                          {tx.block_height.toLocaleString()}
                        </Link>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right hidden lg:table-cell">
                      <span className="text-gray-500 text-xs tabular-nums">
                        {tx.fee > 0 ? tx.fee.toFixed(6) : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-white text-xs font-semibold tabular-nums">
                        {tx.amount.toFixed(2)}
                      </span>
                      <span className="text-gray-600 text-[10px] ml-1">ZION</span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {!loading && txs.length > 0 && (
        <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between">
          <p className="text-[11px] text-gray-600">
            Showing {Math.min(15, txs.length)} latest transactions · Auto-refresh 10s
          </p>
          <Link
            href="/explorer/transactions"
            className="text-[11px] text-zion-cyan hover:text-white transition font-medium"
          >
            Full Transaction Feed →
          </Link>
        </div>
      )}
    </motion.div>
  );
}
