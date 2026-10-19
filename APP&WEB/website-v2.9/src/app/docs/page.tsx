'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Book, BookOpen, Code2, Rocket, Shield, Zap, FileText, Github, ExternalLink, ChevronRight, ChevronDown, Sparkles, Menu, X, Infinity, Users, HelpCircle, Globe, GitBranch, Lock, Layers, Coins, Cpu, Map, AlertTriangle, Building2, LayoutList } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr, tx } from '@/lib/translations';
import {
  versions,
  sections,
  versionText,
  categoryTitles,
  sectionTitles,
  docTitles,
  DOC_HASH_ALIASES,
  resolveLabel,
  resolveMappedLabel,
  type Doc,
  type Category,
  type Version,
  type Section,
  type LocalizedText,
} from '@/lib/docs-manifest';

const PhilosophyContent = dynamic(() => import('@/components/docs/PhilosophyContent'));
const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'));

const docsPageCopy = {
  badge: { cs: 'Znalostní báze', en: 'Knowledge Base' },
  overviewNotice: {
    cs: 'Aktuální veřejná linka je v3.2.0 "One Love" — kandidát na Mainnet Stable; 30denní stability run #2 nesplnil gate, další běh se připravuje. Decimal fork 1e12→1e6 (6-decimal flowers) dokončen. Síť běží na novém genesis hash po hard resetu ze srpna 2026 — viz hlavní dokument níže. Pool aktivní, mining live, DEX a bridge nasazeny. Veřejný launch je odložen (TBD). Projekt potřebuje projít Maturity Gate (Maturitou), získat základní likviditu a sestavit tým dobrovolných vývojářů.',
    en: 'The current public line is v3.2.0 "One Love" — Mainnet Stable candidate; the 30-day stability run #2 did not pass the gate; the next run is being prepared. Decimal fork 1e12→1e6 (6-decimal flowers) complete. The network is running on a new genesis hash after the August 2026 hard reset — see the main document below. Pool active, mining live, DEX and bridge deployed. The public launch is postponed (TBD). The project needs to pass the Maturity Gate, secure basic liquidity, and assemble a team of volunteer developers.',
  },
  overviewNoticeLink: { cs: 'v3.2.0 Přehled', en: 'v3.2.0 Overview' },
  githubLabel: { cs: 'GitHub', en: 'GitHub' },
  apiHealthLabel: { cs: 'Zdraví API', en: 'API Health' },
} as const satisfies Record<string, LocalizedText>;


function findCategoryIdByDoc(docId: string): string | null {
  const category = versions
    .flatMap((version) => version.categories)
    .find((cat) => cat.docs.some((doc) => doc.id === docId));
  if (category) return category.id;
  const section = sections.find(s => s.docs.some(d => d.id === docId));
  return section?.id ?? null;
}

