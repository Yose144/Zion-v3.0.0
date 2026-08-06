"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Globe,
  Lock,
  Shield,
  ShieldCheck,
  TrendingUp,
  Unlock,
  Zap,
  Search,
  Loader2,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";
import { SITE_RELEASE_LABEL } from "@/lib/site";
import {
  BRIDGE_CONTRACTS,
  type BridgeStatus,
} from "@/lib/bridge-api";

const ExplorerBridgeBridgeTrackerClientCopy = {
  finalized: { cs: `Finalizováno`, en: `Finalized` },
  bridge: { cs: `Most`, en: `Bridge` },
  liveTracking: { cs: `Live sledování`, en: `Live Tracking` },
  bridgeTracker: { cs: `Bridge Tracker`, en: `Bridge Tracker` },
  realTimeL1BaseBridgeStatusTrac: { cs: `Real-time stav L1↔Base bridge. Sledujte lock, mint, burn a unlock transakce. Relay metriky z Prometheus.`, en: `Real-time L1↔Base bridge status. Track lock, mint, burn and unlock transactions. Relay metrics from Prometheus.` },
  online: { cs: `Online`, en: `Online` },
  offline: { cs: `Offline`, en: `Offline` },
  uptime: { cs: `Uptime`, en: `Uptime` },
  efficiency: { cs: `Efektivita`, en: `Efficiency` },
  height: { cs: `výška`, en: `height` },
  block: { cs: `blok`, en: `block` },
  metrics: { cs: `Metriky`, en: `Metrics` },
  bridgeMetrics: { cs: `Bridge metriky`, en: `Bridge Metrics` },
  locksDetected: { cs: `Lock detekovány`, en: `Locks Detected` },
  locksFinalized: { cs: `Lock finalizovány`, en: `Locks Finalized` },
  mintsSubmitted: { cs: `Mint odeslány`, en: `Mints Submitted` },
  mintsConfirmed: { cs: `Mint potvrzeny`, en: `Mints Confirmed` },
  burnsDetected: { cs: `Burn detekovány`, en: `Burns Detected` },
  unlocksSubmitted: { cs: `Unlock odeslány`, en: `Unlocks Submitted` },
  unlocksConfirmed: { cs: `Unlock potvrzeny`, en: `Unlocks Confirmed` },
  errors: { cs: `Chyby`, en: `Errors` },
  pipelines: { cs: `Pipeliny`, en: `Pipelines` },
  bridgeFlow: { cs: `Bridge flow`, en: `Bridge Flow` },
  lockMint: { cs: `Lock / Mint`, en: `Lock / Mint` },
  l1Lock: { cs: `L1 Lock`, en: `L1 Lock` },
  userLocksZionOnL1: { cs: `Uživatel zamkne ZION na L1`, en: `User locks ZION on L1` },
  relay: { cs: `Relay`, en: `Relay` },
  k60BlockFinalityValidatorThresh: { cs: `60-bloková finalita, validátor threshold`, en: `60-block finality, validator threshold` },
  evmMint: { cs: `EVM Mint`, en: `EVM Mint` },
  mintWzionErc20OnBase: { cs: `Mint wZION ERC-20 na Base`, en: `Mint wZION ERC-20 on Base` },
  time: { cs: `Doba`, en: `Time` },
  l1Blocks: { cs: `L1 bloků`, en: `L1 blocks` },
  hr: { cs: `hod`, en: `hr` },
  burnUnlock: { cs: `Burn / Unlock`, en: `Burn / Unlock` },
  evmBurn: { cs: `EVM Burn`, en: `EVM Burn` },
  userBurnsWzionOnBase: { cs: `Uživatel spálí wZION na Base`, en: `User burns wZION on Base` },
  k64BlockEvmFinalityL1UnlockTx: { cs: `64-bloková EVM finalita, L1 unlock TX`, en: `64-block EVM finality, L1 unlock TX` },
  l1Unlock: { cs: `L1 Unlock`, en: `L1 Unlock` },
  zionUnlockedOnL1Address: { cs: `ZION odemčeny na L1 adrese`, en: `ZION unlocked on L1 address` },
  evmBlocks: { cs: `EVM bloků`, en: `EVM blocks` },
  min: { cs: `min`, en: `min` },
  liveTransactions: { cs: `Live transakce`, en: `Live Transactions` },
  bridgeLockTransactions: { cs: `Bridge Lock transakce`, en: `Bridge Lock Transactions` },
  recentL1LockTransactionsWithFi: { cs: `Nedávné L1 lock transakce s finality progressem. Data z L1 RPC getBridgeLocks.`, en: `Recent L1 lock transactions with finality progress. Data from L1 RPC getBridgeLocks.` },
  all: { cs: `Vše`, en: `All` },
  pending: { cs: `Čekající`, en: `Pending` },
  finalized_2: { cs: `Finalizované`, en: `Finalized` },
  updatesEvery15s: { cs: `Aktualizace každých 15s`, en: `Updates every 15s` },
  loadingTransactions: { cs: `Načítání transakcí...`, en: `Loading transactions...` },
  l1RpcMayBeOfflineTryAgainLater: { cs: `L1 RPC může být offline. Zkuste to později.`, en: `L1 RPC may be offline. Try again later.` },
  noBridgeTransactionsFound: { cs: `Žádné bridge transakce nenalezeny.`, en: `No bridge transactions found.` },
  lockTransactionsWillAppearHere: { cs: `Lock transakce se objeví zde, když někdo pošle ZION na bridge adresu s BRIDGE memo.`, en: `Lock transactions will appear here when someone sends ZION to the bridge address with a BRIDGE memo.` },
  txHash: { cs: `TX Hash`, en: `TX Hash` },
  block_2: { cs: `Blok`, en: `Block` },
  sender: { cs: `Odesílatel`, en: `Sender` },
  chain: { cs: `Řetězec`, en: `Chain` },
  amount: { cs: `Částka`, en: `Amount` },
  finality: { cs: `Finalita`, en: `Finality` },
  status: { cs: `Stav`, en: `Status` },
  conf: { cs: `konf.`, en: `conf.` },
  clickTxHashForTransactionDetai: { cs: `Klikněte na TX hash pro detail transakce v průzkumníku. EVM mint TX se zobrazí po finalitě (60 bloků).`, en: `Click TX hash for transaction detail in explorer. EVM mint TX appears after finality (60 blocks).` },
  contracts: { cs: `Kontrakty`, en: `Contracts` },
  bridgeContracts: { cs: `Bridge kontrakty`, en: `Bridge Contracts` },
  bridgeBetweenZionL1AndBaseMain: { cs: `Most mezi ZION L1 a Base Mainnet. Lock/Mint a Burn/Unlock s plnou transparencí.`, en: `Bridge between ZION L1 and Base Mainnet. Lock/Mint and Burn/Unlock with full transparency.` },
  bridgeUi: { cs: `Bridge UI`, en: `Bridge UI` },
};

