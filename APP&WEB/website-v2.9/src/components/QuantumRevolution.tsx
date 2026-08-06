import type { CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Atom, BookOpen, Brain, Cpu, Download, Eye, Globe, Heart, Sparkles, Zap } from 'lucide-react';

/* ── Original book chapter map ── */
const chapters = [
  { num: '1', title: 'U Ohně Začíná Příběh', subtitle: 'Strom Života, 144k Guardians, blockchain jako digitální Ma\u2019at', icon: '🔥' },
  { num: '2', title: 'Kvantová Magie', subtitle: 'Dvouštěrbinový experiment, entanglement, QDL, Quantum Pulse', icon: '🔬' },
  { num: '3', title: 'Devět Stupňů Vědomí', subtitle: 'CL1 Physical → CL9 On The Star (1× → 10× multiplier)', icon: '🧘' },
  { num: '4', title: '10% Tithe', subtitle: 'Ekonomie lásky — hard-coded v reward calculatoru', icon: '💚' },
  { num: '5', title: 'ZION OASIS', subtitle: '$50M AAA MMORPG, Golden Egg s 1B ZION', icon: '🎮' },
  { num: '6', title: 'AI WARP', subtitle: 'AI Native principy, WARP Bridges, quantum-resistant crypto', icon: '🤖' },
  { num: '7', title: 'Živá Architektura', subtitle: 'Docker orgány, Rust nervový systém, Pool srdce', icon: '🏗️' },
  { num: '8', title: 'DAO — Lid Vládne', subtitle: 'Smart contracts místo politiků, komunitní správa', icon: '🗳️' },
  { num: '9', title: 'Roadmapa ke Hvězdám', subtitle: 'L1 TerraNova → L6 Issobella (2026–2040+)', icon: '🗺️' },
  { num: '10', title: 'První Kroky', subtitle: 'Začínáš TEĎ — mining, XP, tvá mise jako Guardian', icon: '🚀' },
];

const coreInsights = [
  {
    icon: Eye,
    title: 'Kolaps vědomí',
    quote: 'Tvé pozorování mění chování fotonu. Kvantová mechanika potvrzuje: vědomí je fundamentální.',
    color: 'text-zion-purple-400',
    border: 'border-zion-purple-400/20',
    bg: 'bg-zion-purple-400/5',
  },
  {
    icon: Globe,
    title: 'Entanglement — Nelokální Láska',
    quote: 'Když 144 000 Guardians těží současně, synchronizují kvantové pole. Grid aktivace není magie — je to inženýrství.',
    color: 'text-zion-cyan',
    border: 'border-zion-cyan/20',
    bg: 'bg-zion-cyan/5',
  },
  {
    icon: Brain,
    title: 'QDL — AI s Duší',
    quote: 'AI se neoptimalizuje pro maximalizaci akcionářské hodnoty, ale pro kolektivní rozkvět. AI kódovaná s láskou slouží lásce.',
    color: 'text-zion-gold',
    border: 'border-zion-gold/20',
    bg: 'bg-zion-gold/5',
  },
  {
    icon: Heart,
    title: 'Vědomá těžba',
    quote: 'ZION odměňuje vědomí, ne jen hashrate. Dva těžaři, stejný HW — ale kdo roste, dostane 2× víc. Blockchain s duší.',
    color: 'text-zion-cyan-400',
    border: 'border-zion-cyan-400/20',
    bg: 'bg-zion-cyan-400/5',
  },
];

const editions = ['🇨🇿 CZ', '🇬🇧 EN', '🇩🇪 DE', '🇪🇸 ES', '🇫🇷 FR', '🇧🇷 PT', '🇯🇵 JP', '🇮🇳 Hindi', '🕉️ Sanskrit', '🌺 Hawaiian', '🏛️ Latin'];

