'use client';

import { useState, useEffect } from 'react';
import MarkdownDoc from '@/components/docs/MarkdownDoc';
import {
  BookOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Languages,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import type { BookDef, BookChapter, Lang } from '@/lib/books/types';
import { splitSingleDoc, type SingleDocBook } from '@/lib/books/singleDoc';

interface Category {
  part: number;
  chapters: BookChapter[];
}

function buildCategories(chapters: BookChapter[]): Category[] {
  const categories: Category[] = [];
  for (const ch of chapters) {
    let bucket = categories.find((c) => c.part === ch.part);
    if (!bucket) {
      bucket = { part: ch.part, chapters: [] };
      categories.push(bucket);
    }
    bucket.chapters.push(ch);
  }
  return categories;
}

export default function BookReader({ book }: { book: BookDef }) {
  const { lang } = useLang();
  const l: Lang = lang === 'cs' ? 'cs' : 'en';
  const ACCENT = book.accent;
  const bookSlugs = new Set(book.chapters.map((c) => c.slug));

  const [singleDoc, setSingleDoc] = useState<SingleDocBook | null>(null);
  const chapters = singleDoc ? singleDoc.chapters : book.chapters;
  const parts = singleDoc ? singleDoc.parts : book.parts;
  const categories = buildCategories(chapters);

  const [selectedChapter, setSelectedChapter] = useState(chapters[0]?.slug ?? '');
  const [activePart, setActivePart] = useState(0);
  const [content, setContent] = useState('');
  const [sourceFile, setSourceFile] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true, 1: true });
  const [czFallback, setCzFallback] = useState(false);

  const currentChapter = chapters.find((c) => c.slug === selectedChapter);
  const findPart = (slug: string) => chapters.find((c) => c.slug === slug)?.part ?? 0;

  // single-doc books: fetch once, split by headings → chapters + content map
  useEffect(() => {
    if (!book.singleDoc) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let res = await fetch(book.singleDoc!.docPath(l));
        let path = book.singleDoc!.docPath(l);
        if (!res.ok && book.enFallback && l === 'en') {
          res = await fetch(book.singleDoc!.docPath('cs'));
          path = book.singleDoc!.docPath('cs');
          if (res.ok && !cancelled) setCzFallback(true);
        }
        if (!res.ok) throw new Error(String(res.status));
        const md = await res.text();
        if (cancelled) return;
        const doc = splitSingleDoc(md, book.singleDoc!);
        setSingleDoc(doc);
        setSourceFile(path.replace(/^\/docs\//, ''));
        // deep-link hash may target a generated slug — validate after split
        const hash = window.location.hash.replace('#', '');
        setSelectedChapter(doc.chapters.find((c) => c.slug === hash)?.slug ?? doc.chapters[0].slug);
      } catch {
        if (!cancelled) setContent(`# ${book.title[l]}\n\n${book.notAvailable[l]}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book, l]);

  // Initial hash (deep links incl. legacy redirects) + back/forward.
  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      const ch = chapters.find((c) => c.slug === hash);
      if (ch) {
        setSelectedChapter(ch.slug);
        setActivePart(ch.part);
      }
    };
    if (window.location.hash) syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleDoc]);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedChapter) return;
    const currentHash = window.location.hash.replace('#', '');
    if (currentHash !== selectedChapter) {
      window.history.replaceState(null, '', `#${selectedChapter}`);
    }
  }, [selectedChapter]);

  // chaptered books: fetch per-slug (EN → CZ fallback)
  useEffect(() => {
    if (book.singleDoc) {
      if (singleDoc && selectedChapter) {
        setContent(singleDoc.content[selectedChapter] ?? '');
        setLoading(false);
      }
      return;
    }
    if (!currentChapter || !book.docPath) return;
    let isCancelled = false;
    setCzFallback(false);
    (async () => {
      setLoading(true);
      try {
        let response = await fetch(book.docPath!(currentChapter.slug, l));
        let resolvedPath = book.docPath!(currentChapter.slug, l).replace(/^\/docs\//, '');
        if (!response.ok && book.enFallback && l === 'en') {
          response = await fetch(book.docPath!(currentChapter.slug, 'cs'));
          resolvedPath = book.docPath!(currentChapter.slug, 'cs').replace(/^\/docs\//, '');
          if (response.ok && !isCancelled) setCzFallback(true);
        }
        if (!response.ok) throw new Error(String(response.status));
        const text = await response.text();
        if (!isCancelled) {
          setContent(text);
          setSourceFile(resolvedPath);
        }
      } catch {
        if (!isCancelled) setContent(`# ${currentChapter.title[l]}\n\n${book.notAvailable[l]}`);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [selectedChapter, currentChapter, l, book, singleDoc]);

  const handleChapterSelect = (slug: string, part: number) => {
    setSelectedChapter(slug);
    setActivePart(part);
    setExpanded((prev) => ({ ...prev, [part]: true }));
    setMobileMenuOpen(false);
  };

  const togglePart = (part: number) => {
    setExpanded((prev) => ({ ...prev, [part]: !prev[part] }));
  };

  const HeroIcon = book.icon;
  const accentStyle = { '--rc': ACCENT } as React.CSSProperties;
  const accentRgb = `rgb(${ACCENT})`;

  return (
    <div className="">
      {/* Hero */}
      <div
        className="relative overflow-hidden border-b border-white/10"
        style={{ background: `linear-gradient(to bottom, rgb(${ACCENT} / 0.1), transparent, transparent)` }}
      >
        <div className="zion-container py-20 relative">
          <div className="zion-rainbow-card max-w-4xl mx-auto p-8 md:p-10 text-center" style={accentStyle}>
            <div
              className="zion-kicker mx-auto mb-6 w-fit"
              style={{ borderColor: `rgb(${ACCENT} / 0.3)`, background: `rgb(${ACCENT} / 0.1)` }}
            >
              <HeroIcon className="w-4 h-4" style={{ color: accentRgb }} />
              <span className="text-sm text-amber-200 font-semibold">{book.kicker[l]}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gradient">
              {book.title[l]}
            </h1>
            <p className="text-xl text-gray-400 mb-4">{book.subtitle[l]}</p>
            <div className="zion-rainbow-sub mx-auto mb-8 max-w-3xl px-5 py-4 text-left text-sm text-gray-300" style={accentStyle}>
              {book.description[l]}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-2">
              {book.facts.map((fact, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm px-3 py-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{fact.label[l]}</p>
                  <p className="text-sm font-semibold text-white font-mono break-all">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="zion-container py-12">
        {/* Mobile toggle */}
        <div className="lg:hidden sticky top-20 z-30 mb-6">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 zion-rainbow-sub text-white transition-colors"
            style={accentStyle}
          >
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-5 h-5 shrink-0" style={{ color: accentRgb }} />
              <span className="font-semibold min-w-0 break-words">{parts[activePart]?.[l] ?? book.title[l]}</span>
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {mobileMenuOpen && (
            <div className="mt-4 zion-rainbow-card p-4 space-y-2 max-h-[70vh] overflow-y-auto" style={accentStyle}>
              {categories.map((category) => {
                const Icon = book.partIcons[category.part] ?? Sparkles;
                const isExpanded = expanded[category.part];
                const isActive = activePart === category.part;
                return (
                  <div key={category.part}>
                    <button
                      onClick={() => togglePart(category.part)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold transition-all ${
                        isActive ? 'zion-rainbow-sub text-white' : 'rounded-lg border border-white/10 bg-black/40 text-gray-400 hover:border-white/20 hover:text-gray-300'
                      }`}
                      style={isActive ? accentStyle : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {parts[category.part]?.[l]}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && category.chapters.map((ch) => (
                      <button
                        key={ch.slug}
                        onClick={() => handleChapterSelect(ch.slug, category.part)}
                        className={`w-full text-left pl-10 pr-3 py-2 text-xs transition-all ${
                          selectedChapter === ch.slug
                            ? 'zion-rainbow-sub text-amber-200 font-medium'
                            : 'rounded text-gray-500 hover:text-gray-300'
                        }`}
                        style={selectedChapter === ch.slug ? accentStyle : undefined}
                      >
                        {ch.num[l]} — {ch.title[l]}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-24 zion-rainbow-card overflow-hidden" style={accentStyle}>
              <nav className="px-3 py-3 max-h-[calc(100vh-140px)] overflow-y-auto space-y-2">
                {categories.map((category) => {
                  const Icon = book.partIcons[category.part] ?? Sparkles;
                  const isExpanded = expanded[category.part];
                  const isActive = activePart === category.part;
                  return (
                    <div key={category.part}>
                      <button
                        onClick={() => togglePart(category.part)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-sm ${
                          isActive
                            ? 'zion-rainbow-sub text-white'
                            : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                        style={isActive ? accentStyle : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color: accentRgb }} />
                          <span className="font-semibold">{parts[category.part]?.[l]}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="ml-3 mt-1 border-l border-white/5 pl-2 space-y-0.5 pb-2">
                          {category.chapters.map((ch) => (
                            <button
                              key={ch.slug}
                              onClick={() => handleChapterSelect(ch.slug, category.part)}
                              className={`w-full text-left px-3 py-2 text-xs transition-all flex items-center gap-2 ${
                                selectedChapter === ch.slug
                                  ? 'zion-rainbow-sub text-amber-200 font-medium'
                                  : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                              style={selectedChapter === ch.slug ? accentStyle : undefined}
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              {ch.num[l]} — {ch.title[l]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 max-w-3xl xl:max-w-4xl mx-auto">
            {currentChapter && (
              <div className="mb-10 pb-8 border-b border-white/10">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <span style={{ color: accentRgb }}>{parts[currentChapter.part]?.[l]}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-zion-purple">{currentChapter.num[l]}</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight text-gradient">
                  {currentChapter.title[l]}
                </h2>
                <p className="text-gray-400">
                  {parts[currentChapter.part]?.[l]} · {currentChapter.num[l]}
                </p>
                {czFallback && l === 'en' && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                    <Languages className="w-3.5 h-3.5" />
                    {book.czOnly[l]}
                  </p>
                )}
              </div>
            )}

            <div className="zion-docs-prose">
              {loading ? (
                <div className="space-y-6 py-12">
                  <div className="h-10 w-2/3 rounded-lg bg-white/10 animate-pulse mx-auto" />
                  <div className="h-px w-full bg-white/5" />
                  <div className="h-5 w-full rounded bg-white/5 animate-pulse" />
                  <div className="h-5 w-5/6 rounded bg-white/5 animate-pulse" />
                  <div className="h-5 w-4/6 rounded bg-white/5 animate-pulse" />
                  <div className="h-32 w-full rounded-xl bg-white/5 animate-pulse mt-8" />
                </div>
              ) : (
                <article className="prose prose-invert prose-lg max-w-none">
                  <MarkdownDoc
                    content={content}
                    sourceFile={sourceFile}
                    bookSlugs={bookSlugs.size ? bookSlugs : new Set(chapters.map((c) => c.slug))}
                    className="contents"
                  />
                </article>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
