"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Box,
  Clock,
  Cpu,
  Database,
  Globe,
  Hash,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { usePolling } from "@/hooks/usePolling";

interface TickerData {
  block_height: number;
  difficulty: number;
  network_hashrate_formatted: string;
  avg_block_time: number;
  tx_pool_size: number;
  total_connections: number;
  circulating_supply: number;
  emission_pct: string;
  connected: boolean;
  active_miners: number;
  pool_hashrate_formatted: string;
  pool_pending_payouts_atomic: number;
  pool_pending_miners: number;
  last_block?: {
    height: number;
    hash: string;
    timestamp: number;
    reward: number;
  };
}

const formatNumber = (n: number): string => {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString();
};

const formatAge = (ts: number): string => {
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
};

export default function NetworkTicker() {
  const [data, setData] = useState<TickerData | null>(null);
  const [flash, setFlash] = useState(false);
  const prevHeightRef = useRef(0);
  const flashTimeoutRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const json = await apiClient<any>("/blockchain/stats");
      const nextHeight = json.block_height || 0;
      if (nextHeight > prevHeightRef.current && prevHeightRef.current > 0) {
        setFlash(true);
        if (flashTimeoutRef.current != null) {
          window.clearTimeout(flashTimeoutRef.current);
        }
        flashTimeoutRef.current = window.setTimeout(() => setFlash(false), 2000);
      }
      prevHeightRef.current = nextHeight;
      setData(json);
    } catch {
      /* silent */
    }
  }, []);

  usePolling(fetchData, 15_000);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current != null) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  if (!data) {
    return (
      <div className="w-full bg-black/80 border-b border-white/5">
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pendingZion = data.pool_pending_payouts_atomic
    ? (data.pool_pending_payouts_atomic / 1e12).toFixed(2)
    : "0";

  const items = [
    {
      icon: Box,
      label: "Height",
      value: formatNumber(data.block_height),
      color: "text-zion-gold",
    },
    {
      icon: Cpu,
      label: "Hashrate",
      value: data.network_hashrate_formatted,
      color: "text-emerald-400",
    },
    {
      icon: Hash,
      label: "Difficulty",
      value: formatNumber(data.difficulty),
      color: "text-zion-cyan",
    },
    {
      icon: Clock,
      label: "Block Time",
      value: `${data.avg_block_time}s`,
      color: "text-blue-400",
    },
    {
      icon: Activity,
      label: "Mempool",
      value: `${data.tx_pool_size} tx`,
      color: data.tx_pool_size > 0 ? "text-amber-400" : "text-gray-400",
    },
    {
      icon: Users,
      label: "Peers",
      value: `${data.total_connections}`,
      color: "text-purple-400",
    },
    {
      icon: Database,
      label: "Supply",
      value: `${formatNumber(data.circulating_supply)} ZION`,
      color: "text-zion-gold",
    },
    {
      icon: TrendingUp,
      label: "Mined",
      value: `${data.emission_pct}%`,
      color: "text-pink-400",
    },
    {
      icon: Zap,
      label: "Pool Hash",
      value: data.pool_hashrate_formatted || "—",
      color: "text-cyan-400",
    },
    {
      icon: Globe,
      label: "Miners",
      value: `${data.active_miners ?? 0}`,
      color: "text-emerald-400",
    },
  ];

  const lastBlockAge = data.last_block
    ? formatAge(data.last_block.timestamp)
    : null;

  return (
    <div className="relative w-full bg-black/80 backdrop-blur-xl overflow-hidden">
      {/* New block flash effect */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2 }}
            className="absolute inset-0 bg-gradient-to-r from-zion-gold/20 via-zion-cyan/10 to-transparent pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className="px-5 py-4">
        {/* Status row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                data.connected
                  ? "bg-emerald-400 shadow-emerald-400/50 shadow-sm"
                  : "bg-red-400"
              }`}
            />
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              {data.connected ? "Live" : "Offline"}
            </span>
            {lastBlockAge && (
              <span className="text-[11px] text-gray-500">
                · {lastBlockAge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zion-purple/20 border border-zion-purple/30">
            <Globe className="h-3 w-3 text-zion-purple" />
            <span className="text-[10px] font-bold text-zion-purple uppercase tracking-wider">
              Mainnet
            </span>
          </div>
        </div>

        {/* Stats grid — 2 cols mobile, 5 cols tablet+ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/5 px-3 py-2"
            >
              <item.icon className={`h-3.5 w-3.5 ${item.color} opacity-70 flex-shrink-0`} />
              <div className="min-w-0">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium leading-none mb-0.5">
                  {item.label}
                </div>
                <div className={`text-xs font-semibold ${item.color} tabular-nums truncate`}>
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
