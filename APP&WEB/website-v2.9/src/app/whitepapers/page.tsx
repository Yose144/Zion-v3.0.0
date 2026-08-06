'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen,
  FileText,
  Sparkles,
  ExternalLink,
  Download,
  ChevronRight,
  ChevronDown,
  Cpu,
  Menu,
  X,
  Scroll,
  ScrollText,
  Library,
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
    id: 'overview',
    title: { cs: 'Přehled', en: 'Overview' },
    icon: BookOpen,
    accentText: 'text-zion-purple-300',
    papers: [
      {
        id: 'readme',
        title: { cs: 'README — ZION Whitepapers & Documentation', en: 'README — ZION Whitepapers & Documentation' },
        description: { cs: 'Úvodní index do veřejné dokumentace ZION TerraNova v3.', en: 'Introductory index to the public ZION TerraNova v3 documentation.' },
        file: 'README.md',
        format: 'md',
      },
    ],
  },
  {
    id: 'master',
    title: { cs: 'Master / Kanonická syntéza', en: 'Master / Canonical Synthesis' },
    icon: Sparkles,
    accentText: 'text-zion-gold',
    papers: [
      {
        id: 'master-3.2-cz',
        title: { cs: 'One Love 3.2 (CZ)', en: 'One Love 3.2 (CZ)' },
        description: { cs: 'Kanonická syntéza všech čtyř knih pro Mainnet Stable 3.2 "One Love". Inspirováno duchem Boba Marleye.', en: 'Canonical synthesis of all four books for Mainnet Stable 3.2 "One Love." Inspired by the spirit of Bob Marley.' },
        file: 'ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_CZ.md',
        format: 'md',
      },
      {
        id: 'master-3.2-en',
        title: { cs: 'One Love 3.2 (EN)', en: 'One Love 3.2 (EN)' },
        description: { cs: 'Anglický překlad One Love.', en: 'English translation of the One Love whitepaper.' },
        file: 'ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_EN.md',
        format: 'md',
      },
      {
        id: 'master-cz',
        title: { cs: 'Zlatá kniha 3.1 (CZ)', en: 'Golden Book 3.1 (CZ)' },
        description: { cs: 'Kanonická syntéza všech čtyř knih pro Mainnet Alpha 3.1 (předchozí).', en: 'Canonical synthesis of all four books for Mainnet Alpha 3.1 (previous).' },
        file: 'ZION_MASTER_WHITEPAPER_3.1_CZ.md',
        format: 'md',
      },
      {
        id: 'master-en',
        title: { cs: 'Golden Book 3.1 (EN)', en: 'Golden Book 3.1 (EN)' },
        description: { cs: 'Anglický překlad Zlaté knihy (předchozí).', en: 'English translation of the Golden Book (previous).' },
        file: 'ZION_MASTER_WHITEPAPER_3.1_EN.md',
        format: 'md',
      },
    ],
  },
  {
    id: 'story',
    title: { cs: 'Příběh / Narrativ', en: 'Story / Narrative' },
    icon: Scroll,
    accentText: 'text-zion-cyan-400',
    papers: [
      {
        id: 'genesis-cz',
        title: { cs: 'Kniha Zrození v3.0 (PDF, CZ)', en: 'Book of Genesis v3.0 (PDF, CZ)' },
        description: { cs: 'Původní příběh, šestifázový algoritmus, Zlaté vejce, šest vrstev.', en: 'Origin story, six-phase algorithm, Golden Egg, six layers.' },
        file: 'ZION_Kniha_Zrozeni_v3.0_CZ.pdf',
        format: 'pdf',
      },
      {
        id: 'genesis-en',
        title: { cs: 'Book of Genesis v3.0 (PDF, EN)', en: 'Book of Genesis v3.0 (PDF, EN)' },
        description: { cs: 'Anglický překlad Knihy Zrození.', en: 'English translation of the Book of Genesis.' },
        file: 'ZION_Book_of_Genesis_v3.0_EN.pdf',
        format: 'pdf',
      },
      {
        id: 'wplite-cz',
        title: { cs: 'WpLite — Báje pro dospělé (PDF, CZ)', en: 'WpLite — Fable Edition (PDF, CZ)' },
        description: { cs: 'Pohádka pro dospělé s ověřitelnými kronikálními záznamy.', en: 'A fairy tale for grown-ups with verifiable chronicle entries.' },
        file: 'Zion-WpLite_CZ.pdf',
        format: 'pdf',
      },
      {
        id: 'wplite-en',
        title: { cs: 'WpLite — Fable Edition (PDF, EN)', en: 'WpLite — Fable Edition (PDF, EN)' },
        description: { cs: 'Anglická verze bájí.', en: 'English fable edition.' },
        file: 'Zion-WpLite_EN.pdf',
        format: 'pdf',
      },
      {
        id: 'story6-cz',
        title: { cs: 'WpStory6 — Kronika v3.0.1 → v3.0.6 (CZ)', en: 'WpStory6 — Chronicle v3.0.1 → v3.0.6 (CZ)' },
        description: { cs: 'Růstová kronika od prvního genesis k Trinity.', en: 'Growth chronicle from first genesis to Trinity.' },
        file: 'WpStory6_CZ.md',
        format: 'md',
      },
      {
        id: 'story6-en',
        title: { cs: 'WpStory6 — Chronicle v3.0.1 → v3.0.6 (EN)', en: 'WpStory6 — Chronicle v3.0.1 → v3.0.6 (EN)' },
        description: { cs: 'Anglická verze kroniky.', en: 'English version of the chronicle.' },
        file: 'WpStory6_EN.md',
        format: 'md',
      },
    ],
  },
  {
    id: 'technical',
    title: { cs: 'Technické Whitepapery', en: 'Technical Whitepapers' },
    icon: Cpu,
    accentText: 'text-zion-cyan',
    papers: [
      {
        id: 'technical-cz',
        title: { cs: 'Technický Whitepaper v3.1 (CZ)', en: 'Technical Whitepaper v3.1 (CZ)' },
        description: { cs: 'Konsensus, ekonomika, architektura a bezpečnost.', en: 'Consensus, economics, architecture, and security.' },
        file: 'ZION_Technical_Whitepaper_v3.1_CZ.md',
        format: 'md',
      },
      {
        id: 'technical-en',
        title: { cs: 'Technical Whitepaper v3.1 (EN)', en: 'Technical Whitepaper v3.1 (EN)' },
        description: { cs: 'Anglický překlad technické reference.', en: 'English translation of the technical reference.' },
        file: 'ZION_Technical_Whitepaper_v3.1_EN.md',
        format: 'md',
      },
    ],
  },
];