export default function DocsPage() {
  const [activeVersion, setActiveVersion] = useState('v3.2.0');
  const [selectedDoc, setSelectedDoc] = useState('v320-readme');
  const [activeCategory, setActiveCategory] = useState('v320-overview');
  const [content, setContent] = useState('');
  const [resolvedFile, setResolvedFile] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({ 'v3.2.0': true, 'v3.0.6': false, 'v3.0.0': false, 'v2.9.9': false, 'v2.9.8': false, 'v2.9.7': false, 'v2.9.6': false, 'v2.9.5': false, 'v2.9': false, 'v2.8.x': false, 'live-ops': false, 'ai-native': false, 'whitepaper': false, 'architecture': false, 'mainnet': false, 'listing': false, 'legal': false, 'lumi-language': false });
  const [sidebarTab, setSidebarTab] = useState<'resources' | 'history'>('resources');
  const { lang } = useLang();
  const currentLang = lang === 'cs' ? 'cs' : 'en';
  const primaryVersions = versions.filter((version) => version.id === 'v3.2.0');

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
  const getVersionTag = (version: Version) => resolveLabel(versionText[version.id]?.tag ?? version.tag, currentLang);
  const getVersionDescription = (version: Version) => resolveLabel(versionText[version.id]?.description ?? version.description, currentLang);
  const getCategoryTitle = (category: Category) => resolveMappedLabel(categoryTitles, category.id, category.title, currentLang);
  const getSectionTitle = (section: Section) => resolveMappedLabel(sectionTitles, section.id, section.title, currentLang);
  const getDocTitle = (doc: Doc) => resolveMappedLabel(docTitles, doc.id, doc.title, currentLang);
  const currentDocTitle = currentDoc ? getDocTitle(currentDoc) : '';
  const currentSectionTitle = currentSection ? getSectionTitle(currentSection) : '';
  const currentCategoryTitle = currentDoc && !currentSection
    ? getCategoryTitle(docCategories.find(cat => cat.docs.some(d => d.id === currentDoc.id)) || docCategories[0])
    : '';

  // Sync with URL hash — corpus links may carry section ids or legacy
  // anchors; DOC_HASH_ALIASES maps them onto real doc ids.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const resolveHash = (raw: string) => DOC_HASH_ALIASES[raw] ?? raw;
    const hash = resolveHash(window.location.hash.replace('#', ''));
    if (hash) {
      setSelectedDoc(hash);
      const categoryId = findCategoryIdByDoc(hash);
      if (categoryId) {
        setActiveCategory(categoryId);
      }
    }

    const onHashChange = () => {
      const id = resolveHash(window.location.hash.replace('#', ''));
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

    const loadTextFromCandidates = async (paths: string[]) => {
      for (const path of paths) {
        const response = await fetch(`/docs/${path}`);
        if (response.ok) {
          return { text: await response.text(), resolvedPath: path };
        }
      }

      throw new Error(`Failed to load ${paths.join(', ')}`);
    };

    async function loadDoc() {
      if (!currentDoc) return;
      // Philosophy is a TSX component, not markdown — skip fetch
      if (currentDoc.file === '__philosophy__') {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const candidateFiles = [`${lang}/${currentDoc.file}`, currentDoc.file];
        const { text, resolvedPath } = await loadTextFromCandidates(candidateFiles);
        if (!isCancelled) {
          setContent(text);
          setResolvedFile(resolvedPath);
        }
      } catch (err) {
        console.error('Failed to load document:', err);
        if (!isCancelled) {
          setContent(lang === 'cs'
            ? `# Dokument neni dostupny\n\nDokument **${currentDocTitle}** (${currentDoc?.file}) momentalne neni k dispozici.\n\nZkuste to prosim pozdeji nebo vyberte jiny dokument z navigace.`
            : `# Document Not Available\n\nThe document **${currentDocTitle}** (${currentDoc?.file}) is currently not available.\n\nPlease check back later or try another document from the navigation.`);
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
  }, [selectedDoc, currentDoc, currentDocTitle, lang]);

  const handleDocSelect = (docId: string, categoryId: string, versionId: string) => {
    // Check if doc has a direct href — navigate away instead of loading markdown
    const allDocs = [
      ...versions.flatMap(v => v.categories).flatMap(cat => cat.docs),
      ...sections.flatMap(s => s.docs),
    ];
    const targetDoc = allDocs.find(d => d.id === docId);
    if (targetDoc?.href) {
      window.location.href = targetDoc.href;
      return;
    }
    setSelectedDoc(docId);
    setActiveCategory(categoryId);
    setActiveVersion(versionId);
    setExpandedVersions(prev => ({ ...prev, [versionId]: true }));
  };

  const toggleVersion = (versionId: string) => {
    setExpandedVersions(prev => ({ ...prev, [versionId]: !prev[versionId] }));
  };

  return (
    <div className="">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-white/10 bg-linear-to-b from-zion-cyan/10 via-transparent to-transparent">
        <div className="zion-container py-20 relative">
          <div
            className="zion-rainbow-card max-w-4xl mx-auto p-8 md:p-10 text-center"
            style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
          >
            <div className="zion-kicker mx-auto mb-6 w-fit border-zion-cyan/30 bg-zion-cyan/10 text-cyan-200">
              <BookOpen className="w-4 h-4 text-zion-cyan" />
              <span className="text-sm text-zion-cyan font-semibold">{tx(docsPageCopy.badge, currentLang)}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gradient">
              {tr('docs', 'title', lang)}
            </h1>
            <p className="text-xl text-gray-400 mb-4">
              {tr('docs', 'subtitle', lang)}
            </p>
            <div
              className="zion-rainbow-sub mx-auto mb-8 max-w-3xl px-5 py-4 text-left text-sm text-gray-300"
              style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
            >
              {tx(docsPageCopy.overviewNotice, currentLang)}{' '}
              <button
                onClick={() => {
                  setSelectedDoc('v320-readme');
                  setActiveVersion('v3.2.0');
                  setActiveCategory('v320-overview');
                }}
                className="text-zion-cyan font-semibold hover:text-white underline decoration-zion-cyan/40 underline-offset-2 transition-colors"
              >
                {tx(docsPageCopy.overviewNoticeLink, currentLang)} →
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
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
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-mono font-semibold transition-all ${
                    activeVersion === v.id
                      ? 'zion-rainbow-sub text-zion-gold'
                      : 'rounded-lg border border-white/10 bg-black/40 text-gray-400 hover:border-white/20 hover:text-gray-300'
                  }`}
                  style={activeVersion === v.id ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {v.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${v.tagColor}`}>
                    {getVersionTag(v)}
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
                className="zion-button-secondary"
              >
                <Github className="w-5 h-5" />
                {tx(docsPageCopy.githubLabel, currentLang)}
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-primary"
              >
                <Zap className="w-5 h-5 text-zion-cyan" />
                {tx(docsPageCopy.apiHealthLabel, currentLang)}
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="zion-container py-12">
        {/* Mobile Navigation Toggle */}
        <div className="lg:hidden sticky top-20 z-30 mb-6">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 zion-rainbow-sub text-white transition-colors"
            style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="w-5 h-5 text-zion-cyan shrink-0" />
              <span className="font-semibold min-w-0 break-words">{currentVersion.label} — {getVersionDescription(currentVersion)}</span>
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Mobile Navigation Dropdown */}
          {mobileMenuOpen && (
            <div className="mt-4 zion-rainbow-card p-4 space-y-3 max-h-[70vh] overflow-y-auto" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              {/* Resources / History tabs */}
              <div className="flex border-b border-white/10 mb-2">
                <button
                  onClick={() => setSidebarTab('resources')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                    sidebarTab === 'resources'
                      ? 'zion-rainbow-sub text-zion-cyan'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={sidebarTab === 'resources' ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  {tr('docs', 'resources_tab', lang)}
                </button>
                <button
                  onClick={() => setSidebarTab('history')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                    sidebarTab === 'history'
                      ? 'zion-rainbow-sub text-zion-gold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={sidebarTab === 'history' ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {tr('docs', 'history_tab', lang)}
                </button>
              </div>

              {sidebarTab === 'resources' ? (
                <div className="space-y-1">
                  {sections.map(section => {
                    const Icon = section.icon;
                    const isExpanded = expandedVersions[section.id] ?? false;
                    const hasActiveDoc = section.docs.some(d => d.id === selectedDoc);
                    return (
                      <div key={section.id}>
                        <button
                          onClick={() => toggleVersion(section.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-sm ${
                            hasActiveDoc
                              ? 'zion-rainbow-sub text-white'
                              : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          style={hasActiveDoc ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${section.accentText}`} />
                            <span className={`font-semibold ${hasActiveDoc ? 'text-white' : 'text-gray-400'}`}>
                              {getSectionTitle(section)}
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
                                  if (doc.href) { window.location.href = doc.href; return; }
                                  setSelectedDoc(doc.id);
                                  setActiveCategory(section.id);
                                  setActiveVersion('v3.2.0');
                                  setMobileMenuOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 transition-all text-sm flex items-center gap-2 ${
                                  selectedDoc === doc.id
                                    ? 'zion-rainbow-sub text-zion-gold font-medium'
                                    : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                                style={selectedDoc === doc.id ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                              >
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-xs">{getDocTitle(doc)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {versions.map(version => {
                    const isExpanded = expandedVersions[version.id];
                    const isActiveVersion = activeVersion === version.id;
                    return (
                      <div key={version.id}>
                        <button
                          onClick={() => toggleVersion(version.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-sm ${
                            isActiveVersion
                              ? 'zion-rainbow-sub text-white'
                              : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          style={isActiveVersion ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                        >
                          <div className="flex items-center gap-2">
                            <GitBranch className={`w-4 h-4 ${isActiveVersion ? 'text-zion-gold' : 'text-gray-500'}`} />
                            <span className={`font-mono font-semibold ${isActiveVersion ? 'text-white' : 'text-gray-400'}`}>
                              {version.label}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${version.tagColor}`}>
                              {getVersionTag(version)}
                            </span>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isExpanded && (
                          <div className="ml-3 mt-1 border-l border-white/5 pl-2 space-y-0.5 pb-2">
                            {version.categories.map(category => {
                              const Icon = category.icon;
                              const isActiveCat = activeCategory === category.id && activeVersion === version.id;
                              return (
                                <div key={category.id}>
                                  <button
                                    onClick={() => { setActiveCategory(category.id); setActiveVersion(version.id); }}
                                    className={`w-full text-left px-3 py-2 transition-all text-sm ${
                                      isActiveCat
                                        ? 'zion-rainbow-sub text-zion-cyan'
                                        : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                    style={isActiveCat ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Icon className="w-4 h-4" />
                                      {getCategoryTitle(category)}
                                    </div>
                                  </button>

                                  {isActiveCat && (
                                    <div className="mt-1 ml-6 space-y-0.5 border-l border-zion-cyan/20 pl-3">
                                      {category.docs.map(doc => (
                                        <button
                                          key={doc.id}
                                          onClick={() => { handleDocSelect(doc.id, category.id, version.id); setMobileMenuOpen(false); }}
                                          className={`w-full text-left px-2 py-1.5 text-xs transition-all ${
                                            selectedDoc === doc.id
                                              ? 'zion-rainbow-sub text-zion-gold font-medium'
                                              : 'rounded text-gray-500 hover:text-gray-300'
                                          }`}
                                          style={selectedDoc === doc.id ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                                        >
                                          {getDocTitle(doc)}
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
            </div>
          )}
        </div>

        <div className="flex gap-8">
          {/* ═══ Sidebar — Version Tree ═══ */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 zion-rainbow-card overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              {/* Sidebar Tab Switcher */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setSidebarTab('resources')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                    sidebarTab === 'resources'
                      ? 'zion-rainbow-sub text-zion-cyan'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={sidebarTab === 'resources' ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  {tr('docs', 'resources_tab', lang)}
                </button>
                <button
                  onClick={() => setSidebarTab('history')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                    sidebarTab === 'history'
                      ? 'zion-rainbow-sub text-zion-gold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={sidebarTab === 'history' ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
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
                            className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-sm ${
                              hasActiveDoc
                                ? 'zion-rainbow-sub text-white'
                                : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                            style={hasActiveDoc ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${section.accentText}`} />
                              <span className={`font-semibold ${hasActiveDoc ? 'text-white' : 'text-gray-400'}`}>
                                {getSectionTitle(section)}
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
                                    if (doc.href) { window.location.href = doc.href; return; }
                                    setSelectedDoc(doc.id);
                                    setActiveCategory(section.id);
                                    setActiveVersion('v3.0.1');
                                  }}
                                  className={`w-full text-left px-3 py-2 transition-all text-sm flex items-center gap-2 ${
                                    selectedDoc === doc.id
                                      ? 'zion-rainbow-sub text-zion-gold font-medium'
                                      : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                                  }`}
                                  style={selectedDoc === doc.id ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                                >
                                  <FileText className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-xs">{getDocTitle(doc)}</span>
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
                        className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-sm ${
                          isActiveVersion
                            ? 'zion-rainbow-sub text-white'
                            : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                        style={isActiveVersion ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <GitBranch className={`w-4 h-4 ${isActiveVersion ? 'text-zion-gold' : 'text-gray-500'}`} />
                          <span className={`font-mono font-semibold ${isActiveVersion ? 'text-white' : 'text-gray-400'}`}>
                            {version.label}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${version.tagColor}`}>
                            {getVersionTag(version)}
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
                                  className={`w-full text-left px-3 py-2 transition-all text-sm ${
                                    isActiveCat
                                      ? 'zion-rainbow-sub text-zion-cyan'
                                      : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                                  }`}
                                  style={isActiveCat ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    {getCategoryTitle(category)}
                                  </div>
                                </button>

                                {isActiveCat && (
                                  <div className="mt-1 ml-6 space-y-0.5 border-l border-zion-cyan/20 pl-3">
                                    {category.docs.map(doc => (
                                      <button
                                        key={doc.id}
                                        onClick={() => handleDocSelect(doc.id, category.id, version.id)}
                                        className={`w-full text-left px-2 py-1.5 text-xs transition-all ${
                                          selectedDoc === doc.id
                                            ? 'zion-rainbow-sub text-zion-gold font-medium'
                                            : 'rounded text-gray-500 hover:text-gray-300'
                                        }`}
                                        style={selectedDoc === doc.id ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                                      >
                                        {getDocTitle(doc)}
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
          <div className="flex-1 min-w-0 max-w-3xl xl:max-w-4xl mx-auto">
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
                          <span className={currentSection.accentText}>{currentSectionTitle}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span className="text-zion-gold">{currentDocTitle}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-zion-cyan">{currentVersion.label}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span>{currentCategoryTitle}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span className="text-zion-gold">{currentDocTitle}</span>
                        </>
                      )}
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight text-gradient">
                      {currentDocTitle}
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
                    <DocMarkdownArticle content={content} sourceFile={resolvedFile || currentDoc?.file} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
