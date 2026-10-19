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
  Compass,
  Hammer,
  Sailboat,
  Anchor,
  PenLine,
  Sparkles,
  Languages,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { KRAL_CHAPTERS, KRAL_PARTS, kralDocPath } from '../chapters';

const ACCENT = '245, 158, 11'; // amber — víno / loď / Království srdce

const KRAL_SLUGS = new Set(KRAL_CHAPTERS.map((c) => c.slug));

const PART_ICONS: React.ComponentType<{ className?: string }>[] = [
  Compass,  // O knize
  Hammer,   // Dílna nad Galileou
  Sailboat, // Jezero a bouře
  Anchor,   // Hlubina a přístav
  PenLine,  // Epilog
];

const Copy = {
  heroKicker: { cs: 'Příběh lodi · Bible + nové zjevení · CZ', en: 'The boat story · Bible + new revelation · CZ' },
  heroTitle: { cs: 'KRÁLOVSTVÍ SRDCE', en: 'KRÁLOVSTVÍ SRDCE' },
  heroSubtitle: {
    cs: 'Příběh lodi, kterou postavil tesař z Nazareta — pro moře, které není na žádné mapě.',
    en: 'The story of the boat the carpenter of Nazareth built — for a sea that is on no map.',
  },
  heroDescription: {
    cs: 'Od dílny nad Galileou přes bouři na Kinneret, tři dny v hlubině a navicellu století až k přístavu nové země — kde se loď setkává s flotilou Tres Marías. Každá kapitola = příběh, verše z Písma a kotva pravdy.',
    en: 'From the workshop above Galilee through the storms of Kinneret, three days in the deep and the navicella of the centuries to the harbor of the new earth — where the boat meets the Tres Marías fleet. Each chapter = story, scripture, truth anchor. Czech original.',
  },
  notAvailable: {
    cs: 'Epizodu se nepodařilo načíst. Zkuste to prosím později.',
    en: 'The episode could not be loaded. Please try again later.',
  },
  czOnly: {
    cs: '',
    en: 'English translation is in progress — showing the Czech canonical text.',
  },
};

interface Category {
  part: number;
  chapters: typeof KRAL_CHAPTERS;
}

const categories: Category[] = [];
for (const ch of KRAL_CHAPTERS) {
  let bucket = categories.find((c) => c.part === ch.part);
  if (!bucket) {
    bucket = { part: ch.part, chapters: [] };
    categories.push(bucket);
  }
  bucket.chapters.push(ch);
}

function findPartByChapter(slug: string): number {
  return KRAL_CHAPTERS.find((c) => c.slug === slug)?.part ?? 0;
}

