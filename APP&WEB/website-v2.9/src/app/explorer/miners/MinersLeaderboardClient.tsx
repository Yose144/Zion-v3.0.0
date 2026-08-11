"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Pickaxe,
  Trophy,
  Zap,
  Users,
  Crown,
  Activity,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";
import type { ExplorerMiners } from "@/lib/explorer/types";
import { formatNumber, formatHashrate } from "@/lib/explorer/format";

const ExplorerMinersMinersLeaderboardClientCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  live: { cs: `Live`, en: `Live` },
  mining: { cs: `Těžba`, en: `Mining` },
  topMiners: { cs: `Top mineři`, en: `Top Miners` },
  mostActiveMinersAndPoolsOnTheZ: { cs: `Nejaktivnější těžaři a pooly na ZION síti. Seřazeno podle hashrate, shares a nalezených bloků.`, en: `Most active miners and pools on the ZION network. Sorted by hashrate, shares and blocks found.` },
  totalMiners: { cs: `Celkem minerů`, en: `Total Miners` },
  totalHashrate: { cs: `Celkový hashrate`, en: `Total Hashrate` },
  blocksFound: { cs: `Nalezených bloků`, en: `Blocks Found` },
  totalShares: { cs: `Celkem shares`, en: `Total Shares` },
  leaderboard: { cs: `Žebříček`, en: `Leaderboard` },
  miningLeaderboard: { cs: `Těžební žebříček`, en: `Mining Leaderboard` },
  rank: { cs: `#`, en: `#` },
  address: { cs: `Adresa`, en: `Address` },
  type: { cs: `Typ`, en: `Type` },
  hashrate: { cs: `Hashrate`, en: `Hashrate` },
  shares: { cs: `Shares`, en: `Shares` },
  blocks: { cs: `Bloky`, en: `Blocks` },
  balance: { cs: `Zůstatek`, en: `Balance` },
  pool: { cs: `Pool`, en: `Pool` },
  solo: { cs: `Solo`, en: `Solo` },
  noMinersFound: { cs: `Žádní mineři nenalezeni`, en: `No miners found` },
  zionTerranovaTopMinersLiveData: { cs: `ZION TerraNova — Top Mineři · Live data z poolu · Aktualizace každých 30 s`, en: `ZION TerraNova — Top Miners · Live pool data · Updates every 30s` },
};

export default function MinersLeaderboardClient() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const [data, setData] = useState<ExplorerMiners | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMiners = useCallback(async () => {
    try {
      const res = await apiClient<ExplorerMiners>("/blockchain/miners?limit=100");
      setData(res);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  usePolling(fetchMiners, 30_000);

  const miners = useMemo(() => data?.miners ?? [], [data]);

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
      </div>

      <div className="relative z-10 zion-container max-w-6xl space-y-14 pt-6">
        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
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
              { label: ExplorerMinersMinersLeaderboardClientCopy.totalMiners[cs ? 'cs' : 'en'], value: data?.active_miners ?? 0, icon: Users, color: "text-zion-cyan" },
              { label: ExplorerMinersMinersLeaderboardClientCopy.totalHashrate[cs ? 'cs' : 'en'], value: data?.total_hashrate_formatted ?? formatHashrate(0), icon: Zap, color: "text-zion-gold" },
              { label: ExplorerMinersMinersLeaderboardClientCopy.blocksFound[cs ? 'cs' : 'en'], value: data?.blocks_found ?? 0, icon: Crown, color: "text-zion-gold" },
              { label: ExplorerMinersMinersLeaderboardClientCopy.totalShares[cs ? 'cs' : 'en'], value: formatNumber(data?.total_shares ?? 0), icon: Activity, color: "text-zion-cyan" },
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
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-4 py-3.5">{ExplorerMinersMinersLeaderboardClientCopy.rank[cs ? 'cs' : 'en']}</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5">{ExplorerMinersMinersLeaderboardClientCopy.address[cs ? 'cs' : 'en']}</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden md:table-cell">{ExplorerMinersMinersLeaderboardClientCopy.type[cs ? 'cs' : 'en']}</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden sm:table-cell">{ExplorerMinersMinersLeaderboardClientCopy.hashrate[cs ? 'cs' : 'en']}</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden lg:table-cell">{ExplorerMinersMinersLeaderboardClientCopy.shares[cs ? 'cs' : 'en']}</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3.5 hidden lg:table-cell">{ExplorerMinersMinersLeaderboardClientCopy.blocks[cs ? 'cs' : 'en']}</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-4 py-3.5">{ExplorerMinersMinersLeaderboardClientCopy.balance[cs ? 'cs' : 'en']}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && miners.length === 0
                    ? [...Array(10)].map((_, i) => (
                        <tr key={i} className="border-b border-white/3">
                          {[...Array(7)].map((_, j) => (
                            <td key={j} className="px-3 py-3 first:px-4 last:px-4">
                              <div className="h-4 bg-white/5 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : miners.map((m, i) => (
                        <tr key={m.address} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold tabular-nums ${i < 3 ? "text-zion-gold" : "text-gray-500"}`}>
                              {m.rank || i + 1}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <Link href={`/explorer/address?addr=${encodeURIComponent(m.address)}`}
                              className="text-zion-cyan hover:text-white transition font-mono text-xs">
                              {m.label || `${m.address.slice(0, 12)}…${m.address.slice(-8)}`}
                            </Link>
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                              m.type === "pool"
                                ? "bg-zion-cyan/10 text-zion-cyan border-zion-cyan/20"
                                : "bg-zion-purple/10 text-zion-purple border-zion-purple/20"
                            }`}>
                              {m.type === "pool" ? (ExplorerMinersMinersLeaderboardClientCopy.pool[cs ? 'cs' : 'en']) : (ExplorerMinersMinersLeaderboardClientCopy.solo[cs ? 'cs' : 'en'])}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right hidden sm:table-cell">
                            <span className="text-white text-xs font-semibold tabular-nums">{m.hashrate_formatted || formatHashrate(m.hashrate)}</span>
                          </td>
                          <td className="px-3 py-3 text-right hidden lg:table-cell">
                            <span className="text-gray-400 text-xs font-semibold tabular-nums">{formatNumber(m.shares_accepted)}</span>
                          </td>
                          <td className="px-3 py-3 text-right hidden lg:table-cell">
                            <span className="text-zion-gold text-xs font-semibold tabular-nums">{formatNumber(m.blocks_found)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-white text-xs font-semibold tabular-nums">
                              {(m.balance).toLocaleString(cs ? 'cs-CZ' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
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
          {ExplorerMinersMinersLeaderboardClientCopy.zionTerranovaTopMinersLiveData[cs ? 'cs' : 'en']}
        </p>
      </div>
    </div>
  );
}
