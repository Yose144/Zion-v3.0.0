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

const ProExplorerStatsCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  unableToConnectToZionNetwork: { cs: `Nepodařilo se připojit k síti ZION`, en: `Unable to connect to ZION network` },
  blockHeight: { cs: `Výška bloku`, en: `Block Height` },
  last: { cs: `Poslední`, en: `Last` },
  networkHashrate: { cs: `Hashrate sítě`, en: `Network Hashrate` },
  pool: { cs: `Pool`, en: `Pool` },
  difficulty: { cs: `Obtížnost`, en: `Difficulty` },
  circulatingSupply: { cs: `Oběžná zásoba`, en: `Circulating Supply` },
  avgBlockTime: { cs: `Průměrný čas bloku`, en: `Avg Block Time` },
  target: { cs: `Cíl`, en: `Target` },
  totalTransactions: { cs: `Celkem transakcí`, en: `Total Transactions` },
  connections: { cs: `Spojení`, en: `Connections` },
  activeMiners: { cs: `Aktivní mineři`, en: `Active Miners` },
  blocksFound: { cs: `nalezených bloků`, en: `blocks found` },
  poolPayouts: { cs: `Pool výplaty`, en: `Pool Payouts` },
  minersPending: { cs: `minerů čeká`, en: `miners pending` },
  blockSize: { cs: `Velikost bloku`, en: `Block Size` },
  median: { cs: `Medián`, en: `Median` },
  database: { cs: `Databáze`, en: `Database` },
  knownPeers: { cs: `Známé peery`, en: `Known Peers` },
  altBlocks: { cs: `alternativních bloků`, en: `alt blocks` },
};

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
        transition-all duration-300 overflow-hidden" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
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
  const locale = ProExplorerStatsCopy.enUs[cs ? 'cs' : 'en'];
  const { data: stats, error, loading } = useBlockchainStats(15_000);

  if (loading && !stats && !error) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="zion-rainbow-sub p-4 animate-pulse" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
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
      <div className="zion-rainbow-sub p-6 text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
        <Server className="h-8 w-8 text-zion-purple mx-auto mb-2" />
        <p className="text-zion-purple text-sm">{ProExplorerStatsCopy.unableToConnectToZionNetwork[cs ? 'cs' : 'en']}</p>
      </div>
    );
  }

  const cards: StatCardProps[] = [
    {
      icon: Box, label: ProExplorerStatsCopy.blockHeight[cs ? 'cs' : 'en'], value: fmt(stats.block_height),
      sub: stats.last_block ? `${ProExplorerStatsCopy.last[cs ? 'cs' : 'en']}: ${new Date(stats.last_block.timestamp * 1000).toLocaleTimeString(locale)}` : undefined,
      color: "text-zion-gold", bgColor: "from-zion-gold/5 to-transparent",
    },
    {
      icon: Cpu, label: ProExplorerStatsCopy.networkHashrate[cs ? 'cs' : 'en'], value: stats.network_hashrate_formatted,
      sub: stats.pool_hashrate_formatted ? `${ProExplorerStatsCopy.pool[cs ? 'cs' : 'en']}: ${stats.pool_hashrate_formatted}` : undefined,
      color: "text-zion-cyan", bgColor: "from-zion-cyan/5 to-transparent",
    },
    {
      icon: Hash, label: ProExplorerStatsCopy.difficulty[cs ? 'cs' : 'en'], value: fmt(stats.difficulty),
      color: "text-zion-cyan", bgColor: "from-zion-cyan/5 to-transparent",
    },
    {
      icon: Wallet, label: ProExplorerStatsCopy.circulatingSupply[cs ? 'cs' : 'en'], value: `${fmt(stats.circulating_supply)} ZION`,
      sub: cs ? `${stats.emission_pct}% maxima` : `${stats.emission_pct}% of max`, color: "text-zion-gold", bgColor: "from-zion-gold/5 to-transparent",
    },
    {
      icon: Clock, label: ProExplorerStatsCopy.avgBlockTime[cs ? 'cs' : 'en'], value: `${stats.avg_block_time}s`,
      sub: `${ProExplorerStatsCopy.target[cs ? 'cs' : 'en']}: ${stats.target_block_time}s`, color: "text-zion-purple", bgColor: "from-zion-purple/5 to-transparent",
    },
    {
      icon: Layers, label: ProExplorerStatsCopy.totalTransactions[cs ? 'cs' : 'en'], value: fmt(stats.tx_count),
      color: "text-zion-purple", bgColor: "from-zion-purple/5 to-transparent",
    },
    {
      icon: Zap, label: "Mempool", value: `${stats.tx_pool_size} tx`,
      color: stats.tx_pool_size > 10 ? "text-zion-gold" : "text-gray-400", bgColor: "from-zion-gold/5 to-transparent",
    },
    {
      icon: Users, label: ProExplorerStatsCopy.connections[cs ? 'cs' : 'en'], value: `${stats.total_connections}`,
      sub: `↓${stats.incoming_connections} ↑${stats.outgoing_connections}`,
      color: "text-zion-purple", bgColor: "from-zion-purple/5 to-transparent",
    },
    {
      icon: TrendingUp, label: ProExplorerStatsCopy.activeMiners[cs ? 'cs' : 'en'], value: `${stats.active_miners}`,
      sub: stats.pool_blocks_found ? `${stats.pool_blocks_found} ${ProExplorerStatsCopy.blocksFound[cs ? 'cs' : 'en']}` : undefined,
      color: "text-zion-cyan", bgColor: "from-zion-cyan/5 to-transparent",
    },
    {
      icon: Banknote, label: ProExplorerStatsCopy.poolPayouts[cs ? 'cs' : 'en'],
      value: stats.pool_pending_payouts_atomic ? `${(stats.pool_pending_payouts_atomic / 1e6).toFixed(2)} ZION` : "0 ZION",
      sub: stats.pool_pending_miners ? `${stats.pool_pending_miners} ${ProExplorerStatsCopy.minersPending[cs ? 'cs' : 'en']}` : undefined,
      color: "text-zion-gold", bgColor: "from-zion-gold/5 to-transparent",
    },
    {
      icon: Gauge, label: ProExplorerStatsCopy.blockSize[cs ? 'cs' : 'en'],
      value: stats.last_block ? fmtBytes(stats.last_block.block_size) : "—",
      sub: `${ProExplorerStatsCopy.median[cs ? 'cs' : 'en']}: ${fmtBytes(stats.block_size_median)}`,
      color: "text-zion-cyan", bgColor: "from-zion-cyan/5 to-transparent",
    },
    {
      icon: Database, label: ProExplorerStatsCopy.database[cs ? 'cs' : 'en'],
      value: stats.database_size ? fmtBytes(stats.database_size) : "—",
      sub: stats.version ? `v${stats.version}` : undefined,
      color: "text-zion-purple", bgColor: "from-zion-purple/5 to-transparent",
    },
    {
      icon: Globe, label: ProExplorerStatsCopy.knownPeers[cs ? 'cs' : 'en'], value: `${stats.white_peerlist_size}`,
      sub: stats.alt_blocks_count ? `${stats.alt_blocks_count} ${ProExplorerStatsCopy.altBlocks[cs ? 'cs' : 'en']}` : undefined,
      color: "text-zion-purple", bgColor: "from-zion-purple/5 to-transparent",
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
