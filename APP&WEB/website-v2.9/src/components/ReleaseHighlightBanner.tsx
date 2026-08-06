'use client';

import { motion } from 'framer-motion';
import { Rocket, ArrowDownToLine, ArrowRight, ExternalLink, X, Cpu, Wallet, Zap, Monitor } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

const ReleaseHighlightBannerCopy = {
  dismiss: { cs: `Zavřít`, en: `Dismiss` },
  newRelease: { cs: `Nový release`, en: `New release` },
  zionV310ReleaseHub: { cs: `ZION v3.2.0 "One Love" — Mainnet Stable`, en: `ZION v3.2.0 "One Love" — Mainnet Stable` },
  oneClickGuiMining: { cs: `GUI těžba na jedno kliknutí`, en: `One-click GUI mining` },
  builtInWalletDashboard: { cs: `Vestavěná peněženka a dashboard`, en: `Built-in wallet & dashboard` },
  allPlatformsAvailable: { cs: `Linux + macOS + Windows`, en: `Linux + macOS + Windows` },
  boostStreams: { cs: `Boost Streams: GPU + CPU`, en: `Boost Streams: GPU + CPU` },
  autoGpuBackend: { cs: `Auto GPU backend`, en: `Auto GPU backend` },
  fourPlatforms: { cs: `4 platformy (Linux, macOS ARM/Intel, Windows)`, en: `4 platforms (Linux, macOS ARM/Intel, Windows)` },
  downloadDesktopApp: { cs: `Stáhnout Desktop App`, en: `Download Desktop App` },
  githubDesktopApp: { cs: `GitHub — Desktop App`, en: `GitHub — Desktop App` },
  githubTerminalMiner: { cs: `GitHub — Terminal Miner`, en: `GitHub — Terminal Miner` },
  allNews: { cs: `Všechny novinky`, en: `All news` },
};

const DISMISS_KEY = 'zion-release-310-hub-dismissed';
const RELEASE_TAG = 'v3.1.0-cli';
const RELEASE_DATE = '2026-08-03';
const GITHUB_DESKTOP_URL = 'https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-desktop';
const GITHUB_BOOST_URL = 'https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-cli';

