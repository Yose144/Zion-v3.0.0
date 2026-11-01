import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/core/session/AuthProvider';
import { I18nProvider } from '@/core/i18n';
import { ChatDock } from '@/core/net/ChatDock';
import { GameHud } from '@/core/games/GameHud';
import { NetProvider } from '@/core/net/useNet';
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
          <AuthProvider>
            <NetProvider>
              {children}
              {/* herní HUD: přepínání her, ovládání, žetony, ZION, ZIS —
                  jen na herních površích, sám se podle cesty skryje jinde */}
              <GameHud />
              {/* chat je jedna spojka na celou appku — jedno WS na kartu */}
              <ChatDock />
            </NetProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
