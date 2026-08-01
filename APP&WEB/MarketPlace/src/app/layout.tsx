import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'ZION Market — OASIS Artifact Marketplace',
  description:
    'Trade OASIS game artifacts, ships, avatars, territory deeds, and Golden Eggs on the ZION ecosystem marketplace. Powered by Base L2 + ERC-1155.',
  keywords: ['ZION', 'OASIS', 'NFT', 'marketplace', 'Base', 'ERC-1155', 'game artifacts'],
  openGraph: {
    title: 'ZION Market — OASIS Artifact Marketplace',
    description: 'Trade OASIS game artifacts on Base L2.',
    type: 'website',
    url: 'https://market.zionterranova.com',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport = {
  themeColor: '#05070a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${display.variable}`}>
      <body className="antialiased font-sans">
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 min-h-[calc(100vh-4rem)]">
            {children}
          </main>
          <footer className="border-t border-white/5 mt-16 relative">
            <div className="section-line absolute top-0 inset-x-0" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                {/* Brand */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-oasis-cyan via-oasis-purple to-oasis-gold flex items-center justify-center font-black text-oasis-black text-sm">
                      Z
                    </div>
                    <span className="text-lg font-black text-gradient">ZION Market</span>
                  </div>
                  <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                    The official OASIS artifact marketplace. Trade avatars, ships, quest items,
                    and territory deeds on Base L2.
                  </p>
                </div>
                {/* Links */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Marketplace</h4>
                  <div className="flex flex-col gap-2 text-sm">
                    <a href="/explore" className="text-gray-500 hover:text-oasis-cyan transition-colors">Explore</a>
                    <a href="/create" className="text-gray-500 hover:text-oasis-cyan transition-colors">Create Listing</a>
                    <a href="/explore?filter=auction" className="text-gray-500 hover:text-oasis-cyan transition-colors">Auctions</a>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Ecosystem</h4>
                  <div className="flex flex-col gap-2 text-sm">
                    <a href="https://zionterranova.com" className="text-gray-500 hover:text-oasis-cyan transition-colors">Home</a>
                    <a href="https://oasis.zionterranova.com" className="text-gray-500 hover:text-oasis-cyan transition-colors">OASIS</a>
                    <a href="https://app.zionterranova.com" className="text-gray-500 hover:text-oasis-cyan transition-colors">Web 2.9</a>
                    <a href="https://discord.gg/uq4Az97hG" className="text-gray-500 hover:text-oasis-cyan transition-colors">Discord</a>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="status-dot status-active" />
                  Powered by Base L2 · ERC-1155 · Hybrid L1/L2 Payment
                </div>
                <div className="text-xs text-gray-600">
                  © 2026 ZION Terranova · OASIS Universe
                </div>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
