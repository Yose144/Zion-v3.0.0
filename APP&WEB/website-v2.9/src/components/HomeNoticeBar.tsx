'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, ArrowDownToLine, BookOpen, Compass, Rocket, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

const HomeNoticeBarCopy = {
  release: { cs: `v3.2.0 „One Love" — Mainnet Alpha`, en: `v3.2.0 "One Love" — Mainnet Alpha` },
  download: { cs: `Stáhnout`, en: `Download` },
  onboard: { cs: `Vstoupit na palubu`, en: `Come aboard` },
  whitepapers: { cs: `Whitepapers`, en: `Whitepapers` },
  launchPostponed: { cs: `Launch odložen — číst oznámení`, en: `Launch postponed — read notice` },
  dismiss: { cs: `Zavřit lištu`, en: `Dismiss bar` },
};

const DISMISS_KEY = 'zion-home-notice-bar-dismissed-v1';

export default function HomeNoticeBar() {
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
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="relative z-20 mx-auto max-w-5xl px-4 -mt-2 mb-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-zion-gold/25 bg-black/40 px-4 py-2.5 backdrop-blur-sm">
        <Link
          href="/download"
          className="inline-flex min-w-0 items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-3 py-1 text-xs font-semibold text-zion-gold transition-colors hover:bg-zion-gold/20 sm:text-sm"
        >
          <Rocket className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{HomeNoticeBarCopy.release[cs ? 'cs' : 'en']}</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/download"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-200 transition-colors hover:border-zion-cyan/40 hover:text-zion-cyan"
          >
            <ArrowDownToLine className="h-3 w-3" />
            {HomeNoticeBarCopy.download[cs ? 'cs' : 'en']}
          </Link>
          <Link
            href="/onboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-200 transition-colors hover:border-zion-cyan/40 hover:text-zion-cyan"
          >
            <Compass className="h-3 w-3" />
            {HomeNoticeBarCopy.onboard[cs ? 'cs' : 'en']}
          </Link>
          <Link
            href="/whitepapers"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-200 transition-colors hover:border-zion-purple/50 hover:text-zion-purple"
          >
            <BookOpen className="h-3 w-3" />
            {HomeNoticeBarCopy.whitepapers[cs ? 'cs' : 'en']}
          </Link>
        </div>

        <Link
          href="/news/launch-postponed"
          className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-amber-200/80 underline decoration-amber-200/30 underline-offset-2 transition-colors hover:text-amber-100"
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {HomeNoticeBarCopy.launchPostponed[cs ? 'cs' : 'en']}
        </Link>

        <button
          onClick={dismiss}
          className="shrink-0 text-zion-gold/50 transition hover:text-zion-gold"
          aria-label={HomeNoticeBarCopy.dismiss[cs ? 'cs' : 'en']}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