const quickFacts = [
  { label: { cs: 'Genesishash', en: 'Genesis hash' }, value: '4f75a0df…79bd6e', full: '08a94fb04ad084724af33b62c81b84a3472c32d89bbeccd0a8751fd893bfa122' },
  { label: { cs: 'Total supply', en: 'Total supply' }, value: '144B ZION' },
  { label: { cs: 'Premine', en: 'Premine' }, value: '16.78B ZION' },
  { label: { cs: 'Block split', en: 'Block split' }, value: '89/5/5/1' },
  { label: { cs: 'Licence', en: 'License' }, value: 'MIT' },
];

const allPapers = categories.flatMap(c => c.papers);

function findCategoryIdByPaper(paperId: string): string | null {
  return categories.find(c => c.papers.some(p => p.id === paperId))?.id ?? null;
}

export default function WhitepapersPage() {
  const { lang } = useLang();
  const [selectedPaper, setSelectedPaper] = useState('readme');
  const [activeCategory, setActiveCategory] = useState('overview');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ overview: true, master: false, story: false, technical: false });

  const currentPaper = allPapers.find(p => p.id === selectedPaper);
  const currentCategory = categories.find(c => c.id === activeCategory);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (hash && allPapers.find(p => p.id === hash)) {
      setSelectedPaper(hash);
      setActiveCategory(findCategoryIdByPaper(hash) ?? 'overview');
    }
    const onHashChange = () => {
      const id = window.location.hash.replace('#', '');
      if (allPapers.find(p => p.id === id)) {
        setSelectedPaper(id);
        setActiveCategory(findCategoryIdByPaper(id) ?? 'overview');
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
        const response = await fetch(`/docs/WP/${currentPaper.file}`);
        if (!response.ok) throw new Error(`Failed to load ${currentPaper.file}`);
        const text = await response.text();
        if (!isCancelled) setContent(text);
      } catch (err) {
        console.error('Failed to load whitepaper:', err);
        if (!isCancelled) {
          setContent(`${tr('whitepapers', 'not_available_title', lang)}\n\n${currentPaper.title[lang]} (${currentPaper.file}) ${tr('whitepapers', 'not_available_body', lang)}`);
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

  const pdfUrl = currentPaper && currentPaper.format === 'pdf' ? `/docs/WP/${currentPaper.file}` : null;

  return (
    <div className="">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-zion-purple-600/10 via-transparent to-transparent">
        <div className="zion-container py-20 relative">
          <div className="zion-rainbow-card max-w-4xl mx-auto p-8 md:p-10 text-center" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="zion-kicker mx-auto mb-6 w-fit border-zion-purple-400/30 bg-zion-purple-400/10 text-violet-200">
              <BookOpen className="w-4 h-4 text-zion-purple-300" />
              <span className="text-sm text-violet-200 font-semibold">{tr('whitepapers', 'hero_kicker', lang)}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gradient">
              {tr('whitepapers', 'hero_title', lang)}
            </h1>
            <p className="text-xl text-gray-400 mb-4">
              {tr('whitepapers', 'hero_subtitle', lang)}
            </p>
            <div className="zion-rainbow-sub mx-auto mb-8 max-w-3xl px-5 py-4 text-left text-sm text-gray-300" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              {tr('whitepapers', 'hero_description', lang)}
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
              href="https://github.com/Zion-TerraNova/v3-Mainnet/tree/main/docs/WP"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-zion-purple-500/30 bg-zion-purple-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 hover:bg-zion-purple-500/20 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              {tr('whitepapers', 'source_button', lang)}
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
            style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-5 h-5 text-zion-purple-300 shrink-0" />
              <span className="font-semibold min-w-0 break-words">{currentCategory?.title[lang]}</span>
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {mobileMenuOpen && (
            <div className="mt-4 zion-rainbow-card p-4 space-y-2 max-h-[70vh] overflow-y-auto" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
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
                      style={isActive ? { '--rc': '228, 30, 43' } as React.CSSProperties : undefined}
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
                            ? 'zion-rainbow-sub text-violet-200 font-medium'
                            : 'rounded text-gray-500 hover:text-gray-300'
                        }`}
                        style={selectedPaper === paper.id ? { '--rc': '228, 30, 43' } as React.CSSProperties : undefined}
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
            <div className="sticky top-24 zion-rainbow-card overflow-hidden" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
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
                        style={isActive ? { '--rc': '228, 30, 43' } as React.CSSProperties : undefined}
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
                                  ? 'zion-rainbow-sub text-violet-200 font-medium'
                                  : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                              style={selectedPaper === paper.id ? { '--rc': '228, 30, 43' } as React.CSSProperties : undefined}
                            >
                              {paper.format === 'pdf' ? <Download className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
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
                  <span className="text-zion-purple-300">{currentPaper.title[lang]}</span>
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
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zion-cyan-500/20 hover:bg-zion-cyan-500/30 border border-zion-cyan-500/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    {tr('whitepapers', 'download_pdf', lang)}
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
                    {tr('whitepapers', 'pdf_notice', lang)}
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
