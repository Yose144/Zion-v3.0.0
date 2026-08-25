'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Rocket,
  HelpCircle,
  FileText,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

interface Paper {
  id: string;
  title: { cs: string; en: string };
  description: { cs: string; en: string };
  file: string;
  format: 'md' | 'pdf';
}

interface Category {
  id: string;
  title: { cs: string; en: string };
  icon: React.ComponentType<{ className?: string }>;
  accentText: string;
  papers: Paper[];
}

const categories: Category[] = [
  {
    id: 'welcome',
    title: { cs: 'Vítej na palubě', en: 'Welcome Aboard' },
    icon: Rocket,
    accentText: 'text-zion-cyan',
    papers: [
      {
        id: 'massive-onboarding',
        title: { cs: 'Massive Onboarding — One Love', en: 'Massive Onboarding — One Love' },
        description: { cs: 'Jedna kniha, jedna síť, jeden riddim — plný příběh Sůl této země.', en: 'One book, one network, one riddim — the full Salt of the Earth story.' },
        file: 'MASSIVE_ONBOARDING.md',
        format: 'md',
      },
    ],
  },
  {
    id: 'quick',
    title: { cs: 'Rychlý start', en: 'Quick Start' },
    icon: FileText,
    accentText: 'text-zion-gold',
    papers: [
      {
        id: 'lite',
        title: { cs: 'Onboarding Lite — Rasta vibe', en: 'Onboarding Lite — Rasta vibe' },
        description: { cs: 'Rychlejší verze onboarding — pro ty, kteří chtějí rychle cítit riddim.', en: 'The quicker onboarding version — for those who want to feel the riddim fast.' },
        file: 'LITE.md',
        format: 'md',
      },
    ],
  },
  {
    id: 'faq',
    title: { cs: 'FAQ', en: 'FAQ' },
    icon: HelpCircle,
    accentText: 'text-gray-400',
    papers: [
      {
        id: 'faq',
        title: { cs: 'Často kladené otázky', en: 'Frequently asked questions' },
        description: { cs: 'Základní odpovědi: co je ZION, jak začít těžit, peněženka, nód, bridge, OASIS.', en: 'Basic answers: what is ZION, how to start mining, wallet, node, bridge, OASIS.' },
        file: 'faq.md',
        format: 'md',
      },
    ],
  },
];

const quickFacts = [
  { label: { cs: 'Konsensus', en: 'Consensus' }, value: 'Proof-of-Work' },
  { label: { cs: 'Block time', en: 'Block time' }, value: '60 s' },
  { label: { cs: 'Total supply', en: 'Total supply' }, value: '144B ZION' },
  { label: { cs: 'Block reward', en: 'Block reward' }, value: '5 400,067 ZION' },
  { label: { cs: 'Algoritmus', en: 'Algorithm' }, value: 'Ekam Deeksha' },
];

const allPapers = categories.flatMap(c => c.papers);

function findCategoryIdByPaper(paperId: string): string | null {
  return categories.find(c => c.papers.some(p => p.id === paperId))?.id ?? null;
}