export default function QuantumRevolution() {
  return (
    <section id="quantum-revolution" className="px-4 py-16 md:py-20 scroll-mt-28">
      <div className="zion-container space-y-8">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-purple">
              Kniha, která to celé odstartovala
            </p>
            <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
              Kvantová <span className="text-gradient">Revoluce</span>
            </h2>
            <p className="max-w-3xl text-base leading-relaxed text-gray-300 md:text-lg">
              Příběh u ohně o Nové Zemi, kde kvantová fyzika potkává duši,
              blockchain je meditace a každý z nás je Guardian probouzející Golden Age.
            </p>
          </div>
          <div className="rounded-2xl border border-zion-purple/20 bg-zion-purple/6 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-zion-purple/70">Vstup do světa</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              Publikováno v {editions.length} jazycích. Tahle sekce má na homepage vysvětlit duchovní a filozofický základ stejně čitelně, jako Terra Nova vysvětluje síť a Hiran AI vrstvu.
            </p>
          </div>
        </div>

        {/* Core Insights from the Book */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {coreInsights.map((insight) => {
            const Icon = insight.icon;
            return (
              <div
                key={insight.title}
                className={`zion-rainbow-sub p-5 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-lg`}
                style={{ '--rc': '217, 70, 239' } as React.CSSProperties}
              >
                <Icon className={`h-7 w-7 ${insight.color} mb-3`} />
                <h3 className="text-sm font-semibold text-white mb-2">{insight.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed italic">&bdquo;{insight.quote}&ldquo;</p>
              </div>
            );
          })}
        </div>

        {/* Ten Chapters */}
        <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-zion-purple/40 to-transparent" />

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-zion-gold" />
                <h3 className="text-lg font-semibold text-white">10 kapitol povídky u ohně</h3>
              </div>
              <span className="text-xs text-gray-500 uppercase tracking-wider hidden sm:block">12 stran · vyprávěcí edice 2026</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {chapters.map((ch) => (
                <div key={ch.num} className="rounded-xl border border-white/8 bg-white/3 p-3 transition-all hover:border-zion-gold/25 hover:bg-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{ch.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Kap. {ch.num}</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-200 leading-tight mb-0.5">{ch.title}</p>
                  <p className="text-[10px] text-gray-500 leading-snug">{ch.subtitle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Book Cover + Amenti Library CTA */}
        <div className="relative overflow-hidden rounded-3xl border border-zion-gold/20 bg-[radial-gradient(circle_at_30%_20%,rgba(252, 209, 22,0.08),transparent_50%)] p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
            {/* Book cover */}
            <a
              href="https://newearth.cz/V2/halls.html"
              target="_blank"
              rel="noopener noreferrer"
              className="block shrink-0 mx-auto lg:mx-0"
            >
                <Image
                src="https://newearth.cz/images/Zion.jpg"
                alt="Kvantová Revoluce — obálka knihy"
                width={220}
                height={310}
                sizes="220px"
                className="rounded-2xl border border-zion-gold/30 shadow-[0_8px_40px_rgba(252, 209, 22,0.15)] transition-transform hover:scale-[1.03]"
                loading="lazy"
              />
            </a>
            {/* Amenti info */}
            <div className="space-y-4 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/5 px-3 py-1.5 text-xs uppercase tracking-[0.3em]">
                <span className="text-zion-gold font-semibold">⚛️ Zdarma ke stažení</span>
              </div>
              <h3 className="text-xl font-bold text-white">Síně Amenti — Digitální Knihovna</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                180 stran o filozofii ZION, vědomé těžbě, DAO governance a duchovní evoluci.
                PDF v 11 jazycích + bonus materiály &mdash; Kvantová revoluce, Claude edice.
                Vše dostupné zdarma v Amenti Library.
              </p>
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <a
                  href="https://newearth.cz/V2/halls.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-primary group text-sm"
                  style={{ '--rc': '252, 209, 22' } as CSSProperties}
                >
                  <BookOpen className="h-4 w-4" />
                  Vstoupit do Amenti Library
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a
                  href="https://newearth.cz/V2/books/QuantumRevolution.zip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-secondary text-sm"
                >
                  <Download className="h-4 w-4" />
                  Stáhnout vše (ZIP)
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Verification + Quote + CTA */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Book vs Reality verification */}
          <div className="rounded-2xl border border-zion-cyan-400/20 bg-zion-cyan-400/5 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="h-4 w-4 text-zion-cyan-400" />
              <span className="text-sm font-semibold text-white">Kniha vs. realita: 98% shoda</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Každý duchovní koncept z knihy je hard-coded v implementaci. 9 úrovní vědomí,
              10% humanitární tithe, zásoba 144B, XP multiplikátory (1× → 10×), alokace OASIS 1.44B
              — vše ověřeno v Rust a Python kódu.
            </p>
            <div className="flex flex-wrap gap-2">
              {['9 úrovní vědomí ✅', '10% tithe ✅', '144B zásoba ✅', 'XP systém ✅', 'AI orchestrátor ✅'].map((tag) => (
                <span key={tag} className="text-[10px] bg-zion-cyan-400/10 text-zion-cyan-300 rounded-full px-2.5 py-1 border border-zion-cyan-400/20">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Quote + CTA */}
          <div className="rounded-2xl border border-zion-purple/20 bg-zion-purple/5 p-6 flex flex-col justify-between space-y-4">
            <blockquote className="text-center space-y-2">
              <p className="text-base italic text-gray-300 leading-relaxed">
                &bdquo;Kde roadmapa říká &apos;Pool Native Rewrite 49%&apos;,
                kniha říká &apos;Srdce se učí bít silněji&apos;.
                Kde kód říká &apos;if xp &gt; threshold&apos;,
                kniha říká &apos;Když rosteš ty, roste i tvá odměna&apos;.&ldquo;
              </p>
              <p className="text-xs text-gray-500">— Analýza: kniha vs. realita</p>
            </blockquote>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/genesis#chapter-4"
                className="zion-button-primary group text-sm"
                style={{ '--rc': '228, 30, 43' } as CSSProperties}
              >
                <Sparkles className="h-4 w-4" />
                Genesis: AI a kvantum
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="https://newearth.cz/V2/halls.html"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary group text-sm"
              >
                <Download className="h-4 w-4" />
                Amenti Library
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Language editions bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <span className="text-[10px] uppercase tracking-wider text-gray-600 mr-2">Dostupné v:</span>
          {editions.map((ed) => (
            <span key={ed} className="text-xs text-gray-500 bg-white/3 rounded-full px-2.5 py-1 border border-white/5">
              {ed}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
