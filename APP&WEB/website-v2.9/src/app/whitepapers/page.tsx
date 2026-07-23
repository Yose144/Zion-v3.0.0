'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookOpen,
  FileText,
  Scroll,
  Sparkles,
  ExternalLink,
  Download,
  Globe,
  ChevronRight,
  Shield,
  Cpu,
  Layers,
  Coins,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

interface Whitepaper {
  id: string;
  title: { cs: string; en: string };
  description: { cs: string; en: string };
  href: string;
  format: 'md' | 'pdf';
  external?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

interface Category {
  id: string;
  title: { cs: string; en: string };
  icon: React.ComponentType<{ className?: string }>;
  papers: Whitepaper[];
}

const pageCopy = {
  badge: { cs: 'Dokumentace', en: 'Documentation' },
  title: { cs: 'ZION Whitepapers', en: 'ZION Whitepapers' },
  subtitle: {
    cs: 'Oficiální dokumentace, technické specifikace a příběh projektu ZION TerraNova. Čti online, stahuj PDF a ověřuj fakta on-chain.',
    en: 'Official documentation, technical specifications, and the story of the ZION TerraNova project. Read online, download PDFs, and verify facts on-chain.',
  },
  download: { cs: 'Stáhnout PDF', en: 'Download PDF' },
  read: { cs: 'Číst online', en: 'Read online' },
  canonical: {
    cs: 'Veškerá fakta jsou veřejně ověřitelná: genesis hash, total supply 144B ZION, 89/5/5/1 block reward split a MIT-licencovaný zdrojový kód.',
    en: 'All facts are publicly verifiable: genesis hash, 144B ZION total supply, 89/5/5/1 block reward split, and MIT-licensed source code.',
  },
} as const;

const categories: Category[] = [
  {
    id: 'master',
    title: { cs: 'Master / Kanonická syntéza', en: 'Master / Canonical Synthesis' },
    icon: Sparkles,
    papers: [
      {
        id: 'master-cz',
        title: { cs: 'Zlatá kniha (CZ)', en: 'Golden Book (CZ)' },
        description: { cs: 'Kanonická syntéza všech čtyř knih pro Mainnet Alpha 3.1.', en: 'Canonical synthesis of all four books for Mainnet Alpha 3.1.' },
        href: '/docs/WP/ZION_MASTER_WHITEPAPER_3.1_CZ.md',
        format: 'md',
        icon: Scroll,
      },
      {
        id: 'master-en',
        title: { cs: 'Golden Book (EN)', en: 'Golden Book (EN)' },
        description: { cs: 'Anglický překlad Zlaté knihy.', en: 'English translation of the Golden Book.' },
        href: '/docs/WP/ZION_MASTER_WHITEPAPER_3.1_EN.md',
        format: 'md',
        icon: Scroll,
      },
    ],
  },
  {
    id: 'technical',
    title: { cs: 'Technické Whitepapery', en: 'Technical Whitepapers' },
    icon: Cpu,
    papers: [
      {
        id: 'technical-cz',
        title: { cs: 'Technický Whitepaper v3.1 (CZ)', en: 'Technical Whitepaper v3.1 (CZ)' },
        description: { cs: 'Konsensus, ekonomika, architektura a bezpečnost.', en: 'Consensus, economics, architecture, and security.' },
        href: '/docs/WP/ZION_Technical_Whitepaper_v3.1_CZ.md',
        format: 'md',
        icon: FileText,
      },
      {
        id: 'technical-en',
        title: { cs: 'Technical Whitepaper v3.1 (EN)', en: 'Technical Whitepaper v3.1 (EN)' },
        description: { cs: 'Anglický překlad technické reference.', en: 'English translation of the technical reference.' },
        href: '/docs/WP/ZION_Technical_Whitepaper_v3.1_EN.md',
        format: 'md',
        icon: FileText,
      },
    ],
  },
  {
    id: 'story',
    title: { cs: 'Příběh / Kronika', en: 'Story / Chronicle' },
    icon: BookOpen,
    papers: [
      {
        id: 'story6-cz',
        title: { cs: 'WpStory6 — Kronika v3.0.1 → v3.0.6 (CZ)', en: 'WpStory6 — Chronicle v3.0.1 → v3.0.6 (CZ)' },
        description: { cs: 'Růstová kronika od prvního genesis k Trinity.', en: 'Growth chronicle from first genesis to Trinity.' },
        href: '/docs/WP/WpStory6_CZ.md',
        format: 'md',
        icon: Globe,
      },
      {
        id: 'story6-en',
        title: { cs: 'WpStory6 — Chronicle v3.0.1 → v3.0.6 (EN)', en: 'WpStory6 — Chronicle v3.0.1 → v3.0.6 (EN)' },
        description: { cs: 'Anglická verze kroniky.', en: 'English version of the chronicle.' },
        href: '/docs/WP/WpStory6_EN.md',
        format: 'md',
        icon: Globe,
      },
    ],
  },
  {
    id: 'pdf',
    title: { cs: 'PDF ke stažení', en: 'PDF Downloads' },
    icon: Download,
    papers: [
      {
        id: 'genesis-cz',
        title: { cs: 'Kniha Zrození v3.0 (PDF, CZ)', en: 'Book of Genesis v3.0 (PDF, CZ)' },
        description: { cs: 'Původní příběh, šestifázový algoritmus, Zlaté vejce, šest vrstev.', en: 'Origin story, six-phase algorithm, Golden Egg, six layers.' },
        href: '/docs/WP/ZION_Kniha_Zrozeni_v3.0_CZ.pdf',
        format: 'pdf',
        icon: Download,
      },
      {
        id: 'genesis-en',
        title: { cs: 'Book of Genesis v3.0 (PDF, EN)', en: 'Book of Genesis v3.0 (PDF, EN)' },
        description: { cs: 'Anglický překlad Knihy Zrození.', en: 'English translation of the Book of Genesis.' },
        href: '/docs/WP/ZION_Book_of_Genesis_v3.0_EN.pdf',
        format: 'pdf',
        icon: Download,
      },
      {
        id: 'wplite-cz',
        title: { cs: 'WpLite — Báje pro dospělé (PDF, CZ)', en: 'WpLite — Fable Edition (PDF, CZ)' },
        description: { cs: 'Pohádka pro dospělé s ověřitelnými kronikálními záznamy.', en: 'A fairy tale for grown-ups with verifiable chronicle entries.' },
        href: '/docs/WP/Zion-WpLite_CZ.pdf',
        format: 'pdf',
        icon: Download,
      },
      {
        id: 'wplite-en',
        title: { cs: 'WpLite — Fable Edition (PDF, EN)', en: 'WpLite — Fable Edition (PDF, EN)' },
        description: { cs: 'Anglická verze bájí.', en: 'English fable edition.' },
        href: '/docs/WP/Zion-WpLite_EN.pdf',
        format: 'pdf',
        icon: Download,
      },
    ],
  },
];

const quickFacts = [
  { label: { cs: 'Genesishash', en: 'Genesis hash' }, value: '4f75a0df…79bd6e', full: '4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e' },
  { label: { cs: 'Total supply', en: 'Total supply' }, value: '144B ZION' },
  { label: { cs: 'Block split', en: 'Block split' }, value: '89/5/5/1' },
  { label: { cs: 'Licence', en: 'License' }, value: 'MIT' },
];

export default function WhitepapersPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <main className="relative z-10 min-h-screen pb-24 pt-24 sm:pt-28">
      {/* ambient gradients */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-violet-700/10 blur-3xl" />
        <div className="absolute top-40 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/8 blur-3xl" />
      </div>

      <div className="zion-container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-200 mb-6">
            <BookOpen className="h-4 w-4" />
            {pageCopy.badge[lang]}
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-gradient-soft mb-4">
            {pageCopy.title[lang]}
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {pageCopy.subtitle[lang]}
          </p>
        </motion.div>

        {/* quick facts */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14"
        >
          {quickFacts.map((fact, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm px-4 py-4 text-center"
            >
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{fact.label[lang]}</p>
              <p className="text-sm sm:text-base font-semibold text-white font-mono break-all">
                {fact.value}
              </p>
            </div>
          ))}
        </motion.div>

        {/* categories */}
        <div className="space-y-10">
          {categories.map((category, ci) => {
            const Icon = category.icon;
            return (
              <motion.section
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + ci * 0.1 }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="rounded-xl bg-violet-500/15 p-2.5 border border-violet-500/20">
                    <Icon className="h-5 w-5 text-violet-300" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">
                    {category.title[lang]}
                  </h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {category.papers.map((paper) => {
                    const PaperIcon = paper.icon;
                    const isPdf = paper.format === 'pdf';
                    return (
                      <a
                        key={paper.id}
                        href={paper.href}
                        target={isPdf ? '_blank' : undefined}
                        rel={isPdf ? 'noopener noreferrer' : undefined}
                        className="group relative flex flex-col rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm p-5 transition-all hover:border-violet-500/40 hover:bg-black/40"
                      >
                        <div className="flex items-start gap-4">
                          <div className="rounded-xl bg-white/5 p-2.5 border border-white/10 group-hover:border-violet-500/30 transition-colors">
                            <PaperIcon className="h-5 w-5 text-violet-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white leading-snug mb-1 flex items-center gap-2">
                              {paper.title[lang]}
                              {isPdf && <Download className="h-3.5 w-3.5 text-gray-400" />}
                            </h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                              {paper.description[lang]}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm text-violet-300 font-medium">
                          {isPdf ? pageCopy.download[lang] : pageCopy.read[lang]}
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              </motion.section>
            );
          })}
        </div>

        {/* footer canonical notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm p-6 text-center"
        >
          <p className="text-sm text-gray-400 leading-relaxed max-w-3xl mx-auto">
            {pageCopy.canonical[lang]}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              {cs ? 'Dokumentace' : 'Documentation'}
            </Link>
            <a
              href="https://github.com/Zion-TerraNova/v3-Mainnet/tree/main"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
