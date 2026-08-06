'use client';

import { motion } from 'framer-motion';
import { Rocket, Download, ExternalLink } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const ReleaseBannerCopy = {
  zionV310TerminalMinerIsLive: { cs: `ZION v3.2.0 "One Love" — Mainnet Stable je live`, en: `ZION v3.2.0 "One Love" — Mainnet Stable is live` },
  fourPlatformsAutoGpu: { cs: `4 platformy: Linux, macOS (Apple Silicon + Intel), Windows. Auto GPU backend (CUDA + OpenCL + Metal). One-click GPU auto-detect.`, en: `4 platforms: Linux, macOS (Apple Silicon + Intel), Windows. Auto GPU backend (CUDA + OpenCL + Metal). One-click GPU auto-detect.` },
  downloadFromGithub: { cs: `Stáhnout z GitHub`, en: `Download from GitHub` },
};

export default function ReleaseBanner() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="relative z-20 mx-auto max-w-5xl px-4 -mt-4 mb-4"
    >
      <div className="relative overflow-hidden rounded-2xl border border-zion-gold/30 bg-zion-blue/50 px-5 py-4 backdrop-blur-sm animate-rasta-pulse group">
        <div className="absolute inset-0 pointer-events-none rasta-shimmer opacity-40" />
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-zion-purple via-zion-gold to-zion-cyan pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-linear-to-r from-zion-cyan via-zion-gold to-zion-purple pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="rounded-full bg-zion-gold/15 border border-zion-gold/40 p-2 shrink-0">
              <Rocket className="h-5 w-5 text-zion-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-semibold text-zion-gold leading-snug">
                {ReleaseBannerCopy.zionV310TerminalMinerIsLive[cs ? 'cs' : 'en']}
              </p>
              <p className="text-xs sm:text-sm text-zion-gold/70 leading-relaxed mt-0.5">
                {ReleaseBannerCopy.fourPlatformsAutoGpu[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>
          <a
            href="https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="zion-button-primary gap-2 text-sm shrink-0"
          >
            <Download className="h-4 w-4" />
            {ReleaseBannerCopy.downloadFromGithub[cs ? 'cs' : 'en']}
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
