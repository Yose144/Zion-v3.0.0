'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  X,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import ZlatyKompas, { DIRECTIONS } from '@/components/ZlatyKompas';
import { CHAPTERS_PUBLIC } from './chapters';
import type { BookChapter } from './bookMetaPublic';

export default function TerraNovaPublicClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [activeChapter, setActiveChapter] = useState<number>(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [compassDir, setCompassDir] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const chapter = CHAPTERS_PUBLIC[activeChapter];
  const sections = cs ? chapter.sectionsCs : chapter.sectionsEn;

  const goTo = useCallback((i: number) => {
    setActiveChapter(i);
    setTocOpen(false);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const prev = () => activeChapter > 0 && goTo(activeChapter - 1);
  const next = () =>
    activeChapter < CHAPTERS_PUBLIC.length - 1 && goTo(activeChapter + 1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') setTocOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const MILESTONES = [
    { year: '2026', emoji: '🟡', labelCs: 'L1 Genesis', labelEn: 'L1 Genesis', descCs: 'Blockchain žije, bloky se těží', descEn: 'Blockchain lives, blocks mined', color: '#FFD700', rgb: '255,215,0' },
    { year: '2027', emoji: '🔵', labelCs: 'L2 Ekosystém', labelEn: 'L2 Ecosystem', descCs: 'DeFi, DAO, komunity', descEn: 'DeFi, DAO, communities', color: '#60A5FA', rgb: '96,165,250' },
    { year: '2028', emoji: '🟢', labelCs: 'L4 OASIS', labelEn: 'L4 OASIS', descCs: 'AI NCL, WARP, herní vrstva', descEn: 'AI NCL, WARP, game layer', color: '#34D399', rgb: '52,211,153' },
    { year: '2030', emoji: '🌍', labelCs: 'L5 Svoboda', labelEn: 'L5 Freedom', descCs: '100 komunit, Zlatá republika', descEn: '100 communities, Golden Republic', color: '#A78BFA', rgb: '167,139,250' },
    { year: '2040+', emoji: '🔭', labelCs: 'L6 Issobella', labelEn: 'L6 Issobella', descCs: 'Orbitální stanice, hvězdy', descEn: 'Orbital station, the stars', color: '#F472B6', rgb: '244,114,182' },
  ];

  return (
    <div className="zion-shell min-h-screen pt-24 md:pt-28 pb-24 overflow-x-hidden">
      {/* ── Ambient background ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[600px] w-[600px] rounded-full blur-[240px] bg-zion-gold/6" />
        <div className="absolute -right-40 top-1/2 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/5" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/4" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl">

        {/* ═══════ HERO ═══════ */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20 space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-1.5 text-xs font-semibold tracking-[0.35em] text-zion-gold uppercase">
            <BookOpen className="h-4 w-4" />
            {cs ? 'Čtvrtá kniha ZION' : 'Fourth Book of ZION'}
          </div>

          <h1 className="zion-page-heading text-gradient">
            Terra Nova
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 font-light tracking-wide">
            {cs ? 'Zlatý Kompas Nové Země' : 'Golden Compass of the New Earth'}
          </p>

          {/* Genesis dedication */}
          <div className="max-w-2xl mx-auto pt-4 space-y-4">
            <div className="h-px w-24 bg-linear-to-r from-transparent via-zion-gold/40 to-transparent mx-auto" />
            <p className="text-sm md:text-base text-gray-300 leading-relaxed whitespace-pre-line">
              {cs
                ? 'Pro Sarah Issobel, Maitreya Buddha, Radhu & Situ a Meriam /EnaMaTara/,\npřátele, rodinu, svobodné lidstvo a všechny děti tohoto světa:\nZION je váš.'
                : 'For Sarah Issobel, Maitreya Buddha, Radha & Sita & Meriam /EnaMaTara/,\nFriends, Family, Freedom Humanity and all the children of this world:\nZION is yours.'}
            </p>
            <p className="text-base md:text-lg font-semibold text-zion-gold">
              {cs
                ? 'Stavte lepší svět, kde dosáhnete ke hvězdám.'
                : 'Build a better world where you reach for the stars.'}
            </p>
            <p className="text-sm md:text-base font-bold text-zion-gold/90 tracking-wide">
              {cs ? 'Zlatý věk začíná.' : 'The Golden Age begins.'}
            </p>
            <p className="text-xs text-gray-500 italic">
              Gate, Gate, Paragate, Parasamgate, Bodhi Swaha
            </p>
            <p className="text-xs text-gray-600">
              — Yeshuae / Zion Creator &nbsp;|&nbsp; Hooray to the Egg! &nbsp;Om Namo Hiranyagarbha!
            </p>
            <p className="text-xs text-gray-700">Peace &amp; One Love 4ever.</p>
            <div className="h-px w-24 bg-linear-to-r from-transparent via-zion-gold/40 to-transparent mx-auto" />
          </div>
        </motion.header>

        {/* ═══════ ZLATÝ KOMPAS — INTERAKTIVNÍ ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7 }}
          className="mb-20"
        >
          {/* Section heading */}
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Zlatý Kompas' : 'Golden Compass'}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-zion-gold mb-2">
              {cs ? '7 Směrů TerraNovy' : '7 Directions of TerraNova'}
            </h2>
            <p className="text-gray-500 text-sm">
              {cs ? 'Klikni na symbol kompasu pro detail směru' : 'Click a compass symbol for direction detail'}
            </p>
          </div>

          {/* Compass + directions grid */}
          <div className="grid lg:grid-cols-2 gap-8 items-start mb-10">
            {/* Compass SVG */}
            <div className="zion-panel rounded-3xl p-4 md:p-8 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.04),transparent_70%)]" />
              </div>
              <div className="max-w-md mx-auto">
                <ZlatyKompas selected={compassDir} onSelect={setCompassDir} />
              </div>
            </div>

            {/* Direction detail + grid */}
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {compassDir !== null && DIRECTIONS[compassDir] ? (
                  <motion.div
                    key={DIRECTIONS[compassDir].id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="rounded-2xl border bg-black/60 backdrop-blur-xl p-5 space-y-3"
                    style={{ borderColor: `rgba(${DIRECTIONS[compassDir].rgb},0.3)` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" style={{ color: DIRECTIONS[compassDir].color }}>
                        {DIRECTIONS[compassDir].symbol}
                      </span>
                      <h4 className="text-lg font-semibold" style={{ color: DIRECTIONS[compassDir].color }}>
                        {cs ? DIRECTIONS[compassDir].titleCs : DIRECTIONS[compassDir].titleEn}
                      </h4>
                    </div>
                    <p className="text-gray-300 leading-relaxed text-sm">
                      {cs ? DIRECTIONS[compassDir].descCs : DIRECTIONS[compassDir].descEn}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-2xl border border-white/5 bg-black/30 p-5 text-center"
                  >
                    <p className="text-gray-600 text-sm">
                      {cs ? '← Vyber směr na kompasu' : '← Select a direction on the compass'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 7 direction buttons */}
              <div className="grid grid-cols-2 gap-2">
                {DIRECTIONS.map((d, i) => {
                  const isActive = compassDir === i;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setCompassDir(isActive ? null : i)}
                      className="group rounded-xl border p-3 text-left transition-all duration-300 flex items-center gap-2.5"
                      style={{
                        borderColor: isActive ? `rgba(${d.rgb},0.4)` : 'rgba(255,255,255,0.06)',
                        backgroundColor: isActive ? `rgba(${d.rgb},0.08)` : 'rgba(0,0,0,0.3)',
                      }}
                    >
                      <span
                        className="text-lg shrink-0 transition-transform duration-300 group-hover:scale-110"
                        style={{ color: isActive ? d.color : 'rgba(255,255,255,0.25)' }}
                      >
                        {d.symbol}
                      </span>
                      <span
                        className="text-xs font-semibold truncate transition-colors"
                        style={{ color: isActive ? d.color : 'rgba(255,255,255,0.5)' }}
                      >
                        {cs ? d.titleCs : d.titleEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── MILNÍKY ── */}
          <div className="text-center mb-6">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500">
              {cs ? 'Akcelerační mapa · Milníky' : 'Acceleration Map · Milestones'}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {MILESTONES.map((m) => (
              <div
                key={m.year}
                className="rounded-2xl border p-4 text-center space-y-2 transition-all duration-300 hover:scale-[1.02]"
                style={{
                  borderColor: `rgba(${m.rgb},0.2)`,
                  backgroundColor: `rgba(${m.rgb},0.04)`,
                }}
              >
                <div className="text-2xl">{m.emoji}</div>
                <p className="text-xs font-bold tracking-wider" style={{ color: m.color }}>
                  {m.year}
                </p>
                <p className="text-xs font-semibold text-white/80">
                  {cs ? m.labelCs : m.labelEn}
                </p>
                <p className="text-[11px] text-gray-500 leading-snug">
                  {cs ? m.descCs : m.descEn}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ TABLE OF CONTENTS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-6">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500">
              {cs ? 'Obsah knihy' : 'Table of Contents'}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHAPTERS_PUBLIC.map((ch, i) => {
              const isActive = activeChapter === i;
              const isAppendix = ['A', 'B', 'C'].includes(ch.number);
              return (
                <button
                  key={ch.id}
                  onClick={() => goTo(i)}
                  className="group rounded-2xl border p-4 text-left transition-all duration-300 flex items-center gap-3"
                  style={{
                    borderColor: isActive ? `rgba(${ch.rgb},0.35)` : 'rgba(255,255,255,0.06)',
                    backgroundColor: isActive ? `rgba(${ch.rgb},0.06)` : 'rgba(0,0,0,0.3)',
                  }}
                >
                  <span
                    className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border transition-colors"
                    style={{
                      borderColor: `rgba(${ch.rgb},${isActive ? 0.4 : 0.15})`,
                      color: isActive ? ch.color : 'rgba(255,255,255,0.4)',
                      backgroundColor: `rgba(${ch.rgb},${isActive ? 0.1 : 0.03})`,
                    }}
                  >
                    {isAppendix ? ch.number : ch.number === 'Prolog' ? '✦' : ch.number}
                  </span>
                  <p
                    className="text-sm font-semibold truncate transition-colors"
                    style={{ color: isActive ? ch.color : 'rgba(255,255,255,0.65)' }}
                  >
                    {isAppendix
                      ? `${cs ? 'Příloha' : 'Appendix'} ${ch.number} — ${cs ? ch.titleCs : ch.titleEn}`
                      : ch.number === 'Prolog'
                        ? `${cs ? 'Prolog' : 'Prologue'} — ${cs ? ch.titleCs : ch.titleEn}`
                        : `${cs ? 'Část' : 'Part'} ${ch.number} — ${cs ? ch.titleCs : ch.titleEn}`}
                  </p>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* ═══════ CHAPTER READER ═══════ */}
        <div ref={contentRef}>
          <AnimatePresence mode="wait">
            <motion.article
              key={chapter.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="zion-panel rounded-3xl md:rounded-4xl p-6 md:p-10 lg:p-14 relative overflow-hidden"
            >
              {/* Accent glow */}
              <div
                className="absolute -top-20 -right-20 h-48 w-48 rounded-full blur-[100px] opacity-20"
                style={{ backgroundColor: chapter.color }}
              />

              {/* Chapter header */}
              <div className="relative mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]"
                    style={{
                      borderColor: `rgba(${chapter.rgb},0.3)`,
                      color: chapter.color,
                      backgroundColor: `rgba(${chapter.rgb},0.08)`,
                    }}
                  >
                    {chapter.number === 'Prolog'
                      ? cs
                        ? 'Prolog'
                        : 'Prologue'
                      : ['A', 'B', 'C'].includes(chapter.number)
                        ? `${cs ? 'Příloha' : 'Appendix'} ${chapter.number}`
                        : `${cs ? 'Část' : 'Part'} ${chapter.number}`}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {activeChapter + 1} / {CHAPTERS_PUBLIC.length}
                  </span>
                </div>

                <h2
                  className="text-3xl md:text-4xl font-bold"
                  style={{ color: chapter.color }}
                >
                  {cs ? chapter.titleCs : chapter.titleEn}
                </h2>

                {/* Epigraph */}
                {(cs ? chapter.epigraphCs : chapter.epigraphEn) && (
                  <blockquote className="mt-4 pl-4 border-l-2 text-sm text-gray-400 italic leading-relaxed" style={{ borderColor: `rgba(${chapter.rgb},0.3)` }}>
                    {cs ? chapter.epigraphCs : chapter.epigraphEn}
                  </blockquote>
                )}
              </div>

              {/* ── Kompas reference (chapter XI) ── */}
              {chapter.id === 'kompas' && (
                <div className="my-8 rounded-2xl border border-zion-gold/20 bg-zion-gold/5 p-5 text-center">
                  <p className="text-sm text-gray-400">
                    {cs
                      ? '↑ Zlatý Kompas je interaktivní v horní části stránky. Níže jsou milníky a detaily.'
                      : '↑ The Golden Compass is interactive at the top of the page. Milestones and details below.'}
                  </p>
                </div>
              )}

              {/* Chapter body */}
              <div className="relative space-y-10 max-w-3xl">
                {sections.map((sec, si) => (
                  <div key={si} className={si > 0 ? 'pt-2' : ''}>
                    {si > 0 && (
                      <div className="h-px w-full mb-8 bg-linear-to-r from-transparent via-white/8 to-transparent" />
                    )}
                    {sec.heading && (
                      <h3
                        className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2"
                        style={{ color: chapter.color }}
                      >
                        {sec.heading}
                      </h3>
                    )}
                    <div className="space-y-4">
                      {sec.body.split('\n\n').map((para, pi) => {
                        const lines = para.split('\n');
                        const hasChecklist = lines.some(
                          (l) => l.startsWith('✅') || l.startsWith('⬜'),
                        );
                        const hasTree = lines.some(
                          (l) =>
                            l.includes('├──') ||
                            l.includes('└──') ||
                            l.includes('│') ||
                            l.startsWith('━'),
                        );
                        if (hasChecklist) {
                          return (
                            <div key={pi} className="space-y-2">
                              {lines.map((line, li) => {
                                if (line.startsWith('✅')) {
                                  return (
                                    <div
                                      key={li}
                                      className="flex items-start gap-2.5"
                                    >
                                      <span className="shrink-0 mt-0.5 text-green-400 text-base">
                                        ✅
                                      </span>
                                      <span className="text-gray-300 text-sm leading-relaxed">
                                        {line.slice(2).trim()}
                                      </span>
                                    </div>
                                  );
                                }
                                if (line.startsWith('⬜')) {
                                  return (
                                    <div
                                      key={li}
                                      className="flex items-start gap-2.5 opacity-50"
                                    >
                                      <span className="shrink-0 mt-0.5 text-gray-500 text-base">
                                        ⬜
                                      </span>
                                      <span className="text-gray-400 text-sm leading-relaxed">
                                        {line.slice(2).trim()}
                                      </span>
                                    </div>
                                  );
                                }
                                return line.trim() ? (
                                  <p
                                    key={li}
                                    className="text-gray-400 text-sm leading-relaxed"
                                  >
                                    {line}
                                  </p>
                                ) : null;
                              })}
                            </div>
                          );
                        }
                        if (hasTree) {
                          return (
                            <pre
                              key={pi}
                              className="font-mono text-xs text-gray-400 bg-black/50 rounded-xl p-4 overflow-x-auto border border-white/5 leading-relaxed"
                            >
                              {para}
                            </pre>
                          );
                        }
                        return (
                          <p
                            key={pi}
                            className="text-gray-300 leading-[1.85] text-[15px] md:text-base"
                          >
                            {para}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chapter navigation */}
              <div className="mt-12 pt-6 border-t border-white/5 flex items-center justify-between">
                <button
                  onClick={prev}
                  disabled={activeChapter === 0}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {activeChapter > 0 && (
                    <span className="hidden sm:inline">
                      {cs
                        ? CHAPTERS_PUBLIC[activeChapter - 1].titleCs
                        : CHAPTERS_PUBLIC[activeChapter - 1].titleEn}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setTocOpen(true)}
                  className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors"
                >
                  <List className="w-4 h-4" />
                  {cs ? 'Obsah' : 'Contents'}
                </button>

                <button
                  onClick={next}
                  disabled={activeChapter === CHAPTERS_PUBLIC.length - 1}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  {activeChapter < CHAPTERS_PUBLIC.length - 1 && (
                    <span className="hidden sm:inline">
                      {cs
                        ? CHAPTERS_PUBLIC[activeChapter + 1].titleCs
                        : CHAPTERS_PUBLIC[activeChapter + 1].titleEn}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        {/* ═══════ FOOTER ═══════ */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 text-center space-y-4"
        >
          <p className="text-gray-500 text-sm italic max-w-xl mx-auto">
            {cs
              ? 'Úplná veřejná edice čtvrté knihy ZION. Od kosmologie přes komunity, AI a architekturu až ke hvězdám.'
              : 'Complete public edition of the fourth ZION book. From cosmology through communities, AI, and architecture to the stars.'}
          </p>
        </motion.footer>
      </div>

      {/* ═══════ FLOATING TOC OVERLAY ═══════ */}
      <AnimatePresence>
        {tocOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setTocOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[320px] max-w-[85vw] bg-black/95 backdrop-blur-xl border-r border-white/10 p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">
                  {cs ? 'Obsah' : 'Contents'}
                </h3>
                <button
                  onClick={() => setTocOpen(false)}
                  className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1">
                {CHAPTERS_PUBLIC.map((ch, i) => {
                  const isActive = activeChapter === i;
                  const isAppendix = ['A', 'B', 'C'].includes(ch.number);
                  return (
                    <button
                      key={ch.id}
                      onClick={() => goTo(i)}
                      className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3"
                      style={{
                        backgroundColor: isActive
                          ? `rgba(${ch.rgb},0.1)`
                          : 'transparent',
                        borderLeft: isActive
                          ? `3px solid ${ch.color}`
                          : '3px solid transparent',
                      }}
                    >
                      <span
                        className="text-xs font-mono w-5 text-center shrink-0"
                        style={{
                          color: isActive
                            ? ch.color
                            : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {isAppendix
                          ? ch.number
                          : ch.number === 'Prolog'
                            ? '✦'
                            : ch.number}
                      </span>
                      <span
                        className="text-sm truncate"
                        style={{
                          color: isActive
                            ? ch.color
                            : 'rgba(255,255,255,0.6)',
                        }}
                      >
                        {cs ? ch.titleCs : ch.titleEn}
                      </span>
                    </button>
                  );
                })}
              </nav>


            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
