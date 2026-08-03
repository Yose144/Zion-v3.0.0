'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Rocket,
  Flame,
  BookOpen,
  HelpCircle,
  Monitor,
  Wallet,
  Server,
  Pickaxe,
  Code,
  ArrowLeftRight,
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
    accentText: 'text-emerald-300',
    papers: [
      {
        id: 'readme',
        title: { cs: 'ZION — Vítej na palubě', en: 'ZION — Welcome Aboard' },
        description: { cs: 'Marketingový přehled: příběh, tři cesty a první krok.', en: 'Marketing overview: story, three paths, and first step.' },
        file: 'README.md',
        format: 'md',
      },
    ],
  },
  {
    id: 'now',
    title: { cs: 'Proč začít teď', en: 'Why Start Now' },
    icon: Flame,
    accentText: 'text-amber-400',
    papers: [
      {
        id: 'why-now',
        title: { cs: 'Hodina před deštěm', en: 'The Hour Before the Rain' },
        description: { cs: 'Nejvyšší odměna za blok, jakou kdy ZION vyplatí, je dnes. Skutečný příběh Bitcoin Pizza Day a poctivá matematika rané sítě.', en: 'The highest block reward ZION will ever pay is today. The true story of Bitcoin Pizza Day and the honest math of an early network.' },
        file: 'book/12-hodina-pred-destem.md',
        format: 'md',
      },
    ],
  },
  {
    id: 'story',
    title: { cs: 'Sůl této země — kniha', en: 'Salt of the Earth — the book' },
    icon: BookOpen,
    accentText: 'text-violet-300',
    papers: [
      {
        id: 'book-00',
        title: { cs: 'Úvod — dvanáct zastavení', en: 'Introduction — twelve stops' },
        description: { cs: 'Obsah celé knihy a jak ji číst.', en: 'The full table of contents and how to read it.' },
        file: 'book/00-index.md',
        format: 'md',
      },
      {
        id: 'book-01',
        title: { cs: '1. Sůl země', en: '1. Salt of the Earth' },
        description: { cs: 'Ježíš — podobenství o soli, která nesmí ztratit chuť.', en: 'Jesus — the parable of salt that must not lose its taste.' },
        file: 'book/01-sul-zeme.md',
        format: 'md',
      },
      {
        id: 'book-02',
        title: { cs: '2. Rozpuštění', en: '2. Dissolution' },
        description: { cs: 'Buddha a střední cesta — sůl se má rozpouštět, ne hromadit.', en: 'Buddha and the middle way — salt should dissolve, not pile up.' },
        file: 'book/02-rozpusteni.md',
        format: 'md',
      },
      {
        id: 'book-03',
        title: { cs: '3. Chuť vody', en: '3. The Taste of Water' },
        description: { cs: 'Krišna, višvarúpa a karma jóga — práce bez lpění na výsledku.', en: 'Krishna, vishvarupa, and karma yoga — work without attachment to outcome.' },
        file: 'book/03-chut-vody.md',
        format: 'md',
      },
      {
        id: 'book-04',
        title: { cs: '4. Cesta nevyšlapaná', en: '4. The Untrodden Path' },
        description: { cs: 'Ráma, Sítá a Hanuman — kompas místo mapy, most místo trůnu.', en: 'Rama, Sita, and Hanuman — a compass instead of a map, a bridge instead of a throne.' },
        file: 'book/04-cesta-nevyslapana.md',
        format: 'md',
      },
      {
        id: 'book-05',
        title: { cs: '5. Archa', en: '5. The Ark' },
        description: { cs: 'Noe — kdo vejde dřív, než začne pršet.', en: 'Noah — who enters before it starts raining.' },
        file: 'book/05-archa.md',
        format: 'md',
      },
      {
        id: 'book-06',
        title: { cs: '6. Kompas a pozvánka do Oasis', en: '6. The Compass and the Invitation to Oasis' },
        description: { cs: 'Syntéza všech postav a první vstup do herní vrstvy L4.', en: 'A synthesis of all the characters and the first entry into the L4 game layer.' },
        file: 'book/06-kompas-a-pozvanka-do-oasis.md',
        format: 'md',
      },
      {
        id: 'book-07',
        title: { cs: '7. Epilog — Názor AI', en: '7. Epilogue — An AI\u2019s Opinion' },
        description: { cs: 'Otevřené, kritické hodnocení projektu, rizik a rámce.', en: 'An open, critical assessment of the project, its risks, and its framing.' },
        file: 'book/07-epilog-nazor-ai.md',
        format: 'md',
      },
      {
        id: 'book-08',
        title: { cs: '8. ZION — Nová civilizace', en: '8. ZION — A New Civilization' },
        description: { cs: 'Komplexní pozvánka: co je ŽIVÉ, co je STAVBA a co je HORIZONT.', en: 'A comprehensive invitation: what is LIVE, what is UNDER CONSTRUCTION, and what is the HORIZON.' },
        file: 'book/08-zion-nova-civilizace.md',
        format: 'md',
      },
      {
        id: 'book-09',
        title: { cs: '9. Bohyně Rádha a avataři', en: '9. Goddess Radha and the Avatars' },
        description: { cs: 'Radost a lidská tvář Oasis — proč čísla samotná nestačí.', en: 'Joy and the human face of Oasis — why numbers alone are not enough.' },
        file: 'book/09-bohyne-radha-a-avatari-oasis.md',
        format: 'md',
      },
      {
        id: 'book-10',
        title: { cs: '10. První svět Oasis', en: '10. The First World of Oasis' },
        description: { cs: 'Zahrada Hiranyagarbha, 8 teritorií a Best of Avataři.', en: 'The Garden of Hiranyagarbha, 8 territories, and the Best of Avatars.' },
        file: 'book/10-prvni-svet-oasis-a-best-of-avatari.md',
        format: 'md',
      },
      {
        id: 'book-11',
        title: { cs: '11. Brána prvního hráče', en: '11. The First Player\u2019s Gate' },
        description: { cs: 'Vstup do Oasis, vlastní postava a sedm cest.', en: 'Entering Oasis, your own character, and the seven paths.' },
        file: 'book/11-brana-prvniho-hrace-a-volba-cesty.md',
        format: 'md',
      },
      {
        id: 'book-12',
        title: { cs: '12. Hodina před deštěm', en: '12. The Hour Before the Rain' },
        description: { cs: 'Uzavírací kapitola pro stavitele a těžaře — proč je výhodné začít, dokud je síť malá.', en: 'The closing chapter for builders and miners — why it pays to start while the network is small.' },
        file: 'book/12-hodina-pred-destem.md',
        format: 'md',
      },
    ],
  },
  {
    id: 'faq',
    title: { cs: 'Pro zájemce — FAQ', en: 'For the curious — FAQ' },
    icon: HelpCircle,
    accentText: 'text-gray-400',
    papers: [
      {
        id: 'faq',
        title: { cs: 'Technický FAQ', en: 'Technical FAQ' },
        description: { cs: 'Přehled technických návodů pro ty, co chtějí jít hlouběji.', en: 'Overview of technical guides for those who want to go deeper.' },
        file: 'faq.md',
        format: 'md',
      },
      {
        id: 'desktop',
        title: { cs: 'ZION Public Miner pro začátečníky', en: 'ZION Public Miner for beginners' },
        description: { cs: 'Instalace na Windows 11 a macOS, povolení v nastavení, vytvoření peněženky a start těžby.', en: 'Install on Windows 11 and macOS, allow in settings, create wallet, and start mining.' },
        file: 'desktop.md',
        format: 'md',
      },
      {
        id: 'wallet',
        title: { cs: 'Peněženka ZION', en: 'ZION Wallet' },
        description: { cs: 'Vytvoření, záloha a bezpečné používání adresy.', en: 'Create, back up, and securely use a ZION address.' },
        file: 'wallet.md',
        format: 'md',
      },
      {
        id: 'mining',
        title: { cs: 'Těžba ZION', en: 'ZION Mining' },
        description: { cs: 'Připojení na pool, reward distribuce a tipy.', en: 'Pool connection, reward distribution, and tips.' },
        file: 'mining.md',
        format: 'md',
      },
      {
        id: 'node',
        title: { cs: 'Spuštění nodu', en: 'Run a Node' },
        description: { cs: 'Build, systemd služba a veřejný RPC.', en: 'Build, systemd service, and public RPC.' },
        file: 'node.md',
        format: 'md',
      },
      {
        id: 'bridge',
        title: { cs: 'Bridge a WARP', en: 'Bridge & WARP' },
        description: { cs: 'wZION, most mezi L1 a L2 a API.', en: 'wZION, L1↔L2 bridge, and API.' },
        file: 'bridge.md',
        format: 'md',
      },
      {
        id: 'dapp',
        title: { cs: 'První DApp na ZION', en: 'First DApp on ZION' },
        description: { cs: 'Node.js server a JSON-RPC volání.', en: 'Node.js server and JSON-RPC calls.' },
        file: 'dapp.md',
        format: 'md',
      },
    ],
  },
];