export default function KralovstviSrdceBookPage() {
  const { lang } = useLang();
  const l = lang === 'cs' ? 'cs' : 'en';
  const [selectedChapter, setSelectedChapter] = useState(KRAL_CHAPTERS[0].slug);
  const [activePart, setActivePart] = useState(0);
  const [content, setContent] = useState('');
  const [sourceFile, setSourceFile] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [czFallback, setCzFallback] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true, 1: true });

  const currentChapter = KRAL_CHAPTERS.find((c) => c.slug === selectedChapter);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (hash && KRAL_CHAPTERS.find((c) => c.slug === hash)) {
      setSelectedChapter(hash);
      setActivePart(findPartByChapter(hash));
    }
    const onHashChange = () => {
      const id = window.location.hash.replace('#', '');
      if (KRAL_CHAPTERS.find((c) => c.slug === id)) {
        setSelectedChapter(id);
        setActivePart(findPartByChapter(id));
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentHash = window.location.hash.replace('#', '');
    if (selectedChapter && currentHash !== selectedChapter) {
      window.history.replaceState(null, '', `#${selectedChapter}`);
    }
  }, [selectedChapter]);

  useEffect(() => {
    let isCancelled = false;
    async function loadChapter() {
      if (!currentChapter) return;
      setLoading(true);
      setCzFallback(false);
      try {
        let response = await fetch(kralDocPath(currentChapter.slug, l));
        let resolvedPath = kralDocPath(currentChapter.slug, l).replace(/^\/docs\//, '');
        // If an EN file is missing, fall back to the Czech canonical text
        if (!response.ok && l === 'en') {
          response = await fetch(kralDocPath(currentChapter.slug, 'cs'));
          resolvedPath = kralDocPath(currentChapter.slug, 'cs').replace(/^\/docs\//, '');
          if (response.ok && !isCancelled) setCzFallback(true);
        }
        if (!response.ok) throw new Error(String(response.status));
        const text = await response.text();
        if (!isCancelled) {
          setContent(text);
          setSourceFile(resolvedPath);
        }
      } catch {
        if (!isCancelled) setContent(`# ${currentChapter.title[l]}\n\n${Copy.notAvailable[l]}`);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    loadChapter();
    return () => {
      isCancelled = true;
    };
  }, [selectedChapter, currentChapter, l]);

  const handleChapterSelect = (slug: string, part: number) => {
    setSelectedChapter(slug);
    setActivePart(part);
    setExpanded((prev) => ({ ...prev, [part]: true }));
    setMobileMenuOpen(false);
  };

  const togglePart = (part: number) => {
    setExpanded((prev) => ({ ...prev, [part]: !prev[part] }));
  };

  return (
    <div className="">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-amber-500/10 via-transparent to-transparent">
        <div className="zion-container py-20 relative">
          <div className="zion-rainbow-card max-w-4xl mx-auto p-8 md:p-10 text-center" style={{ '--rc': ACCENT } as React.CSSProperties}>
            <div className="zion-kicker mx-auto mb-6 w-fit border-amber-500/30 bg-amber-500/10 text-amber-200">
              <Compass className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-200 font-semibold">{Copy.heroKicker[l]}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gradient">
              {Copy.heroTitle[l]}
            </h1>
            <p className="text-xl text-gray-400 mb-4">{Copy.heroSubtitle[l]}</p>
            <div className="zion-rainbow-sub mx-auto mb-8 max-w-3xl px-5 py-4 text-left text-sm text-gray-300" style={{ '--rc': ACCENT } as React.CSSProperties}>
              {Copy.heroDescription[l]}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-2">
              {[
                { label: { cs: 'Zastavení', en: 'Stations' }, value: '12 + 1' },
                { label: { cs: 'Vrstev', en: 'Layers' }, value: 'L1 → L6' },
                { label: { cs: 'Jazyky', en: 'Languages' }, value: 'CZ + EN idx' },
              ].map((fact, i) => (
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
            style={{ '--rc': ACCENT } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-semibold min-w-0 break-words">{KRAL_PARTS[activePart][l]}</span>
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {mobileMenuOpen && (
            <div className="mt-4 zion-rainbow-card p-4 space-y-2 max-h-[70vh] overflow-y-auto" style={{ '--rc': ACCENT } as React.CSSProperties}>
              {categories.map((category) => {
                const Icon = PART_ICONS[category.part] ?? Sparkles;
                const isExpanded = expanded[category.part];
                const isActive = activePart === category.part;
                return (
                  <div key={category.part}>
                    <button
                      onClick={() => togglePart(category.part)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold transition-all ${
                        isActive ? 'zion-rainbow-sub text-white' : 'rounded-lg border border-white/10 bg-black/40 text-gray-400 hover:border-white/20 hover:text-gray-300'
                      }`}
                      style={isActive ? { '--rc': ACCENT } as React.CSSProperties : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-amber-400" />
                        {KRAL_PARTS[category.part][l]}
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
                        style={selectedChapter === ch.slug ? { '--rc': ACCENT } as React.CSSProperties : undefined}
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
            <div className="sticky top-24 zion-rainbow-card overflow-hidden" style={{ '--rc': ACCENT } as React.CSSProperties}>
              <nav className="px-3 py-3 max-h-[calc(100vh-140px)] overflow-y-auto space-y-2">
                {categories.map((category) => {
                  const Icon = PART_ICONS[category.part] ?? Sparkles;
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
                        style={isActive ? { '--rc': ACCENT } as React.CSSProperties : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-amber-400" />
                          <span className="font-semibold">{KRAL_PARTS[category.part][l]}</span>
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
                              style={selectedChapter === ch.slug ? { '--rc': ACCENT } as React.CSSProperties : undefined}
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
                  <span className="text-amber-400">{KRAL_PARTS[currentChapter.part][l]}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-zion-purple">{currentChapter.num[l]}</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight text-gradient">
                  {currentChapter.title[l]}
                </h2>
                <p className="text-gray-400">
                  {KRAL_PARTS[currentChapter.part][l]} · {currentChapter.num[l]}
                </p>
                {czFallback && l === 'en' && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                    <Languages className="w-3.5 h-3.5" />
                    {Copy.czOnly[l]}
                  </p>
                )}
              </div>
            )}

            <div className="zion-docs-pamber">
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
                <article className="pamber pamber-invert pamber-lg max-w-none">
                  <MarkdownDoc
                    content={content}
                    sourceFile={sourceFile}
                    bookSlugs={KRAL_SLUGS}
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
