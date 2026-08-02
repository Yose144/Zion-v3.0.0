'use client';

import { motion } from 'framer-motion';
import { Monitor, ArrowDownToLine, ArrowRight, ExternalLink, X, Cpu, Wallet, Activity, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

const ReleaseHighlightBannerCopy = {
  dismiss: { cs: `Zavřít`, en: `Dismiss` },
  newRelease: { cs: `Nový release`, en: `New release` },
  zionDesktopMinerV310: { cs: `ZION Desktop Miner v3.1.0`, en: `ZION Desktop Miner v3.1.0` },
  oneClickGuiMining: { cs: `GUI těžba na jedno kliknutí`, en: `One-click GUI mining` },
  builtInWalletDashboard: { cs: `Vestavěná peněženka a dashboard`, en: `Built-in wallet & dashboard` },
  linuxAvailable: { cs: `Linux (AppImage + DEB)`, en: `Linux (AppImage + DEB)` },
  boostStreams: { cs: `Boost Streams: GPU + CPU`, en: `Boost Streams: GPU + CPU` },
  windowsMacosComingSoon: { cs: `Windows & macOS brzy`, en: `Windows & macOS coming soon` },
  downloadDesktopMiner: { cs: `Stáhnout Desktop Miner`, en: `Download Desktop Miner` },
  githubRelease: { cs: `GitHub Release`, en: `GitHub Release` },
  allNews: { cs: `Všechny novinky`, en: `All news` },
};

const DISMISS_KEY = 'zion-release-310desktop-dismissed';
const RELEASE_TAG = 'v3.1.0-desktop';
const RELEASE_DATE = '2026-08-02';
const GITHUB_RELEASE_URL = 'https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-desktop';

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
      <div
        className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-linear-to-br from-emerald-500/[0.08] via-zion-gold/[0.04] to-transparent backdrop-blur-sm"
        style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
      >
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-emerald-400 via-zion-gold to-emerald-400" />

        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-zion-gold/10 blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8">
          {/* Dismiss button */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 text-gray-400/60 hover:text-gray-300 transition"
            aria-label={ReleaseHighlightBannerCopy.dismiss[cs ? 'cs' : 'en']}
          >
            <X className="h-4 w-4" />
          </button>

          {/* Meta row */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
              <Monitor className="h-3 w-3" />
              {ReleaseHighlightBannerCopy.newRelease[cs ? 'cs' : 'en']}
            </span>
            <span className="text-xs font-mono text-zion-gold/80">{RELEASE_TAG}</span>
            <span className="text-xs text-gray-500">· {RELEASE_DATE}</span>
          </div>

          {/* Headline */}
          <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3">
            <span className="text-gradient">
              {ReleaseHighlightBannerCopy.zionDesktopMinerV310[cs ? 'cs' : 'en']}
            </span>
          </h2>

          {/* Summary */}
          <p className="text-base text-gray-300 leading-relaxed mb-5 max-w-3xl">
            {cs ? (
              <>
                <strong className="text-white font-semibold">Desktop Miner v3.1.0</strong> s Boost Streams — GUI aplikace s vestavěným minerem, peněženkou a dashboardem v reálném čase. Tři streamy těží současně: ZION + GPU + CPU. <strong className="text-white font-semibold">Dostupný pro Linux</strong> (AppImage 131 MB + DEB 106 MB). Windows a macOS verze <strong className="text-zion-gold">připravujeme</strong>.
              </>
            ) : (
              <>
                <strong className="text-white font-semibold">Desktop Miner v3.1.0</strong> with Boost Streams — a GUI app with built-in miner, wallet, and real-time dashboard. Three streams mine simultaneously: ZION + GPU + CPU. <strong className="text-white font-semibold">Available for Linux</strong> (AppImage 131 MB + DEB 106 MB). Windows and macOS versions <strong className="text-zion-gold">coming soon</strong>.
              </>
            )}
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
              <Monitor className="h-3 w-3 text-emerald-400" />
              {ReleaseHighlightBannerCopy.oneClickGuiMining[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
              <Wallet className="h-3 w-3 text-zion-cyan" />
              {ReleaseHighlightBannerCopy.builtInWalletDashboard[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
              <Zap className="h-3 w-3 text-emerald-400" />
              {ReleaseHighlightBannerCopy.boostStreams[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              <Cpu className="h-3 w-3 text-emerald-400" />
              {ReleaseHighlightBannerCopy.linuxAvailable[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-500">
              <Activity className="h-3 w-3 text-gray-500" />
              {ReleaseHighlightBannerCopy.windowsMacosComingSoon[cs ? 'cs' : 'en']}
            </span>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/download"
              className="group inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 px-5 py-2.5 text-sm font-semibold text-emerald-100 transition-all duration-200 hover:bg-emerald-500/25 hover:border-emerald-300/60 hover:shadow-[0_0_24px_rgba(16,185,129,0.25)]"
            >
              <ArrowDownToLine className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              {ReleaseHighlightBannerCopy.downloadDesktopMiner[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href={GITHUB_RELEASE_URL}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-5 py-2.5 text-sm font-medium text-gray-200 transition-all duration-200 hover:bg-white/[0.08] hover:border-white/20 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              {ReleaseHighlightBannerCopy.githubRelease[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href="/news"
              className="group inline-flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-5 py-2.5 text-sm font-medium text-gray-200 transition-all duration-200 hover:bg-white/[0.08] hover:border-white/20 hover:text-white"
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
