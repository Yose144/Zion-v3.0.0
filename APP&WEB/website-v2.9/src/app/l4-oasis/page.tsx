'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Gamepad2, Gem, Users, Zap, Sparkles, ArrowRight,
  CheckCircle2, Clock, Palette, Cpu, Globe2, BookOpen
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const getFeatures = (cs: boolean) => [
  {
    title: cs ? 'UE5 Metaverse' : 'UE5 Metaverse',
    desc: cs
      ? 'Unreal Engine 5 svět postavený na ZION — photorealistické prostředí, persistentní stav, on-chain inventory.'
      : 'Unreal Engine 5 world built on ZION — photorealistic environments, persistent state, on-chain inventory.',
    icon: Palette,
    color: 'text-orange-400',
  },
  {
    title: cs ? 'XP Ekonomie' : 'XP Economy',
    desc: cs
      ? 'Herní XP se převádí na ZION tokeny — skill-based mining, quest rewards, guild treasury.'
      : 'Game XP converts to ZION tokens — skill-based mining, quest rewards, guild treasury.',
    icon: Gem,
    color: 'text-yellow-400',
  },
  {
    title: cs ? 'On-Chain Inventory' : 'On-Chain Inventory',
    desc: cs
      ? 'Všechny herní předměty jsou NFT na ZION L1 — skutečné vlastnictví, obchodování na marketplace.'
      : 'All game items are NFTs on ZION L1 — true ownership, trading on marketplace.',
    icon: Cpu,
    color: 'text-cyan-400',
  },
  {
    title: cs ? 'Guild DAO' : 'Guild DAO',
    desc: cs
      ? 'Hráčské guildy jako DAO — společné treasury, hlasování o expanzi, territory claims.'
      : 'Player guilds as DAOs — shared treasury, expansion voting, territory claims.',
    icon: Users,
    color: 'text-purple-400',
  },
];

const getRoadmap = (cs: boolean) => [
  {
    phase: cs ? 'Alpha' : 'Alpha',
    period: '2027 Q3',
    status: 'planned',
    items: cs
      ? ['Základní UE5 svět', 'On-chain avatars', 'XP systém', 'Testovací síť']
      : ['Basic UE5 world', 'On-chain avatars', 'XP system', 'Test network'],
  },
  {
    phase: cs ? 'Beta' : 'Beta',
    period: '2028 Q2',
    status: 'planned',
    items: cs
      ? ['NFT inventory', 'Guild systém', 'PvE questy', 'ZION marketplace integrace']
      : ['NFT inventory', 'Guild system', 'PvE quests', 'ZION marketplace integration'],
  },
  {
    phase: cs ? 'Live' : 'Live',
    period: '2028 Q4',
    status: 'vision',
    items: cs
      ? ['Full economy', 'Cross-guild warfare', 'Land ownership', 'VR/AR podpora']
      : ['Full economy', 'Cross-guild warfare', 'Land ownership', 'VR/AR support'],
  },
];

export default function L4OasisPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const features = getFeatures(cs);
  const roadmap = getRoadmap(cs);

  return (
    <main className="min-h-screen bg-[#030408] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,165,0,0.12),transparent_60%)]" />
        <div className="zion-container relative pt-28 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-orange-300">
              <Gamepad2 className="h-3.5 w-3.5" />
              {cs ? 'L4 herní vrstva' : 'L4 Game Layer'}
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              <span className="bg-linear-to-r from-yellow-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                ZION Oasis
              </span>
            </h1>
            <p className="mt-5 text-lg text-gray-400 leading-relaxed">
              {cs
                ? 'Metaverse postavený na ZION blockchainu. UE5 svět s on-chain inventory, XP ekonomií a guild DAO.'
                : 'Metaverse built on the ZION blockchain. UE5 world with on-chain inventory, XP economy, and guild DAO.'}
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/roadmap"
                className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-transform hover:-translate-y-0.5"
              >
                {cs ? 'Celá roadmapa' : 'Full Roadmap'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="zion-container py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm"
            >
              <f.icon className={`h-8 w-8 ${f.color}`} />
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="border-t border-white/10">
        <div className="zion-container py-16">
          <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">
            {cs ? 'Vývojová cesta' : 'Development Path'}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {roadmap.map((phase, i) => (
              <motion.div
                key={phase.phase}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-lg font-bold">{phase.phase}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    phase.status === 'planned'
                      ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20'
                      : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                  }`}>
                    {phase.period}
                  </span>
                </div>
                <ul className="space-y-3">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      {phase.status === 'planned' ? (
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                      ) : (
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                      )}
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Links */}
      <section className="border-t border-white/10">
        <div className="zion-container py-12">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/l5-free-world"
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/10 transition-colors"
            >
              <Globe2 className="h-4 w-4" />
              {cs ? 'L5 Free World →' : 'L5 Free World →'}
            </Link>
            <Link
              href="/terranova"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              {cs ? 'TerraNova kniha' : 'TerraNova Book'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
