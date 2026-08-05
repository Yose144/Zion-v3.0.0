'use client';

import { motion } from 'framer-motion';
import { Rocket, Download, ExternalLink } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const ReleaseBannerCopy = {
  zionV310TerminalMinerIsLive: { cs: `ZION v3.1.0 Terminal Miner je live`, en: `ZION v3.1.0 Terminal Miner is live` },
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
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-5 py-4 backdrop-blur-sm">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-emerald-500/5 via-transparent to-cyan-500/5" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="rounded-full bg-emerald-500/20 p-2 shrink-0">
              <Rocket className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-semibold text-emerald-100 leading-snug">
                {ReleaseBannerCopy.zionV310TerminalMinerIsLive[cs ? 'cs' : 'en']}
              </p>
              <p className="text-xs sm:text-sm text-emerald-200/80 leading-relaxed mt-0.5">
                {ReleaseBannerCopy.fourPlatformsAutoGpu[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>
          <a
            href="https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors shrink-0"
          >
            <Download className="h-4 w-4" />
            {ReleaseBannerCopy.downloadFromGithub[cs ? 'cs' : 'en']}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
