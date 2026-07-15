"use client";

import { motion } from "framer-motion";
import { useLang } from "@/contexts/LanguageContext";
import { useBlockchainStats } from "@/hooks/useBlockchainStats";
import {
  type LucideIcon,
  Banknote,
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
  pool_pending_payouts_atomic: number;
  pool_pending_miners: number;
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
      className="group relative zion-rainbow-sub p-4 
        transition-all duration-300 overflow-hidden" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
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
  const { lang } = useLang();
  const cs = lang === "cs";
  const locale = cs ? "cs-CZ" : "en-US";
  const { data: stats, error, loading } = useBlockchainStats(15_000);

  if (loading && !stats && !error) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="zion-rainbow-sub p-4 animate-pulse" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
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
      <div className="zion-rainbow-sub p-6 text-center" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
        <Server className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-400 text-sm">{cs ? "Nepodařilo se připojit k síti ZION" : "Unable to connect to ZION network"}</p>
      </div>
    );
  }

  const cards: StatCardProps[] = [
    {
      icon: Box, label: cs ? "Výška bloku" : "Block Height", value: fmt(stats.block_height),
      sub: stats.last_block ? `${cs ? "Poslední" : "Last"}: ${new Date(stats.last_block.timestamp * 1000).toLocaleTimeString(locale)}` : undefined,
      color: "text-zion-gold", bgColor: "from-yellow-500/5 to-transparent",
    },
    {
      icon: Cpu, label: cs ? "Hashrate sítě" : "Network Hashrate", value: stats.network_hashrate_formatted,
      sub: stats.pool_hashrate_formatted ? `${cs ? "Pool" : "Pool"}: ${stats.pool_hashrate_formatted}` : undefined,
      color: "text-emerald-400", bgColor: "from-emerald-500/5 to-transparent",
    },
    {
      icon: Hash, label: cs ? "Obtížnost" : "Difficulty", value: fmt(stats.difficulty),
      color: "text-zion-cyan", bgColor: "from-cyan-500/5 to-transparent",
    },
    {
      icon: Wallet, label: cs ? "Oběžná zásoba" : "Circulating Supply", value: `${fmt(stats.circulating_supply)} ZION`,
      sub: cs ? `${stats.emission_pct}% maxima` : `${stats.emission_pct}% of max`, color: "text-zion-gold", bgColor: "from-yellow-500/5 to-transparent",
    },
    {
      icon: Clock, label: cs ? "Průměrný čas bloku" : "Avg Block Time", value: `${stats.avg_block_time}s`,
      sub: `${cs ? "Cíl" : "Target"}: ${stats.target_block_time}s`, color: "text-blue-400", bgColor: "from-blue-500/5 to-transparent",
    },
    {
      icon: Layers, label: cs ? "Celkem transakcí" : "Total Transactions", value: fmt(stats.tx_count),
      color: "text-purple-400", bgColor: "from-purple-500/5 to-transparent",
    },
    {
      icon: Zap, label: "Mempool", value: `${stats.tx_pool_size} tx`,
      color: stats.tx_pool_size > 10 ? "text-amber-400" : "text-gray-400", bgColor: "from-amber-500/5 to-transparent",
    },
    {
      icon: Users, label: cs ? "Spojení" : "Connections", value: `${stats.total_connections}`,
      sub: `↓${stats.incoming_connections} ↑${stats.outgoing_connections}`,
      color: "text-purple-400", bgColor: "from-purple-500/5 to-transparent",
    },
    {
      icon: TrendingUp, label: cs ? "Aktivní mineři" : "Active Miners", value: `${stats.active_miners}`,
      sub: stats.pool_blocks_found ? `${stats.pool_blocks_found} ${cs ? "nalezených bloků" : "blocks found"}` : undefined,
      color: "text-emerald-400", bgColor: "from-emerald-500/5 to-transparent",
    },
    {
      icon: Banknote, label: cs ? "Pool výplaty" : "Pool Payouts",
      value: stats.pool_pending_payouts_atomic ? `${(stats.pool_pending_payouts_atomic / 1e6).toFixed(2)} ZION` : "0 ZION",
      sub: stats.pool_pending_miners ? `${stats.pool_pending_miners} ${cs ? "minerů čeká" : "miners pending"}` : undefined,
      color: "text-amber-400", bgColor: "from-amber-500/5 to-transparent",
    },
    {
      icon: Gauge, label: cs ? "Velikost bloku" : "Block Size",
      value: stats.last_block ? fmtBytes(stats.last_block.block_size) : "—",
      sub: `${cs ? "Medián" : "Median"}: ${fmtBytes(stats.block_size_median)}`,
      color: "text-cyan-400", bgColor: "from-cyan-500/5 to-transparent",
    },
    {
      icon: Database, label: cs ? "Databáze" : "Database",
      value: stats.database_size ? fmtBytes(stats.database_size) : "—",
      sub: stats.version ? `v${stats.version}` : undefined,
      color: "text-pink-400", bgColor: "from-pink-500/5 to-transparent",
    },
    {
      icon: Globe, label: cs ? "Známé peery" : "Known Peers", value: `${stats.white_peerlist_size}`,
      sub: stats.alt_blocks_count ? `${stats.alt_blocks_count} ${cs ? "alternativních bloků" : "alt blocks"}` : undefined,
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
