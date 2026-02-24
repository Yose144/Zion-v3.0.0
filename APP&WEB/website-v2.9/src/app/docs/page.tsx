'use client';

import { useState, useEffect } from 'react';
import { Book, BookOpen, Code2, Rocket, Shield, Zap, FileText, Github, ExternalLink, ChevronRight, ChevronDown, Sparkles, Menu, X, Infinity, Users, HelpCircle, Globe, GitBranch, Lock, Layers, Coins } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PhilosophyContent from '@/components/docs/PhilosophyContent';

/* ═══════════════════════════════════════════
   Version Tree — each version is a "branch"
   with its own categories & docs
   ═══════════════════════════════════════════ */

interface Doc {
  id: string;
  title: string;
  file: string;
}

interface Category {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  docs: Doc[];
}

interface Version {
  id: string;
  label: string;
  tag: string;
  tagColor: string;
  description: string;
  categories: Category[];
}

const versions: Version[] = [
  {
    id: 'v2.9.6',
    label: 'v2.9.6',
    tag: 'CURRENT',
    tagColor: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
    description: 'Pre-Mainnet Fork — 6-Layer „On the Star“ + Decade Decay',
    categories: [
      {
        id: 'v296-overview',
        title: 'Přehled',
        icon: Rocket,
        docs: [
          { id: 'v296-readme', title: 'Přehled v2.9.6', file: 'v2.9.6/README.md' },
          { id: 'v296-changelog', title: 'Co je nového', file: 'v2.9.6/changelog.md' },
          { id: 'v296-migration', title: 'Migrace z v2.9.5', file: 'v2.9.6/migration.md' },
        ]
      },
      {
        id: 'v296-layers',
        title: '6-Layer Architektura',
        icon: Layers,
        docs: [
          { id: 'v296-layer-architecture', title: 'On the Star — 6 vrstev', file: 'v2.9.6/layer-architecture.md' },
        ]
      },
      {
        id: 'v296-economics',
        title: 'Ekonomika',
        icon: Coins,
        docs: [
          { id: 'v296-tokenomics', title: 'Tokenomics — Decade Decay (Model A)', file: 'v2.9.6/tokenomics.md' },
        ]
      },
      {
        id: 'v296-architecture',
        title: 'Protokol',
        icon: Code2,
        docs: [
          { id: 'v296-consensus', title: 'Konsenzus změny', file: 'v2.9.6/consensus.md' },
          { id: 'v296-p2p', title: 'P2P síťový protokol', file: 'v2.9.6/p2p.md' },
        ]
      },
      {
        id: 'v296-mainnet',
        title: 'Mainnet příprava',
        icon: Shield,
        docs: [
          { id: 'v296-launch-plan', title: 'Launch plán', file: 'v2.9.6/launch-plan.md' },
          { id: 'v296-audit', title: 'Bezpečnostní audit', file: 'v2.9.6/audit.md' },
        ]
      },
    ]
  },
  {
    id: 'v2.9.5',
    label: 'v2.9.5',
    tag: 'PREVIOUS',
    tagColor: 'text-gray-400 border-gray-400/30 bg-gray-400/5',
    description: 'Native Awakening — předchozí verze',
    categories: [
      {
        id: 'getting-started',
        title: 'Začínáme',
        icon: Rocket,
        docs: [
          { id: 'index', title: 'Úvod do dokumentace', file: 'index.md' },
          { id: 'getting-started', title: 'Quick Start', file: 'getting-started.md' },
          { id: 'setup', title: 'Pokročilý Setup', file: 'setup.md' },
          { id: 'faq', title: 'Často kladené otázky', file: 'faq.md' },
        ]
      },
      {
        id: 'architecture',
        title: 'Architektura',
        icon: Code2,
        docs: [
          { id: 'arch-overview', title: 'Přehled architektury', file: 'architecture/overview.md' },
          { id: 'arch-mining', title: 'Mining architektura', file: 'architecture/mining.md' },
        ]
      },
      {
        id: 'guides',
        title: 'Průvodci',
        icon: BookOpen,
        docs: [
          { id: 'mining-guide', title: 'Mining průvodce', file: 'mining-guide.md' },
          { id: 'pool-setup', title: 'Pool Setup', file: 'pool-setup.md' },
          { id: 'api', title: 'API Reference', file: 'api.md' },
        ]
      },
      {
        id: 'tutorials',
        title: 'Tutoriály',
        icon: Zap,
        docs: [
          { id: 'tutorial-index', title: 'Přehled tutoriálů', file: 'tutorials/index.md' },
          { id: 'tutorial-dapp', title: 'První DApp', file: 'tutorials/first-dapp.md' },
        ]
      },
      {
        id: 'whitepaper',
        title: 'Whitepaper',
        icon: FileText,
        docs: [
          { id: 'whitepaper-295-full', title: 'Whitepaper v2.9.5 (kompletní)', file: 'whitepaper/ZION_Whitepaper_v2.9.5_FULL.md' },
          { id: 'whitepaper-lite', title: 'Whitepaper Lite', file: 'whitepaper-lite.md' },
          { id: 'whitepaper-governance', title: 'Governance', file: 'whitepaper/governance.md' },
          { id: 'whitepaper-security', title: 'Bezpečnost', file: 'whitepaper/security.md' },
          { id: 'whitepaper-roadmap', title: 'Roadmap', file: 'whitepaper/roadmap.md' },
          { id: 'whitepaper-285', title: 'Whitepaper v2.8.5 (archiv)', file: 'whitepaper/ZION_Whitepaper_v2.8.5.md' },
        ]
      },
      {
        id: 'cosmic',
        title: 'Cosmic Map',
        icon: Sparkles,
        docs: [
          { id: 'cosmic-map-full', title: 'Cosmic Map (veřejná edice)', file: 'whitepaper/COSMIC_MAP_2.8.5_PUBLIC_EDITION.md' },
          { id: 'cosmic-map-complete', title: 'Cosmic Map Atlas', file: 'whitepaper/COSMIC_MAP_2.8.5_COMPLETE.md' },
        ]
      },
      {
        id: 'ecosystem',
        title: 'Ekosystém',
        icon: Globe,
        docs: [
          { id: 'core-tech', title: 'Core dokumentace', file: 'whitepaper/CORE_2.8.5.md' },
          { id: 'humanitarian-tithe', title: 'Humanitarian Tithe', file: 'whitepaper/HUMANITARIAN_TITHE_2.8.5.md' },
          { id: 'sacred-knowledge', title: 'Sacred Knowledge', file: 'whitepaper/SACRED_KNOWLEDGE_2.8.5.md' },
          { id: 'zion-oasis', title: 'ZION Oasis', file: 'whitepaper/ZION_OASIS_2.8.5.md' },
          { id: 'zion-victory', title: 'Victory 2025', file: 'whitepaper/ZION_VICTORY_2025.md' },
          { id: 'community', title: 'Komunita & Ekosystém', file: 'community.md' },
        ]
      },
      {
        id: 'philosophy',
        title: 'Filozofie',
        icon: Infinity,
        docs: [
          { id: 'philosophy', title: 'Native Philosophy', file: '__philosophy__' },
        ]
      },
    ]
  },
];

