import type { Metadata, Viewport } from 'next';
import '../../../shared/ui/tokens.css';
import '../../../shared/ui/rasta-nav.css';
import './globals.css';
import { LangProvider } from '@/lib/i18n';
import { AuthProvider } from '@/lib/auth';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'ZION Pool — one pool, four+ coins, native payouts',
  description:
    'Public mining pool of the ZION TerraNova ecosystem: ZION, Quantus (QTC), Pearl (PRL) and multi-algo. Native payouts, transparent PPLNS.',
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
            <main className="mx-auto min-h-[70vh] max-w-6xl px-4">{children}</main>
            <Footer />
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
