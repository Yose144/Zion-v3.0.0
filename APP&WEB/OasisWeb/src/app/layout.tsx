import type { Metadata, Viewport } from 'next';
import './globals.css';
import ToastContainer from '@/components/Toast';

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
  description: 'Explore interactive OASIS worlds in the ZION multiverse.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/symbol-200x200.png',
  },
  openGraph: {
    title: 'ZION OASIS · Interactive Worlds',
    description: 'Explore interactive OASIS worlds in the ZION multiverse.',
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
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
