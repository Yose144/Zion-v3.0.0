import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import StarfieldCanvas from '@/components/StarfieldCanvas';
import { CartProvider } from '@/components/shop/CartContext';

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
  themeColor: '#090A0F',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${display.variable}`}>
      <body className="antialiased font-sans zion-shell">
        <StarfieldCanvas />
        <div className="orb orb-gold" aria-hidden="true" />
        <div className="orb orb-purple" aria-hidden="true" />
        <div className="orb orb-cyan" aria-hidden="true" />
        <Providers>
          <CartProvider>
            <Navbar />
            <main className="zion-container py-6 md:py-8 min-h-[calc(100vh-4rem)]">
              {children}
            </main>
            <footer className="border-t border-white/5 mt-16 relative py-10 zion-container">
            <div className="section-line absolute top-0 inset-x-0" />
            <div className="flex flex-col items-center text-center">
              <Link href="https://market.zionterranova.com" className="opacity-90 hover:opacity-100 transition-opacity duration-300">
                <img
                  src="/logo144.png"
                  alt="ZION"
                  className="w-20 h-auto mx-auto"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.2))' }}
                  loading="lazy"
                  decoding="async"
                />
              </Link>
              <p className="mt-4 text-xs text-gray-600">
                © 2026 ZION ® Terra Nova ∞ Oasis
              </p>
            </div>
          </footer>
          </CartProvider>
        </Providers>
      </body>
    </html>
  );
}