function findCategoryIdByDoc(docId: string): string | null {
  const category = versions
    .flatMap((version) => version.categories)
    .find((cat) => cat.docs.some((doc) => doc.id === docId));
  return category?.id ?? null;
}

export default function DocsPage() {
  const [activeVersion, setActiveVersion] = useState('v2.9.6');
  const [selectedDoc, setSelectedDoc] = useState('v296-readme');
  const [activeCategory, setActiveCategory] = useState('v296-overview');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({ 'v2.9.5': false, 'v2.9.6': true });

  // Get current version data
  const currentVersion = versions.find(v => v.id === activeVersion) || versions[1];
  const docCategories = currentVersion.categories;

  // Find current doc across all versions
  const currentDoc = versions
    .flatMap(v => v.categories)
    .flatMap(cat => cat.docs)
    .find(doc => doc.id === selectedDoc);

  // Sync with URL hash
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setSelectedDoc(hash);
      const categoryId = findCategoryIdByDoc(hash);
      if (categoryId) {
        setActiveCategory(categoryId);
      }
    }

    const onHashChange = () => {
      const id = window.location.hash.replace('#', '');
      if (id) {
        setSelectedDoc(id);
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Update hash when doc changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentHash = window.location.hash.replace('#', '');
    if (selectedDoc && currentHash !== selectedDoc) {
      window.history.replaceState(null, '', `#${selectedDoc}`);
    }
  }, [selectedDoc]);

  // Load markdown content
  useEffect(() => {
    let isCancelled = false;

    async function loadDoc() {
      if (!currentDoc) return;
      // Philosophy is a TSX component, not markdown — skip fetch
      if (currentDoc.file === '__philosophy__') {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const response = await fetch(`/docs/${currentDoc.file}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${currentDoc.file}`);
        }
        const text = await response.text();
        if (!isCancelled) {
          setContent(text);
        }
      } catch (err) {
        console.error('Failed to load document:', err);
        if (!isCancelled) {
          setContent(`# Document Not Available\n\nThe document **${currentDoc?.title}** (${currentDoc?.file}) is currently not available.\n\nPlease check back later or try another document from the navigation.`);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadDoc();

    return () => {
      isCancelled = true;
    };
  }, [selectedDoc, currentDoc]);

  const handleDocSelect = (docId: string, categoryId: string, versionId: string) => {
    setSelectedDoc(docId);
    setActiveCategory(categoryId);
    setActiveVersion(versionId);
    setExpandedVersions(prev => ({ ...prev, [versionId]: true }));
  };

  const toggleVersion = (versionId: string) => {
    setExpandedVersions(prev => ({ ...prev, [versionId]: !prev[versionId] }));
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-white/10 bg-linear-to-b from-zion-cyan/10 via-transparent to-transparent">
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/5 mb-6">
              <BookOpen className="w-4 h-4 text-zion-cyan" />
              <span className="text-sm text-zion-cyan font-semibold">Knowledge Base</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 text-gradient">
              ZION DOKUMENTACE
            </h1>
            <p className="text-xl text-gray-400 mb-4">
              Kompletní průvodci, API reference &amp; architektura protokolu
            </p>
            <div className="flex items-center justify-center gap-3 mb-8">
              {versions.map(v => (
                <button
                  key={v.id}
                  onClick={() => {
                    setActiveVersion(v.id);
                    setExpandedVersions(prev => ({ ...prev, [v.id]: true }));
                    const firstDoc = v.categories[0]?.docs[0];
                    if (firstDoc) {
                      setSelectedDoc(firstDoc.id);
                      setActiveCategory(v.categories[0].id);
                    }
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-mono font-semibold transition-all ${
                    activeVersion === v.id
                      ? 'border-zion-gold/50 bg-zion-gold/10 text-zion-gold'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {v.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${v.tagColor}`}>
                    {v.tag}
                  </span>
                </button>
              ))}
            </div>
            
            {/* Quick Links */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://github.com/Zion-TerraNova"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-white hover:border-zion-gold/50 transition-all"
              >
                <Github className="w-5 h-5" />
                GitHub
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="/health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-white hover:border-zion-cyan/50 transition-all"
              >
                <Zap className="w-5 h-5 text-zion-cyan" />
                API Health
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-3 lg:px-2 xl:px-0 py-12">
        {/* Mobile Navigation Toggle */}
        <div className="lg:hidden mb-6">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl text-white hover:border-zion-cyan/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-zion-cyan" />
              <span className="font-semibold">{currentVersion.label} — {currentVersion.description}</span>
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Mobile Navigation Dropdown */}
          {mobileMenuOpen && (
            <div className="mt-4 border border-white/10 rounded-2xl p-4 bg-black/80 backdrop-blur-xl space-y-3">
              {versions.map(version => (
                <div key={version.id}>
                  <button
                    onClick={() => toggleVersion(version.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 mb-2"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <GitBranch className="w-4 h-4 text-zion-cyan" />
                      {version.label}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${version.tagColor}`}>
                        {version.tag}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${expandedVersions[version.id] ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedVersions[version.id] && version.categories.map(category => {
                    const Icon = category.icon;
                    const isActive = activeCategory === category.id && activeVersion === version.id;
                    return (
                      <div key={category.id} className="ml-3">
                        <button
                          onClick={() => { setActiveCategory(category.id); setActiveVersion(version.id); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                            isActive ? 'bg-zion-cyan/10 text-zion-cyan' : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {category.title}
                        </button>
                        {isActive && (
                          <div className="mt-1 ml-6 space-y-1 border-l border-zion-cyan/20 pl-3 mb-2">
                            {category.docs.map(doc => (
                              <button
                                key={doc.id}
                                onClick={() => { handleDocSelect(doc.id, category.id, version.id); setMobileMenuOpen(false); }}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs ${
                                  selectedDoc === doc.id ? 'text-zion-gold font-medium' : 'text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                {doc.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-8">
          {/* ═══ Sidebar — Version Tree ═══ */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 border border-white/10 rounded-2xl bg-black/60 backdrop-blur-xl overflow-hidden">
              {/* Version Selector Header */}
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <GitBranch className="w-3.5 h-3.5" />
                  Version Tree
                </h3>
              </div>

              {/* Scrollable nav area */}
              <nav className="px-3 pb-4 max-h-[calc(100vh-180px)] overflow-y-auto space-y-1">
                {versions.map(version => {
                  const isExpanded = expandedVersions[version.id];
                  const isActiveVersion = activeVersion === version.id;

                  return (
                    <div key={version.id}>
                      {/* Version Branch Header */}
                      <button
                        onClick={() => toggleVersion(version.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-sm ${
                          isActiveVersion
                            ? 'bg-white/5 border border-white/10'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <GitBranch className={`w-4 h-4 ${isActiveVersion ? 'text-zion-gold' : 'text-gray-500'}`} />
                          <span className={`font-mono font-semibold ${isActiveVersion ? 'text-white' : 'text-gray-400'}`}>
                            {version.label}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${version.tagColor}`}>
                            {version.tag}
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Expanded Category Tree */}
                      {isExpanded && (
                        <div className="ml-3 mt-1 border-l border-white/5 pl-2 space-y-0.5 pb-2">
                          {version.categories.map(category => {
                            const Icon = category.icon;
                            const isActiveCat = activeCategory === category.id && activeVersion === version.id;

                            return (
                              <div key={category.id}>
                                <button
                                  onClick={() => { setActiveCategory(category.id); setActiveVersion(version.id); }}
                                  className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                                    isActiveCat
                                      ? 'bg-zion-cyan/10 text-zion-cyan border-l-2 border-zion-cyan -ml-[2px]'
                                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    {category.title}
                                  </div>
                                </button>

                                {isActiveCat && (
                                  <div className="mt-1 ml-6 space-y-0.5 border-l border-zion-cyan/20 pl-3">
                                    {category.docs.map(doc => (
                                      <button
                                        key={doc.id}
                                        onClick={() => handleDocSelect(doc.id, category.id, version.id)}
                                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-all ${
                                          selectedDoc === doc.id
                                            ? 'text-zion-gold font-medium'
                                            : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                      >
                                        {doc.title}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ═══ Content ═══ */}
          <main className="flex-1 max-w-3xl xl:max-w-4xl mx-auto">
            {selectedDoc === 'philosophy' ? (
              <PhilosophyContent />
            ) : (
              <>
                {/* Doc Header */}
                {currentDoc && (
                  <div className="mb-10 pb-8 border-b border-white/10">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      <span className="font-mono text-zion-cyan">{currentVersion.label}</span>
                      <ChevronRight className="w-3 h-3" />
                      <span>{docCategories.find(cat => cat.docs.some(d => d.id === currentDoc.id))?.title}</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-zion-gold">{currentDoc.title}</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight text-gradient">
                      {currentDoc.title}
                    </h1>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${currentVersion.tagColor}`}>
                        <GitBranch className="w-3 h-3" />
                        {currentVersion.label}
                      </span>
                      <code className="text-xs bg-white/5 px-2 py-1 rounded text-gray-500">{currentDoc.file}</code>
                    </div>
                  </div>
                )}

                {/* Doc Content */}
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
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    </article>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
