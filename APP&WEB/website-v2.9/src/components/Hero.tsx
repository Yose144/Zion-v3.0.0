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
  AlertTriangle,
  Github,
  ExternalLink,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import CosmicFlowers from './CosmicFlowers';
import HolographicEarth from './HolographicEarth';
import MainnetCountdown from './MainnetCountdown';

export default function Hero() {
  const { lang } = useLang();
  const cs = lang === 'cs';
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
          {/* GitHub — highlighted badge */}
          <a
            href="https://github.com/Zion-TerraNova/v3-Mainnet/tree/main"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-linear-to-r from-zion-gold/15 via-amber-500/10 to-zion-gold/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-zion-gold shadow-[0_0_20px_rgba(251,191,36,0.2)] hover:shadow-[0_0_28px_rgba(251,191,36,0.4)] hover:border-zion-gold/60 transition-all"
          >
            <Github className="h-4 w-4 transition-transform group-hover:rotate-12" />
            {cs ? 'Mainnet Beta · GitHub' : 'Mainnet Beta · GitHub'}
            <ExternalLink className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
          </a>
        </motion.div>

        {/* ─── Work in Progress warning ─── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-10 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <p className="text-xs leading-relaxed text-amber-200/80">
              {cs
                ? 'Tento projekt je v neustálém vývoji. Všechny funkce, vizualizace a koncepty se mohou kdykoli změnit. Síť běží v Mainnet Beta — těžba a používání na vlastní riziko. Nic zde není investiční doporučení.'
                : 'This project is under constant development. All features, visualizations, and concepts may change at any time. The network runs in Mainnet Beta — mining and usage at your own risk. Nothing here is investment advice.'}
            </p>
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

          {/* ─── RIGHT col — HolographicEarth + Launch Countdown ─── */}
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

            {/* Mainnet Countdown panel — sized to match HolographicEarth */}
            <div className="mx-auto w-full max-w-sm lg:mx-0 lg:max-w-md">
              <MainnetCountdown embedded />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
