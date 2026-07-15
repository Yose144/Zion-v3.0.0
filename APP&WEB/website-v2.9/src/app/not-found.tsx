'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, Orbit, Search, Rocket, ArrowRight } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

export default function NotFound() {
  const { lang } = useLang();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-32">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-2xl"
      >
        <div className="relative mx-auto mb-8 w-40 h-40">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zion-purple/40 via-zion-gold/20 to-zion-cyan/30 blur-3xl animate-pulse" />
          <div className="relative w-full h-full rounded-full border border-white/10 bg-black/60 backdrop-blur-xl flex items-center justify-center">
            <Orbit className="w-16 h-16 text-zion-gold/60" />
          </div>
        </div>

        <p className="text-sm uppercase tracking-[0.4em] text-gray-500 mb-3">{tr('notFound', 'eyebrow', lang)}</p>
        <h1 className="text-7xl md:text-8xl font-bold text-gradient mb-4">404</h1>
        <p className="text-xl text-gray-300 mb-2">{tr('notFound', 'title_hint', lang)}</p>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-10">{tr('notFound', 'description', lang)}</p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="zion-button-primary group text-sm"
            style={{ '--rc': '255, 215, 0' } as CSSProperties}
          >
            <Home className="w-4 h-4" />
            {tr('notFound', 'btn_home', lang)}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/dashboard"
            className="zion-button-secondary group text-sm"
            style={{ '--rc': '6, 182, 212' } as CSSProperties}
          >
            <Rocket className="w-4 h-4" />
            {tr('notFound', 'btn_dashboard', lang)}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/explorer"
            className="zion-button-secondary group text-sm"
            style={{ '--rc': '147, 51, 234' } as CSSProperties}
          >
            <Search className="w-4 h-4" />
            {tr('notFound', 'btn_explorer', lang)}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { labelKey: 'quick_roadmap' as const, href: '/roadmap' },
            { labelKey: 'quick_download' as const, href: '/download' },
            { labelKey: 'quick_docs' as const, href: '/docs' },
            { labelKey: 'quick_network' as const, href: '/network' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {tr('notFound', link.labelKey, lang)}
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