export default function ReleaseHighlightBanner() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch { /* SSR or privacy mode */ }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  if (dismissed) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative z-10 mx-auto max-w-5xl px-4 py-10"
    >
      <div className="relative overflow-hidden rounded-3xl border border-zion-gold/30 bg-linear-to-br from-zion-purple/[0.10] via-zion-gold/[0.05] to-zion-cyan/[0.10] backdrop-blur-sm animate-rasta-pulse">
        <div className="absolute inset-0 pointer-events-none rasta-shimmer opacity-30" />

        {/* Top & bottom tri-color accent bars */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-zion-purple via-zion-gold to-zion-cyan pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-zion-cyan via-zion-gold to-zion-purple pointer-events-none" />

        {/* Decorative glow orbs */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-zion-purple/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-zion-cyan/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 p-6 sm:p-8">
          {/* Dismiss button */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 text-zion-gold/60 hover:text-zion-gold transition"
            aria-label={ReleaseHighlightBannerCopy.dismiss[cs ? 'cs' : 'en']}
          >
            <X className="h-4 w-4" />
          </button>

          {/* Meta row */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zion-purple/30 bg-zion-purple/10 px-3 py-1 text-[10px] font-semibold text-zion-purple uppercase tracking-wider">
              <Rocket className="h-3 w-3" />
              {ReleaseHighlightBannerCopy.newRelease[cs ? 'cs' : 'en']}
            </span>
            <span className="text-xs font-mono text-zion-gold/80">{RELEASE_TAG}</span>
            <span className="text-xs text-zion-gold/50">· {RELEASE_DATE}</span>
          </div>

          {/* Headline */}
          <h2 className="text-2xl sm:text-3xl font-bold leading-tight mb-3 text-zion-gold">
            <span className="text-gradient">
              {ReleaseHighlightBannerCopy.zionV310ReleaseHub[cs ? 'cs' : 'en']}
            </span>
          </h2>

          {/* Summary */}
          <p className="text-base text-zion-gold/80 leading-relaxed mb-5 max-w-3xl">
            {cs ? (
              <>
                ZION v3.2.0 &quot;One Love&quot; přináší Mainnet Stable: <strong className="text-zion-cyan font-semibold">Terminal Miner</strong> — one-click GPU auto-detect (CUDA → OpenCL → Metal → CPU) na <strong className="text-zion-cyan font-semibold">4 platformách</strong> (Linux, macOS Apple Silicon/Intel, Windows) — a <strong className="text-zion-cyan font-semibold">Desktop App</strong> — GUI aplikaci s vestavěným minerem, peněženkou a dashboardem v reálném čase. Desktop App dostupná pro <strong className="text-zion-cyan font-semibold">Linux, macOS a Windows</strong>.
              </>
            ) : (
              <>
                ZION v3.2.0 &quot;One Love&quot; brings Mainnet Stable: <strong className="text-zion-cyan font-semibold">Terminal Miner</strong> — one-click GPU auto-detect (CUDA → OpenCL → Metal → CPU) on <strong className="text-zion-cyan font-semibold">4 platforms</strong> (Linux, macOS Apple Silicon/Intel, Windows) — and <strong className="text-zion-cyan font-semibold">Desktop App</strong> — a GUI app with built-in miner, wallet, and real-time dashboard. Desktop App available for <strong className="text-zion-cyan font-semibold">Linux, macOS and Windows</strong>.
              </>
            )}
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zion-purple/20 bg-zion-purple/10 px-3 py-1 text-xs text-zion-purple">
              <Zap className="h-3 w-3 text-zion-purple" />
              {ReleaseHighlightBannerCopy.boostStreams[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zion-cyan/20 bg-zion-cyan/10 px-3 py-1 text-xs text-zion-cyan">
              <Monitor className="h-3 w-3 text-zion-cyan" />
              {ReleaseHighlightBannerCopy.oneClickGuiMining[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zion-gold/20 bg-zion-gold/10 px-3 py-1 text-xs text-zion-gold">
              <Wallet className="h-3 w-3 text-zion-gold" />
              {ReleaseHighlightBannerCopy.builtInWalletDashboard[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zion-purple/20 bg-zion-purple/10 px-3 py-1 text-xs text-zion-purple">
              <Cpu className="h-3 w-3 text-zion-purple" />
              {ReleaseHighlightBannerCopy.autoGpuBackend[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zion-cyan/20 bg-zion-cyan/10 px-3 py-1 text-xs text-zion-cyan">
              <Cpu className="h-3 w-3 text-zion-cyan" />
              {ReleaseHighlightBannerCopy.fourPlatforms[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zion-gold/20 bg-zion-gold/10 px-3 py-1 text-xs text-zion-gold">
              <Monitor className="h-3 w-3 text-zion-gold" />
              {ReleaseHighlightBannerCopy.allPlatformsAvailable[cs ? 'cs' : 'en']}
            </span>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/download"
              className="group zion-button-primary gap-2 text-sm"
            >
              <ArrowDownToLine className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              {ReleaseHighlightBannerCopy.downloadDesktopApp[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href={GITHUB_DESKTOP_URL}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-xl border border-zion-purple/30 bg-zion-purple/5 px-5 py-2.5 text-sm font-medium text-zion-purple/90 transition-all duration-200 hover:bg-zion-purple/10 hover:border-zion-purple/60 hover:text-zion-purple hover:shadow-[0_0_20px_rgba(228,30,43,0.25)]"
            >
              <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              {ReleaseHighlightBannerCopy.githubDesktopApp[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href={GITHUB_BOOST_URL}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-xl border border-zion-cyan/30 bg-zion-cyan/5 px-5 py-2.5 text-sm font-medium text-zion-cyan/90 transition-all duration-200 hover:bg-zion-cyan/10 hover:border-zion-cyan/60 hover:text-zion-cyan hover:shadow-[0_0_20px_rgba(7,137,48,0.25)]"
            >
              <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              {ReleaseHighlightBannerCopy.githubTerminalMiner[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href="/news"
              className="group inline-flex items-center gap-2 rounded-xl border border-zion-gold/30 bg-zion-gold/5 px-5 py-2.5 text-sm font-medium text-zion-gold/90 transition-all duration-200 hover:bg-zion-gold/10 hover:border-zion-gold/60 hover:text-zion-gold hover:shadow-[0_0_20px_rgba(252,209,22,0.25)]"
            >
              {ReleaseHighlightBannerCopy.allNews[cs ? 'cs' : 'en']}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