// ─── Bridge Transaction Types ────────────────────────────────────────────────

interface BridgeLockTx {
  txid: string;
  block_height: number;
  sender: string;
  recipient_chain: string;
  recipient: string;
  amount_zion: string;
  amount_flowers: number;
  memo: string;
  confirmations: number;
  finalized: boolean;
  status: 'finalized' | 'pending';
  direction: 'lock';
}

interface BridgeTxsResponse {
  transactions: BridgeLockTx[];
  chain_height: number;
  total_detected: number;
  finality_threshold: number;
  error?: string;
}

/** Truncate a hex string: 0x1234...5678 */
function truncateHash(hash: string, prefix = 10, suffix = 6): string {
  if (!hash || hash.length <= prefix + suffix) return hash;
  return `${hash.slice(0, prefix)}...${hash.slice(-suffix)}`;
}

/** Truncate a zion/bech32 address */
function truncateAddr(addr: string, prefix = 12, suffix = 6): string {
  if (!addr || addr.length <= prefix + suffix) return addr;
  return `${addr.slice(0, prefix)}...${addr.slice(-suffix)}`;
}

/** Status badge color + label */
function statusBadge(finalized: boolean, confirmations: number, threshold: number, cs: boolean) {
  if (finalized) {
    return {
      label: ExplorerBridgeBridgeTrackerClientCopy.finalized[cs ? 'cs' : 'en'],
      className: "text-zion-cyan bg-zion-cyan/10 border-zion-cyan/20",
      icon: CheckCircle2,
    };
  }
  return {
    label: cs ? `Čeká (${confirmations}/${threshold})` : `Pending (${confirmations}/${threshold})`,
    className: "text-zion-gold bg-zion-gold/10 border-zion-gold/20",
    icon: Clock,
  };
}

