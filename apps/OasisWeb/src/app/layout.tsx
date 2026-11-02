import type { Metadata, Viewport } from 'next';
import '../../../shared/ui/tokens.css';
import './globals.css';
import ToastContainer from '@/components/Toast';
import { AuthProvider } from '@/contexts/AuthContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d0d0d',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://oasis.zionterranova.com'),
  title: 'ZION OASIS · Interactive Worlds',
  description: 'Explore interactive OASIS worlds in the ZION multiverse · Mainnet Beta ecosystem · OASIS preview.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/symbol-200x200.png',
  },
  openGraph: {
    title: 'ZION OASIS · Interactive Worlds',
    description: 'Explore interactive OASIS worlds in the ZION multiverse · Mainnet Beta ecosystem · OASIS preview.',
    images: ['/zion-social-banner.png'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/zion-social-banner.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="dark">
      <body className="antialiased text-white">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-black">
          Skip to content
        </a>
        <AuthProvider>
          <main id="main-content">
            {children}
          </main>
          <ToastContainer />
        </AuthProvider>
      </body>
    </html>
  );
}
