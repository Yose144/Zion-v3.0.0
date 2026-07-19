"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Boxes,
  CheckCircle2,
  Clock,
  Cpu,
  Globe,
  HardDrive,
  Hash,
  Heart,
  Network,
  Pickaxe,
  Server,
  Shield,
  Signal,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL } from "@/lib/site";
import { formatHashrate, formatNumber, formatAge, formatDuration } from "@/lib/explorer/format";
import { useExplorerSSE } from "@/components/explorer/v4/hooks/useExplorerSSE";
import LiveBadge from "@/components/explorer/v4/shared/LiveBadge";

/* ── types ───────────────────────────────────────────────────── */

interface StatsData {
  block_height: number;
  top_block_hash: string;
  difficulty: number;
  cumulative_difficulty: number;
  network_hashrate: number;
  network_hashrate_formatted: string;
  target_block_time: number;
  avg_block_time: number;
  tx_count: number;
  tx_pool_size: number;
  total_transactions: number;
  total_blocks: number;
  incoming_connections: number;
  outgoing_connections: number;
  total_connections: number;
  white_peerlist_size: number;
  grey_peerlist_size: number;
  version: string;
  status: string;
  mainnet: boolean;
  testnet: boolean;
  pool_hashrate: number;
  pool_hashrate_formatted: string;
  active_miners: number;
  total_miners: number;
  pool_blocks_found: number;
  pool_uptime_s: number;
  pool_pplns_window: number;
  connected: boolean;
  last_block?: {
    height: number;
    hash: string;
    timestamp: number;
    reward: number;
    num_txes: number;
  };
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  emission_pct: string;
}

interface PeerData {
  count: number;
  connected_peers: number;
  known_peers: number;
  peer_count: number;
  chain_height: number;
  peers: Array<{
    address: string;
    host: string;
    port: number;
    height: number;
    incoming: boolean;
    connected: boolean;
    state: string;
    sub_version: string;
    last_seen: number;
    idle_seconds: number;
    failed_attempts: number;
  }>;
}

/* ── component ───────────────────────────────────────────────── */

