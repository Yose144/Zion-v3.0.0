"use client";

import { motion } from "framer-motion";
import { Zap, Rocket, Shield, Brain, Star, Infinity as InfinityIcon } from "lucide-react";

type Milestone = {
  version: string;
  codename: string;
  date: string;
  icon: "zap" | "rocket" | "shield" | "brain" | "star" | "infinity";
  color: string; // tailwind color base without shade, e.g., 'purple'
  accent: string; // gradient: from-*-500 to-*-500
  summary: string;
  highlight?: boolean; // visually emphasized
};

const ICONS = {
  zap: Zap,
  rocket: Rocket,
  shield: Shield,
  brain: Brain,
  star: Star,
  infinity: InfinityIcon,
};

const MILESTONES: Milestone[] = [
  {
    version: "v2.7.0",
    codename: "Genesis",
    date: "Apr 2024",
    icon: "star",
    color: "purple",
    accent: "from-zion-purple-500 to-zion-purple-500",
    summary: "4 ASIC‑resistant algos, DAO governance, 14.34B premine",
  },
  {
    version: "v2.7.1",
    codename: "Harmony",
    date: "May 2024",
    icon: "zap",
    color: "blue",
    accent: "from-zion-purple-500 to-zion-cyan-500",
    summary: "Cosmic Harmony algorithm, Zero‑Point Energy integration",
  },
  {
    version: "v2.7.5",
    codename: "Consciousness",
    date: "Aug 2024",
    icon: "brain",
    color: "cyan",
    accent: "from-zion-cyan-500 to-zion-cyan-500",
    summary: "KRISTUS Quantum Engine, AI Orchestrator v1.0",
  },
  {
    version: "v2.8.0",
    codename: "WARP POC",
    date: "Sep 2024",
    icon: "rocket",
    color: "yellow",
    accent: "from-zion-gold-500 to-zion-gold-500",
    summary: "WARP Engine POC via Ankr RPC (23 chains, <$300/mo)",
  },
  {
    version: "v2.8.1",
    codename: "Bridge",
    date: "Oct 2024",
    icon: "shield",
    color: "green",
    accent: "from-zion-cyan-500 to-zion-cyan-500",
    summary: "WARP Production (8+ chains, 50k+ users, ~$2M/month)",
  },
  {
    version: "v2.8.4",
    codename: "Mining",
    date: "Nov 2024",
    icon: "zap",
    color: "orange",
    accent: "from-zion-gold-500 to-zion-purple-500",
    summary: "Stratum v2, GPU optimization, pool infrastructure",
  },
  {
    version: "v2.8.5",
    codename: "Enterprise",
    date: "Dec 2024",
    icon: "shield",
    color: "pink",
    accent: "from-zion-purple-500 to-zion-purple-500",
    summary: "Database +75%, Docker −60%, prod hardening",
  },
  {
    version: "v2.8.9",
    codename: "Polish",
    date: "Jan 2025",
    icon: "star",
    color: "indigo",
    accent: "from-zion-purple-500 to-zion-purple-500",
    summary: "400+ tests, WebSocket API, 548k H/s native",
  },
  {
    version: "v2.9.0",
    codename: "Quantum Leap",
    date: "2026",
    icon: "infinity",
    color: "amber",
    accent: "from-zion-purple to-zion-gold",
    summary: "WARP 2, Security Hardening, AI Orchestrator v3.0 ($6.5M)",
    highlight: true,
  },
];

export default function HistoryLine() {
  return (
    <section aria-label="Historyline" className="relative">
      {/* Marker for verification in static HTML */}
      {/* HISTORYLINE_START */}
      <h2 className="text-3xl font-bold text-center mb-8 text-gradient">📜 Historyline</h2>
      <p className="text-center text-gray-400 mb-10 max-w-2xl mx-auto">
        Klíčové milníky ZION: Genesis → WARP Production → Quantum Leap
      </p>

      <div className="relative max-w-4xl mx-auto">
        {/* Vertical line */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-linear-to-b from-zion-gold/60 via-white/20 to-zion-purple/60" />

        <div className="space-y-8">
          {MILESTONES.map((m, idx) => {
            const Icon = ICONS[m.icon];
            const isLeft = idx % 2 === 0;
            return (
              <motion.div
                key={`${m.version}-${m.codename}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: 0.05 * idx }}
                className={`relative flex ${isLeft ? "justify-start" : "justify-end"}`}
              >
                {/* Node */}
                <div className="absolute left-1/2 -translate-x-1/2 -mt-1.5 w-3 h-3 rounded-full bg-zion-gold shadow-[0_0_12px_rgba(252,209,22,0.55)]" />

                {/* Card */}
                <div
                  className={`w-full md:w-[46%] ${
                    isLeft ? "pr-10 md:pr-0 md:mr-[54%]" : "pl-10 md:pl-0 md:ml-[54%]"
                  }`}
                >
                  <div
                    className={`group relative bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all ${
                      m.highlight ? "ring-2 ring-zion-gold/50" : ""
                    }`}
                  >
                    <div className={`absolute -top-4 ${isLeft ? "left-4" : "right-4"} w-12 h-12 rounded-xl bg-linear-to-br ${m.accent} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                          {m.version}
                        </div>
                        <h3 className="text-lg font-bold text-white">{m.codename}</h3>
                      </div>
                      <span className="text-xs text-gray-400">{m.date}</span>
                    </div>
                    <p className="text-sm text-gray-300 mt-2">{m.summary}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Key stats under the line */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ delay: 0.2 }}
        className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
          <div className="text-2xl font-bold text-zion-gold">16</div>
          <div className="text-xs text-gray-400 mt-1">Versions Released</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
          <div className="text-2xl font-bold text-zion-cyan">548k</div>
          <div className="text-xs text-gray-400 mt-1">H/s Performance</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
          <div className="text-2xl font-bold text-zion-cyan-400">50k+</div>
          <div className="text-xs text-gray-400 mt-1">WARP Users</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
          <div className="text-2xl font-bold text-zion-purple-400">$2M</div>
          <div className="text-xs text-gray-400 mt-1">Monthly Volume</div>
        </div>
      </motion.div>

      {/* HISTORYLINE_END */}
    </section>
  );
}
