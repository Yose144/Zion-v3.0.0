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
      label: cs ? 'Blockchain Explorer' : 'Blockchain Explorer',
      desc: cs ? 'Bloky, transakce, adresy, hashrate v reálném čase' : 'Blocks, transactions, addresses, live hashrate',
      icon: Blocks,
      accent: 'from-zion-gold/25 to-zion-purple/10',
      border: 'border-zion-gold/25',
    },
    {
      href: '/network',
      label: cs ? 'Síťové Monitorování' : 'Network Monitoring',
      desc: cs ? 'Uzly, latence, algoritmy, live feed' : 'Nodes, latency, algorithms, live feed',
      icon: Globe,
      accent: 'from-zion-cyan/25 to-zion-gold/10',
      border: 'border-zion-cyan/25',
    },
    {
      href: '/pool',
      label: cs ? 'Mining Pool Dashboard' : 'Mining Pool Dashboard',
      desc: cs ? 'Hashrate, mineri, odměny, statistiky' : 'Hashrate, miners, rewards, stats',
      icon: HardHat,
      accent: 'from-zion-purple/25 to-zion-cyan/10',
      border: 'border-zion-purple/25',
    },
    {
      href: '/docs',
      label: cs ? 'Dokumentace' : 'Documentation',
      desc: cs ? 'Guardian guide, API reference, runbooky' : 'Guardian guide, API reference, runbooks',
      icon: ScrollText,
      accent: 'from-emerald-500/25 to-zion-gold/10',
      border: 'border-emerald-500/25',
    },
    {
      href: '/roadmap',
      label: cs ? 'Roadmapa' : 'Roadmap',
      desc: cs ? 'L1–L6 vize, milníky, časová osa' : 'L1–L6 vision, milestones, timeline',
      icon: LayoutDashboard,
      accent: 'from-pink-500/25 to-zion-purple/10',
      border: 'border-pink-500/25',
    },
    {
      href: '/terranova',
      label: cs ? 'Terranova & Golden Egg' : 'Terranova & Golden Egg',
      desc: cs ? 'Kniha, hologram, ekonomika, vize' : 'Book, hologram, economy, vision',
      icon: Sparkles,
      accent: 'from-amber-500/25 to-pink-500/10',
      border: 'border-amber-500/25',
    },
  ];

  return (
    <section className="py-16 px-4">
      <div className="zion-container space-y-10">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.4em] text-zion-gold">
            {cs ? 'Rychlé odkazy' : 'Quick Links'}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            {cs ? 'Prozkoumej ekosystém' : 'Explore the Ecosystem'}
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                className={`group block rounded-2xl border ${link.border} bg-gradient-to-br ${link.accent} p-5 hover:scale-[1.02] transition-transform`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <link.icon className="w-5 h-5 text-white/80" />
                      <span className="font-semibold text-white">{link.label}</span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{link.desc}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
