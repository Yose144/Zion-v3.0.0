'use client';

import { motion } from 'framer-motion';
import { BookOpen, FileText, Sparkles, ExternalLink, Scroll, Globe } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import Link from 'next/link';

const WhitepapersBannerCopy = {
  officialZionWhitepapers: { cs: `Oficiální Whitepapers ZION`, en: `Official ZION Whitepapers` },
  masterWhitepaperTechnicalWhite: { cs: `Master Whitepaper, Technical Whitepaper, Kniha Zrození a další. Čti, stahuj PDF a sdílej fundaci projektu.`, en: `Master Whitepaper, Technical Whitepaper, Book of Genesis and more. Read, download PDFs, and share the foundation of the project.` },
  exploreWhitepapers: { cs: `Prozkoumat Whitepapers`, en: `Explore Whitepapers` },
};

export default function WhitepapersBanner() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="relative z-20 mx-auto max-w-5xl px-4 -mt-2 mb-6"
    >
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-violet-500/[0.08] px-5 py-4 backdrop-blur-sm">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-violet-500/5 via-transparent to-cyan-500/5" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="rounded-full bg-violet-500/20 p-2 shrink-0">
              <Scroll className="h-5 w-5 text-violet-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-semibold text-violet-100 leading-snug">
                {WhitepapersBannerCopy.officialZionWhitepapers[cs ? 'cs' : 'en']}
              </p>
              <p className="text-xs sm:text-sm text-violet-200/80 leading-relaxed mt-0.5">
                {WhitepapersBannerCopy.masterWhitepaperTechnicalWhite[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>
          <Link
            href="/whitepapers"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors shrink-0"
          >
            <BookOpen className="h-4 w-4" />
            {WhitepapersBannerCopy.exploreWhitepapers[cs ? 'cs' : 'en']}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
