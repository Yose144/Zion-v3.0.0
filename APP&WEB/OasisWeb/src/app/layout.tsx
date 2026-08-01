import type { Metadata, Viewport } from 'next';
import './globals.css';
import ToastContainer from '@/components/Toast';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#05070a',
};

export const metadata: Metadata = {
  title: 'ZION OASIS · Interactive Worlds',
  description: 'Explore interactive OASIS worlds in the ZION multiverse.',
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