/** Progress bar for finality (0 → threshold confirmations) */
function FinalityProgress({ confirmations, threshold }: { confirmations: number; threshold: number }) {
  const pct = Math.min(100, (confirmations / threshold) * 100);
  return (
    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          pct >= 100 ? "bg-zion-cyan" : "bg-zion-gold"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface BridgeMetrics {
  online: boolean;
  uptime_seconds: number;
  last_l1_height: number;
  last_evm_block: number;
  l1_locks_detected: number;
  l1_locks_finalized: number;
  evm_mints_submitted: number;
  evm_mints_confirmed: number;
  evm_burns_detected: number;
  l1_unlocks_submitted: number;
  l1_unlocks_confirmed: number;
  errors_total: number;
  fetched_at: number;
}

function fmtUptime(s: number) {
  if (s <= 0) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

function PipelineStep({
  icon: Icon,
  label,
  sub,
  count,
  color,
  border,
  done,
  arrow,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  count?: number;
  color: string;
  border: string;
  done?: boolean;
  arrow?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative zion-rainbow-sub p-4 min-w-0 sm:min-w-[140px] flex-1"
        style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs font-medium text-white">{label}</span>
          {done && <CheckCircle2 className="h-3.5 w-3.5 text-zion-cyan ml-auto" />}
        </div>
        <p className="text-[10px] text-gray-500 leading-snug">{sub}</p>
        {count !== undefined && (
          <p className={`text-lg font-bold tabular-nums mt-1 ${color}`}>{fmtNum(count)}</p>
        )}
      </div>
      {arrow && (
        <ChevronRight className="h-5 w-5 text-gray-600 shrink-0" />
      )}
    </div>
  );
}

export default function BridgeTrackerClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  const [data, setData] = useState<BridgeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [txs, setTxs] = useState<BridgeLockTx[]>([]);
  const [txsLoading, setTxsLoading] = useState(true);
  const [txsError, setTxsError] = useState<string | null>(null);
  const [chainHeight, setChainHeight] = useState(0);
  const [finalityThreshold, setFinalityThreshold] = useState(60);
  const [txFilter, setTxFilter] = useState<'all' | 'pending' | 'finalized'>('all');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient<BridgeMetrics>("/bridge/status");
      setData(res);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTxs = useCallback(async () => {
    try {
      setTxsError(null);
      const res = await fetch('/api/bridge/transactions?limit=50&scan_depth=1000');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: BridgeTxsResponse = await res.json();
      setTxs(json.transactions ?? []);
      setChainHeight(json.chain_height ?? 0);
      setFinalityThreshold(json.finality_threshold ?? 60);
    } catch (e) {
      setTxsError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setTxsLoading(false);
    }
  }, []);

  usePolling(fetchStatus, 10_000);
  usePolling(fetchTxs, 15_000);

  // Filtered transactions
  const filteredTxs = txs.filter((tx) => {
    if (txFilter === 'pending') return !tx.finalized;
    if (txFilter === 'finalized') return tx.finalized;
    return true;
  });

  const online = data?.online ?? false;
  const uptime = fmtUptime(data?.uptime_seconds ?? 0);
  const efficiency =
    data && data.l1_locks_detected > 0
      ? Math.round((data.l1_locks_finalized / data.l1_locks_detected) * 100)
      : 100;

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-cyan/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14 pt-6">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
                <ArrowLeftRight className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {ExplorerBridgeBridgeTrackerClientCopy.bridge[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {ExplorerBridgeBridgeTrackerClientCopy.liveTracking[cs ? 'cs' : 'en']}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {ExplorerBridgeBridgeTrackerClientCopy.bridgeTracker[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {ExplorerBridgeBridgeTrackerClientCopy.realTimeL1BaseBridgeStatusTrac[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                {online ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-zion-cyan">
                    <ShieldCheck className="h-3 w-3" /> {ExplorerBridgeBridgeTrackerClientCopy.online[cs ? 'cs' : 'en']}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-zion-purple/30 bg-zion-purple/10 px-4 py-2 text-zion-purple">
                    <AlertCircle className="h-3 w-3" /> {ExplorerBridgeBridgeTrackerClientCopy.offline[cs ? 'cs' : 'en']}
                  </span>
                )}
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Clock className="h-3 w-3 text-zion-gold" /> {ExplorerBridgeBridgeTrackerClientCopy.uptime[cs ? 'cs' : 'en']}: {uptime}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <TrendingUp className="h-3 w-3 text-zion-cyan" /> {ExplorerBridgeBridgeTrackerClientCopy.efficiency[cs ? 'cs' : 'en']}: {efficiency}%
                </span>
              </div>
            </div>

            {/* Mini status panel */}
            <div className="grid gap-3 sm:grid-cols-2 lg:w-auto w-full">
              <div className="zion-rainbow-sub px-5 py-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">L1 {ExplorerBridgeBridgeTrackerClientCopy.height[cs ? 'cs' : 'en']}</p>
                <p className="text-2xl font-semibold text-white mt-1 tabular-nums">
                  {fmtNum(data?.last_l1_height ?? 0)}
                </p>
              </div>
              <div className="zion-rainbow-sub px-5 py-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">EVM {ExplorerBridgeBridgeTrackerClientCopy.block[cs ? 'cs' : 'en']}</p>
                <p className="text-2xl font-semibold text-white mt-1 tabular-nums">
                  {fmtNum(data?.last_evm_block ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ STATS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerBridgeBridgeTrackerClientCopy.metrics[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-cyan" />
              {ExplorerBridgeBridgeTrackerClientCopy.bridgeMetrics[cs ? 'cs' : 'en']}
            </h2>
          </div>

          {loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="zion-rainbow-sub p-6 h-28" style={{ '--rc': '252, 209, 22' } as React.CSSProperties} />
              ))}
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: ExplorerBridgeBridgeTrackerClientCopy.locksDetected[cs ? 'cs' : 'en'], icon: Lock, accent: "text-zion-cyan", value: fmtNum(data?.l1_locks_detected ?? 0) },
                { label: ExplorerBridgeBridgeTrackerClientCopy.locksFinalized[cs ? 'cs' : 'en'], icon: ShieldCheck, accent: "text-zion-cyan", value: fmtNum(data?.l1_locks_finalized ?? 0) },
                { label: ExplorerBridgeBridgeTrackerClientCopy.mintsSubmitted[cs ? 'cs' : 'en'], icon: Zap, accent: "text-zion-gold", value: fmtNum(data?.evm_mints_submitted ?? 0) },
                { label: ExplorerBridgeBridgeTrackerClientCopy.mintsConfirmed[cs ? 'cs' : 'en'], icon: CheckCircle2, accent: "text-zion-cyan", value: fmtNum(data?.evm_mints_confirmed ?? 0) },
                { label: ExplorerBridgeBridgeTrackerClientCopy.burnsDetected[cs ? 'cs' : 'en'], icon: Flame, accent: "text-zion-gold", value: fmtNum(data?.evm_burns_detected ?? 0) },
                { label: ExplorerBridgeBridgeTrackerClientCopy.unlocksSubmitted[cs ? 'cs' : 'en'], icon: Unlock, accent: "text-zion-purple", value: fmtNum(data?.l1_unlocks_submitted ?? 0) },
                { label: ExplorerBridgeBridgeTrackerClientCopy.unlocksConfirmed[cs ? 'cs' : 'en'], icon: CheckCircle2, accent: "text-zion-cyan", value: fmtNum(data?.l1_unlocks_confirmed ?? 0) },
                { label: ExplorerBridgeBridgeTrackerClientCopy.errors[cs ? 'cs' : 'en'], icon: AlertCircle, accent: "text-zion-purple", value: fmtNum(data?.errors_total ?? 0) },
              ].map((card) => (
                <div
                  key={card.label}
                  className="zion-rainbow-sub p-6"
                  style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <card.icon className={`h-4 w-4 ${card.accent}`} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{card.label}</span>
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${card.accent}`}>{card.value}</p>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ═══════ PIPELINES ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerBridgeBridgeTrackerClientCopy.pipelines[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ArrowLeftRight className="h-7 w-7 text-zion-cyan" />
              {ExplorerBridgeBridgeTrackerClientCopy.bridgeFlow[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* L1 → Base */}
            <div className="zion-section p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-5 w-5 text-zion-cyan" />
                <h3 className="text-lg font-semibold text-white">L1 → Base</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-500">
                  {ExplorerBridgeBridgeTrackerClientCopy.lockMint[cs ? 'cs' : 'en']}
                </span>
              </div>
              <div className="space-y-2">
                <PipelineStep
                  icon={Lock}
                  label={ExplorerBridgeBridgeTrackerClientCopy.l1Lock[cs ? 'cs' : 'en']}
                  sub={ExplorerBridgeBridgeTrackerClientCopy.userLocksZionOnL1[cs ? 'cs' : 'en']}
                  count={data?.l1_locks_detected}
                  color="text-zion-cyan"
                  border="border-zion-cyan/20"
                  arrow
                />
                <PipelineStep
                  icon={Shield}
                  label={ExplorerBridgeBridgeTrackerClientCopy.relay[cs ? 'cs' : 'en']}
                  sub={ExplorerBridgeBridgeTrackerClientCopy.k60BlockFinalityValidatorThresh[cs ? 'cs' : 'en']}
                  count={data?.l1_locks_finalized}
                  color="text-zion-gold"
                  border="border-zion-gold/20"
                  done
                  arrow
                />
                <PipelineStep
                  icon={Zap}
                  label={ExplorerBridgeBridgeTrackerClientCopy.evmMint[cs ? 'cs' : 'en']}
                  sub={ExplorerBridgeBridgeTrackerClientCopy.mintWzionErc20OnBase[cs ? 'cs' : 'en']}
                  count={data?.evm_mints_confirmed}
                  color="text-zion-cyan"
                  border="border-zion-cyan/20"
                  done
                />
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs text-gray-500">
                <ArrowDown className="h-3 w-3" />
                {ExplorerBridgeBridgeTrackerClientCopy.time[cs ? 'cs' : 'en']}: ~60 {ExplorerBridgeBridgeTrackerClientCopy.l1Blocks[cs ? 'cs' : 'en']} (~1 {ExplorerBridgeBridgeTrackerClientCopy.hr[cs ? 'cs' : 'en']})
              </div>
            </div>

            {/* Base → L1 */}
            <div className="zion-section p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <Flame className="h-5 w-5 text-zion-gold" />
                <h3 className="text-lg font-semibold text-white">Base → L1</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-500">
                  {ExplorerBridgeBridgeTrackerClientCopy.burnUnlock[cs ? 'cs' : 'en']}
                </span>
              </div>
              <div className="space-y-2">
                <PipelineStep
                  icon={Flame}
                  label={ExplorerBridgeBridgeTrackerClientCopy.evmBurn[cs ? 'cs' : 'en']}
                  sub={ExplorerBridgeBridgeTrackerClientCopy.userBurnsWzionOnBase[cs ? 'cs' : 'en']}
                  count={data?.evm_burns_detected}
                  color="text-zion-gold"
                  border="border-zion-gold/20"
                  arrow
                />
                <PipelineStep
                  icon={Shield}
                  label={ExplorerBridgeBridgeTrackerClientCopy.relay[cs ? 'cs' : 'en']}
                  sub={ExplorerBridgeBridgeTrackerClientCopy.k64BlockEvmFinalityL1UnlockTx[cs ? 'cs' : 'en']}
                  count={data?.l1_unlocks_submitted}
                  color="text-zion-gold"
                  border="border-zion-gold/20"
                  done
                  arrow
                />
                <PipelineStep
                  icon={Unlock}
                  label={ExplorerBridgeBridgeTrackerClientCopy.l1Unlock[cs ? 'cs' : 'en']}
                  sub={ExplorerBridgeBridgeTrackerClientCopy.zionUnlockedOnL1Address[cs ? 'cs' : 'en']}
                  count={data?.l1_unlocks_confirmed}
                  color="text-zion-cyan"
                  border="border-zion-cyan/20"
                  done
                />
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs text-gray-500">
                <ArrowDown className="h-3 w-3" />
                {ExplorerBridgeBridgeTrackerClientCopy.time[cs ? 'cs' : 'en']}: ~64 {ExplorerBridgeBridgeTrackerClientCopy.evmBlocks[cs ? 'cs' : 'en']} (~2 {ExplorerBridgeBridgeTrackerClientCopy.min[cs ? 'cs' : 'en']}) + L1
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ LIVE TRANSACTIONS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
              {ExplorerBridgeBridgeTrackerClientCopy.liveTransactions[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-cyan" />
              {ExplorerBridgeBridgeTrackerClientCopy.bridgeLockTransactions[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">
              {ExplorerBridgeBridgeTrackerClientCopy.recentL1LockTransactionsWithFi[cs ? 'cs' : 'en']}
            </p>
          </div>

          {/* Filter buttons */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {([
              { key: 'all', label: ExplorerBridgeBridgeTrackerClientCopy.all[cs ? 'cs' : 'en'], count: txs.length },
              { key: 'pending', label: ExplorerBridgeBridgeTrackerClientCopy.pending[cs ? 'cs' : 'en'], count: txs.filter(t => !t.finalized).length },
              { key: 'finalized', label: ExplorerBridgeBridgeTrackerClientCopy.finalized_2[cs ? 'cs' : 'en'], count: txs.filter(t => t.finalized).length },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setTxFilter(f.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                  txFilter === f.key
                    ? 'border-zion-cyan/40 bg-zion-cyan/10 text-zion-cyan'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {f.label}
                <span className="tabular-nums opacity-60">{f.count}</span>
              </button>
            ))}
            <span className="ml-auto text-[10px] text-gray-500">
              {cs ? `Skenováno ${chainHeight} bloků` : `Scanned ${chainHeight} blocks`} · {ExplorerBridgeBridgeTrackerClientCopy.updatesEvery15s[cs ? 'cs' : 'en']}
            </span>
          </div>

          {/* Transaction table */}
          <div className="zion-rainbow-card rounded-2xl overflow-hidden" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
            {txsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 text-zion-cyan animate-spin" />
                <span className="ml-3 text-sm text-gray-400">
                  {ExplorerBridgeBridgeTrackerClientCopy.loadingTransactions[cs ? 'cs' : 'en']}
                </span>
              </div>
            ) : txsError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="h-8 w-8 text-zion-purple mb-3" />
                <p className="text-sm text-zion-purple">{txsError}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {ExplorerBridgeBridgeTrackerClientCopy.l1RpcMayBeOfflineTryAgainLater[cs ? 'cs' : 'en']}
                </p>
              </div>
            ) : filteredTxs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-8 w-8 text-gray-600 mb-3" />
                <p className="text-sm text-gray-400">
                  {ExplorerBridgeBridgeTrackerClientCopy.noBridgeTransactionsFound[cs ? 'cs' : 'en']}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {ExplorerBridgeBridgeTrackerClientCopy.lockTransactionsWillAppearHere[cs ? 'cs' : 'en']}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500">
                      <th className="text-left px-4 py-3 font-medium">{ExplorerBridgeBridgeTrackerClientCopy.txHash[cs ? 'cs' : 'en']}</th>
                      <th className="text-left px-4 py-3 font-medium">{ExplorerBridgeBridgeTrackerClientCopy.block_2[cs ? 'cs' : 'en']}</th>
                      <th className="text-left px-4 py-3 font-medium">{ExplorerBridgeBridgeTrackerClientCopy.sender[cs ? 'cs' : 'en']}</th>
                      <th className="text-left px-4 py-3 font-medium">{ExplorerBridgeBridgeTrackerClientCopy.chain[cs ? 'cs' : 'en']}</th>
                      <th className="text-right px-4 py-3 font-medium">{ExplorerBridgeBridgeTrackerClientCopy.amount[cs ? 'cs' : 'en']}</th>
                      <th className="text-left px-4 py-3 font-medium min-w-0 sm:min-w-[120px]">{ExplorerBridgeBridgeTrackerClientCopy.finality[cs ? 'cs' : 'en']}</th>
                      <th className="text-center px-4 py-3 font-medium">{ExplorerBridgeBridgeTrackerClientCopy.status[cs ? 'cs' : 'en']}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxs.map((tx) => {
                      const badge = statusBadge(tx.finalized, tx.confirmations, finalityThreshold, cs);
                      const StatusIcon = badge.icon;
                      return (
                        <tr
                          key={tx.txid}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          {/* TX Hash */}
                          <td className="px-4 py-3">
                            <Link
                              href={`/explorer/tx?hash=${encodeURIComponent(tx.txid)}`}
                              className="font-mono text-xs text-zion-cyan hover:text-cyan-200 transition-colors"
                            >
                              {truncateHash(tx.txid)}
                            </Link>
                          </td>
                          {/* Block */}
                          <td className="px-4 py-3">
                            <Link
                              href={`/explorer/block?id=${tx.block_height}`}
                              className="font-mono text-xs text-gray-300 hover:text-white transition-colors tabular-nums"
                            >
                              {tx.block_height.toLocaleString()}
                            </Link>
                          </td>
                          {/* Sender */}
                          <td className="px-4 py-3">
                            <Link
                              href={`/explorer/address?addr=${encodeURIComponent(tx.sender)}`}
                              className="font-mono text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              {truncateAddr(tx.sender)}
                            </Link>
                          </td>
                          {/* Target Chain */}
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-300">
                              <ArrowRight className="h-3 w-3 text-gray-600" />
                              {tx.recipient_chain}
                            </span>
                          </td>
                          {/* Amount */}
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-xs font-semibold text-zion-gold tabular-nums">
                              {tx.amount_zion}
                            </span>
                            <span className="text-[10px] text-gray-500 ml-1">ZION</span>
                          </td>
                          {/* Finality Progress */}
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <FinalityProgress
                                confirmations={tx.confirmations}
                                threshold={finalityThreshold}
                              />
                              <p className="text-[10px] text-gray-500 tabular-nums">
                                {tx.confirmations}/{finalityThreshold} {ExplorerBridgeBridgeTrackerClientCopy.conf[cs ? 'cs' : 'en']}
                              </p>
                            </div>
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium ${badge.className}`}>
                              <StatusIcon className="h-3 w-3" />
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recipient hint */}
          {filteredTxs.length > 0 && (
            <p className="text-[10px] text-gray-600 mt-3 text-center">
              {ExplorerBridgeBridgeTrackerClientCopy.clickTxHashForTransactionDetai[cs ? 'cs' : 'en']}
            </p>
          )}
        </motion.section>

        {/* ═══════ CONTRACTS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="zion-section p-6 md:p-10"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerBridgeBridgeTrackerClientCopy.contracts[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe className="h-7 w-7 text-zion-purple" />
              {ExplorerBridgeBridgeTrackerClientCopy.bridgeContracts[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                label: "wZION ERC-20",
                addr: BRIDGE_CONTRACTS.wzion_address,
                net: "Base Mainnet",
                chainId: 8453,
                color: "text-zion-cyan",
                border: "border-zion-cyan/20",
                icon: Zap,
              },
              {
                label: "ZIONBridge",
                addr: BRIDGE_CONTRACTS.bridge_address,
                net: "Base Mainnet",
                chainId: 8453,
                color: "text-zion-gold",
                border: "border-zion-gold/20",
                icon: Shield,
              },
            ].map((c) => (
              <a
                key={c.label}
                href={`${BRIDGE_CONTRACTS.explorer_base}${c.addr}`}
                target="_blank"
                rel="noreferrer"
                className="group zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
              >
                <div className="flex items-center gap-2 mb-2">
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                  <span className="text-sm font-medium text-white">{c.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-gray-500 ml-auto group-hover:text-white transition-colors" />
                </div>
                <p className="font-mono text-xs text-gray-400 break-all">{c.addr}</p>
                <p className="text-[10px] text-gray-500 mt-1">{c.net} · Chain ID {c.chainId}</p>
              </a>
            ))}
          </div>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18 }}
          className="zion-cta-banner p-10 text-center"
        >
          <ArrowLeftRight className="mx-auto h-12 w-12 text-zion-cyan" />
          <h2 className="mt-6 text-3xl font-semibold text-white">ZION Bridge</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {ExplorerBridgeBridgeTrackerClientCopy.bridgeBetweenZionL1AndBaseMain[cs ? 'cs' : 'en']}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/bridge" className="zion-button-primary group text-sm" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <Lock className="h-4 w-4" /> {ExplorerBridgeBridgeTrackerClientCopy.bridgeUi[cs ? 'cs' : 'en']}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/explorer/mempool" className="zion-button-secondary text-sm">
              <Flame className="h-4 w-4" /> Mempool
            </Link>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {cs
            ? `ZION TerraNova ${SITE_RELEASE_LABEL} — Bridge Tracker · Relay metriky (10s) + L1 lock TX (15s) · Finalita 60 bloků`
            : `ZION TerraNova ${SITE_RELEASE_LABEL} — Bridge Tracker · Relay metrics (10s) + L1 lock TX (15s) · Finality 60 blocks`}
        </p>
      </div>
    </div>
  );
}
