import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import StarfieldCanvas from '@/components/StarfieldCanvas';
import { CartProvider } from '@/components/shop/CartContext';
import { tr } from '@/lib/translations';
import { COMPANY } from '@/lib/invoice';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

const FOOTER_LINKS = [
  { href: '/about', labelKey: 'footer.about' },
  { href: '/terms', labelKey: 'footer.terms' },
  { href: '/gdpr', labelKey: 'footer.gdpr' },
  { href: '/legal', labelKey: 'footer.legal' },
  { href: '/shopping-guide', labelKey: 'footer.guide' },
  { href: '/faq', labelKey: 'footer.faq' },
];

export const metadata: Metadata = {
  metadataBase: new URL('https://market.zionterranova.com'),
  title: tr('common', 'metadataTitle', 'cs'),
  description: tr('common', 'metadataDescription', 'cs'),
  keywords: ['ZION', 'OASIS', 'NFT', 'marketplace', 'Base', 'ERC-1155', 'game artifacts'],
  openGraph: {
    title: tr('common', 'metadataTitle', 'cs'),
    description: 'Trade OASIS game artifacts on Base L2.',
    type: 'website',
    url: 'https://market.zionterranova.com',
    images: ['/zion-social-banner.png'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/zion-social-banner.png'],
  },
  icons: {
    icon: '/logo/org/favicon.ico',
    apple: '/logo/org/symbol-200x200.png',
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
        <div className="orb orb-rasta-red" aria-hidden="true" />
        <div className="orb orb-rasta-gold" aria-hidden="true" />
        <div className="orb orb-rasta-green" aria-hidden="true" />
        <Providers>
          <CartProvider>
            <Navbar />
            <main className="zion-container py-6 md:py-8 min-h-[calc(100vh-4rem)]">
              {children}
            </main>
            <footer className="rasta-footer mt-16 relative py-10 zion-container">
            <div className="section-line absolute top-0 inset-x-0" />
            <div className="flex flex-col items-center text-center">
              <Link href="/" className="opacity-90 hover:opacity-100 transition-opacity duration-300">
                <img
                  src="/images/logo144.png"
                  alt="ZION Market"
                  className="w-20 h-auto mx-auto rasta-footer-logo"
                  loading="lazy"
                  decoding="async"
                />
              </Link>
              <nav className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-500">
                {FOOTER_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="hover:text-rasta-gold transition-colors"
                  >
                    {tr('footer', link.labelKey.split('.')[1] as 'about' | 'terms' | 'gdpr' | 'legal' | 'guide' | 'faq', 'cs')}
                  </Link>
                ))}
              </nav>
              <p className="mt-6 text-xs text-gray-600">
                © 2026 {COMPANY.name} · ZION Market
              </p>
            </div>
          </footer>
          </CartProvider>
        </Providers>
      </body>
    </html>
  );
}
