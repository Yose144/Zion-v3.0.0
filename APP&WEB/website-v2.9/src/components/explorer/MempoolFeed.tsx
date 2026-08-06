"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ActivitySquare, Flame, Hash, Loader2 } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";

const MempoolFeedCopy = {
  mempoolUnavailable: { cs: `Mempool není dostupný`, en: `Mempool unavailable` },
  live: { cs: `Živě`, en: `Live` },
  k15sRefresh: { cs: `obnova po 15 s`, en: `15s refresh` },
  pending: { cs: `Čekající`, en: `Pending` },
  poolSize: { cs: `Velikost poolu`, en: `Pool Size` },
  fees: { cs: `Poplatky`, en: `Fees` },
  mempoolIsEmptyAllTransactionsC: { cs: `Mempool je prázdný, všechny transakce jsou potvrzené ✓`, en: `Mempool is empty — all transactions confirmed ✓` },
};

interface MempoolTx {
  tx_hash: string;
  size: number;
  fee: number;
  receive_time: number;
  age_seconds: number;
  double_spend_seen: boolean;
}

interface MempoolResponse {
  count: number;
  pool_size_bytes: number;
  total_fees: number;
  fee_stats: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
  transactions: MempoolTx[];
}

const formatTime = (seconds: number, cs: boolean) => {
  if (seconds < 60) return cs ? `před ${seconds} s` : `${seconds}s ago`;
  if (seconds < 3600) return cs ? `před ${Math.floor(seconds / 60)} min` : `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return cs ? `před ${Math.floor(seconds / 3600)} h` : `${Math.floor(seconds / 3600)}h ago`;
  return cs ? `před ${Math.floor(seconds / 86400)} d` : `${Math.floor(seconds / 86400)}d ago`;
};

const truncate = (value: string, lead = 8, tail = 6) => {
  if (!value) return "—";
  if (value.length <= lead + tail) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
};

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

export default function MempoolFeed() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const [data, setData] = useState<MempoolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMempool = useCallback(async () => {
    try {
      const result = await apiClient<MempoolResponse>(
        "/blockchain/mempool",
        { cache: "no-store" }
      );
      setData(result);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch mempool:", err);
      setError(MempoolFeedCopy.mempoolUnavailable[cs ? 'cs' : 'en']);
    } finally {
      setLoading(false);
    }
  }, [cs]);

  usePolling(fetchMempool, 20_000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="zion-rainbow-card p-6"
      style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
    >
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/explorer/mempool"
          className="flex items-center gap-3 group"
        >
          <Flame className="h-5 w-5 text-zion-gold-400 group-hover:text-zion-gold-300 transition-colors" />
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{MempoolFeedCopy.live[cs ? 'cs' : 'en']}</p>
            <h3 className="text-lg font-semibold text-white group-hover:text-zion-gold-300 transition-colors">Mempool →</h3>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-flex h-2 w-2 rounded-full bg-zion-cyan-400"
          />
          <span className="text-xs text-gray-500">{MempoolFeedCopy.k15sRefresh[cs ? 'cs' : 'en']}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <p className="text-xs text-gray-400">{MempoolFeedCopy.pending[cs ? 'cs' : 'en']}</p>
          <p className="text-xl font-bold text-white">{data?.count ?? 0}</p>
        </div>
        <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <p className="text-xs text-gray-400">{MempoolFeedCopy.poolSize[cs ? 'cs' : 'en']}</p>
          <p className="text-xl font-bold text-zion-cyan-400">
            {formatBytes(data?.pool_size_bytes ?? 0)}
          </p>
        </div>
        <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <p className="text-xs text-gray-400">{MempoolFeedCopy.fees[cs ? 'cs' : 'en']}</p>
          <p className="text-xl font-bold text-zion-gold-400">
            {(data?.total_fees ?? 0).toFixed(4)}
          </p>
        </div>
      </div>

      {/* TX list */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {loading && !data && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}
        {error && (
          <p className="text-center text-sm text-zion-purple-400/80 py-4">{error}</p>
        )}
        {data && data.transactions.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-4">
            {MempoolFeedCopy.mempoolIsEmptyAllTransactionsC[cs ? 'cs' : 'en']}
          </p>
        )}
        {data?.transactions.slice(0, 12).map((tx, i) => (
          <motion.div
            key={tx.tx_hash}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: i * 0.02 }}
            className="zion-tile p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <Link
                href={`/explorer/tx?hash=${encodeURIComponent(tx.tx_hash)}`}
                className="flex items-center gap-1.5 font-mono text-xs text-zion-purple-300 hover:text-purple-200 transition-colors"
              >
                <Hash className="h-3 w-3 text-gray-500" />
                {truncate(tx.tx_hash)}
              </Link>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <ActivitySquare className="h-3 w-3" />
                {formatTime(tx.age_seconds, cs)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">
                {formatBytes(tx.size)}
              </span>
              <span className="text-zion-gold-400 font-semibold">
                {tx.fee.toFixed(6)} ZION
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