export default function StatusPageClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  const [stats, setStats] = useState<StatsData | null>(null);
  const [peers, setPeers] = useState<PeerData | null>(null);
  const [loading, setLoading] = useState(true);

  // SSE live updates
  const sse = useExplorerSSE({ interval: 15, enabled: true });

  const fetchAll = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        apiClient<StatsData>("/blockchain/stats"),
        apiClient<PeerData>("/blockchain/peers").catch(() => null),
      ]);
      setStats(s);
      if (p) setPeers(p);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchAll, 15_000);

  // Health checks
  const healthChecks = [
    {
      label: cs ? "Node RPC" : "Node RPC",
      status: stats?.connected ? "ok" : "down",
      detail: stats?.connected ? (cs ? "Připojeno" : "Connected") : (cs ? "Odpojeno" : "Disconnected"),
    },
    {
      label: cs ? "Mainnet" : "Mainnet",
      status: stats?.mainnet ? "ok" : "warn",
      detail: stats?.mainnet ? (cs ? "Aktivní" : "Active") : (cs ? "Neaktivní" : "Inactive"),
    },
    {
      label: cs ? "Mempool" : "Mempool",
      status: (stats?.tx_pool_size ?? 0) > 0 ? "ok" : "idle",
      detail: `${stats?.tx_pool_size ?? 0} ${cs ? "TX čeká" : "TX pending"}`,
    },
    {
      label: cs ? "P2P síť" : "P2P Network",
      status: (stats?.total_connections ?? 0) > 0 ? "ok" : "warn",
      detail: `${stats?.total_connections ?? 0} ${cs ? "připojení" : "connections"}`,
    },
    {
      label: cs ? "Mining pool" : "Mining Pool",
      status: (stats?.active_miners ?? 0) > 0 ? "ok" : "idle",
      detail: `${stats?.active_miners ?? 0} ${cs ? "aktivních minerů" : "active miners"}`,
    },
    {
      label: "SSE",
      status: sse.connected ? "ok" : "connecting",
      detail: sse.connected
        ? `${sse.blockCount} ${cs ? "nových bloků" : "new blocks"}`
        : (cs ? "Připojuje…" : "Connecting…"),
    },
  ];

  const nodeInfo = [
    { label: cs ? "Verze protokolu" : "Protocol version", value: stats?.version || "v3.0.6", icon: Hash, color: "text-zion-gold" },
    { label: cs ? "Profil konsenzu" : "Consensus profile", value: "deeksha_lite_fire", icon: Shield, color: "text-emerald-400" },
    { label: cs ? "Síť" : "Network", value: stats?.mainnet ? "Mainnet" : "Testnet", icon: Network, color: "text-zion-cyan" },
    { label: cs ? "Runtime" : "Runtime", value: SITE_RUNTIME_LABEL, icon: Cpu, color: "text-zion-purple" },
    { label: cs ? "Vydání" : "Release", value: SITE_RELEASE_LABEL, icon: Boxes, color: "text-zion-gold" },
    { label: cs ? "Status" : "Status", value: stats?.status || "OK", icon: Activity, color: "text-emerald-400" },
  ];

  const networkMetrics = [
    { label: cs ? "Výška bloku" : "Block height", value: stats ? `#${stats.block_height.toLocaleString()}` : "—", icon: Boxes, color: "text-zion-gold" },
    { label: cs ? "Tip hash" : "Tip hash", value: stats?.top_block_hash ? `${stats.top_block_hash.slice(0, 12)}…` : "—", icon: Hash, color: "text-zion-cyan" },
    { label: cs ? "Hashrate" : "Hashrate", value: stats?.network_hashrate_formatted ?? "—", icon: Zap, color: "text-zion-cyan" },
    { label: cs ? "Obtížnost" : "Difficulty", value: stats ? formatNumber(stats.difficulty) : "—", icon: Activity, color: "text-emerald-400" },
    { label: cs ? "Kumulativní obtížnost" : "Cumulative difficulty", value: stats ? formatNumber(stats.cumulative_difficulty) : "—", icon: TrendingUp, color: "text-emerald-400" },
    { label: cs ? "Cílový čas bloku" : "Target block time", value: stats ? `${stats.target_block_time}s` : "—", icon: Clock, color: "text-amber-400" },
    { label: cs ? "Průměrný čas bloku" : "Avg block time", value: stats ? `${stats.avg_block_time.toFixed(1)}s` : "—", icon: Clock, color: "text-amber-400" },
    { label: cs ? "Celkem bloků" : "Total blocks", value: stats ? stats.total_blocks.toLocaleString() : "—", icon: Boxes, color: "text-zion-gold" },
    { label: cs ? "Celkem transakcí" : "Total transactions", value: stats ? stats.total_transactions.toLocaleString() : "—", icon: Activity, color: "text-zion-cyan" },
    { label: cs ? "Mempool TX" : "Mempool TX", value: stats ? String(stats.tx_pool_size) : "—", icon: Signal, color: "text-rose-400" },
  ];

  const peerMetrics = [
    { label: cs ? "Příchozí" : "Incoming", value: stats ? String(stats.incoming_connections) : "—", icon: ArrowDown, color: "text-emerald-400" },
    { label: cs ? "Odchozí" : "Outgoing", value: stats ? String(stats.outgoing_connections) : "—", icon: ArrowUp, color: "text-zion-cyan" },
    { label: cs ? "Celkem" : "Total", value: stats ? String(stats.total_connections) : "—", icon: Network, color: "text-zion-gold" },
    { label: cs ? "White peerlist" : "White peerlist", value: stats ? String(stats.white_peerlist_size) : "—", icon: Globe, color: "text-zion-purple" },
    { label: cs ? "Grey peerlist" : "Grey peerlist", value: stats ? String(stats.grey_peerlist_size) : "—", icon: Globe, color: "text-gray-400" },
  ];

  const poolMetrics = [
    { label: cs ? "Pool hashrate" : "Pool hashrate", value: stats?.pool_hashrate_formatted ?? "—", icon: Zap, color: "text-zion-cyan" },
    { label: cs ? "Aktivní mineři" : "Active miners", value: stats ? String(stats.active_miners) : "—", icon: Pickaxe, color: "text-amber-400" },
    { label: cs ? "Nalezené bloky" : "Blocks found", value: stats ? String(stats.pool_blocks_found) : "—", icon: Boxes, color: "text-zion-gold" },
    { label: cs ? "Pool uptime" : "Pool uptime", value: stats?.pool_uptime_s ? formatDuration(stats.pool_uptime_s) : "—", icon: Clock, color: "text-emerald-400" },
    { label: cs ? "PPLNS window" : "PPLNS window", value: stats ? String(stats.pool_pplns_window) : "—", icon: HardDrive, color: "text-zion-purple" },
  ];

  /* ── render ──────────────────────────────────────────────── */

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* ── Background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-emerald-500/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-emerald-500/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-10 pt-6 pb-8">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
          style={{ "--rc": "74, 222, 128" } as React.CSSProperties}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-300 uppercase">
                <Server className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {cs ? "Status uzlu" : "Node Status"}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {cs ? "Živý stav" : "Live Health"}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? "Status sítě" : "Network Status"}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? "Kompletní přehled zdraví ZION node, P2P sítě, mining poolu a služeb. Real-time SSE aktualizace."
                  : "Complete overview of ZION node health, P2P network, mining pool, and services. Real-time SSE updates."}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="zion-badge zion-badge-green">
                  <Activity className="h-3 w-3" /> {cs ? "Auto-refresh 15s" : "Auto-Refresh 15s"}
                </span>
                {sse.connected ? (
                  <span className="zion-badge zion-badge-green">
                    <Zap className="h-3 w-3" /> SSE {cs ? "připojeno" : "connected"}
                  </span>
                ) : (
                  <span className="zion-badge text-amber-400 border-amber-500/40 bg-amber-500/10">
                    SSE {cs ? "připojuje…" : "connecting…"}
                  </span>
                )}
                <LiveBadge label={cs ? "ŽIVĚ" : "LIVE"} />
              </div>
            </div>

            {/* SSE live height card */}
            {sse.stats && (
              <div className="zion-rainbow-sub p-6 rounded-2xl" style={{ "--rc": "74, 222, 128" } as React.CSSProperties}>
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
                  {cs ? "Aktuální výška (SSE)" : "Current height (SSE)"}
                </div>
                <div className="text-4xl font-bold text-emerald-400 tabular-nums">
                  #{sse.stats.height.toLocaleString()}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div>
                    <span className="text-gray-500">{cs ? "Mempool" : "Mempool"}</span>
                    <div className="text-amber-400 font-bold">{sse.stats.mempool_size} TX</div>
                  </div>
                  <div>
                    <span className="text-gray-500">{cs ? "Protokol" : "Protocol"}</span>
                    <div className="text-zion-cyan font-bold">{sse.stats.protocol_version}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        {/* ═══════ HEALTH CHECKS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
              {cs ? "Zdraví" : "Health"}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Heart className="h-7 w-7 text-emerald-400" />
              {cs ? "Kontroly zdraví" : "Health Checks"}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {healthChecks.map((check, i) => {
              const statusConfig = {
                ok: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle2 },
                warn: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Clock },
                down: { color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", icon: Shield },
                idle: { color: "text-gray-400", bg: "bg-white/5", border: "border-white/10", icon: Clock },
                connecting: { color: "text-zion-cyan", bg: "bg-zion-cyan/10", border: "border-zion-cyan/20", icon: Signal },
              };
              const cfg = statusConfig[check.status as keyof typeof statusConfig] || statusConfig.idle;
              return (
                <motion.div
                  key={check.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.02 }}
                  className={`zion-rainbow-sub p-4 rounded-2xl border ${cfg.bg} ${cfg.border}`}
                  style={{ "--rc": "74, 222, 128" } as React.CSSProperties}
                >
                  <cfg.icon className={`w-5 h-5 ${cfg.color} mb-2`} />
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                    {check.label}
                  </div>
                  <div className={`text-sm font-bold ${cfg.color}`}>{check.detail}</div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═══════ NODE INFO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
              {cs ? "Uzel" : "Node"}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Server className="h-7 w-7 text-zion-gold" />
              {cs ? "Informace o uzlu" : "Node Information"}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {nodeInfo.map((info, i) => (
              <motion.div
                key={info.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.02 }}
                className="zion-rainbow-sub p-4 rounded-2xl"
                style={{ "--rc": "251, 191, 36" } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {info.label}
                  </span>
                  <info.icon className={`w-4 h-4 ${info.color}`} />
                </div>
                <div className={`text-sm font-bold ${info.color} truncate`}>
                  {info.value}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ NETWORK METRICS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
              {cs ? "Metriky" : "Metrics"}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-cyan" />
              {cs ? "Síťové metriky" : "Network Metrics"}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {networkMetrics.map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 + i * 0.02 }}
                className="zion-rainbow-sub p-4 rounded-2xl"
                style={{ "--rc": "6, 182, 212" } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {metric.label}
                  </span>
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                </div>
                <div className={`text-base font-bold ${metric.color} tabular-nums truncate`}>
                  {metric.value}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ PEERS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
              {cs ? "P2P" : "P2P"}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe className="h-7 w-7 text-zion-purple" />
              {cs ? "Síťoví peeri" : "Network Peers"}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {peerMetrics.map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.02 }}
                className="zion-rainbow-sub p-4 rounded-2xl"
                style={{ "--rc": "168, 85, 247" } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {metric.label}
                  </span>
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                </div>
                <div className={`text-lg font-bold ${metric.color} tabular-nums`}>
                  {metric.value}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Peer table */}
          {peers?.peers && peers.peers.length > 0 && (
            <div className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-hidden" style={{ "--rc": "168, 85, 247" } as React.CSSProperties}>
              <div className="grid grid-cols-[1fr_80px_80px_100px_100px_80px] gap-3 px-5 py-3 border-b border-white/6">
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{cs ? "Adresa" : "Address"}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{cs ? "Směr" : "Direction"}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{cs ? "Výška" : "Height"}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{cs ? "Verze" : "Version"}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{cs ? "Stav" : "State"}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{cs ? "Idle" : "Idle"}</span>
              </div>
              {peers.peers.slice(0, 10).map((peer, i) => (
                <div
                  key={`${peer.address}-${i}`}
                  className="grid grid-cols-[1fr_80px_80px_100px_100px_80px] gap-3 px-5 py-3 border-b border-white/3 hover:bg-white/2 transition-colors"
                >
                  <span className="text-[13px] font-mono text-cyan-300 truncate">
                    {peer.address || peer.host}
                  </span>
                  <span className={`text-[12px] ${peer.incoming ? "text-emerald-400" : "text-zion-cyan"}`}>
                    {peer.incoming ? (cs ? "příchozí" : "incoming") : (cs ? "odchozí" : "outgoing")}
                  </span>
                  <span className="text-[12px] text-zion-gold tabular-nums">
                    {peer.height > 0 ? `#${peer.height.toLocaleString()}` : "—"}
                  </span>
                  <span className="text-[12px] text-white/50 font-mono truncate">
                    {peer.sub_version || "—"}
                  </span>
                  <span className="text-[12px] text-emerald-400">
                    {peer.state || "connected"}
                  </span>
                  <span className="text-[12px] text-white/40 tabular-nums text-right">
                    {peer.idle_seconds ? `${peer.idle_seconds}s` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ═══════ POOL ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
              {cs ? "Pool" : "Pool"}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Pickaxe className="h-7 w-7 text-amber-400" />
              {cs ? "Mining pool" : "Mining Pool"}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {poolMetrics.map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 + i * 0.02 }}
                className="zion-rainbow-sub p-4 rounded-2xl"
                style={{ "--rc": "251, 191, 36" } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {metric.label}
                  </span>
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                </div>
                <div className={`text-base font-bold ${metric.color} tabular-nums`}>
                  {metric.value}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ LAST BLOCK ═══════ */}
        {stats?.last_block && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
                {cs ? "Poslední blok" : "Last Block"}
              </p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Boxes className="h-7 w-7 text-zion-gold" />
                {cs ? "Nejnovější blok" : "Latest Block"}
              </h2>
            </div>
            <div className="zion-rainbow-card rounded-2xl bg-black/60 p-6" style={{ "--rc": "251, 191, 36" } as React.CSSProperties}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{cs ? "Výška" : "Height"}</div>
                  <Link href={`/explorer/block?height=${stats.last_block.height}`} className="text-xl font-bold text-zion-gold hover:text-amber-300 tabular-nums">
                    #{stats.last_block.height.toLocaleString()}
                  </Link>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{cs ? "Odměna" : "Reward"}</div>
                  <div className="text-xl font-bold text-emerald-400 tabular-nums">
                    {stats.last_block.reward.toFixed(2)} ₿Z
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{cs ? "Transakce" : "Transactions"}</div>
                  <div className="text-xl font-bold text-zion-cyan tabular-nums">
                    {stats.last_block.num_txes}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{cs ? "Stáří" : "Age"}</div>
                  <div className="text-xl font-bold text-amber-400">
                    {formatAge(stats.last_block.timestamp, cs)}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{cs ? "Hash" : "Hash"}</div>
                <Link href={`/explorer/block?hash=${stats.last_block.hash}`} className="text-sm font-mono text-zion-cyan hover:text-zion-gold transition-colors break-all">
                  {stats.last_block.hash}
                </Link>
              </div>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
