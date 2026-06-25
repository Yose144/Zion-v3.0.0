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
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

export default function HomeQuickLinks() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const links = [
    {
      href: '/explorer',
      label: cs ? 'Explorer' : 'Explorer',
      eyebrow: '01 / L1',
      desc: cs ? 'Bloky, transakce, adresy a hashrate v reálném čase.' : 'Blocks, transactions, addresses, and live hashrate.',
      icon: Blocks,
      accent: 'from-zion-gold/18 via-white/5 to-transparent',
      border: 'border-zion-gold/25',
    },
    {
      href: '/network',
      label: cs ? 'Síť' : 'Network',
      eyebrow: '02 / LIVE',
      desc: cs ? 'Uzly, latence, algoritmy a stav Core + Edge topologie.' : 'Nodes, latency, algorithms, and Core + Edge topology.',
      icon: Globe,
      accent: 'from-zion-cyan/18 via-white/5 to-transparent',
      border: 'border-zion-cyan/25',
    },
    {
      href: '/pool',
      label: cs ? 'Pool' : 'Pool',
      eyebrow: '03 / POW',
      desc: cs ? 'Hashrate, mineri, odměny a základní těžební přehled.' : 'Hashrate, miners, rewards, and mining overview.',
      icon: HardHat,
      accent: 'from-zion-purple/18 via-white/5 to-transparent',
      border: 'border-zion-purple/25',
    },
    {
      href: '/docs',
      label: cs ? 'Dokumentace' : 'Documentation',
      eyebrow: '04 / KNOW',
      desc: cs ? 'Guardian guide, API reference, runbooky a technické poznámky.' : 'Guardian guide, API reference, runbooks, and technical notes.',
      icon: ScrollText,
      accent: 'from-emerald-500/18 via-white/5 to-transparent',
      border: 'border-emerald-500/25',
    },
    {
      href: '/roadmap',
      label: cs ? 'Roadmapa' : 'Roadmap',
      eyebrow: '05 / PLAN',
      desc: cs ? 'L1-L6 vize, milníky a praktická časová osa.' : 'L1-L6 vision, milestones, and practical timeline.',
      icon: LayoutDashboard,
      accent: 'from-pink-500/18 via-white/5 to-transparent',
      border: 'border-pink-500/25',
    },
    {
      href: '/terranova',
      label: cs ? 'Terranova & Golden Egg' : 'Terranova & Golden Egg',
      eyebrow: '06 / STORY',
      desc: cs ? 'Kniha, hologram, ekonomika a veřejná vize Terra Nova.' : 'Book, hologram, economy, and Terra Nova public vision.',
      icon: Sparkles,
      accent: 'from-amber-500/18 via-white/5 to-transparent',
      border: 'border-amber-500/25',
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                className={`group relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl border ${link.border} bg-black/35 p-5 shadow-[0_16px_46px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-white/6 hover:shadow-[0_20px_58px_rgba(0,0,0,0.28)]`}
              >
                <div className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${link.accent} opacity-90`} />
                <div className="relative flex items-start justify-between gap-4">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">{link.eyebrow}</span>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8">
                    <link.icon className="h-5 w-5 text-white/85" />
                  </div>
                </div>
                <div className="relative mt-8 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold text-white">{link.label}</h3>
                    <ArrowRight className="h-5 w-5 shrink-0 text-white/40 transition-all group-hover:translate-x-1 group-hover:text-white/80" />
                  </div>
                  <p className="text-sm leading-relaxed text-gray-300">{link.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
