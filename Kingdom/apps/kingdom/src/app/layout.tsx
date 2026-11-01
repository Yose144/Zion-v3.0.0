import type { Metadata, Viewport } from 'next';
import '@zion/ui/tokens.css';
import './globals.css';
import { getLocale } from '@/core/locale.server';

export const metadata: Metadata = {
  title: 'Království srdce · ZION',
  description:
    'Jeden klient ekosystému ZION — řetěz, těžba, tržiště, knihovna a účet v jedné místnosti.',
  applicationName: 'ZION Kingdom',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#05060a',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
