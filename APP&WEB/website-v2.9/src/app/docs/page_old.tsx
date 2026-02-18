'use client';

import { useState, useEffect } from 'react';
import { Book, BookOpen, Code2, Rocket, Shield, Compass, Zap, FileText, Github, ExternalLink, ChevronRight, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const docCategories = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Rocket,
    docs: [
      { id: 'index', title: 'Documentation Home', file: 'index.md' },
      { id: 'getting-started', title: 'Getting Started', file: 'getting-started.md' },
      { id: 'setup', title: 'Setup Guide', file: 'setup.md' },
    ]
  },
  {
    id: 'architecture',
    title: 'Architecture',
    icon: Code2,
    docs: [
      { id: 'arch-overview', title: 'Architecture Overview', file: 'architecture/overview.md' },
      { id: 'arch-mining', title: 'Mining Architecture', file: 'architecture/mining.md' },
    ]
  },
  {
    id: 'guides',
    title: 'Guides',
    icon: BookOpen,
    docs: [
      { id: 'mining-guide', title: 'Mining Guide', file: 'mining-guide.md' },
      { id: 'pool-setup', title: 'Pool Setup', file: 'pool-setup.md' },
      { id: 'api', title: 'API Reference', file: 'api.md' },
    ]
  },
  {
    id: 'tutorials',
    title: 'Tutorials',
    icon: Zap,
    docs: [
      { id: 'tutorial-index', title: 'Tutorials Overview', file: 'tutorials/index.md' },
      { id: 'tutorial-dapp', title: 'First DApp', file: 'tutorials/first-dapp.md' },
    ]
  },
  {
    id: 'whitepaper',
    title: 'Whitepaper',
    icon: FileText,
    docs: [
      { id: 'whitepaper-full', title: 'Full Whitepaper v2.8.5', file: 'whitepaper/ZION_Whitepaper_v2.8.5.md' },
      { id: 'whitepaper-lite', title: 'Whitepaper Lite', file: 'whitepaper-lite.md' },
      { id: 'whitepaper-index', title: 'Whitepaper Index', file: 'whitepaper/index.md' },
      { id: 'whitepaper-governance', title: 'Governance', file: 'whitepaper/governance.md' },
      { id: 'whitepaper-security', title: 'Security', file: 'whitepaper/security.md' },
      { id: 'whitepaper-roadmap', title: 'Roadmap Detail', file: 'whitepaper/roadmap.md' },
    ]
  },
  {
    id: 'cosmic',
    title: 'Cosmic Map',
    icon: Sparkles,
    docs: [
      { id: 'cosmic-map-full', title: 'Cosmic Map (Public)', file: 'whitepaper/COSMIC_MAP_2.8.5_PUBLIC_EDITION.md' },
      { id: 'cosmic-map-complete', title: 'Cosmic Map Complete', file: 'whitepaper/COSMIC_MAP_2.8.5_COMPLETE.md' },
    ]
  },
  {
    id: 'advanced',
    title: 'Advanced',
    icon: Shield,
    docs: [
      { id: 'core-285', title: 'Core v2.8.5', file: 'whitepaper/CORE_2.8.5.md' },
      { id: 'sacred-knowledge', title: 'Sacred Knowledge', file: 'whitepaper/SACRED_KNOWLEDGE_2.8.5.md' },
      { id: 'humanitarian-tithe', title: 'Humanitarian Tithe', file: 'whitepaper/HUMANITARIAN_TITHE_2.8.5.md' },
      { id: 'zion-oasis', title: 'ZION Oasis', file: 'whitepaper/ZION_OASIS_2.8.5.md' },
      { id: 'zion-victory', title: 'ZION Victory 2025', file: 'whitepaper/ZION_VICTORY_2025.md' },
    ]
  },
];

export default function DocsPage() {
  const [selectedDoc, setSelectedDoc] = useState('index');
  const [activeCategory, setActiveCategory] = useState('getting-started');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  // Find current doc
  const currentDoc = docCategories
    .flatMap(cat => cat.docs)
    .find(doc => doc.id === selectedDoc);

  // Sync with URL hash
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setSelectedDoc(hash);
      // Find category for this doc
      const category = docCategories.find(cat => 
        cat.docs.some(doc => doc.id === hash)
      );
      if (category) {
        setActiveCategory(category.id);
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
          setContent('# Error\n\nFailed to load document.');
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

  const handleDocSelect = (docId: string, categoryId: string) => {
    setSelectedDoc(docId);
    setActiveCategory(categoryId);
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
              ZION DOCUMENTATION
            </h1>
            <p className="text-xl text-gray-400 mb-8">
              Complete guides, API references & sacred protocols
            </p>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Vše, co potřebuješ pro stavbu na Zion blockchainu.<br />
              Od prvního nodu po pokročilé AI rituály.
            </p>
            
            {/* Quick Links */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
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
      <div className="container mx-auto px-4 py-12">
        <div className="flex gap-8">
          {/* Sticky Category Navigation */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 border border-white/10 rounded-2xl p-6 bg-black/60 backdrop-blur-xl">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Book className="w-4 h-4" />
                Categories
              </h3>
              <nav className="space-y-6">
                {docCategories.map((category) => {
                  const Icon = category.icon;
                  const isActive = activeCategory === category.id;
                  
                  return (
                    <div key={category.id}>
                      <button
                        onClick={() => setActiveCategory(category.id)}
                        className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-semibold mb-2 ${
                          isActive
                            ? 'bg-zion-cyan/10 text-zion-cyan'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {category.title}
                      </button>
                      
                      {isActive && (
                        <div className="space-y-1 ml-6 border-l-2 border-zion-cyan/30 pl-3">
                          {category.docs.map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => handleDocSelect(doc.id, category.id)}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-all ${
                                selectedDoc === doc.id
                                  ? 'text-zion-gold font-medium'
                                  : 'text-gray-500 hover:text-white'
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
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 max-w-4xl mx-auto">
            {/* Doc Header */}
            {currentDoc && (
              <div className="mb-8 pb-8 border-b border-white/10">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <BookOpen className="w-4 h-4" />
                  <span>{docCategories.find(cat => cat.docs.some(d => d.id === currentDoc.id))?.title}</span>
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-zion-gold">{currentDoc.title}</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                  {currentDoc.title}
                </h1>
                <p className="text-gray-400">
                  <code className="text-sm bg-white/5 px-2 py-1 rounded">{currentDoc.file}</code>
                </p>
              </div>
            )}

            {/* Doc Content */}
            <div className="prose prose-invert prose-lg max-w-none">
              {loading ? (
                <div className="space-y-4">
                  <div className="h-8 w-3/4 rounded bg-white/10 animate-pulse" />
                  <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
                  <div className="h-4 w-5/6 rounded bg-white/5 animate-pulse" />
                  <div className="h-4 w-4/6 rounded bg-white/5 animate-pulse" />
                </div>
              ) : (
                <article className="prose-headings:text-zion-gold prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-p:text-gray-300 prose-p:leading-relaxed prose-code:text-zion-cyan prose-code:bg-white/10 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-pre:bg-black/70 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:p-4 prose-a:text-zion-cyan hover:prose-a:text-zion-gold prose-li:text-gray-300 prose-strong:text-white prose-ul:list-disc prose-ol:list-decimal">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </article>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
