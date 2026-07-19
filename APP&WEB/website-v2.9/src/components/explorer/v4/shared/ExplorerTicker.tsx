"use client";

import { motion } from "framer-motion";
import { Box, Cpu, Globe, Hash, TrendingUp, Users, Zap } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { useBlockchainStats } from "@/hooks/useBlockchainStats";
import { formatHashrate, formatNumber, formatAge } from "@/lib/explorer/format";
import LiveBadge from "./LiveBadge";

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
      label: cs ? "Výška" : "Height",
      value: stats ? formatNumber(stats.block_height) : "—",
      accent: "text-zion-gold",
    },
    {
      icon: Zap,
      label: cs ? "Hashrate" : "Hashrate",
      value: stats ? formatHashrate(stats.network_hashrate || stats.pool_hashrate || 0) : "—",
      accent: "text-zion-cyan",
    },
    {
      icon: TrendingUp,
      label: cs ? "Obtížnost" : "Difficulty",
      value: stats ? formatNumber(stats.difficulty) : "—",
      accent: "text-zion-purple",
    },
    {
      icon: Hash,
      label: cs ? "Mempool" : "Mempool",
      value: stats ? String(stats.tx_pool_size || 0) : "—",
      accent: "text-amber-400",
    },
    {
      icon: Globe,
      label: cs ? "Peeri" : "Peers",
      value: stats ? String(stats.total_connections || 0) : "—",
      accent: "text-green-400",
    },
    {
      icon: Cpu,
      label: cs ? "Čas bloku" : "Block time",
      value: stats ? `${(stats.avg_block_time || 60).toFixed(1)}s` : "—",
      accent: "text-zion-blue",
    },
    {
      icon: Users,
      label: cs ? "Mineři" : "Miners",
      value: stats ? String(stats.active_miners || 0) : "—",
      accent: "text-rose-400",
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
