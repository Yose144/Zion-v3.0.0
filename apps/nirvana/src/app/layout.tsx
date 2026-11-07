import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/core/session/AuthProvider';
import { I18nProvider } from '@/core/i18n';
import { ChatDock } from '@/core/net/ChatDock';
import { PassGate } from '@/core/shell/PassGate';
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
              {/* ZAP pas odemyká **celou** Nirvanu, ne jen vesmír: dřív šlo
                  z menu přepnout do hry i bez něj. Proxy navíc redirectuje
                  bez cookie rovnou na bránu, takže se sem nedostane ani HTML. */}
              {/* HUD i chat patří **za** bránu: jinak je na zamčené stránce
                  vidět lišta s přepínáním her a chat (a to je přesně to,
                  čím se dalo dostat do hry bez pasu). */}
              <PassGate>
                {children}
                {/* herní HUD: přepínání her, ovládání, žetony, ZION, ZIS —
                    jen na herních površích, sám se podle cesty skryje jinde */}
                <GameHud />
                {/* chat je jedna spojka na celou appku — jedno WS na kartu */}
                <ChatDock />
              </PassGate>
            </NetProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
