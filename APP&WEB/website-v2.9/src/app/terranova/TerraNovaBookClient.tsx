'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  X,
  Compass,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import { BOOK_META, CHAPTERS } from './bookData';
import type { BookChapter, Section } from './bookData';

/* ═══════════════════════════════════════════════════════════
   Terra Nova — Public Book Reader
   Full bilingual reader with chapter navigation
   ═══════════════════════════════════════════════════════════ */

export default function TerraNovaBookClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [activeChapter, setActiveChapter] = useState<number>(0);
  const [tocOpen, setTocOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const chapter = CHAPTERS[activeChapter];
  const sections = cs ? chapter.sectionsCs : chapter.sectionsEn;

  const goTo = useCallback(
    (i: number) => {
      setActiveChapter(i);
      setTocOpen(false);
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const prev = () => activeChapter > 0 && goTo(activeChapter - 1);
  const next = () => activeChapter < CHAPTERS.length - 1 && goTo(activeChapter + 1);

  /* Keyboard nav */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') setTocOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const meta = BOOK_META;

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

          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
            {cs ? meta.editionCs : meta.editionEn}
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
            <p className="text-gray-400 leading-relaxed text-sm">
              {cs ? meta.layersCs : meta.layersEn}
            </p>

            <div className="border-t border-white/5 pt-5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-3">
                {cs ? 'Kompoziční mapa' : 'Compositional Map'}
              </p>
              <ol className="space-y-1.5">
                {(cs ? meta.compositionCs : meta.compositionEn).map((line, i) => (
                  <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                    <span className="text-zion-gold/60 font-mono text-xs mt-0.5">{i + 1}.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </motion.section>

        {/* ═══════ TABLE OF CONTENTS (inline) ═══════ */}
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
            {CHAPTERS.map((ch, i) => {
              const isActive = activeChapter === i;
              const isAppendix = ch.number === 'A' || ch.number === 'B';
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
                  <div className="min-w-0">
                    {ch.subtitleCs && (
                      <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600">
                        {cs ? ch.subtitleCs : ch.subtitleEn}
                      </p>
                    )}
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
                  </div>
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
                    {chapter.subtitleCs && (cs ? chapter.subtitleCs : chapter.subtitleEn)}
                    {!chapter.subtitleCs &&
                      (chapter.number === 'Prolog'
                        ? cs
                          ? 'Prolog'
                          : 'Prologue'
                        : `${cs ? 'Část' : 'Part'} ${chapter.number}`)}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {activeChapter + 1} / {CHAPTERS.length}
                  </span>
                </div>

                <h2
                  className="text-3xl md:text-4xl font-bold"
                  style={{ color: chapter.color }}
                >
                  {cs ? chapter.titleCs : chapter.titleEn}
                </h2>

                {(cs ? chapter.subtitleCs : chapter.subtitleEn) &&
                  chapter.number === 'Prolog' && (
                    <p className="mt-2 text-gray-400 italic">
                      {cs ? chapter.subtitleCs : chapter.subtitleEn}
                    </p>
                  )}
              </div>

              {/* Chapter body */}
              <div className="relative space-y-8 max-w-3xl">
                {sections.map((sec, si) => (
                  <div key={si}>
                    {sec.heading && (
                      <h3 className="text-lg md:text-xl font-semibold text-white mb-3">
                        {sec.heading}
                      </h3>
                    )}
                    {sec.body.split('\n\n').map((para, pi) => (
                      <p
                        key={pi}
                        className="text-gray-300 leading-[1.85] text-[15px] md:text-base mb-4 last:mb-0"
                      >
                        {para}
                      </p>
                    ))}
                  </div>
                ))}
              </div>

              {/* Kompas link for chapter VII */}
              {chapter.id === 'kompas' && (
                <div className="mt-10 pt-6 border-t border-white/5">
                  <Link
                    href="/kompas"
                    className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold/30 bg-zion-gold/8 px-5 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/15 transition-colors"
                  >
                    <Compass className="w-4 h-4" />
                    {cs
                      ? 'Otevřít interaktivní Zlatý Kompas'
                      : 'Open Interactive Golden Compass'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}

              {/* ── Chapter navigation ── */}
              <div className="mt-12 pt-6 border-t border-white/5 flex items-center justify-between">
                <button
                  onClick={prev}
                  disabled={activeChapter === 0}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {activeChapter > 0 && (
                    <span className="hidden sm:inline">
                      {cs ? CHAPTERS[activeChapter - 1].titleCs : CHAPTERS[activeChapter - 1].titleEn}
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
                  disabled={activeChapter === CHAPTERS.length - 1}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  {activeChapter < CHAPTERS.length - 1 && (
                    <span className="hidden sm:inline">
                      {cs ? CHAPTERS[activeChapter + 1].titleCs : CHAPTERS[activeChapter + 1].titleEn}
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
              ? 'Mrtvé mapy bývají přesné jen na papíře. Živé mapy dokážou přežít i cestu.'
              : 'Dead maps tend to be precise only on paper. Living maps can survive the journey.'}
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/kompas"
              className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold/20 bg-zion-gold/5 px-5 py-2.5 text-sm font-semibold text-zion-gold hover:bg-zion-gold/10 transition-colors"
            >
              <Compass className="w-4 h-4" />
              {cs ? 'Zlatý Kompas' : 'Golden Compass'}
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              {cs ? 'Dokumentace' : 'Documentation'}
            </Link>
          </div>
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
                {CHAPTERS.map((ch, i) => {
                  const isActive = activeChapter === i;
                  const isAppendix = ch.number === 'A' || ch.number === 'B';
                  return (
                    <button
                      key={ch.id}
                      onClick={() => goTo(i)}
                      className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3"
                      style={{
                        backgroundColor: isActive ? `rgba(${ch.rgb},0.1)` : 'transparent',
                        borderLeft: isActive ? `3px solid ${ch.color}` : '3px solid transparent',
                      }}
                    >
                      <span
                        className="text-xs font-mono w-5 text-center shrink-0"
                        style={{ color: isActive ? ch.color : 'rgba(255,255,255,0.3)' }}
                      >
                        {isAppendix ? ch.number : ch.number === 'Prolog' ? '✦' : ch.number}
                      </span>
                      <span
                        className="text-sm truncate"
                        style={{ color: isActive ? ch.color : 'rgba(255,255,255,0.6)' }}
                      >
                        {cs ? ch.titleCs : ch.titleEn}
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-8 pt-4 border-t border-white/5">
                <Link
                  href="/kompas"
                  className="flex items-center gap-2 text-xs text-zion-gold/70 hover:text-zion-gold transition-colors"
                  onClick={() => setTocOpen(false)}
                >
                  <Compass className="w-3.5 h-3.5" />
                  {cs ? 'Interaktivní Kompas' : 'Interactive Compass'}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
