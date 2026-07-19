"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  Flame,
  Gauge,
  Rabbit,
  Timer,
  Turtle,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";

interface MempoolTx {
  tx_hash: string;
  size: number;
  fee: number;
  receive_time: number;
}

interface MempoolResponse {
  count: number;
  transactions: MempoolTx[];
  fee_stats: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
}

function formatFee(n: number) {
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  return n.toFixed(6);
}

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export default function FeeEstimatorClient() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const [data, setData] = useState<MempoolResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMempool = useCallback(async () => {
    try {
      const res = await apiClient<MempoolResponse>("/blockchain/mempool", { cache: "no-store" });
      setData(res);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  usePolling(fetchMempool, 10_000);

  const fees = useMemo(() => {
    if (!data?.transactions.length) return null;
    const arr = data.transactions.map((t) => t.fee);
    return {
      low: percentile(arr, 25),
      medium: percentile(arr, 50),
      high: percentile(arr, 75),
      urgent: percentile(arr, 90),
      min: data.fee_stats.min,
      max: data.fee_stats.max,
      avg: data.fee_stats.avg,
      median: data.fee_stats.median,
      count: data.count,
    };
  }, [data]);

  const tiers = fees ? [
    {
      key: "low",
      label: cs ? "Nízký" : "Low",
      sub: cs ? "~10 min" : "~10 min",
      fee: fees.low,
      icon: Turtle,
      color: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
    },
    {
      key: "medium",
      label: cs ? "Střední" : "Medium",
      sub: cs ? "~5 min" : "~5 min",
      fee: fees.medium,
      icon: Timer,
      color: "text-zion-cyan",
      border: "border-zion-cyan/20",
      bg: "bg-zion-cyan/5",
    },
    {
      key: "high",
      label: cs ? "Vysoký" : "High",
      sub: cs ? "~2 min" : "~2 min",
      fee: fees.high,
      icon: Rabbit,
      color: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
    },
    {
      key: "urgent",
      label: cs ? "Urgentní" : "Urgent",
      sub: cs ? "~1 min" : "~1 min",
      fee: fees.urgent,
      icon: Zap,
      color: "text-rose-400",
      border: "border-rose-500/20",
      bg: "bg-rose-500/5",
    },
  ] : [];

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-emerald-500/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-14 pt-6">
        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-300 uppercase">
                <Gauge className="h-4 w-4" />
                {cs ? "Live" : "Live"}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? "Mempool analýza" : "Mempool Analysis"}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? "Fee odhad" : "Fee Estimator"}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? "Doporučené poplatky na základě aktuálního mempoolu. Čím vyšší fee, tím rychlejší potvrzení."
                  : "Recommended fees based on the current mempool. Higher fee = faster confirmation."}
              </p>
            </div>
          </div>
        </motion.section>

        {/* TIER CARDS */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Doporučení" : "Recommendations"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <DollarSign className="h-7 w-7 text-emerald-400" />
              {cs ? "Odhad poplatků" : "Fee Tiers"}
            </h2>
          </div>

          {loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="zion-rainbow-sub p-6 h-40" style={{ '--rc': '251, 191, 36' } as React.CSSProperties} />
              ))}
            </div>
          )}

          {!loading && fees && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {tiers.map((t) => (
                <div key={t.key} className="zion-rainbow-sub p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <div className="flex items-center gap-2 mb-3">
                    <t.icon className={`h-4 w-4 ${t.color}`} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{t.label}</span>
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${t.color}`}>{formatFee(t.fee)} ZION</p>
                  <p className="text-[11px] text-gray-500 mt-1">{t.sub}</p>
                </div>
              ))}
            </div>
          )}

          {!loading && !fees && (
            <div className="zion-section p-10 text-center">
              <Flame className="h-10 w-10 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">{cs ? "Mempool je prázdný — není třeba fee" : "Mempool is empty — no fee needed"}</p>
            </div>
          )}
        </motion.section>

        {/* STATS */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="zion-section p-6 md:p-10">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Statistiky" : "Statistics"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Gauge className="h-7 w-7 text-zion-cyan" />
              {cs ? "Mempool statistiky" : "Mempool Stats"}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: cs ? "TX čekajících" : "Pending TX", value: fees?.count ?? 0, color: "text-white" },
              { label: cs ? "Min fee" : "Min Fee", value: formatFee(fees?.min ?? 0) + " ZION", color: "text-emerald-400" },
              { label: cs ? "Průměr" : "Average", value: formatFee(fees?.avg ?? 0) + " ZION", color: "text-zion-cyan" },
              { label: cs ? "Medián" : "Median", value: formatFee(fees?.median ?? 0) + " ZION", color: "text-zion-gold" },
              { label: cs ? "Max fee" : "Max Fee", value: formatFee(fees?.max ?? 0) + " ZION", color: "text-amber-400" },
              { label: cs ? "25. percentil" : "25th %ile", value: formatFee(fees?.low ?? 0) + " ZION", color: "text-purple-400" },
              { label: cs ? "50. percentil" : "50th %ile", value: formatFee(fees?.medium ?? 0) + " ZION", color: "text-purple-400" },
              { label: cs ? "90. percentil" : "90th %ile", value: formatFee(fees?.urgent ?? 0) + " ZION", color: "text-rose-400" },
            ].map((s) => (
              <div key={s.label} className="zion-tile p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">{s.label}</p>
                <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {cs
            ? `ZION TerraNova — Fee Estimator · Data z mempoolu · Aktualizace každých 10 s`
            : `ZION TerraNova — Fee Estimator · Mempool data · Updates every 10s`}
        </p>
      </div>
    </div>
  );
}
