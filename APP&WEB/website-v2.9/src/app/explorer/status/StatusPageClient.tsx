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

const ExplorerStatusStatusPageClientCopy = {
  nodeRpc: { cs: `Node RPC`, en: `Node RPC` },
  connected: { cs: `Připojeno`, en: `Connected` },
  disconnected: { cs: `Odpojeno`, en: `Disconnected` },
  mainnet: { cs: `Mainnet`, en: `Mainnet` },
  active: { cs: `Aktivní`, en: `Active` },
  inactive: { cs: `Neaktivní`, en: `Inactive` },
  mempool: { cs: `Mempool`, en: `Mempool` },
  txPending: { cs: `TX čeká`, en: `TX pending` },
  p2pNetwork: { cs: `P2P síť`, en: `P2P Network` },
  connections: { cs: `připojení`, en: `connections` },
  miningPool: { cs: `Mining pool`, en: `Mining Pool` },
  activeMiners: { cs: `aktivních minerů`, en: `active miners` },
  newBlocks: { cs: `nových bloků`, en: `new blocks` },
  connecting: { cs: `Připojuje…`, en: `Connecting…` },
  protocolVersion: { cs: `Verze protokolu`, en: `Protocol version` },
  consensusProfile: { cs: `Profil konsenzu`, en: `Consensus profile` },
  network: { cs: `Síť`, en: `Network` },
  runtime: { cs: `Runtime`, en: `Runtime` },
  release: { cs: `Vydání`, en: `Release` },
  status: { cs: `Status`, en: `Status` },
  blockHeight: { cs: `Výška bloku`, en: `Block height` },
  tipHash: { cs: `Tip hash`, en: `Tip hash` },
  hashrate: { cs: `Hashrate`, en: `Hashrate` },
  difficulty: { cs: `Obtížnost`, en: `Difficulty` },
  cumulativeDifficulty: { cs: `Kumulativní obtížnost`, en: `Cumulative difficulty` },
  targetBlockTime: { cs: `Cílový čas bloku`, en: `Target block time` },
  avgBlockTime: { cs: `Průměrný čas bloku`, en: `Avg block time` },
  totalBlocks: { cs: `Celkem bloků`, en: `Total blocks` },
  totalTransactions: { cs: `Celkem transakcí`, en: `Total transactions` },
  mempoolTx: { cs: `Mempool TX`, en: `Mempool TX` },
  incoming: { cs: `Příchozí`, en: `Incoming` },
  outgoing: { cs: `Odchozí`, en: `Outgoing` },
  total: { cs: `Celkem`, en: `Total` },
  whitePeerlist: { cs: `White peerlist`, en: `White peerlist` },
  greyPeerlist: { cs: `Grey peerlist`, en: `Grey peerlist` },
  poolHashrate: { cs: `Pool hashrate`, en: `Pool hashrate` },
  activeMiners_2: { cs: `Aktivní mineři`, en: `Active miners` },
  blocksFound: { cs: `Nalezené bloky`, en: `Blocks found` },
  poolUptime: { cs: `Pool uptime`, en: `Pool uptime` },
  pplnsWindow: { cs: `PPLNS window`, en: `PPLNS window` },
  nodeStatus: { cs: `Status uzlu`, en: `Node Status` },
  liveHealth: { cs: `Živý stav`, en: `Live Health` },
  networkStatus: { cs: `Status sítě`, en: `Network Status` },
  completeOverviewOfZionNodeHeal: { cs: `Kompletní přehled zdraví ZION node, P2P sítě, mining poolu a služeb. Real-time SSE aktualizace.`, en: `Complete overview of ZION node health, P2P network, mining pool, and services. Real-time SSE updates.` },
  autoRefresh15s: { cs: `Auto-refresh 15s`, en: `Auto-Refresh 15s` },
  connected_2: { cs: `připojeno`, en: `connected` },
  connecting_2: { cs: `připojuje…`, en: `connecting…` },
  live: { cs: `ŽIVĚ`, en: `LIVE` },
  currentHeightSse: { cs: `Aktuální výška (SSE)`, en: `Current height (SSE)` },
  protocol: { cs: `Protokol`, en: `Protocol` },
  health: { cs: `Zdraví`, en: `Health` },
  healthChecks: { cs: `Kontroly zdraví`, en: `Health Checks` },
  node: { cs: `Uzel`, en: `Node` },
  nodeInformation: { cs: `Informace o uzlu`, en: `Node Information` },
  metrics: { cs: `Metriky`, en: `Metrics` },
  networkMetrics: { cs: `Síťové metriky`, en: `Network Metrics` },
  p2p: { cs: `P2P`, en: `P2P` },
  networkPeers: { cs: `Síťoví peeri`, en: `Network Peers` },
  address: { cs: `Adresa`, en: `Address` },
  direction: { cs: `Směr`, en: `Direction` },
  height: { cs: `Výška`, en: `Height` },
  version: { cs: `Verze`, en: `Version` },
  state: { cs: `Stav`, en: `State` },
  idle: { cs: `Idle`, en: `Idle` },
  incoming_2: { cs: `příchozí`, en: `incoming` },
  outgoing_2: { cs: `odchozí`, en: `outgoing` },
  pool: { cs: `Pool`, en: `Pool` },
  lastBlock: { cs: `Poslední blok`, en: `Last Block` },
  latestBlock: { cs: `Nejnovější blok`, en: `Latest Block` },
  reward: { cs: `Odměna`, en: `Reward` },
  transactions: { cs: `Transakce`, en: `Transactions` },
  age: { cs: `Stáří`, en: `Age` },
  hash: { cs: `Hash`, en: `Hash` },
};

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
      label: ExplorerStatusStatusPageClientCopy.nodeRpc[cs ? 'cs' : 'en'],
      status: stats?.connected ? "ok" : "down",
      detail: stats?.connected ? (ExplorerStatusStatusPageClientCopy.connected[cs ? 'cs' : 'en']) : (ExplorerStatusStatusPageClientCopy.disconnected[cs ? 'cs' : 'en']),
    },
    {
      label: ExplorerStatusStatusPageClientCopy.mainnet[cs ? 'cs' : 'en'],
      status: stats?.mainnet ? "ok" : "warn",
      detail: stats?.mainnet ? (ExplorerStatusStatusPageClientCopy.active[cs ? 'cs' : 'en']) : (ExplorerStatusStatusPageClientCopy.inactive[cs ? 'cs' : 'en']),
    },
    {
      label: ExplorerStatusStatusPageClientCopy.mempool[cs ? 'cs' : 'en'],
      status: (stats?.tx_pool_size ?? 0) > 0 ? "ok" : "idle",
      detail: `${stats?.tx_pool_size ?? 0} ${ExplorerStatusStatusPageClientCopy.txPending[cs ? 'cs' : 'en']}`,
    },
    {
      label: ExplorerStatusStatusPageClientCopy.p2pNetwork[cs ? 'cs' : 'en'],
      status: (stats?.total_connections ?? 0) > 0 ? "ok" : "warn",
      detail: `${stats?.total_connections ?? 0} ${ExplorerStatusStatusPageClientCopy.connections[cs ? 'cs' : 'en']}`,
    },
    {
      label: ExplorerStatusStatusPageClientCopy.miningPool[cs ? 'cs' : 'en'],
      status: (stats?.active_miners ?? 0) > 0 ? "ok" : "idle",
      detail: `${stats?.active_miners ?? 0} ${ExplorerStatusStatusPageClientCopy.activeMiners[cs ? 'cs' : 'en']}`,
    },
    {
      label: "SSE",
      status: sse.connected ? "ok" : "connecting",
      detail: sse.connected
        ? `${sse.blockCount} ${ExplorerStatusStatusPageClientCopy.newBlocks[cs ? 'cs' : 'en']}`
        : (ExplorerStatusStatusPageClientCopy.connecting[cs ? 'cs' : 'en']),
    },
  ];

  const nodeInfo = [
    { label: ExplorerStatusStatusPageClientCopy.protocolVersion[cs ? 'cs' : 'en'], value: stats?.version || "v3.2.0", icon: Hash, color: "text-zion-gold" },
    { label: ExplorerStatusStatusPageClientCopy.consensusProfile[cs ? 'cs' : 'en'], value: "deeksha_lite_fire", icon: Shield, color: "text-emerald-400" },
    { label: ExplorerStatusStatusPageClientCopy.network[cs ? 'cs' : 'en'], value: stats?.mainnet ? "Mainnet" : "Testnet", icon: Network, color: "text-zion-cyan" },
    { label: ExplorerStatusStatusPageClientCopy.runtime[cs ? 'cs' : 'en'], value: SITE_RUNTIME_LABEL, icon: Cpu, color: "text-zion-purple" },
    { label: ExplorerStatusStatusPageClientCopy.release[cs ? 'cs' : 'en'], value: SITE_RELEASE_LABEL, icon: Boxes, color: "text-zion-gold" },
    { label: ExplorerStatusStatusPageClientCopy.status[cs ? 'cs' : 'en'], value: stats?.status || "OK", icon: Activity, color: "text-emerald-400" },
  ];

  const networkMetrics = [
    { label: ExplorerStatusStatusPageClientCopy.blockHeight[cs ? 'cs' : 'en'], value: stats ? `#${stats.block_height.toLocaleString()}` : "—", icon: Boxes, color: "text-zion-gold" },
    { label: ExplorerStatusStatusPageClientCopy.tipHash[cs ? 'cs' : 'en'], value: stats?.top_block_hash ? `${stats.top_block_hash.slice(0, 12)}…` : "—", icon: Hash, color: "text-zion-cyan" },
    { label: ExplorerStatusStatusPageClientCopy.hashrate[cs ? 'cs' : 'en'], value: stats?.network_hashrate_formatted ?? "—", icon: Zap, color: "text-zion-cyan" },
    { label: ExplorerStatusStatusPageClientCopy.difficulty[cs ? 'cs' : 'en'], value: stats ? formatNumber(stats.difficulty) : "—", icon: Activity, color: "text-emerald-400" },
    { label: ExplorerStatusStatusPageClientCopy.cumulativeDifficulty[cs ? 'cs' : 'en'], value: stats ? formatNumber(stats.cumulative_difficulty) : "—", icon: TrendingUp, color: "text-emerald-400" },
    { label: ExplorerStatusStatusPageClientCopy.targetBlockTime[cs ? 'cs' : 'en'], value: stats ? `${stats.target_block_time}s` : "—", icon: Clock, color: "text-amber-400" },
    { label: ExplorerStatusStatusPageClientCopy.avgBlockTime[cs ? 'cs' : 'en'], value: stats ? `${stats.avg_block_time.toFixed(1)}s` : "—", icon: Clock, color: "text-amber-400" },
    { label: ExplorerStatusStatusPageClientCopy.totalBlocks[cs ? 'cs' : 'en'], value: stats ? stats.total_blocks.toLocaleString() : "—", icon: Boxes, color: "text-zion-gold" },
    { label: ExplorerStatusStatusPageClientCopy.totalTransactions[cs ? 'cs' : 'en'], value: stats ? stats.total_transactions.toLocaleString() : "—", icon: Activity, color: "text-zion-cyan" },
    { label: ExplorerStatusStatusPageClientCopy.mempoolTx[cs ? 'cs' : 'en'], value: stats ? String(stats.tx_pool_size) : "—", icon: Signal, color: "text-rose-400" },
  ];

  const peerMetrics = [
    { label: ExplorerStatusStatusPageClientCopy.incoming[cs ? 'cs' : 'en'], value: stats ? String(stats.incoming_connections) : "—", icon: ArrowDown, color: "text-emerald-400" },
    { label: ExplorerStatusStatusPageClientCopy.outgoing[cs ? 'cs' : 'en'], value: stats ? String(stats.outgoing_connections) : "—", icon: ArrowUp, color: "text-zion-cyan" },
    { label: ExplorerStatusStatusPageClientCopy.total[cs ? 'cs' : 'en'], value: stats ? String(stats.total_connections) : "—", icon: Network, color: "text-zion-gold" },
    { label: ExplorerStatusStatusPageClientCopy.whitePeerlist[cs ? 'cs' : 'en'], value: stats ? String(stats.white_peerlist_size) : "—", icon: Globe, color: "text-zion-purple" },
    { label: ExplorerStatusStatusPageClientCopy.greyPeerlist[cs ? 'cs' : 'en'], value: stats ? String(stats.grey_peerlist_size) : "—", icon: Globe, color: "text-gray-400" },
  ];

  const poolMetrics = [
    { label: ExplorerStatusStatusPageClientCopy.poolHashrate[cs ? 'cs' : 'en'], value: stats?.pool_hashrate_formatted ?? "—", icon: Zap, color: "text-zion-cyan" },
    { label: ExplorerStatusStatusPageClientCopy.activeMiners_2[cs ? 'cs' : 'en'], value: stats ? String(stats.active_miners) : "—", icon: Pickaxe, color: "text-amber-400" },
    { label: ExplorerStatusStatusPageClientCopy.blocksFound[cs ? 'cs' : 'en'], value: stats ? String(stats.pool_blocks_found) : "—", icon: Boxes, color: "text-zion-gold" },
    { label: ExplorerStatusStatusPageClientCopy.poolUptime[cs ? 'cs' : 'en'], value: stats?.pool_uptime_s ? formatDuration(stats.pool_uptime_s) : "—", icon: Clock, color: "text-emerald-400" },
    { label: ExplorerStatusStatusPageClientCopy.pplnsWindow[cs ? 'cs' : 'en'], value: stats ? String(stats.pool_pplns_window) : "—", icon: HardDrive, color: "text-zion-purple" },
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
                {SITE_RELEASE_LABEL} · {ExplorerStatusStatusPageClientCopy.nodeStatus[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {ExplorerStatusStatusPageClientCopy.liveHealth[cs ? 'cs' : 'en']}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {ExplorerStatusStatusPageClientCopy.networkStatus[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {ExplorerStatusStatusPageClientCopy.completeOverviewOfZionNodeHeal[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="zion-badge zion-badge-green">
                  <Activity className="h-3 w-3" /> {ExplorerStatusStatusPageClientCopy.autoRefresh15s[cs ? 'cs' : 'en']}
                </span>
                {sse.connected ? (
                  <span className="zion-badge zion-badge-green">
                    <Zap className="h-3 w-3" /> SSE {ExplorerStatusStatusPageClientCopy.connected_2[cs ? 'cs' : 'en']}
                  </span>
                ) : (
                  <span className="zion-badge text-amber-400 border-amber-500/40 bg-amber-500/10">
                    SSE {ExplorerStatusStatusPageClientCopy.connecting_2[cs ? 'cs' : 'en']}
                  </span>
                )}
                <LiveBadge label={ExplorerStatusStatusPageClientCopy.live[cs ? 'cs' : 'en']} />
              </div>
            </div>

            {/* SSE live height card */}
            {sse.stats && (
              <div className="zion-rainbow-sub p-6 rounded-2xl" style={{ "--rc": "74, 222, 128" } as React.CSSProperties}>
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
                  {ExplorerStatusStatusPageClientCopy.currentHeightSse[cs ? 'cs' : 'en']}
                </div>
                <div className="text-4xl font-bold text-emerald-400 tabular-nums">
                  #{sse.stats.height.toLocaleString()}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div>
                    <span className="text-gray-500">{ExplorerStatusStatusPageClientCopy.mempool[cs ? 'cs' : 'en']}</span>
                    <div className="text-amber-400 font-bold">{sse.stats.mempool_size} TX</div>
                  </div>
                  <div>
                    <span className="text-gray-500">{ExplorerStatusStatusPageClientCopy.protocol[cs ? 'cs' : 'en']}</span>
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
              {ExplorerStatusStatusPageClientCopy.health[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Heart className="h-7 w-7 text-emerald-400" />
              {ExplorerStatusStatusPageClientCopy.healthChecks[cs ? 'cs' : 'en']}
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
              {ExplorerStatusStatusPageClientCopy.node[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Server className="h-7 w-7 text-zion-gold" />
              {ExplorerStatusStatusPageClientCopy.nodeInformation[cs ? 'cs' : 'en']}
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
              {ExplorerStatusStatusPageClientCopy.metrics[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-cyan" />
              {ExplorerStatusStatusPageClientCopy.networkMetrics[cs ? 'cs' : 'en']}
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
                style={{ "--rc": "7, 137, 48" } as React.CSSProperties}
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
              {ExplorerStatusStatusPageClientCopy.p2p[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe className="h-7 w-7 text-zion-purple" />
              {ExplorerStatusStatusPageClientCopy.networkPeers[cs ? 'cs' : 'en']}
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
            <div className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-x-auto overflow-y-hidden" style={{ "--rc": "168, 85, 247" } as React.CSSProperties}>
              <div className="grid grid-cols-[1fr_80px_80px_100px_100px_80px] min-w-[460px] gap-3 px-5 py-3 border-b border-white/6">
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerStatusStatusPageClientCopy.address[cs ? 'cs' : 'en']}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerStatusStatusPageClientCopy.direction[cs ? 'cs' : 'en']}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerStatusStatusPageClientCopy.height[cs ? 'cs' : 'en']}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerStatusStatusPageClientCopy.version[cs ? 'cs' : 'en']}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerStatusStatusPageClientCopy.state[cs ? 'cs' : 'en']}</span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{ExplorerStatusStatusPageClientCopy.idle[cs ? 'cs' : 'en']}</span>
              </div>
              {peers.peers.slice(0, 10).map((peer, i) => (
                <div
                  key={`${peer.address}-${i}`}
                  className="grid grid-cols-[1fr_80px_80px_100px_100px_80px] min-w-[460px] gap-3 px-5 py-3 border-b border-white/3 hover:bg-white/2 transition-colors"
                >
                  <span className="text-[13px] font-mono text-cyan-300 truncate">
                    {peer.address || peer.host}
                  </span>
                  <span className={`text-[12px] ${peer.incoming ? "text-emerald-400" : "text-zion-cyan"}`}>
                    {peer.incoming ? (ExplorerStatusStatusPageClientCopy.incoming_2[cs ? 'cs' : 'en']) : (ExplorerStatusStatusPageClientCopy.outgoing_2[cs ? 'cs' : 'en'])}
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
              {ExplorerStatusStatusPageClientCopy.pool[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Pickaxe className="h-7 w-7 text-amber-400" />
              {ExplorerStatusStatusPageClientCopy.miningPool[cs ? 'cs' : 'en']}
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
                {ExplorerStatusStatusPageClientCopy.lastBlock[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Boxes className="h-7 w-7 text-zion-gold" />
                {ExplorerStatusStatusPageClientCopy.latestBlock[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="zion-rainbow-card rounded-2xl bg-black/60 p-6" style={{ "--rc": "251, 191, 36" } as React.CSSProperties}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{ExplorerStatusStatusPageClientCopy.height[cs ? 'cs' : 'en']}</div>
                  <Link href={`/explorer/block?height=${stats.last_block.height}`} className="text-xl font-bold text-zion-gold hover:text-amber-300 tabular-nums">
                    #{stats.last_block.height.toLocaleString()}
                  </Link>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{ExplorerStatusStatusPageClientCopy.reward[cs ? 'cs' : 'en']}</div>
                  <div className="text-xl font-bold text-emerald-400 tabular-nums">
                    {stats.last_block.reward.toFixed(2)} ₿Z
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{ExplorerStatusStatusPageClientCopy.transactions[cs ? 'cs' : 'en']}</div>
                  <div className="text-xl font-bold text-zion-cyan tabular-nums">
                    {stats.last_block.num_txes}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{ExplorerStatusStatusPageClientCopy.age[cs ? 'cs' : 'en']}</div>
                  <div className="text-xl font-bold text-amber-400">
                    {formatAge(stats.last_block.timestamp, cs)}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{ExplorerStatusStatusPageClientCopy.hash[cs ? 'cs' : 'en']}</div>
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
