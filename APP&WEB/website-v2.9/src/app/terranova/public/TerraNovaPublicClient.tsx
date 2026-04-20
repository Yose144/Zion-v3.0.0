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
import { BOOK_META_PUBLIC } from './bookMetaPublic';
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

  const meta = BOOK_META_PUBLIC;

  return (
    <div className="zion-shell min-h-screen pt-24 md:pt-28 pb-24 overflow-x-hidden">
      {/* ── Ambient background ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[600px] w-[600px] rounded-full blur-[240px] bg-zion-gold/6" />
        <div className="absolute -right-40 top-1/2 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/5" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/4" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl">


        {/* ═══════ BOOK HEADER ═══════ */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 space-y-5"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-1.5 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
            <BookOpen className="h-4 w-4" />
            {cs ? 'Čtvrtá kniha ZION' : 'Fourth Book of ZION'}
          </div>

          <h1 className="zion-page-heading text-gradient">
            {cs ? meta.titleCs : meta.titleEn}
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 font-light">
            {cs ? meta.subtitleCs : meta.subtitleEn}
          </p>
        </motion.header>

        {/* ═══════ DEDICATION ═══════ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mb-12 text-center"
        >
          <blockquote className="text-sm md:text-base text-gray-400 italic leading-relaxed whitespace-pre-line max-w-2xl mx-auto">
            {cs ? meta.dedicationCs : meta.dedicationEn}
          </blockquote>
          <p className="mt-3 text-xs text-gray-600">
            — Yeshuae Ben Yose / Zion Creator
          </p>
        </motion.div>

        {/* ═══════ ABOUT + COMPOSITION ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-16 space-y-6"
        >
          <div className="zion-panel rounded-3xl p-6 md:p-8 space-y-5">
            <p className="text-gray-300 leading-relaxed">
              {cs ? meta.aboutCs : meta.aboutEn}
            </p>

            <div className="border-t border-white/5 pt-5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-3">
                {cs ? 'Kompoziční mapa' : 'Compositional Map'}
              </p>
              <ol className="space-y-1.5">
                {(cs ? meta.compositionCs : meta.compositionEn).map(
                  (line, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-400 flex items-start gap-2"
                    >
                      <span className="text-zion-gold/60 font-mono text-xs mt-0.5">
                        {i + 1}.
                      </span>
                      <span>{line}</span>
                    </li>
                  ),
                )}
              </ol>
            </div>
          </div>
        </motion.section>

        {/* ═══════ TABLE OF CONTENTS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mb-16"
        >
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 mb-5 text-center">
            {cs ? 'Obsah' : 'Contents'}
          </p>
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
                    borderColor: isActive
                      ? `rgba(${ch.rgb},0.35)`
                      : 'rgba(255,255,255,0.06)',
                    backgroundColor: isActive
                      ? `rgba(${ch.rgb},0.06)`
                      : 'rgba(0,0,0,0.3)',
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
                    {isAppendix
                      ? ch.number
                      : ch.number === 'Prolog'
                        ? '✦'
                        : ch.number}
                  </span>
                  <p
                    className="text-sm font-semibold truncate transition-colors"
                    style={{
                      color: isActive
                        ? ch.color
                        : 'rgba(255,255,255,0.65)',
                    }}
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

              {/* ── Interactive Compass (chapter XI only) ── */}
              {chapter.id === 'kompas' && (
                <div className="my-10 space-y-8">
                  {/* Compass SVG */}
                  <div className="zion-panel rounded-3xl p-4 md:p-8 relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.15),transparent_70%)]" />
                    </div>
                    <p className="text-center text-xs uppercase tracking-[0.4em] text-gray-500 mb-4">
                      {cs ? 'Klikni na směr pro detail' : 'Click a direction for detail'}
                    </p>
                    <div className="max-w-lg mx-auto">
                      <ZlatyKompas selected={compassDir} onSelect={setCompassDir} />
                    </div>
                  </div>

                  {/* Direction detail */}
                  <AnimatePresence mode="wait">
                    {compassDir !== null && DIRECTIONS[compassDir] && (
                      <motion.div
                        key={DIRECTIONS[compassDir].id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="rounded-2xl border bg-black/70 backdrop-blur-xl p-5 space-y-3"
                        style={{ borderColor: `rgba(${DIRECTIONS[compassDir].rgb},0.25)` }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl" style={{ color: DIRECTIONS[compassDir].color }}>{DIRECTIONS[compassDir].symbol}</span>
                          <h4 className="text-lg font-semibold" style={{ color: DIRECTIONS[compassDir].color }}>
                            {cs ? DIRECTIONS[compassDir].titleCs : DIRECTIONS[compassDir].titleEn}
                          </h4>
                        </div>
                        <p className="text-gray-300 leading-relaxed">
                          {cs ? DIRECTIONS[compassDir].descCs : DIRECTIONS[compassDir].descEn}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* All 7 directions grid */}
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-500 mb-4 text-center">
                      {cs ? 'Sedm směrů' : 'Seven directions'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {DIRECTIONS.map((d, i) => {
                        const isActive = compassDir === i;
                        return (
                          <button
                            key={d.id}
                            onClick={() => setCompassDir(isActive ? null : i)}
                            className="group rounded-2xl border p-4 text-left transition-all duration-300"
                            style={{
                              borderColor: isActive ? `rgba(${d.rgb},0.35)` : 'rgba(255,255,255,0.06)',
                              backgroundColor: isActive ? `rgba(${d.rgb},0.06)` : 'rgba(0,0,0,0.3)',
                            }}
                          >
                            <span
                              className="text-xl mb-2 block transition-transform duration-300 group-hover:scale-110"
                              style={{ color: isActive ? d.color : 'rgba(255,255,255,0.3)' }}
                            >
                              {d.symbol}
                            </span>
                            <p
                              className="text-sm font-semibold transition-colors"
                              style={{ color: isActive ? d.color : 'rgba(255,255,255,0.6)' }}
                            >
                              {cs ? d.titleCs : d.titleEn}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider before milestones */}
                  <div className="h-px w-full bg-linear-to-r from-transparent via-zion-gold/20 to-transparent" />
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
