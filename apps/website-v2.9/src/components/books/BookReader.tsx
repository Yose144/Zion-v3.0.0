'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MarkdownDoc from '@/components/docs/MarkdownDoc';
import {
  BookOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Library,
  Menu,
  X,
  Sparkles,
  Languages,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import type { BookDef, BookChapter, Lang } from '@/lib/books/types';
import { BOOK_NAV, bookNavLabel } from '@/lib/books/registry';
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const currentChapter = chapters.find((c) => c.slug === selectedChapter);

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

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }));
  };

  /** Whole-library nav: groups → books; the active book expands to its chapter TOC. */
  const renderNav = (inMenu = false) => (
    <nav className="space-y-1.5">
      {BOOK_NAV.map((group) => {
        const hasActive = group.books.some((b) => b.id === book.id);
        const isOpen = openGroups[group.id] ?? hasActive;
        return (
          <div key={group.id}>
            <button
              onClick={() => toggleGroup(group.id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-all rounded-lg ${
                hasActive ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <span>{group.label[l]}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="mt-0.5 space-y-0.5">
                {group.books.map((b) => {
                  if (b.id !== book.id) {
                    return (
                      <Link
                        key={b.id}
                        href={b.href}
                        prefetch={false}
                        onClick={() => inMenu && setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                      >
                        <BookOpen className="w-3.5 h-3.5 shrink-0 text-gray-600" />
                        <span className="truncate">{bookNavLabel(b, l)}</span>
                      </Link>
                    );
                  }
                  // Active book — accent row + inline chapter TOC
                  return (
                    <div key={b.id} className="zion-rainbow-sub" style={accentStyle}>
                      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white">
                        <HeroIcon className="w-3.5 h-3.5 shrink-0" style={{ color: accentRgb }} />
                        <span className="truncate">{book.title[l]}</span>
                      </div>
                      <div className="pb-1">
                        {categories.map((category) => {
                          const Icon = book.partIcons[category.part] ?? Sparkles;
                          const isExpanded = expanded[category.part];
                          return (
                            <div key={category.part}>
                              <button
                                onClick={() => togglePart(category.part)}
                                className="w-full flex items-center justify-between pl-9 pr-3 py-1.5 text-[11px] text-gray-400 hover:text-white transition-colors"
                              >
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <Icon className="w-3 h-3 shrink-0" style={{ color: accentRgb }} />
                                  <span className="truncate">{parts[category.part]?.[l]}</span>
                                </span>
                                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                              {isExpanded && (
                                <div className="ml-9 border-l border-white/10 pl-1.5 space-y-px pb-1">
                                  {category.chapters.map((ch) => (
                                    <button
                                      key={ch.slug}
                                      onClick={() => handleChapterSelect(ch.slug, category.part)}
                                      className={`w-full text-left px-2.5 py-1.5 text-[11px] rounded transition-all flex items-center gap-1.5 ${
                                        selectedChapter === ch.slug
                                          ? 'bg-white/10 text-amber-200 font-medium'
                                          : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                                      }`}
                                    >
                                      <FileText className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{ch.num[l]} — {ch.title[l]}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

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
        <div className="zion-container py-12 md:py-16 relative">
          <div className="zion-rainbow-card max-w-4xl mx-auto p-6 md:p-8 text-center" style={accentStyle}>
            <div
              className="zion-kicker mx-auto mb-5 w-fit"
              style={{ borderColor: `rgb(${ACCENT} / 0.3)`, background: `rgb(${ACCENT} / 0.1)` }}
            >
              <HeroIcon className="w-4 h-4" style={{ color: accentRgb }} />
              <span className="text-sm text-amber-200 font-semibold">{book.kicker[l]}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 text-gradient">
              {book.title[l]}
            </h1>
            <p className="text-lg text-gray-400 mb-4">{book.subtitle[l]}</p>
            <div className="zion-rainbow-sub mx-auto mb-6 max-w-3xl px-5 py-4 text-left text-sm text-gray-300" style={accentStyle}>
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
            <div className="mt-4 zion-rainbow-card p-3 max-h-[70vh] overflow-y-auto" style={accentStyle}>
              {renderNav(true)}
            </div>
          )}
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-24 zion-rainbow-card overflow-hidden" style={accentStyle}>
              <div className="px-3 py-3 max-h-[calc(100vh-140px)] overflow-y-auto">
                {renderNav()}
              </div>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 max-w-3xl xl:max-w-4xl mx-auto">
            {/* Breadcrumbs — same chrome as /docs/view */}
            <nav className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 mb-8">
              <Link
                href="/maitreya"
                className="inline-flex items-center gap-1.5 text-zion-cyan hover:text-white transition-colors"
              >
                <Library className="w-4 h-4" /> {l === 'cs' ? 'Knihovna' : 'Library'}
              </Link>
              <ChevronRight className="w-3 h-3 text-gray-600" />
              <span className="text-gray-500">{book.title[l]}</span>
              {currentChapter && (
                <>
                  <ChevronRight className="w-3 h-3 text-gray-600" />
                  <span className="text-zion-gold">{currentChapter.num[l]}</span>
                </>
              )}
            </nav>

            {currentChapter && (
              <div className="mb-10 pb-6 border-b border-white/10 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
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
                {sourceFile && (
                  <a
                    href={`/docs/${sourceFile}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="zion-button-secondary inline-flex items-center gap-2 text-sm shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" /> {l === 'cs' ? 'Zdroj' : 'Source'}
                  </a>
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

            {/* Prev / next chapter */}
            {currentChapter &&
              (() => {
                const idx = chapters.findIndex((c) => c.slug === currentChapter.slug);
                const prev = idx > 0 ? chapters[idx - 1] : null;
                const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;
                if (!prev && !next) return null;
                return (
                  <nav className="mt-12 pt-8 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {prev ? (
                      <button
                        onClick={() => handleChapterSelect(prev.slug, prev.part)}
                        className="zion-rainbow-sub group flex items-center gap-3 px-4 py-3 text-left transition-all hover:border-white/25"
                        style={accentStyle}
                      >
                        <ArrowLeft className="w-4 h-4 shrink-0 text-gray-500 transition-transform group-hover:-translate-x-0.5" />
                        <span className="min-w-0">
                          <span className="block text-[10px] uppercase tracking-wider text-gray-500">{prev.num[l]}</span>
                          <span className="block truncate text-sm font-semibold text-gray-200">{prev.title[l]}</span>
                        </span>
                      </button>
                    ) : (
                      <span />
                    )}
                    {next && (
                      <button
                        onClick={() => handleChapterSelect(next.slug, next.part)}
                        className="zion-rainbow-sub group flex items-center justify-end gap-3 px-4 py-3 text-right transition-all hover:border-white/25 sm:col-start-2"
                        style={accentStyle}
                      >
                        <span className="min-w-0">
                          <span className="block text-[10px] uppercase tracking-wider text-gray-500">{next.num[l]}</span>
                          <span className="block truncate text-sm font-semibold text-gray-200">{next.title[l]}</span>
                        </span>
                        <ArrowRight className="w-4 h-4 shrink-0 text-gray-500 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    )}
                  </nav>
                );
              })()}
          </div>
        </div>
      </div>
    </div>
  );
}
