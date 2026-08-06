'use client';

import { motion } from 'framer-motion';
import { Rocket, ExternalLink } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import Link from 'next/link';

const OnboardBannerCopy = {
  title: { cs: 'Sůl této země — Vítej na palubě', en: 'Salt of the Earth — Welcome Aboard' },
  body: {
    cs: 'Síť je pořád malá a odměna za blok je dnes nejvyšší, jakou kdy bude. Přečti si proč — beze slibu ceny, jen s fakty.',
    en: 'The network is still small and today\u2019s block reward is the highest it will ever be. Read why — no price promises, just the facts.',
  },
  cta: { cs: 'Otevřít onboard', en: 'Open Onboarding' },
};

export default function OnboardBanner() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
      className="relative z-20 mx-auto max-w-5xl px-4 -mt-2 mb-6"
    >
      <div className="relative overflow-hidden rounded-2xl border border-zion-cyan/30 bg-zion-cyan/[0.08] px-5 py-4 backdrop-blur-sm">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-zion-cyan/5 via-transparent to-zion-cyan/5" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="rounded-full bg-zion-cyan/20 p-2 shrink-0">
              <Rocket className="h-5 w-5 text-zion-cyan" />
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-semibold text-emerald-100 leading-snug">
                {OnboardBannerCopy.title[cs ? 'cs' : 'en']}
              </p>
              <p className="text-xs sm:text-sm text-emerald-200/80 leading-relaxed mt-0.5">
                {OnboardBannerCopy.body[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>
          <Link
            href="/onboard#why-now"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zion-cyan/20 hover:bg-zion-cyan/30 border border-zion-cyan/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors shrink-0"
          >
            <Rocket className="h-4 w-4" />
            {OnboardBannerCopy.cta[cs ? 'cs' : 'en']}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
