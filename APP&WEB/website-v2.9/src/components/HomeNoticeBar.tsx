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
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-2xl border border-zion-gold/25 bg-black/50 px-4 pb-2.5 pt-3.5 backdrop-blur-sm">
        {/* ─── rasta top stripe ─── */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#e41e2b] via-[#fcd116] to-[#066928]" />
        {/* ─── rasta ambient glow ─── */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(228,30,43,0.10),transparent_42%),radial-gradient(ellipse_at_50%_0%,rgba(252,209,22,0.10),transparent_42%),radial-gradient(ellipse_at_100%_0%,rgba(6,105,40,0.14),transparent_46%)]" />

        {/* release pill — rasta ring */}
        <Link
          href="/download"
          className="group/release relative inline-flex min-w-0 shrink-0 items-center rounded-full bg-gradient-to-r from-[#e41e2b] via-[#fcd116] to-[#066928] p-[1.5px] shadow-[0_0_18px_rgba(252,209,22,0.20)] transition-shadow hover:shadow-[0_0_26px_rgba(252,209,22,0.4)]"
        >
          <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-black/85 px-3 py-1 text-xs font-semibold text-zion-gold sm:text-sm">
            <Rocket className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{HomeNoticeBarCopy.release[cs ? 'cs' : 'en']}</span>
          </span>
        </Link>

        <div className="relative flex items-center gap-2">
          {/* gold — Download */}
          <Link
            href="/download"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#fcd116] to-[#fbbf24] px-3 py-1 text-[11px] font-bold text-black shadow-[0_0_14px_rgba(252,209,22,0.30)] transition-all hover:shadow-[0_0_22px_rgba(252,209,22,0.5)] hover:brightness-110"
          >
            <ArrowDownToLine className="h-3 w-3" />
            {HomeNoticeBarCopy.download[cs ? 'cs' : 'en']}
          </Link>
          {/* rasta green — Onboard */}
          <Link
            href="/onboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#2ea44f]/60 bg-[#066928]/80 px-3 py-1 text-[11px] font-bold text-emerald-50 shadow-[0_0_14px_rgba(6,105,40,0.4)] transition-all hover:bg-[#0a8a36] hover:shadow-[0_0_22px_rgba(6,105,40,0.6)]"
          >
            <Compass className="h-3 w-3" />
            {HomeNoticeBarCopy.onboard[cs ? 'cs' : 'en']}
          </Link>
          {/* rasta red — Whitepapers */}
          <Link
            href="/whitepapers"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ff5560]/50 bg-[#e41e2b]/85 px-3 py-1 text-[11px] font-bold text-white shadow-[0_0_14px_rgba(228,30,43,0.4)] transition-all hover:bg-[#f03642] hover:shadow-[0_0_22px_rgba(228,30,43,0.6)]"
          >
            <BookOpen className="h-3 w-3" />
            {HomeNoticeBarCopy.whitepapers[cs ? 'cs' : 'en']}
          </Link>
        </div>

        <Link
          href="/news/launch-postponed"
          className="relative ml-auto inline-flex items-center gap-1.5 text-[11px] text-amber-200/80 underline decoration-amber-200/30 underline-offset-2 transition-colors hover:text-amber-100"
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {HomeNoticeBarCopy.launchPostponed[cs ? 'cs' : 'en']}
        </Link>

        <button
          onClick={dismiss}
          className="relative shrink-0 text-zion-gold/50 transition hover:text-zion-gold"
          aria-label={HomeNoticeBarCopy.dismiss[cs ? 'cs' : 'en']}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
