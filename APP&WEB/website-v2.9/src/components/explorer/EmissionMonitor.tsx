"use client";

import { useState } from "react";
import { Coins, TrendingUp, Flame, Heart, Timer } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";

const EmissionMonitorCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  emissionMonitor: { cs: `Monitoring emise`, en: `Emission Monitor` },
  block: { cs: `Blok`, en: `Block` },
  mined: { cs: `Vytěženo`, en: `Mined` },
  emitted: { cs: `emitováno`, en: `emitted` },
  dailyEmission: { cs: `Denní emise`, en: `Daily Emission` },
  blocks: { cs: `bloků`, en: `blocks` },
  miningDuration: { cs: `Doba těžby`, en: `Mining Duration` },
  full: { cs: `Plně`, en: `Full` },
  totalFees: { cs: `Celkové poplatky`, en: `Total Fees` },
  cumulativeNetworkFees: { cs: `Kumulované síťové poplatky`, en: `Cumulative network fees` },
  humanitarianTithe: { cs: `Humanitární desátek`, en: `Humanitarian Tithe` },
};

interface EmissionData {
  total_emission: number;
  total_fees: number;
  circulating_supply: number;
  max_supply: number;
  emission_pct: number;
  remaining_supply: number;
  base_reward_per_block: number;
  blocks_per_day: number;
  daily_emission: number;
  yearly_emission: number;
  estimated_years_remaining: number;
  estimated_full_emission_date: string;
  mining_horizon_label?: string;
  block_height: number;
  humanitarian: {
    rate: number;
    per_block: number;
    estimated_total: number;
  };
}

export default function EmissionMonitor() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const locale = EmissionMonitorCopy.enUs[cs ? 'cs' : 'en'];
  const [data, setData] = useState<EmissionData | null>(null);
  const [loading, setLoading] = useState(true);

  usePolling(async () => {
    try { setData(await apiClient<EmissionData>("/blockchain/emission")); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }, 60000);

  const fmt = (num: number, dec = 2) => {
    if (num >= 1e12) return (num / 1e12).toFixed(dec) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(dec) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(dec) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(dec) + "K";
    return num.toLocaleString(undefined, { maximumFractionDigits: dec });
  };

  if (loading) {
    return (
      <div className="rounded-[28px] bg-black/60 backdrop-blur-2xl border border-white/8 p-6 animate-pulse">
        <div className="h-5 bg-white/5 rounded w-44 mb-5" />
        <div className="h-3 bg-white/5 rounded-full mb-6" />
        <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white/3 rounded-2xl" />)}</div>
      </div>
    );
  }

  if (!data) return null;

  const progressPct = Math.min(data.emission_pct, 100);

  return (
    <div className="rounded-[28px] bg-black/60 backdrop-blur-2xl border border-white/8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="w-9 h-9 rounded-xl bg-zion-gold/10 border border-zion-gold/20 flex items-center justify-center">
          <Coins className="w-4.5 h-4.5 text-zion-gold" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{EmissionMonitorCopy.emissionMonitor[cs ? 'cs' : 'en']}</h2>
          <p className="text-[11px] text-white/30">{EmissionMonitorCopy.block[cs ? 'cs' : 'en']} #{data.block_height?.toLocaleString(locale)}</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-5">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-[11px] mb-2">
            <span className="text-white/40">{EmissionMonitorCopy.mined[cs ? 'cs' : 'en']}</span>
            <span className="text-zion-gold font-mono tabular-nums">
              {fmt(data.circulating_supply)} / {fmt(data.max_supply)} ZION
            </span>
          </div>
          <div className="h-2.5 bg-white/4 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-zion-gold/80 via-amber-400 to-yellow-300 transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-right text-[10px] text-white/20 mt-1 tabular-nums">
            {data.emission_pct.toFixed(6)}% {EmissionMonitorCopy.emitted[cs ? 'cs' : 'en']}
          </div>
        </div>

        {/* 2×2 metric cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: EmissionMonitorCopy.dailyEmission[cs ? 'cs' : 'en'], icon: TrendingUp, color: "text-emerald-400", value: `${fmt(data.daily_emission)} ZION`, sub: `${data.base_reward_per_block} ZION × ${data.blocks_per_day.toLocaleString(locale)} ${EmissionMonitorCopy.blocks[cs ? 'cs' : 'en']}` },
            { label: EmissionMonitorCopy.miningDuration[cs ? 'cs' : 'en'], icon: Timer, color: "text-cyan-400", value: data.mining_horizon_label ?? (cs ? `~${Math.round(data.estimated_years_remaining)} let` : `~${Math.round(data.estimated_years_remaining)} years`), sub: `${EmissionMonitorCopy.full[cs ? 'cs' : 'en']}: ${data.estimated_full_emission_date}` },
            { label: EmissionMonitorCopy.totalFees[cs ? 'cs' : 'en'], icon: Flame, color: "text-amber-400", value: `${fmt(data.total_fees)} ZION`, sub: EmissionMonitorCopy.cumulativeNetworkFees[cs ? 'cs' : 'en'] },
            { label: EmissionMonitorCopy.humanitarianTithe[cs ? 'cs' : 'en'], icon: Heart, color: "text-pink-400", value: `${fmt(data.humanitarian.estimated_total)} ZION`, sub: cs ? `${(data.humanitarian.rate * 100).toFixed(0)}% všech odměn` : `${(data.humanitarian.rate * 100).toFixed(0)}% of all rewards` },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl bg-white/3 border border-white/6 p-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30">{m.label}</span>
              </div>
              <p className={`text-lg font-bold tabular-nums ${m.color}`}>{m.value}</p>
              <p className="text-[10px] text-white/20 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
