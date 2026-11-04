'use client';

import { useState, useEffect, useRef } from 'react';
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
  Clock,
  Download,
  Bookmark,
  BookmarkCheck,
  Search,
  Type,
  Check,
  Loader2,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import type { BookDef, BookChapter, Lang } from '@/lib/books/types';
import BookNav from '@/components/books/BookNav';
import { downloadForBook } from '@/lib/books/downloads';
import { saveReadingProgress } from '@/lib/books/progress';
import { bookmarkId, toggleBookmark, removeBookmark, useBookmarks } from '@/lib/books/bookmarks';
import {
  readerFontClass,
  readerThemeClass,
  readerWidthClass,
  useReaderSettings,
} from '@/lib/books/reader-settings';
import { splitSingleDoc, type SingleDocBook } from '@/lib/books/singleDoc';

interface Category {
  part: number;
  chapters: BookChapter[];
}

// Some EN slots exist as a short "language note" stub instead of a real
// translation (e.g. Ekam, Quantum Revolution). Treat those as missing so the
// reader falls back to the canonical Czech text instead of showing a note.
function isTranslationStub(text: string): boolean {
  return text.length < 1500 && /language note/i.test(text);
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

// Plain-text snippet around a match — markdown punctuation is stripped so the
// result list stays readable.
function snippetAround(raw: string, index: number, needleLength: number): string {
  const start = Math.max(0, index - 90);
  const end = Math.min(raw.length, index + needleLength + 90);
  return raw
    .slice(start, end)
    .replace(/[#*_>`~\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const [readingMinutes, setReadingMinutes] = useState<number | null>(null);
  const [settings, updateSettings] = useReaderSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { slug: string; part: number; label: string; snippet: string }[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const searchCache = useRef<Record<string, string>>({});
  const settingsRef = useRef<HTMLDivElement>(null);
  const bookmarks = useBookmarks(book.id);
  const download = downloadForBook(book.id);

  const currentChapter = chapters.find((c) => c.slug === selectedChapter);
  const chapterIndex = currentChapter
    ? chapters.findIndex((c) => c.slug === currentChapter.slug)
    : -1;

  // Front matter (index / README) is part of the book's TOC but not part of the
  // reading progress — otherwise every book starts at "1 / N" on its index.
  const isFrontMatter = (chapter: BookChapter | undefined) =>
    Boolean(
      chapter &&
        (/^(00-)?readme$/i.test(chapter.slug) ||
          chapter.num.cs === 'Index' ||
          chapter.num.en === 'Index'),
    );
  const progressChapters = chapters.filter((c) => !isFrontMatter(c));
  const progressIndex =
    currentChapter && !isFrontMatter(currentChapter)
      ? progressChapters.findIndex((c) => c.slug === currentChapter.slug)
      : -1;
  const readingPct =
    progressChapters.length > 0 && progressIndex >= 0
      ? Math.round(((progressIndex + 1) / progressChapters.length) * 100)
      : 0;

  const currentBookmarkId = currentChapter ? bookmarkId(book.id, currentChapter.slug) : '';
  const currentBookmarked = bookmarks.some((b) => b.id === currentBookmarkId);

  // Reading time estimate — honest and cheap: words / 200 wpm, minimum a minute.
  useEffect(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    setReadingMinutes(words > 60 ? Math.max(1, Math.round(words / 200)) : null);
  }, [content]);

  // Remember where this reader stopped (localStorage only — see lib/books/progress).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!currentChapter || progressChapters.length === 0) return;
    const index = progressChapters.findIndex((c) => c.slug === currentChapter.slug);
    if (index < 0) return; // opening the index must not reset real progress
    saveReadingProgress({
      bookId: book.id,
      path: window.location.pathname,
      chapterSlug: currentChapter.slug,
      chapterIndex: index,
      totalChapters: progressChapters.length,
      chapterLabel: `${currentChapter.num[l]} — ${currentChapter.title[l]}`,
      bookTitle: book.title[l],
      updatedAt: Date.now(),
    });
  }, [book.id, book.title, progressChapters, currentChapter, l]);

  // Keyboard chapter navigation (← / →), ignored while typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const index = chapters.findIndex((c) => c.slug === selectedChapter);
      const next = event.key === 'ArrowRight' ? chapters[index + 1] : chapters[index - 1];
      if (!next) return;
      event.preventDefault();
      setSelectedChapter(next.slug);
      setActivePart(next.part);
      setExpanded((prev) => ({ ...prev, [next.part]: true }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chapters, selectedChapter]);

  // Close the reader settings popover on outside click / Escape.
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [settingsOpen]);

  // Full-text search across this book's chapters (fetched on demand, cached per session).
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 3) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const needle = query.toLowerCase();
      const list = chapters.filter((c) => !isFrontMatter(c));
      const found: { slug: string; part: number; label: string; snippet: string }[] = [];
      const queue = [...list];
      const worker = async () => {
        while (!cancelled && queue.length) {
          const chapter = queue.shift()!;
          let text = book.singleDoc
            ? (singleDoc?.content[chapter.slug] ?? '')
            : (searchCache.current[chapter.slug] ?? '');
          if (!text && book.docPath) {
            try {
              const res = await fetch(book.docPath(chapter.slug, l));
              if (res.ok) {
                text = await res.text();
                if (l === 'en' && book.enFallback && isTranslationStub(text)) {
                  const cs = await fetch(book.docPath(chapter.slug, 'cs'));
                  if (cs.ok) text = await cs.text();
                }
                searchCache.current[chapter.slug] = text;
              }
            } catch {
              /* skip unreadable chapter */
            }
          }
          const index = text.toLowerCase().indexOf(needle);
          if (index >= 0) {
            found.push({
              slug: chapter.slug,
              part: chapter.part,
              label: `${chapter.num[l]} — ${chapter.title[l]}`,
              snippet: snippetAround(text, index, needle.length),
            });
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(6, Math.max(1, list.length)) }, () => worker()),
      );
      if (cancelled) return;
      found.sort(
        (a, b) =>
          list.findIndex((c) => c.slug === a.slug) - list.findIndex((c) => c.slug === b.slug),
      );
      setSearchResults(found);
      setSearching(false);
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, chapters, book, l, singleDoc]);

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
        let md = await res.text();
        if (l === 'en' && book.enFallback && isTranslationStub(md)) {
          const csRes = await fetch(book.singleDoc!.docPath('cs'));
          if (csRes.ok) {
            const csMd = await csRes.text();
            if (!isTranslationStub(csMd)) {
              md = csMd;
              path = book.singleDoc!.docPath('cs');
              if (!cancelled) setCzFallback(true);
            }
          }
        }
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
        let text = await response.text();
        if (l === 'en' && book.enFallback && isTranslationStub(text)) {
          const csRes = await fetch(book.docPath!(currentChapter.slug, 'cs'));
          if (csRes.ok) {
            const csText = await csRes.text();
            if (!isTranslationStub(csText)) {
              text = csText;
              resolvedPath = book.docPath!(currentChapter.slug, 'cs').replace(/^\/docs\//, '');
              if (!isCancelled) setCzFallback(true);
            }
          }
        }
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

  const toggleCurrentBookmark = () => {
    if (!currentChapter) return;
    toggleBookmark({
      bookId: book.id,
      bookTitle: book.title[l],
      chapterSlug: currentChapter.slug,
      chapterLabel: `${currentChapter.num[l]} — ${currentChapter.title[l]}`,
      path: window.location.pathname,
    });
  };

  const renderSearch = () => {
    const active = searchQuery.trim().length >= 3;
    return (
      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={l === 'cs' ? 'Hledat v knize…' : 'Search this book…'}
            aria-label={l === 'cs' ? 'Hledat v knize' : 'Search this book'}
            className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-8 pr-8 text-xs text-white placeholder:text-gray-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={l === 'cs' ? 'Vymazat hledání' : 'Clear search'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {active && (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-black/40">
            {searching ? (
              <p className="flex items-center gap-2 px-3 py-2 text-[11px] text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {l === 'cs' ? 'Hledám…' : 'Searching…'}
              </p>
            ) : searchResults && searchResults.length > 0 ? (
              <ul className="divide-y divide-white/5">
                {searchResults.map((result) => (
                  <li key={result.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        handleChapterSelect(result.slug, result.part);
                        setSearchQuery('');
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left transition-colors hover:bg-white/5"
                    >
                      <span className="block truncate text-[11px] font-semibold text-gray-200">
                        {result.label}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-gray-500">
                        {result.snippet}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-2 text-[11px] text-gray-500">
                {l === 'cs' ? 'Nic nenalezeno.' : 'Nothing found.'}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderBookmarks = () =>
    bookmarks.length > 0 ? (
      <div className="mb-3 rounded-lg border border-white/10 bg-black/20 p-2">
        <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
          {l === 'cs' ? 'Záložky' : 'Bookmarks'} · {bookmarks.length}
        </p>
        <ul className="space-y-0.5">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const chapter = chapters.find((c) => c.slug === bookmark.chapterSlug);
                  handleChapterSelect(bookmark.chapterSlug, chapter?.part ?? 0);
                  setMobileMenuOpen(false);
                }}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <BookmarkCheck className="h-3 w-3 shrink-0" style={{ color: accentRgb }} />
                <span className="truncate">{bookmark.chapterLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => removeBookmark(bookmark.id)}
                aria-label={l === 'cs' ? 'Odebrat záložku' : 'Remove bookmark'}
                className="rounded p-1 text-gray-600 transition-colors hover:bg-white/10 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  /** Active-book slot inside the shared library nav: accent row + inline chapter TOC. */
  const renderActiveBook = () => (
    <div className="zion-rainbow-sub" style={accentStyle}>
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white">
        <HeroIcon className="w-3.5 h-3.5 shrink-0" style={{ color: accentRgb }} />
        <span className="truncate">{book.title[l]}</span>
        {progressChapters.length > 0 && progressIndex >= 0 && (
          <span className="ml-auto shrink-0 font-mono text-[10px] font-medium text-gray-500">
            {progressIndex + 1}/{progressChapters.length}
          </span>
        )}
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

  const renderNav = (inMenu = false) => (
    <BookNav
      lang={l}
      activeBookId={book.id}
      renderActive={renderActiveBook}
      onNavigate={inMenu ? () => setMobileMenuOpen(false) : undefined}
    />
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

            {download && (
              <a
                href={`/api/archive/downloads/${download.id}`}
                className="mx-auto mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60"
              >
                <Download className="h-4 w-4" />
                {l === 'cs'
                  ? `Stáhnout kompletní edici (ZIP, ${download.sizeLabel})`
                  : `Download the complete edition (ZIP, ${download.sizeLabel})`}
              </a>
            )}
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
              {renderSearch()}
              {renderBookmarks()}
              {renderNav(true)}
            </div>
          )}
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-24 zion-rainbow-card overflow-hidden" style={accentStyle}>
              <div className="px-3 py-3 max-h-[calc(100vh-140px)] overflow-y-auto">
                {renderSearch()}
                {renderBookmarks()}
                {renderNav()}
              </div>
            </div>
          </aside>

          {/* Content */}
          <div className={`flex-1 min-w-0 mx-auto ${readerWidthClass[settings.width]}`}>
            {/* Breadcrumbs — same chrome as /docs/view */}
            <nav className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 mb-8">
              <Link
                href="/zion-archive"
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
                  {progressChapters.length > 1 && progressIndex >= 0 && (
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${readingPct}%`, backgroundColor: accentRgb }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                        {progressIndex + 1} / {progressChapters.length}
                      </span>
                    </div>
                  )}
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
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleCurrentBookmark}
                    aria-pressed={currentBookmarked}
                    title={
                      l === 'cs'
                        ? currentBookmarked
                          ? 'Odebrat záložku'
                          : 'Přidat záložku'
                        : currentBookmarked
                          ? 'Remove bookmark'
                          : 'Add bookmark'
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60 ${
                      currentBookmarked
                        ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                        : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {currentBookmarked ? (
                      <BookmarkCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Bookmark className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{l === 'cs' ? 'Záložka' : 'Bookmark'}</span>
                  </button>

                  <div className="relative" ref={settingsRef}>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen((open) => !open)}
                      aria-expanded={settingsOpen}
                      aria-haspopup="dialog"
                      title={l === 'cs' ? 'Nastavení čtečky' : 'Reader settings'}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60"
                    >
                      <Type className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{l === 'cs' ? 'Čtečka' : 'Reader'}</span>
                    </button>

                    {settingsOpen && (
                      <div
                        role="dialog"
                        aria-label={l === 'cs' ? 'Nastavení čtečky' : 'Reader settings'}
                        className="absolute right-0 top-full z-40 mt-2 w-64 space-y-3 rounded-xl border border-white/15 bg-black/95 p-3 shadow-xl backdrop-blur"
                      >
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                            {l === 'cs' ? 'Velikost písma' : 'Font size'}
                          </p>
                          <div className="flex gap-1.5">
                            {(['sm', 'md', 'lg', 'xl'] as const).map((font) => (
                              <button
                                key={font}
                                type="button"
                                onClick={() => updateSettings({ font })}
                                aria-pressed={settings.font === font}
                                className={`flex-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                                  settings.font === font
                                    ? 'border-zion-gold/50 bg-zion-gold/10 text-zion-gold'
                                    : 'border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
                                }`}
                              >
                                {font === 'sm' ? 'S' : font === 'md' ? 'M' : font === 'lg' ? 'L' : 'XL'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                            {l === 'cs' ? 'Šířka sloupce' : 'Column width'}
                          </p>
                          <div className="flex gap-1.5">
                            {(['narrow', 'normal', 'wide'] as const).map((width) => (
                              <button
                                key={width}
                                type="button"
                                onClick={() => updateSettings({ width })}
                                aria-pressed={settings.width === width}
                                className={`flex-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                                  settings.width === width
                                    ? 'border-zion-cyan/50 bg-zion-cyan/10 text-zion-cyan'
                                    : 'border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
                                }`}
                              >
                                {l === 'cs'
                                  ? width === 'narrow'
                                    ? 'Úzká'
                                    : width === 'normal'
                                      ? 'Normál'
                                      : 'Široká'
                                  : width === 'narrow'
                                    ? 'Narrow'
                                    : width === 'normal'
                                      ? 'Normal'
                                      : 'Wide'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                            {l === 'cs' ? 'Vzhled' : 'Theme'}
                          </p>
                          <div className="flex gap-1.5">
                            {(['dark', 'sepia', 'light'] as const).map((theme) => (
                              <button
                                key={theme}
                                type="button"
                                onClick={() => updateSettings({ theme })}
                                aria-pressed={settings.theme === theme}
                                className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                                  settings.theme === theme
                                    ? 'border-white/40 bg-white/10 text-white'
                                    : 'border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
                                }`}
                              >
                                {settings.theme === theme && <Check className="h-3 w-3" />}
                                {l === 'cs'
                                  ? theme === 'dark'
                                    ? 'Tmavý'
                                    : theme === 'sepia'
                                      ? 'Sépia'
                                      : 'Světlý'
                                  : theme === 'dark'
                                    ? 'Dark'
                                    : theme === 'sepia'
                                      ? 'Sepia'
                                      : 'Light'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {readingMinutes && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-gray-400">
                      <Clock className="h-3.5 w-3.5" />~{readingMinutes} min
                    </span>
                  )}
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
              </div>
            )}

            <div className={readerThemeClass[settings.theme]}>
              <div className={`zion-docs-prose ${readerFontClass[settings.font]}`}>
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
            {chapters.length > 1 && (
              <p className="mt-4 text-center text-[11px] text-gray-600">
                {l === 'cs'
                  ? 'Klávesy ← → přepínají kapitoly.'
                  : 'Use ← → to move between chapters.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
