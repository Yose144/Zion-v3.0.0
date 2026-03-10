'use client';

import { useState, useEffect } from 'react';
import { Book, BookOpen, Code2, Rocket, Shield, Zap, FileText, Github, ExternalLink, ChevronRight, ChevronDown, Sparkles, Menu, X, Infinity, Users, HelpCircle, Globe, GitBranch, Lock, Layers, Coins, Cpu, Map, AlertTriangle, Building2, LayoutList } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PhilosophyContent from '@/components/docs/PhilosophyContent';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

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
    tag: 'BASELINE',
    tagColor: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
    description: 'Protocol baseline — architecture, economics, migration, consensus',
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
    tag: 'ARCHIVE',
    tagColor: 'text-gray-500 border-gray-500/30 bg-gray-500/5',
    description: 'Native Awakening — complete Rust rewrite, Fair Launch',
    categories: [
      {
        id: 'v295-overview',
        title: 'Overview',
        icon: Rocket,
        docs: [
          { id: 'v295-readme', title: 'ZION v2.9.5 Overview', file: 'v2.9.5/README.md' },
          { id: 'v295-changelog', title: 'Changelog from v2.9', file: 'v2.9.5/changelog.md' },
        ]
      },
      {
        id: 'v295-protocol',
        title: 'Protokol',
        icon: Code2,
        docs: [
          { id: 'v295-tokenomics', title: 'Tokenomics & Economic Model', file: 'v2.9.5/tokenomics.md' },
          { id: 'v295-consensus', title: 'Cosmic Harmony v3', file: 'v2.9.5/consensus.md' },
        ]
      },
      {
        id: 'v295-whitepaper',
        title: 'Whitepaper',
        icon: FileText,
        docs: [
          { id: 'whitepaper-295-full', title: 'Whitepaper v2.9.5 (kompletní)', file: 'whitepaper/ZION_Whitepaper_v2.9.5_FULL.md' },
          { id: 'whitepaper-lite', title: 'Whitepaper Lite', file: 'whitepaper-lite.md' },
        ]
      },
    ]
  },
  {
    id: 'v2.9',
    label: 'v2.9',
    tag: 'LEGACY',
    tagColor: 'text-gray-600 border-gray-600/30 bg-gray-600/5',
    description: 'Quantum Leap — first multi-node TestNet, Python era',
    categories: [
      {
        id: 'v29-overview',
        title: 'Overview',
        icon: Rocket,
        docs: [
          { id: 'v29-readme', title: 'ZION v2.9 — Quantum Leap', file: 'v2.9/README.md' },
          { id: 'v29-origins', title: 'Origins — Sep 26, 2025', file: 'v2.9/origins.md' },
        ]
      },
    ]
  },
  {
    id: 'v2.8.x',
    label: 'v2.8.x',
    tag: 'LEGACY',
    tagColor: 'text-gray-600 border-gray-600/30 bg-gray-600/5',
    description: 'Python era — v2.8.5 genesis, v2.8.9 Polish Sprint',
    categories: [
      {
        id: 'v28-overview',
        title: 'Overview',
        icon: Layers,
        docs: [
          { id: 'v28-readme', title: 'v2.8.x Legacy Era', file: 'v2.8.x/README.md' },
        ]
      },
      {
        id: 'v28-archive',
        title: 'Archiv',
        icon: FileText,
        docs: [
          { id: 'whitepaper-285', title: 'Whitepaper v2.8.5', file: 'whitepaper/ZION_Whitepaper_v2.8.5.md' },
          { id: 'cosmic-map-public', title: 'Cosmic Map (veřejná edice)', file: 'whitepaper/COSMIC_MAP_2.8.5_PUBLIC_EDITION.md' },
        ]
      },
    ]
  },
];

/* ═══════════════════════════════════════════
   Resources — static sections (non-versioned)
   ═══════════════════════════════════════════ */

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accentText: string;
  accentBorder: string;
  docs: Doc[];
}

