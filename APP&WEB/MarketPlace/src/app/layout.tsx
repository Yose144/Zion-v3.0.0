import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import Navbar from '@/components/Navbar';

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
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
          <footer className="border-t border-white/5 mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-oasis-cyan via-oasis-purple to-oasis-gold flex items-center justify-center font-black text-oasis-black text-xs">
                  Z
                </div>
                <span className="text-sm text-gray-500">
                  ZION Market · OASIS Artifact Marketplace
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <a href="https://zionterranova.com" className="hover:text-oasis-cyan">Home</a>
                <a href="https://oasis.zionterranova.com" className="hover:text-oasis-cyan">OASIS</a>
                <a href="https://app.zionterranova.com" className="hover:text-oasis-cyan">Web2.9</a>
                <a href="https://discord.gg/uq4Az97hG" className="hover:text-oasis-cyan">Discord</a>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
