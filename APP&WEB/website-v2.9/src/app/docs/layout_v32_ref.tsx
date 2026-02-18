export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-matrix-dark">
      {/* Header spacing for fixed navbar */}
      <div className="h-16"></div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-80 bg-black/80 backdrop-blur-md border-r border-matrix-green/20 overflow-y-auto">
          <nav className="p-6">
            <div className="mb-8">
              <h3 className="text-matrix-green font-orbitron text-lg mb-4">Documentation</h3>

              <div className="space-y-2">
                <a href="/docs" className="block text-gray-300 hover:text-matrix-green transition-colors py-2 px-3 rounded hover:bg-matrix-green/10">
                  Overview
                </a>
                <a href="/docs/getting-started" className="block text-gray-300 hover:text-matrix-green transition-colors py-2 px-3 rounded hover:bg-matrix-green/10">
                  Getting Started
                </a>
                <a href="/docs/community" className="block text-gray-300 hover:text-matrix-green transition-colors py-2 px-3 rounded hover:bg-matrix-green/10">
                  Community
                </a>
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-matrix-green font-semibold mb-4">Architecture</h4>
              <div className="space-y-2 pl-4">
                <a href="/docs/architecture/overview" className="block text-gray-400 hover:text-matrix-green transition-colors py-1 px-3 rounded text-sm hover:bg-matrix-green/10">
                  System Overview
                </a>
                <a href="/docs/architecture/mining" className="block text-gray-400 hover:text-matrix-green transition-colors py-1 px-3 rounded text-sm hover:bg-matrix-green/10">
                  Mining Guide
                </a>
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-matrix-green font-semibold mb-4">Whitepaper</h4>
              <div className="space-y-2 pl-4">
                <a href="/docs/whitepaper/full" className="block text-gray-400 hover:text-matrix-green transition-colors py-1 px-3 rounded text-sm hover:bg-matrix-green/10">
                  Executive Summary
                </a>
                <a href="/docs/whitepaper/ZION_Whitepaper_v2.8.5" className="block text-gray-400 hover:text-matrix-green transition-colors py-1 px-3 rounded text-sm hover:bg-matrix-green/10">
                  Complete Technical Spec
                </a>
                <a href="/docs/whitepaper/COSMIC_MAP_2.8.5_COMPLETE" className="block text-gray-400 hover:text-matrix-green transition-colors py-1 px-3 rounded text-sm hover:bg-matrix-green/10">
                  Cosmic Map & Vision
                </a>
                <a href="/docs/whitepaper/HUMANITARIAN_TITHE_2.8.5" className="block text-gray-400 hover:text-matrix-green transition-colors py-1 px-3 rounded text-sm hover:bg-matrix-green/10">
                  Humanitarian Initiatives
                </a>
                <a href="/docs/whitepaper/SACRED_KNOWLEDGE_2.8.5" className="block text-gray-400 hover:text-matrix-green transition-colors py-1 px-3 rounded text-sm hover:bg-matrix-green/10">
                  Sacred Knowledge
                </a>
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-matrix-green font-semibold mb-4">API & Development</h4>
              <div className="space-y-2 pl-4">
                <a href="/docs/api" className="block text-gray-400 hover:text-matrix-green transition-colors py-1 px-3 rounded text-sm hover:bg-matrix-green/10">
                  API Reference
                </a>
                <a href="/docs/tutorials/first-dapp" className="block text-gray-400 hover:text-matrix-green transition-colors py-1 px-3 rounded text-sm hover:bg-matrix-green/10">
                  First dApp Tutorial
                </a>
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-80 min-h-screen">
          <article className="prose prose-invert max-w-4xl mx-auto p-8 prose-headings:text-matrix-green prose-a:text-matrix-green prose-code:text-matrix-green prose-pre:bg-black/70 prose-pre:border prose-pre:border-matrix-green/20">
            {children}
          </article>
        </main>
      </div>
    </div>
  );
}