export default function OnboardPage() {
  const { lang } = useLang();
  const [selectedPaper, setSelectedPaper] = useState('massive-onboarding');
  const [activeCategory, setActiveCategory] = useState('welcome');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ welcome: true, quick: true, faq: false });

  const currentPaper = allPapers.find(p => p.id === selectedPaper);
  const currentCategory = categories.find(c => c.id === activeCategory);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (hash && allPapers.find(p => p.id === hash)) {
      setSelectedPaper(hash);
      setActiveCategory(findCategoryIdByPaper(hash) ?? 'start');
    }
    const onHashChange = () => {
      const id = window.location.hash.replace('#', '');
      if (allPapers.find(p => p.id === id)) {
        setSelectedPaper(id);
        setActiveCategory(findCategoryIdByPaper(id) ?? 'start');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentHash = window.location.hash.replace('#', '');
    if (selectedPaper && currentHash !== selectedPaper) {
      window.history.replaceState(null, '', `#${selectedPaper}`);
    }
  }, [selectedPaper]);

  useEffect(() => {
    let isCancelled = false;

    async function loadPaper() {
      if (!currentPaper) return;

      if (currentPaper.format === 'pdf') {
        setContent('');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const langPrefix = lang === 'en' ? 'en/' : '';
        const response = await fetch(`/docs/onboard/${langPrefix}${currentPaper.file}`);
        if (!response.ok) throw new Error(`Failed to load ${currentPaper.file}`);
        const text = await response.text();
        if (!isCancelled) setContent(text);
      } catch (err) {
        console.error('Failed to load onboard doc:', err);
        if (!isCancelled) {
          setContent(`${tr('onboard', 'not_available_title', lang)}\n\n${currentPaper.title[lang]} (${currentPaper.file}) ${tr('onboard', 'not_available_body', lang)}`);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadPaper();
    return () => { isCancelled = true; };
  }, [selectedPaper, currentPaper, lang]);

  const handlePaperSelect = (paperId: string, categoryId: string) => {
    setSelectedPaper(paperId);
    setActiveCategory(categoryId);
    setExpanded(prev => ({ ...prev, [categoryId]: true }));
    setMobileMenuOpen(false);
  };

  const toggleCategory = (categoryId: string) => {
    setExpanded(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const pdfUrl = currentPaper && currentPaper.format === 'pdf' ? `/docs/onboard/${currentPaper.file}` : null;

  return (
    <div className="">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-zion-cyan/10 via-transparent to-transparent">
        <div className="zion-container py-20 relative">
          <div className="zion-rainbow-card max-w-4xl mx-auto p-8 md:p-10 text-center" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="zion-kicker mx-auto mb-6 w-fit border-zion-cyan/30 bg-zion-cyan/10 text-emerald-200">
              <Rocket className="w-4 h-4 text-zion-cyan" />
              <span className="text-sm text-emerald-200 font-semibold">{tr('onboard', 'hero_kicker', lang)}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gradient">
              {tr('onboard', 'hero_title', lang)}
            </h1>
            <p className="text-xl text-gray-400 mb-4">
              {tr('onboard', 'hero_subtitle', lang)}
            </p>
            <div className="zion-rainbow-sub mx-auto mb-8 max-w-3xl px-5 py-4 text-left text-sm text-gray-300" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              {tr('onboard', 'hero_description', lang)}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
              {quickFacts.map((fact, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm px-3 py-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{fact.label[lang]}</p>
                  <p className="text-sm font-semibold text-white font-mono break-all">{fact.value}</p>
                </div>
              ))}
            </div>

            <a
              href="https://github.com/Zion-TerraNova/2.9.6/tree/main/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-zion-cyan/30 bg-zion-cyan/10 px-5 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-zion-cyan/20 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              {tr('onboard', 'source_button', lang)}
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="zion-container py-12">
        {/* Mobile toggle */}
        <div className="lg:hidden sticky top-20 z-30 mb-6">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 zion-rainbow-sub text-white transition-colors"
            style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Rocket className="w-5 h-5 text-zion-cyan shrink-0" />
              <span className="font-semibold min-w-0 break-words">{currentCategory?.title[lang]}</span>
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {mobileMenuOpen && (
            <div className="mt-4 zion-rainbow-card p-4 space-y-2 max-h-[70vh] overflow-y-auto" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              {categories.map(category => {
                const Icon = category.icon;
                const isExpanded = expanded[category.id];
                const isActive = activeCategory === category.id;
                return (
                  <div key={category.id}>
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold transition-all ${
                        isActive ? 'zion-rainbow-sub text-white' : 'rounded-lg border border-white/10 bg-black/40 text-gray-400 hover:border-white/20 hover:text-gray-300'
                      }`}
                      style={isActive ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${category.accentText}`} />
                        {category.title[lang]}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && category.papers.map(paper => (
                      <button
                        key={paper.id}
                        onClick={() => handlePaperSelect(paper.id, category.id)}
                        className={`w-full text-left pl-10 pr-3 py-2 text-xs transition-all ${
                          selectedPaper === paper.id
                            ? 'zion-rainbow-sub text-emerald-200 font-medium'
                            : 'rounded text-gray-500 hover:text-gray-300'
                        }`}
                        style={selectedPaper === paper.id ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                      >
                        {paper.title[lang]}
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
            <div className="sticky top-24 zion-rainbow-card overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              <nav className="px-3 py-3 max-h-[calc(100vh-140px)] overflow-y-auto space-y-2">
                {categories.map(category => {
                  const Icon = category.icon;
                  const isExpanded = expanded[category.id];
                  const isActive = activeCategory === category.id;

                  return (
                    <div key={category.id}>
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-sm ${
                          isActive
                            ? 'zion-rainbow-sub text-white'
                            : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                        style={isActive ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${category.accentText}`} />
                          <span className="font-semibold">{category.title[lang]}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="ml-3 mt-1 border-l border-white/5 pl-2 space-y-0.5 pb-2">
                          {category.papers.map(paper => (
                            <button
                              key={paper.id}
                              onClick={() => handlePaperSelect(paper.id, category.id)}
                              className={`w-full text-left px-3 py-2 text-xs transition-all flex items-center gap-2 ${
                                selectedPaper === paper.id
                                  ? 'zion-rainbow-sub text-emerald-200 font-medium'
                                  : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                              style={selectedPaper === paper.id ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                            >
                              {paper.format === 'pdf' ? <ExternalLink className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
                              {paper.title[lang]}
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
            {currentPaper && (
              <div className="mb-10 pb-8 border-b border-white/10">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <span className={currentCategory?.accentText}>{currentCategory?.title[lang]}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-zion-cyan">{currentPaper.title[lang]}</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight text-gradient">
                  {currentPaper.title[lang]}
                </h1>
                <p className="text-gray-400">{currentPaper.description[lang]}</p>
                {currentPaper.format === 'pdf' && (
                  <a
                    href={pdfUrl ?? ''}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zion-cyan/20 hover:bg-zion-cyan/30 border border-zion-cyan/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {tr('onboard', 'download_pdf', lang)}
                    <ExternalLink className="h-3 w-3 opacity-60" />
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
              ) : currentPaper?.format === 'pdf' ? (
                <div className="space-y-6">
                  <p className="text-gray-400 text-lg">
                    {tr('onboard', 'pdf_notice', lang)}
                  </p>
                  <div className="aspect-[4/3] w-full rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
                    <iframe
                      src={pdfUrl ?? ''}
                      className="w-full h-full min-h-[600px]"
                      title={currentPaper.title[lang]}
                    />
                  </div>
                </div>
              ) : (
                <article className="prose prose-invert prose-lg max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-6 rounded-xl border border-white/10">
                          <table className="min-w-full">{children}</table>
                        </div>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </article>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
