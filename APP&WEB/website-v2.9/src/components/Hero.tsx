'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  CircuitBoard,
  Gauge,
  Satellite,
  ShieldHalf,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { SITE_LAUNCH_DATE_DISPLAY } from '@/lib/site';
import CosmicFlowers from './CosmicFlowers';
import HolographicEarth from './HolographicEarth';

export default function Hero() {
  const { lang } = useLang();
  const heroMetrics = [
    { label: tr('hero', 'metric_loc', lang),   value: '52 590', icon: Zap },
    { label: tr('hero', 'metric_nodes', lang), value: '2 / 2',   icon: Satellite },
    { label: tr('hero', 'metric_tests', lang), value: '780+',    icon: Gauge },
  ];

  return (
    <section className="relative px-4 pt-24 pb-16 sm:pt-28 sm:pb-20 md:pt-32 md:pb-28 overflow-hidden">
      {/* ── ambient gradients ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-violet-700/12 blur-3xl" />
        <div className="absolute top-60 -right-32 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[400px] rounded-full bg-zion-gold/6 blur-3xl" />
      </div>

      {/* ── lightweight floral composition ── */}
      <CosmicFlowers className="z-0 hidden md:block" />

      <div className="zion-container relative z-10">
        {/* ─── top badge row ─── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap items-center gap-3 mb-12 justify-center lg:justify-start"
        >
          <div className="zion-kicker border-zion-gold/25 bg-zion-gold/10 text-zion-gold">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            {tr('hero', 'badge_version', lang)}
          </div>
          <div className="zion-kicker border-pink-500/25 bg-pink-500/10 text-pink-300">
            <BrainCircuit className="w-3.5 h-3.5 animate-pulse" />
            {tr('hero', 'badge_chv4', lang)}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-12 xl:gap-20 items-start">
          {/* ─── LEFT col ─── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85 }}
            className="space-y-8"
          >
            {/* headline */}
            <div>
              <p className="text-lg md:text-xl text-zion-cyan font-semibold mb-3 tracking-wide">
                {tr('hero', 'tagline', lang)}
              </p>
              <h1 className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-extrabold leading-[1.06] tracking-tight">
                <span className="text-gradient-soft">ZION</span>
                <span className="block text-white mt-1">Terra Nova</span>
                <span className="block text-xl sm:text-2xl md:text-3xl xl:text-4xl font-semibold text-white/60 mt-2 tracking-normal">
                  {tr('hero', 'title_sub', lang)}
                </span>
              </h1>
            </div>

            {/* paragraph */}
            <p className="text-lg md:text-xl text-gray-300 max-w-xl leading-relaxed">
              {tr('hero', 'description', lang)}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                href="/network"
                className="zion-button-primary group w-full sm:w-auto justify-center"
              >
                {tr('hero', 'btn_warp', lang)}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/docs"
                className="zion-button-secondary w-full sm:w-auto justify-center"
              >
                <ShieldHalf className="w-5 h-5 text-zion-cyan" />
                {tr('hero', 'btn_guardian_docs', lang)}
              </Link>
              <Link
                href="/download"
                className="zion-button-secondary hover:border-zion-gold/60 w-full sm:w-auto justify-center"
              >
                <CircuitBoard className="w-5 h-5 text-zion-gold" />
                {tr('hero', 'btn_native_miner', lang)}
              </Link>
            </div>

            {/* Release teaser card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="zion-panel-soft zion-panel-hover relative overflow-hidden border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-violet-500/8 to-transparent p-5"
            >
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-500/15 to-violet-600/10 blur-sm pointer-events-none" />
              <div className="relative flex items-start gap-4">
                <div className="flex-none w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <BrainCircuit className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">Launch Countdown — 31 December 2026</span>
                    <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                        T-{Math.ceil((new Date('2026-12-31').getTime() - Date.now()) / (1000*60*60*24))}d
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Network status, explorer, pool, downloads, and documentation — preparing for mainnet launch on {SITE_LAUNCH_DATE_DISPLAY}.
                      Core + Edge topology in testing, mining test active, bridge in preparation.
                  </p>
                </div>
                <a
                  href="#tree-of-life"
                  className="flex-none ml-auto text-xs text-emerald-300 hover:text-emerald-200 flex items-center gap-1 transition"
                >
                  {tr('hero', 'teaser_cta', lang)} <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>

            {/* metrics strip */}
            <div className="grid grid-cols-3 gap-3">
              {heroMetrics.map((metric, i) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                  className="zion-panel-soft zion-panel-hover group p-4 cursor-default"
                >
                  <metric.icon className="w-4 h-4 text-zion-gold mb-2" />
                  <div className="text-xl font-bold text-white">{metric.value}</div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mt-0.5">{metric.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ─── RIGHT col — Hiran / Hiranyagarbha ─── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25 }}
            className="relative"
          >
            {/* outer halo glow */}
            <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-violet-600/25 via-cyan-500/15 to-transparent blur-3xl pointer-events-none" />

            <div className="mb-4 z-10 mx-auto flex w-full max-w-sm justify-center lg:mx-0 lg:max-w-md">
              <HolographicEarth className="w-full shrink-0" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