const sections: Section[] = [
  {
    id: 'live-ops',
    title: 'Live TestNet',
    icon: Globe,
    accentText: 'text-emerald-400',
    accentBorder: 'border-emerald-400/30',
    docs: [
      { id: 'live-index', title: 'Aktuální snapshot sítě', file: 'index.md' },
      { id: 'live-p2p', title: '3-node topologie', file: 'v2.9.6/p2p.md' },
      { id: 'live-mainnet', title: 'Launch path', file: 'mainnet/README.md' },
    ],
  },
  {
    id: 'whitepaper',
    title: 'WhitePaper',
    icon: FileText,
    accentText: 'text-zion-gold',
    accentBorder: 'border-zion-gold/30',
    docs: [
      { id: 'wp-v297', title: 'Whitepaper v2.9.7 (EN, archive)', file: 'whitepaper/ZION_Whitepaper_v2.9.7.md' },
      { id: 'wp-v295-full', title: 'Whitepaper v2.9.5 (full)', file: 'whitepaper/ZION_Whitepaper_v2.9.5_FULL.md' },
      { id: 'wp-lite', title: 'Whitepaper Lite (CS)', file: 'whitepaper-lite.md' },
    ],
  },
  {
    id: 'architecture',
    title: 'Architecture',
    icon: Cpu,
    accentText: 'text-zion-cyan',
    accentBorder: 'border-zion-cyan/30',
    docs: [
      { id: 'arch-overview', title: '6-Layer Stack', file: 'architecture/README.md' },
      { id: 'arch-consensus', title: 'CHv3 → CHv4 Roadmap', file: 'architecture/consensus.md' },
    ],
  },
  {
    id: 'mainnet',
    title: 'MainNet Launch',
    icon: Rocket,
    accentText: 'text-emerald-400',
    accentBorder: 'border-emerald-400/30',
    docs: [
      { id: 'mainnet-plan', title: 'Launch Plan 2026', file: 'mainnet/README.md' },
      { id: 'mainnet-checklist', title: 'MainNet Gate Checklist (archive)', file: 'v2.9.7/mainnet-gate.md' },
    ],
  },
  {
    id: 'listing',
    title: 'Listing / CoinGecko',
    icon: Map,
    accentText: 'text-violet-400',
    accentBorder: 'border-violet-400/30',
    docs: [
      { id: 'coingecko-checklist', title: 'CoinGecko Checklist', file: 'mainnet/coingecko.md' },
    ],
  },
  {
    id: 'legal',
    title: 'Legal',
    icon: AlertTriangle,
    accentText: 'text-orange-400',
    accentBorder: 'border-orange-400/30',
    docs: [
      { id: 'legal-disclaimer', title: 'Disclaimer', file: 'legal/disclaimer.md' },
      { id: 'legal-risk', title: 'Risk Disclosure', file: 'legal/risk.md' },
      { id: 'legal-token', title: 'Token Not Security', file: 'legal/token.md' },
    ],
  },
];

function findCategoryIdByDoc(docId: string): string | null {
  const category = versions
    .flatMap((version) => version.categories)
    .find((cat) => cat.docs.some((doc) => doc.id === docId));
  if (category) return category.id;
  const section = sections.find(s => s.docs.some(d => d.id === docId));
  return section?.id ?? null;
}

