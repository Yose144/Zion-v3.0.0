"use client";

import { motion } from "framer-motion";
import { Activity, Globe, TrendingUp, Users, Zap } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { useBlockchainStats } from "@/hooks/useBlockchainStats";

interface DashboardData {
  active_miners: number;
  network_status: string;
  block_time_avg: number;
  pool_hashrate: string;
  connections: number;
  tx_pool_size: number;
  difficulty: number;
  block_height: number;
}

export default function ExplorerDashboard() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const { data: stats, loading } = useBlockchainStats(15_000);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-green-400";
      case "warning": return "text-yellow-400";
      default: return "text-red-400";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "healthy": return "bg-green-400";
      case "warning": return "bg-yellow-400";
      default: return "bg-red-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "healthy":
        return cs ? "zdravá" : "healthy";
      case "warning":
        return cs ? "varování" : "warning";
      default:
        return cs ? "offline" : "offline";
    }
  };

  if (loading && !stats) {
    return (
      <div className="zion-rainbow-card rounded-[28px] bg-black/60 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
        <div className="animate-pulse">
          <div className="h-5 bg-white/10 rounded mb-4 w-2/3" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-3">
                <div className="h-3 bg-white/10 rounded mb-2" />
                <div className="h-5 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="zion-rainbow-card rounded-[28px] border-red-500/20 bg-black/60 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <Activity className="w-5 h-5" />
          <span className="font-semibold">{cs ? "Přehled sítě" : "Network Dashboard"}</span>
        </div>
        <p className="text-gray-500 text-sm">{cs ? "Nepodařilo se připojit k daemonu. Služby se možná právě spouštějí..." : "Unable to connect to daemon. Services may be starting..."}</p>
      </div>
    );
  }

  // Derive dashboard data from shared stats
  const connections = stats.total_connections || stats.connections || 0;
  const hashrate = stats.network_hashrate || 0;
  const difficulty = stats.difficulty || 0;
  const miners = stats.active_miners || stats.total_miners || 0;
  let networkStatus = "offline";
  if (difficulty > 0 || hashrate > 0 || connections > 0) {
    networkStatus = miners > 0 ? "healthy" : (connections > 0 ? "healthy" : "warning");
  }
  const data: DashboardData = {
    active_miners: miners,
    network_status: networkStatus,
    block_time_avg: stats.avg_block_time || 60,
    pool_hashrate: stats.pool_hashrate_formatted || formatHashrate(stats.pool_hashrate || 0),
    connections,
    tx_pool_size: stats.tx_pool_size || 0,
    difficulty,
    block_height: stats.block_height || 0,
  };

  const metrics = [
    {
      label: cs ? "Síť" : "Network",
      value: getStatusLabel(data.network_status),
      color: getStatusColor(data.network_status),
      icon: Globe,
      dot: getStatusDot(data.network_status),
    },
    {
      label: cs ? "Mineři" : "Miners",
      value: data.active_miners.toString(),
      color: "text-blue-400",
      icon: Users,
    },
    {
      label: cs ? "Hash poolu" : "Pool Hash",
      value: data.pool_hashrate,
      color: "text-green-400",
      icon: TrendingUp,
    },
    {
      label: cs ? "Čas bloku" : "Block Time",
      value: `${data.block_time_avg}s`,
      color: "text-cyan-400",
      icon: Activity,
    },
    {
      label: cs ? "Mempool" : "Mempool",
      value: data.tx_pool_size.toString(),
      color: "text-orange-400",
      icon: Zap,
    },
    {
      label: cs ? "Peery" : "Peers",
      value: data.connections.toString(),
      color: "text-purple-400",
      icon: Globe,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="zion-rainbow-card rounded-[28px] bg-black/60 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
    >
      <div className="flex items-center gap-3 mb-5">
        <Activity className="h-5 w-5 text-purple-400" />
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{cs ? "Živě" : "Live"}</p>
          <h3 className="text-lg font-semibold text-white">{cs ? "Přehled sítě" : "Network Dashboard"}</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="zion-rainbow-sub p-3" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 mb-1">
              <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
              <span className="text-xs text-gray-400">{m.label}</span>
              {m.dot && (
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`h-2 w-2 rounded-full ${m.dot}`}
                />
              )}
            </div>
            <p className={`text-lg font-bold ${m.color} capitalize`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Block reward info */}
      <div className="mt-4 zion-rainbow-sub p-3" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
        <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-2">
          {cs ? "Distribuce odmeny" : "Reward Distribution"}
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { label: cs ? "Odmena" : "Reward", value: "5,400 ZION", color: "text-zion-gold" },
            { label: cs ? "Emise" : "Emission", value: cs ? "Decade Decay" : "Decade Decay", color: "text-gray-300" },
            { label: cs ? "Miner (89%)" : "Miner (89%)", value: "4,806 ZION", color: "text-emerald-400" },
            { label: cs ? "Humanitar." : "Humanitarian", value: "5% (270)", color: "text-blue-400" },
            { label: cs ? "Issobella" : "Issobella", value: "5% (270)", color: "text-purple-400" },
            { label: cs ? "Pool fee" : "Pool Fee", value: "1% (54)", color: "text-amber-400" },
          ].map((c) => (
            <div key={c.label} className="flex items-center justify-between">
              <span className="text-gray-500">{c.label}</span>
              <span className={`font-bold ${c.color}`}>{c.value}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function formatHashrate(h: number): string {
  if (h >= 1e12) return `${(h / 1e12).toFixed(1)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(1)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(1)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(1)} kH/s`;
  return `${h.toFixed(0)} H/s`;
}