'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Blocks,
  Globe,
  HardHat,
  LayoutDashboard,
  ScrollText,
  Sparkles,
  Swords,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

export default function HomeQuickLinks() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const links = [
    {
      href: '/explorer',
      label: cs ? 'Explorer' : 'Explorer',
      desc: cs ? 'Bloky, tx, adresy' : 'Blocks, tx, addresses',
      icon: Blocks,
      rc: '251, 191, 36', // gold
    },
    {
      href: '/network',
      label: cs ? 'Síť' : 'Network',
      desc: cs ? 'Uzly, latence' : 'Nodes, latency',
      icon: Globe,
      rc: '6, 182, 212', // cyan
    },
    {
      href: '/pool',
      label: cs ? 'Pool' : 'Pool',
      desc: cs ? 'Hashrate, mineri' : 'Hashrate, miners',
      icon: HardHat,
      rc: '147, 51, 234', // purple
    },
    {
      href: '/docs',
      label: cs ? 'Dokumentace' : 'Docs',
      desc: cs ? 'Guides, API' : 'Guides, API',
      icon: ScrollText,
      rc: '16, 185, 129', // emerald
    },
    {
      href: '/roadmap',
      label: cs ? 'Roadmapa' : 'Roadmap',
      desc: cs ? 'L1-L6 vize' : 'L1-L6 vision',
      icon: LayoutDashboard,
      rc: '236, 72, 153', // pink
    },
    {
      href: '/terranova',
      label: cs ? 'Terra Nova' : 'Terra Nova',
      desc: cs ? 'Kniha, příběh' : 'Book, story',
      icon: Sparkles,
      rc: '245, 158, 11', // amber
    },
  ];

  return (
    <section className="px-4 py-14 sm:py-16">
      <div className="zion-container space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-gold">
              {cs ? 'Šest vstupů' : 'Six Gateways'}
            </p>
            <h2 className="max-w-2xl text-3xl font-bold leading-tight text-white sm:text-4xl">
              {cs ? 'Homepage jako přehledný řídicí panel' : 'Homepage as a clean control panel'}
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-gray-300 sm:text-base">
            {cs
              ? 'Méně šumu, jasné směry: síť, těžba, dokumentace, plán a příběh Terra Nova.'
              : 'Less noise, clearer direction: network, mining, documentation, roadmap, and the Terra Nova story.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {links.map((link, i) => (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <Link
                href={link.href}
                className="zion-rainbow-sub group relative flex flex-col items-center gap-3 overflow-hidden p-4 text-center"
                style={{ '--rc': link.rc } as React.CSSProperties}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-110"
                  style={{
                    borderColor: `rgba(${link.rc}, 0.4)`,
                    backgroundColor: `rgba(${link.rc}, 0.12)`,
                  }}
                >
                  <link.icon className="h-6 w-6" style={{ color: `rgb(${link.rc})` }} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">{link.label}</h3>
                  <p className="text-[11px] leading-tight text-gray-400">{link.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-all group-hover:translate-x-1 group-hover:text-white/70" />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Doge vs ZION — special card below the 6 gateways */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.42 }}
        >
          <Link
            href="/doge-vs-zion"
            className="zion-rainbow-sub group relative flex items-center gap-4 overflow-hidden p-5"
            style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-110"
              style={{
                borderColor: 'rgba(245, 158, 11, 0.4)',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
              }}
            >
              <Swords className="h-6 w-6 text-amber-400" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Doge vs ZION</h3>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                  {cs ? 'ARKÁDA' : 'ARCADE'}
                </span>
              </div>
              <p className="text-[11px] leading-tight text-gray-400">
                {cs ? 'Když Dogecoin stál $0.0002 — 5 her, showdown, stargate' : 'When Dogecoin was $0.0002 — 5 games, showdown, stargate'}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-all group-hover:translate-x-1 group-hover:text-white/70" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
