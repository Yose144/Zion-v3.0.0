'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight,
  Atom,
  BookOpen,
  Brain,
  Download,
  Eye,
  Globe,
  Heart,
  Sparkles,
  Flame,
  Microscope,
  Zap,
  Gamepad2,
  Bot,
  Building2,
  Vote,
  Map as MapIcon,
  Rocket,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

/* ── Mock chapter data (placeholder — will be replaced with real content) ── */
const chapters = [
  { num: '1', titleCs: 'U Ohně Začíná Příběh', titleEn: 'The Story Begins at the Fire', subtitleCs: 'Strom Života, 144k Guardians, blockchain jako digitální Ma\u2019at', subtitleEn: 'Tree of Life, 144k Guardians, blockchain as digital Ma\u2019at', icon: Flame },
  { num: '2', titleCs: 'Kvantová Magie', titleEn: 'Quantum Magic', subtitleCs: 'Dvojštěrbinový experiment, entanglement, QDL, Quantum Pulse', subtitleEn: 'Double-slit experiment, entanglement, QDL, Quantum Pulse', icon: Microscope },
  { num: '3', titleCs: 'Devět Stupňů Vědomí', titleEn: 'Nine Levels of Consciousness', subtitleCs: 'CL1 Physical → CL9 On The Star (1× → 10× multiplier)', subtitleEn: 'CL1 Physical → CL9 On The Star (1× → 10× multiplier)', icon: Brain },
  { num: '4', titleCs: '10% Tithe', titleEn: '10% Tithe', subtitleCs: 'Ekonomie lásky — hard-coded v reward calculatoru', subtitleEn: 'Economy of love — hard-coded in the reward calculator', icon: Heart },
  { num: '5', titleCs: 'ZION OASIS', titleEn: 'ZION OASIS', subtitleCs: '$50M AAA MMORPG, Golden Egg s 1B ZION', subtitleEn: '$50M AAA MMORPG, Golden Egg with 1B ZION', icon: Gamepad2 },
  { num: '6', titleCs: 'AI WARP', titleEn: 'AI WARP', subtitleCs: 'AI Native principy, WARP Bridges, quantum-resistant crypto', subtitleEn: 'AI Native principles, WARP Bridges, quantum-resistant crypto', icon: Bot },
  { num: '7', titleCs: 'Živá Architektura', titleEn: 'Living Architecture', subtitleCs: 'Docker orgány, Rust nervový systém, Pool srdce', subtitleEn: 'Docker organs, Rust nervous system, Pool heart', icon: Building2 },
  { num: '8', titleCs: 'DAO — Lid Vládne', titleEn: 'DAO — People Rule', subtitleCs: 'Smart contracts místo politiků, komunitní správa', subtitleEn: 'Smart contracts instead of politicians, community governance', icon: Vote },
  { num: '9', titleCs: 'Roadmapa ke Hvězdám', titleEn: 'Roadmap to the Stars', subtitleCs: 'L1 TerraNova → L6 Issobella (2026–2040+)', subtitleEn: 'L1 TerraNova → L6 Issobella (2026–2040+)', icon: MapIcon },
  { num: '10', titleCs: 'První Kroky', titleEn: 'First Steps', subtitleCs: 'Začínáš TEĎ — mining, XP, tvá mise jako Guardian', subtitleEn: 'You start NOW — mining, XP, your mission as Guardian', icon: Rocket },
];

