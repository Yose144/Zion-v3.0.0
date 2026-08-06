"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Pickaxe,
  TrendingUp,
  Trophy,
  Zap,
  Users,
  Crown,
  Activity,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";

const ExplorerMinersMinersLeaderboardClientCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  live: { cs: `Live`, en: `Live` },
  mining: { cs: `Těžba`, en: `Mining` },
  topMiners: { cs: `Top mineři`, en: `Top Miners` },
  mostActiveMinersAndPoolsOnTheZ: { cs: `Nejaktivnější těžaři a pooly na ZION síti. Seřazeno podle zůstatku a aktivní těžby.`, en: `Most active miners and pools on the ZION network. Sorted by balance and mining activity.` },
  totalMiners: { cs: `Celkem minerů`, en: `Total Miners` },
  minerSupply: { cs: `Těžební zásoba`, en: `Miner Supply` },
  pools: { cs: `Pooly`, en: `Pools` },
  soloMiners: { cs: `Solo mineři`, en: `Solo Miners` },
  leaderboard: { cs: `Žebříček`, en: `Leaderboard` },
  miningLeaderboard: { cs: `Těžební žebříček`, en: `Mining Leaderboard` },
  address: { cs: `Adresa`, en: `Address` },
  type: { cs: `Typ`, en: `Type` },
  balance: { cs: `Zůstatek`, en: `Balance` },
  pool: { cs: `Pool`, en: `Pool` },
  solo: { cs: `Solo`, en: `Solo` },
  noMinersFound: { cs: `Žádní mineři nenalezeni`, en: `No miners found` },
  zionTerranovaTopMinersRichlist: { cs: `ZION TerraNova — Top Mineři · Data z richlistu · Aktualizace každých 30 s`, en: `ZION TerraNova — Top Miners · Richlist data · Updates every 30s` },
};

interface RichListEntry {
  address: string;
  known_label?: string | null;
  known_type?: string | null;
  balance: number;
  type: "premine" | "miner" | "fund" | "other";
}

interface RichListStats {
  total_miners: number;
  total_premine: number;
  total_funds: number;
  total_other: number;
  miner_supply: number;
  premine_supply: number;
}

interface MinersData {
  entries: RichListEntry[];
  stats: RichListStats;
}

export default function MinersLeaderboardClient() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const locale = ExplorerMinersMinersLeaderboardClientCopy.enUs[cs ? 'cs' : 'en'];
  const [data, setData] = useState<MinersData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMiners = useCallback(async () => {
    try {
      const res = await apiClient<MinersData>("/blockchain/richlist?limit=100");
      setData(res);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  usePolling(fetchMiners, 30_000);

  const miners = useMemo(() => {
    if (!data?.entries) return [];
    return data.entries
      .filter((e) => e.type === "miner" || e.known_type === "pool")
      .slice(0, 50);
  }, [data]);

  const stats = data?.stats;

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold-500/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan-500/6" />
      </div>

      <div className="relative z-10 zion-container max-w-6xl space-y-14 pt-6">
        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold-500/40 bg-zion-gold-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold-300 uppercase">
              <Pickaxe className="h-4 w-4" />
              {ExplorerMinersMinersLeaderboardClientCopy.live[cs ? 'cs' : 'en']}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{ExplorerMinersMinersLeaderboardClientCopy.mining[cs ? 'cs' : 'en']}</p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                {ExplorerMinersMinersLeaderboardClientCopy.topMiners[cs ? 'cs' : 'en']}
              </h1>
            </div>
            <p className="text-lg text-gray-300 max-w-2xl">
              {ExplorerMinersMinersLeaderboardClientCopy.mostActiveMinersAndPoolsOnTheZ[cs ? 'cs' : 'en']}
            </p>
          </div>
        </motion.section>

        {/* STATS */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: ExplorerMinersMinersLeaderboardClientCopy.totalMiners[cs ? 'cs' : 'en'], value: stats?.total_miners ?? 0, icon: Users, color: "text-zion-cyan-400" },
              { label: ExplorerMinersMinersLeaderboardClientCopy.minerSupply[cs ? 'cs' : 'en'], value: `${((stats?.miner_supply ?? 0) / 1e6).toFixed(2)} ZION`, icon: TrendingUp, color: "text-zion-gold" },
              { label: ExplorerMinersMinersLeaderboardClientCopy.pools[cs ? 'cs' : 'en'], value: miners.filter((m) => m.known_type === "pool").length, icon: Crown, color: "text-zion-gold-400" },
              { label: ExplorerMinersMinersLeaderboardClientCopy.soloMiners[cs ? 'cs' : 'en'], value: miners.filter((m) => m.known_type !== "pool").length, icon: Activity, color: "text-zion-cyan" },
            ].map((s) => (
              <div key={s.label} className="zion-rainbow-sub p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-3">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{s.label}</span>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* TABLE */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerMinersMinersLeaderboardClientCopy.leaderboard[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Trophy className="h-7 w-7 text-zion-gold" />
              {ExplorerMinersMinersLeaderboardClientCopy.miningLeaderboard[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-hidden" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/6">
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3.5">#</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5">{ExplorerMinersMinersLeaderboardClientCopy.address[cs ? 'cs' : 'en']}</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden md:table-cell">{ExplorerMinersMinersLeaderboardClientCopy.type[cs ? 'cs' : 'en']}</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3.5">{ExplorerMinersMinersLeaderboardClientCopy.balance[cs ? 'cs' : 'en']}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && miners.length === 0
                    ? [...Array(10)].map((_, i) => (
                        <tr key={i} className="border-b border-white/3">
                          {[...Array(4)].map((_, j) => (
                            <td key={j} className="px-3 py-3 first:px-6 last:px-6">
                              <div className="h-4 bg-white/5 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : miners.map((m, i) => (
                        <tr key={m.address} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                          <td className="px-6 py-3">
                            <span className={`text-xs font-bold tabular-nums ${i < 3 ? "text-zion-gold" : "text-gray-500"}`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <Link href={`/explorer/address?addr=${encodeURIComponent(m.address)}`}
                              className="text-zion-cyan hover:text-white transition font-mono text-xs">
                              {m.known_label || `${m.address.slice(0, 12)}…${m.address.slice(-8)}`}
                            </Link>
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                              m.known_type === "pool"
                                ? "bg-zion-cyan-500/10 text-zion-cyan-400 border-zion-cyan-500/20"
                                : "bg-zion-purple-500/10 text-zion-purple-400 border-zion-purple-500/20"
                            }`}>
                              {m.known_type === "pool" ? (ExplorerMinersMinersLeaderboardClientCopy.pool[cs ? 'cs' : 'en']) : (ExplorerMinersMinersLeaderboardClientCopy.solo[cs ? 'cs' : 'en'])}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-white text-xs font-semibold tabular-nums">
                              {(m.balance / 1e6).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </span>
                            <span className="text-gray-600 text-[10px] ml-1">ZION</span>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            {miners.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Pickaxe className="h-10 w-10 text-white/10" />
                <p className="text-white/30 text-sm">{ExplorerMinersMinersLeaderboardClientCopy.noMinersFound[cs ? 'cs' : 'en']}</p>
              </div>
            )}
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {ExplorerMinersMinersLeaderboardClientCopy.zionTerranovaTopMinersRichlist[cs ? 'cs' : 'en']}
        </p>
      </div>
    </div>
  );
}
