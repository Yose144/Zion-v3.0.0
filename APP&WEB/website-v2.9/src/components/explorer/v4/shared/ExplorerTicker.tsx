"use client";

import { motion } from "framer-motion";
import { Box, Cpu, Globe, Hash, TrendingUp, Users, Zap } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { useBlockchainStats } from "@/hooks/useBlockchainStats";
import { formatHashrate, formatNumber, formatAge } from "@/lib/explorer/format";
import LiveBadge from "./LiveBadge";

const ExplorerTickerCopy = {
  height: { cs: `Výška`, en: `Height` },
  hashrate: { cs: `Hashrate`, en: `Hashrate` },
  difficulty: { cs: `Obtížnost`, en: `Difficulty` },
  mempool: { cs: `Mempool`, en: `Mempool` },
  peers: { cs: `Peeri`, en: `Peers` },
  blockTime: { cs: `Čas bloku`, en: `Block time` },
  miners: { cs: `Mineři`, en: `Miners` },
};

/**
 * Slim live stats strip for the explorer.
 * Shows: height, hashrate, difficulty, mempool, peers, block time.
 * Auto-refreshes via shared useBlockchainStats hook (15s polling).
 */
export default function ExplorerTicker() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const { data: stats } = useBlockchainStats(15_000);

  const items = [
    {
      icon: Box,
      label: ExplorerTickerCopy.height[cs ? 'cs' : 'en'],
      value: stats ? formatNumber(stats.block_height) : "—",
      accent: "text-zion-gold",
    },
    {
      icon: Zap,
      label: ExplorerTickerCopy.hashrate[cs ? 'cs' : 'en'],
      value: stats ? formatHashrate(stats.network_hashrate || stats.pool_hashrate || 0) : "—",
      accent: "text-zion-cyan",
    },
    {
      icon: TrendingUp,
      label: ExplorerTickerCopy.difficulty[cs ? 'cs' : 'en'],
      value: stats ? formatNumber(stats.difficulty) : "—",
      accent: "text-zion-purple",
    },
    {
      icon: Hash,
      label: ExplorerTickerCopy.mempool[cs ? 'cs' : 'en'],
      value: stats ? String(stats.tx_pool_size || 0) : "—",
      accent: "text-zion-gold",
    },
    {
      icon: Globe,
      label: ExplorerTickerCopy.peers[cs ? 'cs' : 'en'],
      value: stats ? String(stats.total_connections || 0) : "—",
      accent: "text-zion-cyan",
    },
    {
      icon: Cpu,
      label: ExplorerTickerCopy.blockTime[cs ? 'cs' : 'en'],
      value: stats ? `${(stats.avg_block_time || 60).toFixed(1)}s` : "—",
      accent: "text-zion-blue",
    },
    {
      icon: Users,
      label: ExplorerTickerCopy.miners[cs ? 'cs' : 'en'],
      value: stats ? String(stats.active_miners || 0) : "—",
      accent: "text-zion-purple",
    },
  ];

  return (
    <div className="zion-panel-soft rounded-2xl px-4 py-2.5 flex items-center gap-4 overflow-x-auto">
      <LiveBadge className="flex-shrink-0" />
      <div className="h-4 w-px bg-white/10 flex-shrink-0" />
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 flex-shrink-0">
          <item.icon className={`w-3.5 h-3.5 ${item.accent}`} />
          <span className="text-xs text-gray-400">{item.label}</span>
          <span className={`text-xs font-bold tabular-nums ${item.accent}`}>{item.value}</span>
        </div>
      ))}
      {stats?.last_block?.timestamp && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <span className="text-xs text-gray-500">{formatAge(stats.last_block.timestamp, cs)}</span>
        </div>
      )}
    </div>
  );
}