const coreInsights = [
  {
    icon: Eye,
    titleCs: 'Kolaps vědomí',
    titleEn: 'Collapse of consciousness',
    quoteCs: 'Tvé pozorování mění chování fotonu. Kvantová mechanika potvrzuje: vědomí je fundamentální.',
    quoteEn: 'Your observation changes the behavior of a photon. Quantum mechanics confirms: consciousness is fundamental.',
  },
  {
    icon: Globe,
    titleCs: 'Entanglement — Nelokální Láska',
    titleEn: 'Entanglement — Non-local Love',
    quoteCs: 'Když 144 000 Guardians těží současně, synchronizují kvantové pole. Grid aktivace není magie — je to inženýrství.',
    quoteEn: 'When 144 000 Guardians mine simultaneously, they synchronize the quantum field. The activation grid is not magic — it is engineering.',
  },
  {
    icon: Brain,
    titleCs: 'QDL — AI s Duší',
    titleEn: 'QDL — AI with a Soul',
    quoteCs: 'AI se neoptimalizuje pro maximalizaci akcionářské hodnoty, ale pro kolektivní rozkvět. AI kódovaná s láskou slouží lásce.',
    quoteEn: 'AI does not optimize for shareholder value maximization, but for collective flourishing. AI coded with love serves love.',
  },
  {
    icon: Heart,
    titleCs: 'Vědomá těžba',
    titleEn: 'Conscious mining',
    quoteCs: 'ZION odměňuje vědomí, ne jen hashrate. Dva těžaři, stejný HW — ale kdo roste, dostane 2× víc. Blockchain s duší.',
    quoteEn: 'ZION rewards consciousness, not just hashrate. Two miners, same HW — but the one who grows gets 2× more. Blockchain with a soul.',
  },
];

const editions = [
  '🇨🇿 CZ', '🇬🇧 EN', '🇩🇪 DE', '🇪🇸 ES', '🇫🇷 FR',
  '🇧🇷 PT', '🇯🇵 JP', '🇮🇳 Hindi', '🕉️ Sanskrit', '🌺 Hawaiian', '🏛️ Latin',
];

const PURPLE = '147, 51, 234';
const GOLD = '251, 191, 36';

