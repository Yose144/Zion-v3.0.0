import type { Metadata, Viewport } from 'next';
import '../../../shared/ui/tokens.css';
import '../../../shared/ui/rasta-nav.css';
import './globals.css';
import { LangProvider } from '@/lib/i18n';
import { AuthProvider } from '@/lib/auth';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import StatusBanner from '@/components/StatusBanner';

export const metadata: Metadata = {
  metadataBase: new URL('https://pool.zionterranova.com'),
  title: {
    default: 'ZION Pool — one pool, twelve coins, native payouts',
    template: '%s | ZION Pool',
  },
  description:
    'Public mining pool of the ZION TerraNova ecosystem: ZION, Quantus (QTC), Pearl (PRL) + 9 auxPoW coins over one stratum. Native payouts, transparent PPLNS.',
  keywords: [
    'ZION',
    'mining pool',
    'PPLNS',
    'Quantus',
    'QTC',
    'Pearl',
    'PRL',
    'auxpow',
    'merged mining',
    'stratum',
    'ZION TerraNova',
  ],
  applicationName: 'ZION Pool',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'ZION Pool',
    title: 'ZION Pool — one pool, twelve coins, native payouts',
    description:
      'Public mining pool of the ZION TerraNova ecosystem: ZION, Quantus (QTC), Pearl (PRL) + 9 auxPoW coins over one stratum. Native payouts, transparent PPLNS.',
    url: 'https://pool.zionterranova.com',
    images: [
      {
        url: '/brand/hero-multichain.webp',
        width: 1672,
        height: 941,
        alt: 'ZION Pool — multi-chain mining',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZION Pool — one pool, twelve coins, native payouts',
    description:
      'Public mining pool of the ZION TerraNova ecosystem: ZION, Quantus (QTC), Pearl (PRL) + 9 auxPoW coins over one stratum. Native payouts, transparent PPLNS.',
    images: ['/brand/hero-multichain.webp'],
  },
  icons: {
    icon: [{ url: '/brand/zion-symbol.png', type: 'image/png', sizes: '200x200' }],
    apple: [{ url: '/brand/zion-symbol.png', type: 'image/png' }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0d0d0d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body>
        <LangProvider>
          <AuthProvider>
            <Nav />
            <main className="zion-container mx-auto min-h-[70vh]">
              <StatusBanner />
              {children}
            </main>
            <Footer />
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
