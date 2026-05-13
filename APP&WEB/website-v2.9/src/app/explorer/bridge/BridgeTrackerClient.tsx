"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowLeft,
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
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";
import { SITE_RELEASE_LABEL } from "@/lib/site";
import {
  BRIDGE_CONTRACTS,
  type BridgeStatus,
} from "@/lib/bridge-api";

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
        className={`relative rounded-2xl border ${border} bg-black/40 p-4 min-w-[140px] flex-1`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs font-medium text-white">{label}</span>
          {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 ml-auto" />}
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

  usePolling(fetchStatus, 10_000);

  const online = data?.online ?? false;
  const uptime = fmtUptime(data?.uptime_seconds ?? 0);
  const efficiency =
    data && data.l1_locks_detected > 0
      ? Math.round((data.l1_locks_finalized / data.l1_locks_detected) * 100)
      : 100;

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-cyan/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14">
        {/* ── Back link ── */}
        <Link
          href="/explorer"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {cs ? "Zpět do průzkumníka" : "Back to Explorer"}
        </Link>

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-panel rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
                <ArrowLeftRight className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {cs ? "Most" : "Bridge"}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {cs ? "Live sledování" : "Live Tracking"}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? "Bridge Tracker" : "Bridge Tracker"}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? "Real-time stav L1↔Base bridge. Sledujte lock, mint, burn a unlock transakce. Relay metriky z Prometheus."
                  : "Real-time L1↔Base bridge status. Track lock, mint, burn and unlock transactions. Relay metrics from Prometheus."}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                {online ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-emerald-300">
                    <ShieldCheck className="h-3 w-3" /> {cs ? "Online" : "Online"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-400/10 px-4 py-2 text-red-300">
                    <AlertCircle className="h-3 w-3" /> {cs ? "Offline" : "Offline"}
                  </span>
                )}
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Clock className="h-3 w-3 text-zion-gold" /> {cs ? "Uptime" : "Uptime"}: {uptime}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <TrendingUp className="h-3 w-3 text-zion-cyan" /> {cs ? "Efektivita" : "Efficiency"}: {efficiency}%
                </span>
              </div>
            </div>

            {/* Mini status panel */}
            <div className="grid gap-3 sm:grid-cols-2 lg:w-auto w-full">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">L1 {cs ? "výška" : "height"}</p>
                <p className="text-2xl font-semibold text-white mt-1 tabular-nums">
                  {fmtNum(data?.last_l1_height ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">EVM {cs ? "blok" : "block"}</p>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Metriky" : "Metrics"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {cs ? "Bridge metriky" : "Bridge Metrics"}
            </h2>
          </div>

          {loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-3xl border border-white/8 bg-black/60 p-6 h-28" />
              ))}
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: cs ? "Lock detekovány" : "Locks Detected", icon: Lock, accent: "text-zion-cyan", value: fmtNum(data?.l1_locks_detected ?? 0) },
                { label: cs ? "Lock finalizovány" : "Locks Finalized", icon: ShieldCheck, accent: "text-emerald-400", value: fmtNum(data?.l1_locks_finalized ?? 0) },
                { label: cs ? "Mint odeslány" : "Mints Submitted", icon: Zap, accent: "text-zion-gold", value: fmtNum(data?.evm_mints_submitted ?? 0) },
                { label: cs ? "Mint potvrzeny" : "Mints Confirmed", icon: CheckCircle2, accent: "text-emerald-400", value: fmtNum(data?.evm_mints_confirmed ?? 0) },
                { label: cs ? "Burn detekovány" : "Burns Detected", icon: Flame, accent: "text-amber-400", value: fmtNum(data?.evm_burns_detected ?? 0) },
                { label: cs ? "Unlock odeslány" : "Unlocks Submitted", icon: Unlock, accent: "text-zion-purple", value: fmtNum(data?.l1_unlocks_submitted ?? 0) },
                { label: cs ? "Unlock potvrzeny" : "Unlocks Confirmed", icon: CheckCircle2, accent: "text-emerald-400", value: fmtNum(data?.l1_unlocks_confirmed ?? 0) },
                { label: cs ? "Chyby" : "Errors", icon: AlertCircle, accent: "text-red-400", value: fmtNum(data?.errors_total ?? 0) },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl p-6 hover:border-white/12 transition-colors"
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Pipeliny" : "Pipelines"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ArrowLeftRight className="h-7 w-7 text-zion-cyan" />
              {cs ? "Bridge flow" : "Bridge Flow"}
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* L1 → Base */}
            <div className="rounded-4xl border border-white/8 bg-black/60 backdrop-blur-xl p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-5 w-5 text-zion-cyan" />
                <h3 className="text-lg font-semibold text-white">L1 → Base</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-500">
                  {cs ? "Lock / Mint" : "Lock / Mint"}
                </span>
              </div>
              <div className="space-y-2">
                <PipelineStep
                  icon={Lock}
                  label={cs ? "L1 Lock" : "L1 Lock"}
                  sub={cs ? "Uživatel zamkne ZION na L1" : "User locks ZION on L1"}
                  count={data?.l1_locks_detected}
                  color="text-zion-cyan"
                  border="border-zion-cyan/20"
                  arrow
                />
                <PipelineStep
                  icon={Shield}
                  label={cs ? "Relay" : "Relay"}
                  sub={cs ? "60-bloková finalita, validátor threshold" : "60-block finality, validator threshold"}
                  count={data?.l1_locks_finalized}
                  color="text-zion-gold"
                  border="border-zion-gold/20"
                  done
                  arrow
                />
                <PipelineStep
                  icon={Zap}
                  label={cs ? "EVM Mint" : "EVM Mint"}
                  sub={cs ? "Mint wZION ERC-20 na Base" : "Mint wZION ERC-20 on Base"}
                  count={data?.evm_mints_confirmed}
                  color="text-emerald-400"
                  border="border-emerald-500/20"
                  done
                />
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs text-gray-500">
                <ArrowDown className="h-3 w-3" />
                {cs ? "Doba" : "Time"}: ~60 {cs ? "L1 bloků" : "L1 blocks"} (~1 {cs ? "hod" : "hr"})
              </div>
            </div>

            {/* Base → L1 */}
            <div className="rounded-4xl border border-white/8 bg-black/60 backdrop-blur-xl p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <Flame className="h-5 w-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-white">Base → L1</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-500">
                  {cs ? "Burn / Unlock" : "Burn / Unlock"}
                </span>
              </div>
              <div className="space-y-2">
                <PipelineStep
                  icon={Flame}
                  label={cs ? "EVM Burn" : "EVM Burn"}
                  sub={cs ? "Uživatel spálí wZION na Base" : "User burns wZION on Base"}
                  count={data?.evm_burns_detected}
                  color="text-amber-400"
                  border="border-amber-500/20"
                  arrow
                />
                <PipelineStep
                  icon={Shield}
                  label={cs ? "Relay" : "Relay"}
                  sub={cs ? "64-bloková EVM finalita, L1 unlock TX" : "64-block EVM finality, L1 unlock TX"}
                  count={data?.l1_unlocks_submitted}
                  color="text-zion-gold"
                  border="border-zion-gold/20"
                  done
                  arrow
                />
                <PipelineStep
                  icon={Unlock}
                  label={cs ? "L1 Unlock" : "L1 Unlock"}
                  sub={cs ? "ZION odemčeny na L1 adrese" : "ZION unlocked on L1 address"}
                  count={data?.l1_unlocks_confirmed}
                  color="text-emerald-400"
                  border="border-emerald-500/20"
                  done
                />
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs text-gray-500">
                <ArrowDown className="h-3 w-3" />
                {cs ? "Doba" : "Time"}: ~64 {cs ? "EVM bloků" : "EVM blocks"} (~2 {cs ? "min" : "min"}) + L1
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ CONTRACTS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="rounded-4xl border border-white/8 bg-black/60 backdrop-blur-xl p-6 md:p-10"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Kontrakty" : "Contracts"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe className="h-7 w-7 text-zion-purple" />
              {cs ? "Bridge kontrakty" : "Bridge Contracts"}
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
                className={`group rounded-2xl border ${c.border} bg-white/3 p-5 hover:bg-white/5 transition-colors`}
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
          className="rounded-4xl border border-zion-cyan/30 bg-linear-to-r from-zion-cyan/20 via-zion-purple/10 to-zion-cyan/20 p-10 text-center"
        >
          <ArrowLeftRight className="mx-auto h-12 w-12 text-zion-cyan" />
          <h2 className="mt-6 text-3xl font-semibold text-white">ZION Bridge</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs
              ? "Most mezi ZION L1 a Base Mainnet. Lock/Mint a Burn/Unlock s plnou transparencí."
              : "Bridge between ZION L1 and Base Mainnet. Lock/Mint and Burn/Unlock with full transparency."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/bridge" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <Lock className="h-4 w-4" /> {cs ? "Bridge UI" : "Bridge UI"}
            </Link>
            <Link href="/explorer/mempool" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white border border-white/10">
              <Flame className="h-4 w-4" /> Mempool
            </Link>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {cs
            ? `ZION TerraNova ${SITE_RELEASE_LABEL} — Bridge Tracker · Data z relay Prometheus metrik · Aktualizace každých 10 s`
            : `ZION TerraNova ${SITE_RELEASE_LABEL} — Bridge Tracker · Data from relay Prometheus metrics · Updates every 10s`}
        </p>
      </div>
    </div>
  );
}