export default function DocsPage() {
  const [activeVersion, setActiveVersion] = useState('v2.9.6');
  const [selectedDoc, setSelectedDoc] = useState('live-index');
  const [activeCategory, setActiveCategory] = useState('live-ops');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({ 'v2.9.5': false, 'v2.9.6': true, 'v2.9': false, 'v2.8.x': false, 'live-ops': true, 'whitepaper': false, 'architecture': false, 'mainnet': false, 'listing': false, 'legal': false });
  const [sidebarTab, setSidebarTab] = useState<'resources' | 'history'>('resources');
  const { lang } = useLang();
  const primaryVersions = versions.filter((version) => version.id === 'v2.9.6' || version.id === 'v2.9.5');

  // Get current version data
  const currentVersion = versions.find(v => v.id === activeVersion) || versions[0];
  const docCategories = currentVersion.categories;

  // Find current doc across all versions AND sections
  const currentDoc = [
    ...versions.flatMap(v => v.categories).flatMap(cat => cat.docs),
    ...sections.flatMap(s => s.docs),
  ].find(doc => doc.id === selectedDoc);

  // Check if selected doc belongs to a resource section (not versioned)
  const currentSection = sections.find(s => s.docs.some(d => d.id === selectedDoc));

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
    <div className="zion-shell min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-white/10 bg-linear-to-b from-zion-cyan/10 via-transparent to-transparent">
        <div className="zion-container py-20 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/5 mb-6">
              <BookOpen className="w-4 h-4 text-zion-cyan" />
              <span className="text-sm text-zion-cyan font-semibold">Knowledge Base</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 text-gradient">
              {tr('docs', 'title', lang)}
            </h1>
            <p className="text-xl text-gray-400 mb-4">
              {tr('docs', 'subtitle', lang)}
            </p>
            <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-5 py-4 text-left text-sm text-gray-300">
              Live testnet běží na v2.9.8 Deeksha canonical path. Nahoře jsou teď prioritně provozní a referenční materiály; hlubší historie zůstává v záložce History.
            </div>
            <div className="flex items-center justify-center gap-3 mb-8">
              {primaryVersions.map(v => (
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
      <div className="zion-container py-12">
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
              {/* Sidebar Tab Switcher */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setSidebarTab('resources')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                    sidebarTab === 'resources'
                      ? 'text-zion-cyan border-b-2 border-zion-cyan bg-zion-cyan/5'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  {tr('docs', 'resources_tab', lang)}
                </button>
                <button
                  onClick={() => setSidebarTab('history')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                    sidebarTab === 'history'
                      ? 'text-zion-gold border-b-2 border-zion-gold bg-zion-gold/5'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {tr('docs', 'history_tab', lang)}
                </button>
              </div>

              {/* Scrollable nav area */}
              <nav className="px-3 pb-4 max-h-[calc(100vh-180px)] overflow-y-auto space-y-1 pt-2">
                {sidebarTab === 'resources' ? (
                  /* ── Resources Panel ── */
                  <div className="space-y-1">
                    {sections.map(section => {
                      const Icon = section.icon;
                      const isExpanded = expandedVersions[section.id] ?? false;
                      const hasActiveDoc = section.docs.some(d => d.id === selectedDoc);
                      return (
                        <div key={section.id}>
                          <button
                            onClick={() => toggleVersion(section.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-sm ${
                              hasActiveDoc ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${section.accentText}`} />
                              <span className={`font-semibold ${hasActiveDoc ? 'text-white' : 'text-gray-400'}`}>
                                {section.title}
                              </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="ml-3 mt-1 border-l border-white/5 pl-2 space-y-0.5 pb-2">
                              {section.docs.map(doc => (
                                <button
                                  key={doc.id}
                                  onClick={() => {
                                    setSelectedDoc(doc.id);
                                    setActiveCategory(section.id);
                                    setActiveVersion('v2.9.6');
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm flex items-center gap-2 ${
                                    selectedDoc === doc.id
                                      ? `${section.accentText} font-medium bg-white/5`
                                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <FileText className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-xs">{doc.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                /* ── Version Tree ── */
                <div className="space-y-1">
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
                                      ? 'bg-zion-cyan/10 text-zion-cyan border-l-2 border-zion-cyan -ml-0.5'
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
                </div>
                )}
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
                      {currentSection ? (
                        <>
                          <span className={currentSection.accentText}>{currentSection.title}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span className="text-zion-gold">{currentDoc.title}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-zion-cyan">{currentVersion.label}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span>{docCategories.find(cat => cat.docs.some(d => d.id === currentDoc.id))?.title}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span className="text-zion-gold">{currentDoc.title}</span>
                        </>
                      )}
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
