'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  CircuitBoard,
  Gauge,
  Rocket,
  Satellite,
  ShieldHalf,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useObservatory } from '@/contexts/ObservatoryContext';
import type { ObservatoryMode } from '@/contexts/ObservatoryContext';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { SITE_ENVIRONMENT_LABEL, SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL, SITE_LAUNCH_DATE_DISPLAY } from '@/lib/site';
import CosmicFlowers from './CosmicFlowers';
import HolographicEarth from './HolographicEarth';
import HiranMiniChat from './HiranMiniChat';
import ZionTicker from './ZionTicker';

export default function Hero() {
  const { mode, setMode, availableModes } = useObservatory();
  const { lang } = useLang();
  const observatoryMeta: Record<ObservatoryMode, { label: string; description: string; signal: string; focus: string }> = {
    'deep-space': {
      label: tr('hero', 'mode_deep_space_label', lang),
      description: tr('hero', 'mode_deep_space_desc', lang),
      signal: tr('hero', 'mode_deep_space_signal', lang),
      focus: tr('hero', 'mode_deep_space_focus', lang),
    },
    'planet-orbit': {
      label: tr('hero', 'mode_planet_orbit_label', lang),
      description: tr('hero', 'mode_planet_orbit_desc', lang),
      signal: tr('hero', 'mode_planet_orbit_signal', lang),
      focus: tr('hero', 'mode_planet_orbit_focus', lang),
    },
    'galactic-core': {
      label: tr('hero', 'mode_galactic_core_label', lang),
      description: tr('hero', 'mode_galactic_core_desc', lang),
      signal: tr('hero', 'mode_galactic_core_signal', lang),
      focus: tr('hero', 'mode_galactic_core_focus', lang),
    },
  };
  const active = observatoryMeta[mode];

  const missionSignals = [
    { title: tr('hero', 'signal_l1', lang),      status: tr('hero', 'signal_status_l1', lang),      value: '52 590 LOC · 780+ tests · Rust', accent: 'text-emerald-300' },
    { title: tr('hero', 'signal_nodes', lang),   status: tr('hero', 'signal_status_nodes', lang),   value: 'Core + Edge topology',        accent: 'text-zion-cyan' },
    { title: tr('hero', 'signal_mainnet', lang), status: tr('hero', 'signal_status_mainnet', lang), value: tr('hero', 'signal_target', lang),  accent: 'text-zion-purple' },
  ];
  const heroMetrics = [
    { label: tr('hero', 'metric_loc', lang),   value: '52 590', icon: Zap },
    { label: tr('hero', 'metric_nodes', lang), value: '2 / 2',   icon: Satellite },
    { label: tr('hero', 'metric_tests', lang), value: '780+',    icon: Gauge },
  ];

  return (
    <section className="relative px-4 pt-24 sm:pt-32 pb-16 sm:pb-28 overflow-hidden">
      {/* ── ambient gradients ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 sm:-top-40 sm:-left-40 w-[350px] h-[350px] sm:w-[700px] sm:h-[700px] rounded-full bg-violet-700/12 blur-3xl" />
        <div className="absolute top-40 -right-10 sm:top-60 sm:-right-32 w-[250px] h-[250px] sm:w-[500px] sm:h-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-10 left-1/4 sm:bottom-0 sm:left-1/3 w-[300px] h-[200px] sm:w-[600px] sm:h-[400px] rounded-full bg-zion-gold/6 blur-3xl" />
      </div>

      {/* ── lightweight floral composition ── */}
      <CosmicFlowers className="z-0 hidden md:block" />

      <div className="zion-container relative z-10">
        {/* ─── top badge row ─── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap items-center gap-3 mb-8 sm:mb-12 justify-center lg:justify-start"
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

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 xl:gap-24 items-start">
          {/* ─── LEFT col ─── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85 }}
            className="space-y-8"
          >
            {/* headline */}
            <div>
              <p className="text-base sm:text-lg md:text-xl text-zion-cyan font-semibold mb-2 sm:mb-3 tracking-wide">
                {tr('hero', 'tagline', lang)}
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.06] tracking-tight">
                <span className="bg-gradient-to-r from-emerald-400 via-yellow-300 to-rose-400 bg-clip-text text-transparent">ZION Terra Nova</span>
                <span className="block text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-semibold text-white/60 mt-1 sm:mt-2 tracking-normal">
                  {tr('hero', 'title_sub', lang)}
                </span>
              </h1>
            </div>

            {/* paragraph */}
            <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-xl leading-relaxed">
              {tr('hero', 'description', lang)}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                href="/network"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3.5 font-bold text-white shadow-[0_18px_45px_rgba(16,185,129,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(16,185,129,0.45)] hover:saturate-[1.08]"
              >
                {tr('hero', 'btn_warp', lang)}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/docs"
                className="zion-button-secondary"
              >
                <ShieldHalf className="w-5 h-5 text-zion-cyan" />
                {tr('hero', 'btn_guardian_docs', lang)}
              </Link>
              <Link
                href="/download"
                className="zion-button-secondary hover:border-zion-gold/60"
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
              <div className="relative flex flex-col sm:flex-row items-start gap-4">
                <div className="flex-none w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <BrainCircuit className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-sm font-bold text-white">Bridge, Defi Run — 18 June 2026</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                </span>
                <span className="text-xs bg-zion-purple/20 text-zion-purple-300 px-2 py-0.5 rounded-full font-semibold">
                  v3.0.2
                </span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Bridge and DeFi protocols are now live on Base Mainnet. ZION L2 DeFi contracts deployed, wZION token trading, and atomic swap functionality active. Core + Edge topology running, mining active.
              </p>
              <a
                href="#tree-of-life"
                className="flex-none sm:ml-auto text-xs text-emerald-300 hover:text-emerald-200 flex items-center gap-1 transition"
              >
                {tr('hero', 'teaser_cta', lang)} <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </motion.div>

            {/* metrics strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

          {/* ─── RIGHT col — Observatory HUD ─── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25 }}
            className="relative hidden lg:block"
          >
            {/* outer halo glow */}
            <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-violet-600/25 via-cyan-500/15 to-transparent blur-3xl pointer-events-none" />

            <div className="mb-5 z-10 mx-auto flex w-full max-w-md justify-center lg:max-w-xl">
              <HolographicEarth className="w-full shrink-0" />
            </div>

            {/* ── Hiran v2.2 Mini Chat ── */}
            <div className="mb-4 z-10 mx-auto w-full max-w-md lg:max-w-xl px-2">
              <HiranMiniChat lang={lang} />
            </div>

            {/* ── L3 Hiran link ── */}
            <div className="mb-5 flex justify-center">
              <a
                href="https://www.zionterranova.com/l3-hiran"
                className="group inline-flex items-center gap-2 text-xs font-medium text-purple-300 hover:text-purple-200 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Full AI Layer — L3 Hiran v2.2</span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </a>
            </div>

            {/* ── Interactive Ticker ── */}
            <div className="mb-5 mx-auto w-full max-w-md lg:max-w-xl px-2">
              <ZionTicker />
            </div>

            <div className="zion-panel relative rounded-[28px] p-4 sm:p-6 space-y-5">
              {/* HUD header */}
              <header className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase text-gray-500 tracking-[0.3em] mb-1">{tr('hero', 'observatory_label', lang)}</p>
                  <h3 className="text-xl font-bold text-white">
                    {active.label}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">{tr('hero', 'observatory_focus_label', lang)}</p>
                  <p className="text-sm text-zion-cyan font-semibold">{active.focus}</p>
                </div>
              </header>

              {/* scanline */}
              <div className="zion-panel-soft rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{tr('hero', 'observatory_scan_label', lang)}</p>
                <p className="text-sm text-white">{active.signal}</p>
              </div>

              {/* mode buttons */}
              <div className="grid grid-cols-1 gap-2">
                {availableModes.map((availableMode) => (
                  <button
                    key={availableMode.id}
                    onClick={() => setMode(availableMode.id)}
                    className={`group flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                      mode === availableMode.id
                        ? 'border-zion-gold/45 bg-white/10 shadow-[0_10px_35px_rgba(249,217,118,0.12)]'
                        : 'border-white/8 hover:border-white/22 hover:bg-white/5'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            mode === availableMode.id ? 'bg-zion-gold animate-pulse' : 'bg-zion-cyan/50'
                          }`}
                        />
                        {observatoryMeta[availableMode.id].label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{observatoryMeta[availableMode.id].description}</p>
                    </div>
                    <ArrowRight
                      className={`w-4 h-4 transition-all ${
                        mode === availableMode.id ? 'text-zion-gold translate-x-0.5' : 'text-gray-600 group-hover:text-white'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* mission signals */}
              <div className="space-y-2">
                <p className="text-xs uppercase text-gray-600 tracking-[0.2em]">{tr('hero', 'section_signals', lang)}</p>
                {missionSignals.map((signal) => (
                  <div
                    key={signal.title}
                    className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{signal.title}</p>
                      <p className="text-xs text-gray-500">{signal.value}</p>
                    </div>
                    <span className={`text-xs font-semibold ${signal.accent}`}>{signal.status}</span>
                  </div>
                ))}
              </div>

              {/* version pill */}
              <div className="flex items-center gap-2 pt-1">
                <Rocket className="w-4 h-4 text-zion-gold" />
                <span className="text-xs text-gray-400">
                  {SITE_ENVIRONMENT_LABEL} · {SITE_RELEASE_LABEL} · runtime {SITE_RUNTIME_LABEL} · Bridge, Defi Run
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
