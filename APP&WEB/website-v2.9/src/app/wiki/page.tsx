'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  BookMarked, FileText, Globe, Sprout, TreeDeciduous, Waves
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const getSections = (cs: boolean) => [
  {
    href: '/terranova',
    icon: BookMarked,
    title: cs ? 'TerraNova' : 'TerraNova',
    desc: cs
      ? 'Kniha nové Země — 7 kapitol od Genesis po Zlatý Kompas. Kompletní filosofie a vize projektu ZION.'
      : 'The Book of the New Earth — 7 chapters from Genesis to Golden Compass. The complete philosophy and vision of the ZION project.',
  },
  {
    href: '/genesis',
    icon: Sprout,
    title: cs ? 'Genesis' : 'Genesis',
    desc: cs
      ? 'Specifikace genesis bloku, konfigurace fee split, premine adresy a parametry sítě.'
      : 'Genesis block specification, fee split configuration, premine addresses and network parameters.',
  },
  {
    href: '/docs',
    icon: FileText,
    title: cs ? 'Dokumentace' : 'Documentation',
    desc: cs
      ? 'Technická dokumentace, whitepaper, API reference, návody a FAQ.'
      : 'Technical documentation, whitepaper, API reference, guides and FAQ.',
  },
  {
    href: '/terranova/te-piko-ora',
    icon: Waves,
    title: 'Te Pīko Ora',
    desc: cs
      ? 'Rapa Nui — kulturní obnova, ochrana dědictví a L5 komunitní fond.'
      : 'Rapa Nui — cultural revival, heritage protection and L5 community fund.',
  },
];

export default function WikiPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const sections = getSections(cs);

  return (
    <main className="zion-page text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="zion-container relative pb-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-2xl text-center"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-zion-cyan">
              <Globe className="h-3.5 w-3.5" />
              {cs ? 'Znalostní báze' : 'Knowledge Base'}
            </div>
            <h1 className="text-gradient text-4xl font-bold tracking-tight sm:text-5xl">
              ZION Wiki
            </h1>
            <p className="mt-4 text-lg text-gray-400">
              {cs
                ? 'TerraNova, Genesis, dokumentace a další zdroje vědomí o projektu ZION.'
                : 'TerraNova, Genesis, documentation and other knowledge sources about the ZION project.'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Cards */}
      <section className="zion-container py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((s, i) => (
            <motion.div
              key={s.href}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                href={s.href}
                className="zion-rainbow-card group block h-full rounded-[32px] p-6"
                style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
              >
                <div className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-zion-gold to-amber-500 p-3 shadow-lg">
                  <s.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{s.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-zion-cyan opacity-70 group-hover:opacity-100 transition-opacity">
                  {cs ? 'Otevřít →' : 'Open →'}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="border-t border-white/10">
        <div className="zion-container py-12">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link
              href="/terranova"
              className="zion-rainbow-sub px-4 py-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
            >
              {cs ? 'TerraNova kniha' : 'TerraNova Book'}
            </Link>
            <Link
              href="/genesis"
              className="zion-rainbow-sub px-4 py-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
            >
              Genesis
            </Link>
            <Link
              href="/docs"
              className="zion-rainbow-sub px-4 py-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
            >
              {cs ? 'Dokumentace' : 'Documentation'}
            </Link>
            <Link
              href="/terranova/te-piko-ora"
              className="zion-rainbow-sub px-4 py-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
            >
              Te Pīko Ora
            </Link>
            <Link
              href="/terranova/dharma-temple"
              className="zion-rainbow-sub px-4 py-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
            >
              Dharma Temple
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