const quickFacts = [
  { label: { cs: 'Konsensus', en: 'Consensus' }, value: 'Proof-of-Work' },
  { label: { cs: 'Block time', en: 'Block time' }, value: '60 s' },
  { label: { cs: 'Total supply', en: 'Total supply' }, value: '144B ZION' },
  { label: { cs: 'Block reward', en: 'Block reward' }, value: '5 400 ZION' },
  { label: { cs: 'Algoritmus', en: 'Algorithm' }, value: 'Cosmic Harmony' },
];

const allPapers = categories.flatMap(c => c.papers);

function findCategoryIdByPaper(paperId: string): string | null {
  return categories.find(c => c.papers.some(p => p.id === paperId))?.id ?? null;
}

export default function OnboardPage() {
  const { lang } = useLang();
  const [selectedPaper, setSelectedPaper] = useState('readme');
  const [activeCategory, setActiveCategory] = useState('welcome');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ welcome: true, now: false, story: false, faq: false });

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
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-emerald-600/10 via-transparent to-transparent">
        <div className="zion-container py-20 relative">
          <div className="zion-rainbow-card max-w-4xl mx-auto p-8 md:p-10 text-center" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="zion-kicker mx-auto mb-6 w-fit border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
              <Rocket className="w-4 h-4 text-emerald-300" />
              <span className="text-sm text-emerald-200 font-semibold">{tr('onboard', 'hero_kicker', lang)}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gradient">
              {tr('onboard', 'hero_title', lang)}
            </h1>
            <p className="text-xl text-gray-400 mb-4">
              {tr('onboard', 'hero_subtitle', lang)}
            </p>
            <div className="zion-rainbow-sub mx-auto mb-8 max-w-3xl px-5 py-4 text-left text-sm text-gray-300" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
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

            <button
              onClick={() => handlePaperSelect('why-now', 'now')}
              className="w-full mb-8 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-left hover:bg-amber-400/15 transition-colors"
            >
              <Flame className="h-8 w-8 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-semibold text-amber-100">{tr('onboard', 'now_title', lang)}</p>
                <p className="text-xs sm:text-sm text-amber-200/70">{tr('onboard', 'now_body', lang)}</p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-100 whitespace-nowrap">
                {tr('onboard', 'now_cta', lang)} <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>

            <a
              href="https://github.com/Zion-TerraNova/2.9.6/tree/main/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 transition-colors"
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
            style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Rocket className="w-5 h-5 text-emerald-300 shrink-0" />
              <span className="font-semibold min-w-0 break-words">{currentCategory?.title[lang]}</span>
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {mobileMenuOpen && (
            <div className="mt-4 zion-rainbow-card p-4 space-y-2 max-h-[70vh] overflow-y-auto" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
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
                      style={isActive ? { '--rc': '16, 185, 129' } as React.CSSProperties : undefined}
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
                        style={selectedPaper === paper.id ? { '--rc': '16, 185, 129' } as React.CSSProperties : undefined}
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
            <div className="sticky top-24 zion-rainbow-card overflow-hidden" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
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
                        style={isActive ? { '--rc': '16, 185, 129' } as React.CSSProperties : undefined}
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
                              style={selectedPaper === paper.id ? { '--rc': '16, 185, 129' } as React.CSSProperties : undefined}
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
                  <span className="text-emerald-300">{currentPaper.title[lang]}</span>
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
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors"
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
