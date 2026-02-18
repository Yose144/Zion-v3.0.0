"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { motion } from "framer-motion";
import {
  type LucideIcon,
  Box,
  Clock,
  Cpu,
  Database,
  Gauge,
  Globe,
  Hash,
  Layers,
  Server,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

interface Stats {
  block_height: number;
  difficulty: number;
  cumulative_difficulty: number;
  circulating_supply: number;
  max_supply: number;
  emission_pct: string;
  network_hashrate: number;
  network_hashrate_formatted: string;
  target_block_time: number;
  avg_block_time: number;
  tx_count: number;
  tx_pool_size: number;
  total_connections: number;
  incoming_connections: number;
  outgoing_connections: number;
  white_peerlist_size: number;
  block_size_limit: number;
  block_size_median: number;
  connected: boolean;
  version: string;
  database_size: number;
  alt_blocks_count: number;
  active_miners: number;
  pool_hashrate: number;
  pool_hashrate_formatted: string;
  pool_blocks_found: number;
  last_block?: {
    height: number;
    hash: string;
    timestamp: number;
    difficulty: number;
    reward: number;
    num_txes: number;
    block_size: number;
  };
}

const fmt = (n: number): string => {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString();
};

const fmtBytes = (b: number): string => {
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bgColor: string;
  delay?: number;
}

function StatCard({ icon: Icon, label, value, sub, color, bgColor, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 
        hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300 overflow-hidden"
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 
        bg-gradient-to-br ${bgColor} pointer-events-none`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`flex items-center justify-center h-8 w-8 rounded-xl bg-white/5`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
        <p className="text-[11px] uppercase tracking-[0.15em] text-gray-500 font-medium mb-1">{label}</p>
        <p className="text-xl font-bold text-white tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-500 mt-1 tabular-nums">{sub}</p>}
      </div>
    </motion.div>
  );
}

export default function ProExplorerStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const json = await apiClient<Stats>("/blockchain/stats");
      setStats(json);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 12000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  if (!stats && !error) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 animate-pulse">
            <div className="h-8 w-8 bg-white/5 rounded-xl mb-3" />
            <div className="h-3 w-16 bg-white/5 rounded mb-2" />
            <div className="h-6 w-20 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <Server className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-400 text-sm">Unable to connect to ZION network</p>
        <button onClick={fetchStats} className="mt-3 text-xs text-gray-400 hover:text-white transition">Retry →</button>
      </div>
    );
  }

  const cards: StatCardProps[] = [
    {
      icon: Box, label: "Block Height", value: fmt(stats.block_height),
      sub: stats.last_block ? `Last: ${new Date(stats.last_block.timestamp * 1000).toLocaleTimeString()}` : undefined,
      color: "text-zion-gold", bgColor: "from-yellow-500/5 to-transparent",
    },
    {
      icon: Cpu, label: "Network Hashrate", value: stats.network_hashrate_formatted,
      sub: stats.pool_hashrate_formatted ? `Pool: ${stats.pool_hashrate_formatted}` : undefined,
      color: "text-emerald-400", bgColor: "from-emerald-500/5 to-transparent",
    },
    {
      icon: Hash, label: "Difficulty", value: fmt(stats.difficulty),
      color: "text-zion-cyan", bgColor: "from-cyan-500/5 to-transparent",
    },
    {
      icon: Wallet, label: "Circulating Supply", value: `${fmt(stats.circulating_supply)} ZION`,
      sub: `${stats.emission_pct}% of max`, color: "text-zion-gold", bgColor: "from-yellow-500/5 to-transparent",
    },
    {
      icon: Clock, label: "Avg Block Time", value: `${stats.avg_block_time}s`,
      sub: `Target: ${stats.target_block_time}s`, color: "text-blue-400", bgColor: "from-blue-500/5 to-transparent",
    },
    {
      icon: Layers, label: "Total Transactions", value: fmt(stats.tx_count),
      color: "text-purple-400", bgColor: "from-purple-500/5 to-transparent",
    },
    {
      icon: Zap, label: "Mempool", value: `${stats.tx_pool_size} tx`,
      color: stats.tx_pool_size > 10 ? "text-amber-400" : "text-gray-400", bgColor: "from-amber-500/5 to-transparent",
    },
    {
      icon: Users, label: "Connections", value: `${stats.total_connections}`,
      sub: `↓${stats.incoming_connections} ↑${stats.outgoing_connections}`,
      color: "text-purple-400", bgColor: "from-purple-500/5 to-transparent",
    },
    {
      icon: TrendingUp, label: "Active Miners", value: `${stats.active_miners}`,
      sub: stats.pool_blocks_found ? `${stats.pool_blocks_found} blocks found` : undefined,
      color: "text-emerald-400", bgColor: "from-emerald-500/5 to-transparent",
    },
    {
      icon: Gauge, label: "Block Size",
      value: stats.last_block ? fmtBytes(stats.last_block.block_size) : "—",
      sub: `Median: ${fmtBytes(stats.block_size_median)}`,
      color: "text-cyan-400", bgColor: "from-cyan-500/5 to-transparent",
    },
    {
      icon: Database, label: "Database",
      value: stats.database_size ? fmtBytes(stats.database_size) : "—",
      sub: stats.version ? `v${stats.version}` : undefined,
      color: "text-pink-400", bgColor: "from-pink-500/5 to-transparent",
    },
    {
      icon: Globe, label: "Known Peers", value: `${stats.white_peerlist_size}`,
      sub: stats.alt_blocks_count ? `${stats.alt_blocks_count} alt blocks` : undefined,
      color: "text-indigo-400", bgColor: "from-indigo-500/5 to-transparent",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {cards.map((card, i) => (
        <StatCard key={card.label} {...card} delay={i * 0.04} />
      ))}
    </div>
  );
}
