'use client';

import type { CSSProperties } from 'react';
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
import HolographicEarthLazy from './HolographicEarthLazy';
import MainnetCountdown from './MainnetCountdown';

const HeroCopy = {
  mainnetBetaGithub: { cs: `Mainnet Stable · GitHub`, en: `Mainnet Stable · GitHub` },
};

export default function Hero() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const heroMetrics = [
    { label: tr('hero', 'metric_loc', lang),   value: '52 590', icon: Zap },
    { label: tr('hero', 'metric_nodes', lang), value: '2 / 2',   icon: Satellite },
    { label: tr('hero', 'metric_tests', lang), value: '780+',    icon: Gauge },
  ];

  return (
    <section className="relative px-4 pt-16 pb-10 sm:pt-20 sm:pb-14 md:pt-24 md:pb-18 overflow-hidden">
      {/* ── rasta ambient orbs ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-48 -left-32 w-[560px] h-[560px] rounded-full bg-zion-purple/12 blur-3xl animate-bubble-drift" />
        <div className="absolute top-20 -right-40 w-[480px] h-[480px] rounded-full bg-zion-cyan/10 blur-3xl animate-bubble-drift" style={{ animationDelay: '-8s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-zion-gold/6 blur-3xl animate-bubble-drift" style={{ animationDelay: '-16s' }} />
      </div>

      <div className="zion-container relative z-10">
        {/* ─── top badge row ─── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap items-center gap-2 mb-8 justify-center lg:justify-start"
        >
          <div className="zion-kicker border-zion-gold/25 bg-zion-gold/10 text-zion-gold">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            {tr('hero', 'badge_version', lang)}
          </div>
          <div className="zion-kicker border-zion-purple/25 bg-zion-purple/10 text-zion-purple">
            <BrainCircuit className="w-3.5 h-3.5 animate-pulse" />
            {tr('hero', 'badge_chv4', lang)}
          </div>
          {/* GitHub — highlighted badge */}
          <a
            href="https://github.com/Zion-TerraNova/v3-Mainnet/tree/main"
            target="_blank"
            rel="noopener noreferrer"
            className="zion-kicker border-zion-gold/40 bg-zion-gold/10 text-zion-gold group"
          >
            <Github className="h-4 w-4 transition-transform group-hover:rotate-12" />
            {HeroCopy.mainnetBetaGithub[cs ? 'cs' : 'en']}
            <ExternalLink className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
          </a>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_0.85fr] gap-8 xl:gap-12 items-start">
          {/* ─── LEFT col ─── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85 }}
            className="space-y-6"
          >
            {/* headline */}
            <div>
              <p className="text-base md:text-lg text-zion-cyan font-semibold mb-3 tracking-wide flex items-center gap-2">
                <span className="w-8 h-[2px] bg-gradient-to-r from-zion-purple via-zion-gold to-zion-cyan rounded-full" />
                {tr('hero', 'tagline', lang)}
              </p>
              <h1 className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-extrabold leading-[1.05] tracking-tight">
                <span className="text-gradient">ZION</span>
                <span className="block text-white mt-2">Terra Nova</span>
                <span className="block text-lg sm:text-xl md:text-2xl xl:text-3xl font-semibold text-zion-gold/90 mt-3 tracking-normal">
                  {tr('hero', 'title_sub', lang)}
                </span>
              </h1>
            </div>

            {/* paragraph */}
            <p className="text-base md:text-lg text-gray-300 max-w-xl leading-relaxed">
              {tr('hero', 'description', lang)}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                href="/network"
                className="zion-button-primary group w-full sm:w-auto justify-center rasta-shimmer"
              >
                {tr('hero', 'btn_warp', lang)}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/docs"
                className="zion-button-secondary w-full sm:w-auto justify-center border-zion-gold/30 hover:border-zion-gold/60 hover:bg-zion-gold/10 hover:text-zion-gold transition-colors"
              >
                <ShieldHalf className="w-5 h-5 text-zion-purple" />
                {tr('hero', 'btn_guardian_docs', lang)}
              </Link>
              <Link
                href="/download"
                className="zion-button-secondary w-full sm:w-auto justify-center border-zion-cyan/30 hover:border-zion-cyan/60 hover:bg-zion-cyan/10 hover:text-zion-cyan transition-colors"
              >
                <CircuitBoard className="w-5 h-5 text-zion-cyan" />
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
                  className="zion-panel-soft zion-panel-hover group p-3 cursor-default min-w-0"
                  style={{ borderTop: '2px solid transparent', borderImage: `linear-gradient(90deg, ${['#e41e2b', '#fcd116', '#066928'][i]}, transparent) 1` } as CSSProperties}
                >
                  <metric.icon className="w-4 h-4 text-zion-gold mb-1.5" />
                  <div className="text-base sm:text-lg font-bold text-white truncate">{metric.value}</div>
                  <div className="text-[9px] uppercase tracking-wide text-zion-gold/70 mt-0.5 leading-tight">{metric.label}</div>
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
            <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-zion-purple/25 via-zion-cyan/15 to-transparent blur-3xl pointer-events-none" />

            <div className="mb-4 z-10 mx-auto flex w-full max-w-sm justify-center lg:mx-0 lg:max-w-md">
              <HolographicEarthLazy className="w-full shrink-0" />
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
