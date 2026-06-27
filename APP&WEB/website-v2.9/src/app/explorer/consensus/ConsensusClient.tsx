"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Cpu,
  Clock,
  Flame,
  Heart,
  Layers,
  Pickaxe,
  Shield,
  TrendingDown,
  Wallet,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

export default function ConsensusClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  const sections = [
    {
      icon: Clock,
      title: cs ? "LWMA DAA" : "LWMA DAA",
      color: "text-zion-cyan",
      border: "border-zion-cyan/20",
      bg: "bg-zion-cyan/5",
      content: cs
        ? "ZION používá Linearly Weighted Moving Average (LWMA) Difficulty Adjustment Algorithm. Cílem je stabilní 60s blok bez náhlých skoků obtížnosti. LWMA klade vyšší váhu na recentní bloky, což umožňuje rychlejší reakci na změny hashrate."
        : "ZION uses the Linearly Weighted Moving Average (LWMA) Difficulty Adjustment Algorithm. The goal is a stable 60s block time without sudden difficulty jumps. LWMA weights recent blocks more heavily, allowing faster response to hashrate changes.",
    },
    {
      icon: TrendingDown,
      title: cs ? "Decade Decay" : "Decade Decay",
      color: "text-zion-gold",
      border: "border-zion-gold/20",
      bg: "bg-zion-gold/5",
      content: cs
        ? "Emise ZION není halving — je to Decade Decay. Každých ~10 let (525 600 bloků) klesne odměna o 20 %. Startuje na 5 400 ZION/blok a postupně klesá na 724 ZION/blok v desáté dekádě, kde zůstává jako tail emise do nekonečna. Celkový strop je 144 miliard ZION."
        : "ZION emission is not a halving — it's Decade Decay. Every ~10 years (525,600 blocks) the reward drops by 20%. Starting at 5,400 ZION/block and gradually declining to 724 ZION/block in the 10th decade, where it remains as tail emission forever. Total cap is 144 billion ZION.",
    },
    {
      icon: Pickaxe,
      title: cs ? "PoW algoritmy" : "PoW Algorithms",
      color: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      content: cs
        ? "ZION podporuje tři algoritmy: Deeksha Lite (default, nízká energie, 256 KiB scratchpad), Deeksha Lite Fire (full power, 512 KiB, vyšší teplota) a Cosmic Harmony Ekam Deeksha v2 (nejpokročilejší). Pool automaticky detekuje algoritmus z Hello zprávy a validuje share podle něj."
        : "ZION supports three algorithms: Deeksha Lite (default, low energy, 256 KiB scratchpad), Deeksha Lite Fire (full power, 512 KiB, higher temperature), and Cosmic Harmony Ekam Deeksha v2 (most advanced). The pool auto-detects the algorithm from the Hello message and validates shares accordingly.",
    },
    {
      icon: Heart,
      title: cs ? "Odměna 89/5/5/1" : "89/5/5/1 Reward Split",
      color: "text-rose-400",
      border: "border-rose-500/20",
      bg: "bg-rose-500/5",
      content: cs
        ? "Každý coinbase blok rozděluje odměnu: 89 % miner, 5 % humanitární fond, 5 % Issobella Fund a 1 % pool fee. Tento poměr je konstituční — změna vyžaduje governance proposal. Fee transakcí jsou 100 % spáleny (burn), což snižuje celkovou zásobu."
        : "Every coinbase block splits the reward: 89% miner, 5% humanitarian fund, 5% Issobella Fund, and 1% pool fee. This ratio is constitutional — changing it requires a governance proposal. Transaction fees are 100% burned, reducing total supply.",
    },
    {
      icon: Shield,
      title: cs ? "Bezpečnost & validace" : "Security & Validation",
      color: "text-purple-400",
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
      content: cs
        ? "UTXO model s ring signatures. Každý blok musí projít plnou validací: PoW, signature verification, double-spend check a consensus rules. Orphan bloky jsou sledovány jako potenciální forky. Pool validuje share pomocí session-specific algoritmu."
        : "UTXO model with ring signatures. Every block undergoes full validation: PoW, signature verification, double-spend check, and consensus rules. Orphan blocks are tracked as potential forks. The pool validates shares using the session-specific algorithm.",
    },
  ];

  const decades = [
    { index: 0, reward: 5400.067, blocks: 525_600, pct: "20%" },
    { index: 1, reward: 4320.054, blocks: 525_600, pct: "16%" },
    { index: 2, reward: 3456.043, blocks: 525_600, pct: "12.8%" },
    { index: 3, reward: 2764.834, blocks: 525_600, pct: "10.24%" },
    { index: 4, reward: 2211.867, blocks: 525_600, pct: "8.19%" },
    { index: 5, reward: 1769.494, blocks: 525_600, pct: "6.55%" },
    { index: 6, reward: 1415.595, blocks: 525_600, pct: "5.24%" },
    { index: 7, reward: 1132.476, blocks: 525_600, pct: "4.19%" },
    { index: 8, reward: 905.981, blocks: 525_600, pct: "3.36%" },
    { index: 9, reward: 724.785, blocks: 525_600, pct: "2.68%" },
    { index: 10, reward: 724.785, blocks: 0, pct: "Tail ∞" },
  ];

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-purple-500/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-14">
        <Link href="/explorer" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {cs ? "Zpět do průzkumníka" : "Back to Explorer"}
        </Link>

        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-purple-300 uppercase">
              <Cpu className="h-4 w-4" />
              {cs ? "Protokol" : "Protocol"}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? "TerraNova konsensus" : "TerraNova Consensus"}</p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                {cs ? "Konsensus & ekonomika" : "Consensus & Economics"}
              </h1>
            </div>
            <p className="text-lg text-gray-300 max-w-2xl">
              {cs
                ? "Přehled algoritmů, emise a bezpečnostního modelu ZION TerraNova."
                : "Overview of algorithms, emission, and security model of ZION TerraNova."}
            </p>
          </div>
        </motion.section>

        {/* INFO CARDS */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Detaily" : "Details"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-purple-400" />
              {cs ? "Protokolové parametry" : "Protocol Parameters"}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((s) => (
              <div key={s.title} className="zion-rainbow-sub p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-3">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                  <h3 className="text-base font-semibold text-white">{s.title}</h3>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{s.content}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* DECADE TABLE */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="zion-section p-6 md:p-10">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Emise" : "Emission"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Flame className="h-7 w-7 text-zion-gold" />
              {cs ? "Decade Decay rozvrh" : "Decade Decay Schedule"}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6">
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3">{cs ? "Dekáda" : "Decade"}</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3">{cs ? "Odměna / blok" : "Reward / Block"}</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3">{cs ? "Bloků" : "Blocks"}</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3">{cs ? "Podíl" : "Share"}</th>
                </tr>
              </thead>
              <tbody>
                {decades.map((d) => (
                  <tr key={d.index} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                    <td className="px-6 py-3 text-white font-semibold">{d.index === 10 ? "Tail ∞" : `Decade ${d.index}`}</td>
                    <td className="px-3 py-3 text-zion-gold font-mono">{d.reward.toFixed(3)} ZION</td>
                    <td className="px-3 py-3 text-gray-400 font-mono">{d.blocks > 0 ? d.blocks.toLocaleString() : "∞"}</td>
                    <td className="px-6 py-3 text-right text-gray-400">{d.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {cs
            ? `ZION TerraNova — Konsensus · Protokolové parametry · V3 MainNet`
            : `ZION TerraNova — Consensus · Protocol parameters · V3 MainNet`}
        </p>
      </div>
    </div>
  );
}