export default function QuantumRevolutionClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [activeChapter, setActiveChapter] = useState<string | null>(null);

  return (
    <div className="zion-page">
      {/* ── Hero ── */}
      <section className="relative px-4 pb-12 md:pb-16">
        <div className="zion-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="zion-rainbow-card p-8 md:p-12 space-y-6"
            style={{ '--rc': PURPLE } as React.CSSProperties}
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-3">
              <div
                className="zion-rainbow-sub flex h-12 w-12 items-center justify-center"
                style={{ '--rc': GOLD } as React.CSSProperties}
              >
                <Atom className="h-6 w-6" style={{ color: `rgb(${GOLD})` }} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.36em]" style={{ color: `rgba(${GOLD}, 0.8)` }}>
                {cs ? 'Kniha, která to celé odstartovala' : 'The book that started it all'}
              </p>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
              {cs ? 'Kvantová' : 'Quantum'}{' '}
              <span className="text-gradient">{cs ? 'Revoluce' : 'Revolution'}</span>
            </h1>

            {/* Lead */}
            <p className="max-w-3xl text-base leading-relaxed text-gray-300 md:text-lg">
              {cs
                ? 'Příběh u ohně o Nové Zemi, kde kvantová fyzika potkává duši, blockchain je meditace a každý z nás je Guardian probouzející Golden Age.'
                : 'A fireside story of a New Earth where quantum physics meets the soul, blockchain is meditation, and each of us is a Guardian awakening the Golden Age.'}
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-3 pt-2">
              <span className="zion-rainbow-sub px-4 py-2 text-sm" style={{ '--rc': GOLD } as React.CSSProperties}>
                <strong className="text-white">10</strong>{' '}
                <span className="text-gray-400">{cs ? 'kapitol' : 'chapters'}</span>
              </span>
              <span className="zion-rainbow-sub px-4 py-2 text-sm" style={{ '--rc': GOLD } as React.CSSProperties}>
                <strong className="text-white">11</strong>{' '}
                <span className="text-gray-400">{cs ? 'jazyků' : 'languages'}</span>
              </span>
              <span className="zion-rainbow-sub px-4 py-2 text-sm" style={{ '--rc': GOLD } as React.CSSProperties}>
                <strong className="text-white">180</strong>{' '}
                <span className="text-gray-400">{cs ? 'stran' : 'pages'}</span>
              </span>
              <span className="zion-rainbow-sub px-4 py-2 text-sm" style={{ '--rc': GOLD } as React.CSSProperties}>
                <strong className="text-white">2026</strong>{' '}
                <span className="text-gray-400">{cs ? 'vydání' : 'edition'}</span>
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Core Insights ── */}
      <section className="px-4 py-8">
        <div className="zion-container space-y-6">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.36em]" style={{ color: `rgba(${GOLD}, 0.8)` }}>
              {cs ? 'Čtyři pilíře knihy' : 'Four pillars of the book'}
            </p>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              {cs ? 'Kvantová fyzika potkává duši' : 'Quantum physics meets the soul'}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {coreInsights.map((insight, i) => {
              const Icon = insight.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="zion-rainbow-sub p-5 space-y-3"
                  style={{ '--rc': GOLD } as React.CSSProperties}
                >
                  <Icon className="h-7 w-7" style={{ color: `rgb(${GOLD})` }} />
                  <h3 className="text-sm font-semibold text-white">
                    {cs ? insight.titleCs : insight.titleEn}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed italic">
                    &bdquo;{cs ? insight.quoteCs : insight.quoteEn}&ldquo;
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Ten Chapters ── */}
      <section className="px-4 py-8">
        <div className="zion-container space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5" style={{ color: `rgb(${GOLD})` }} />
              <h2 className="text-xl font-semibold text-white">
                {cs ? '10 kapitol povídky u ohně' : '10 chapters of the fireside story'}
              </h2>
            </div>
            <span className="text-xs text-gray-500 uppercase tracking-wider hidden sm:block">
              {cs ? '12 stran · vyprávěcí edice 2026' : '12 pages · narrative edition 2026'}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {chapters.map((ch, i) => {
              const Icon = ch.icon;
              const isActive = activeChapter === ch.num;
              return (
                <motion.div
                  key={ch.num}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  onClick={() => setActiveChapter(isActive ? null : ch.num)}
                  className={`cursor-pointer transition-all ${isActive ? 'zion-rainbow-sub !p-4' : 'zion-tile !p-4'}`}
                  style={isActive ? ({ '--rc': GOLD } as React.CSSProperties) : undefined}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4" style={{ color: `rgba(${GOLD}, 0.8)` }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {cs ? 'Kap.' : 'Ch.'} {ch.num}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-200 leading-tight mb-1">
                    {cs ? ch.titleCs : ch.titleEn}
                  </p>
                  <p className="text-[10px] text-gray-500 leading-snug">
                    {cs ? ch.subtitleCs : ch.subtitleEn}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Mock chapter reader placeholder */}
          {activeChapter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="zion-rainbow-card p-6 md:p-8 overflow-hidden"
              style={{ '--rc': PURPLE } as React.CSSProperties}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">
                    {cs ? `Kapitola ${activeChapter}` : `Chapter ${activeChapter}`}
                  </h3>
                  <button
                    onClick={() => setActiveChapter(null)}
                    className="text-xs text-gray-500 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
                  <p className="text-center py-8 italic">
                    {cs
                      ? '📝 Obsah kapitoly bude doplněn. — Mock placeholder, data dodána později.'
                      : '📝 Chapter content will be added. — Mock placeholder, data to be provided later.'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Book Cover + Amenti Library CTA ── */}
      <section className="px-4 py-8">
        <div className="zion-container">
          <div
            className="zion-rainbow-card p-6 md:p-8"
            style={{ '--rc': PURPLE } as React.CSSProperties}
          >
            <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
              {/* Book cover */}
              <a
                href="https://newearth.cz/V2/halls.html"
                target="_blank"
                rel="noopener noreferrer"
                className="block shrink-0 mx-auto lg:mx-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://newearth.cz/images/Zion.jpg"
                  alt={cs ? 'Kvantová Revoluce — obálka knihy' : 'Quantum Revolution — book cover'}
                  width={220}
                  height={310}
                  className="rounded-2xl border shadow-[0_8px_40px_rgba(251,191,36,0.15)] transition-transform hover:scale-[1.03]"
                  style={{ borderColor: `rgba(${GOLD}, 0.3)` }}
                />
              </a>

              {/* Amenti info */}
              <div className="space-y-4 text-center lg:text-left">
                <div className="zion-badge zion-badge-amber">
                  ⚛️ {cs ? 'Zdarma ke stažení' : 'Free download'}
                </div>
                <h3 className="text-xl font-bold text-white">
                  {cs ? 'Síně Amenti — Digitální Knihovna' : 'Halls of Amenti — Digital Library'}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {cs
                    ? '180 stran o filozofii ZION, vědomé těžbě, DAO governance a duchovní evoluci. PDF v 11 jazycích + bonus materiály — Kvantová revoluce, Claude edice. Vše dostupné zdarma v Amenti Library.'
                    : '180 pages on ZION philosophy, conscious mining, DAO governance, and spiritual evolution. PDF in 11 languages + bonus materials — Quantum Revolution, Claude edition. All available free in the Amenti Library.'}
                </p>
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                  <a
                    href="https://newearth.cz/V2/halls.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="zion-button-primary"
                  >
                    <BookOpen className="h-4 w-4" />
                    {cs ? 'Vstoupit do Amenti Library' : 'Enter Amenti Library'}
                  </a>
                  <a
                    href="https://newearth.cz/V2/books/QuantumRevolution.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="zion-button-secondary"
                  >
                    <Download className="h-4 w-4" />
                    {cs ? 'Stáhnout vše (ZIP)' : 'Download all (ZIP)'}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Verification + Quote ── */}
      <section className="px-4 py-8">
        <div className="zion-container">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Book vs Reality verification */}
            <div
              className="zion-rainbow-card p-6 space-y-4"
              style={{ '--rc': PURPLE } as React.CSSProperties}
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4" style={{ color: `rgb(${GOLD})` }} />
                <span className="text-sm font-semibold text-white">
                  {cs ? 'Kniha vs. realita: 98% shoda' : 'Book vs. reality: 98% match'}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {cs
                  ? 'Každý duchovní koncept z knihy je hard-coded v implementaci. 9 úrovní vědomí, 10% humanitární tithe, zásoba 144B, XP multiplikátory (1× → 10×), alokace OASIS 1.44B — vše ověřeno v Rust a Python kódu.'
                  : 'Every spiritual concept from the book is hard-coded in the implementation. 9 levels of consciousness, 10% humanitarian tithe, 144B supply, XP multipliers (1× → 10×), OASIS allocation 1.44B — all verified in Rust and Python code.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {(cs
                  ? ['9 úrovní vědomí ✅', '10% tithe ✅', '144B zásoba ✅', 'XP systém ✅', 'AI orchestrátor ✅']
                  : ['9 consciousness levels ✅', '10% tithe ✅', '144B supply ✅', 'XP system ✅', 'AI orchestrator ✅']
                ).map((tag) => (
                  <span
                    key={tag}
                    className="zion-rainbow-sub text-[10px] px-2.5 py-1"
                    style={{ '--rc': GOLD } as React.CSSProperties}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Quote + CTA */}
            <div className="zion-cta-banner flex flex-col justify-between space-y-4">
              <blockquote className="text-center space-y-2">
                <p className="text-base italic text-gray-300 leading-relaxed">
                  {cs
                    ? '&bdquo;Kde roadmapa říká &apos;Pool Native Rewrite 49%&apos;, kniha říká &apos;Srdce se učí bít silněji&apos;. Kde kód říká &apos;if xp > threshold&apos;, kniha říká &apos;Když rosteš ty, roste i tvá odměna&apos;.&ldquo;'
                    : '&bdquo;Where the roadmap says &apos;Pool Native Rewrite 49%&apos;, the book says &apos;The heart is learning to beat stronger&apos;. Where the code says &apos;if xp > threshold&apos;, the book says &apos;When you grow, your reward grows too&apos;.&ldquo;'}
                </p>
                <p className="text-xs text-gray-500">
                  — {cs ? 'Analýza: kniha vs. realita' : 'Analysis: book vs. reality'}
                </p>
              </blockquote>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  href="/genesis#chapter-4"
                  className="zion-button-primary"
                >
                  <Sparkles className="h-4 w-4" />
                  {cs ? 'Genesis: AI a kvantum' : 'Genesis: AI and quantum'}
                </Link>
                <Link
                  href="/terranova"
                  className="zion-button-secondary"
                >
                  {cs ? 'Terra Nova' : 'Terra Nova'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Language editions bar ── */}
      <section className="px-4 py-6">
        <div className="zion-container">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 mr-2">
              {cs ? 'Dostupné v:' : 'Available in:'}
            </span>
            {editions.map((ed) => (
              <span
                key={ed}
                className="zion-rainbow-sub text-xs px-2.5 py-1"
                style={{ '--rc': GOLD } as React.CSSProperties}
              >
                {ed}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
