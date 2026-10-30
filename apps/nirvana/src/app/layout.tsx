import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/core/session/AuthProvider';
import { I18nProvider } from '@/core/i18n';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#02030a',
};

export const metadata: Metadata = {
  title: 'Království srdce',
  description: 'ZION Nirvana — Království srdce. Orbit Nové Země, prstenec Issobelly, Brána, OASIS.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
