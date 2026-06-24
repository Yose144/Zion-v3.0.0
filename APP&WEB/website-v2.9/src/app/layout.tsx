import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ObservatoryProvider } from "@/contexts/ObservatoryContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { ZionWalletProvider } from "@/contexts/ZionWalletContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ClientBackgrounds from "@/components/ClientBackgrounds";
import HeroSection from "@/components/HeroSection";
import { SITE_NETWORK_TOPOLOGY, SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL, SITE_VERSION } from '@/lib/site';

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#000000',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://zionterranova.com'),
  title: {
    default: `ZION Blockchain ${SITE_RELEASE_LABEL}`,
    template: '%s | ZION TerraNova',
  },
  description: `ZION TerraNova ${SITE_VERSION}: native Rust blockchain mainnet launch countdown to 31 December 2026 (New Year's Eve). ${SITE_NETWORK_TOPOLOGY}, public line ${SITE_RELEASE_LABEL}, runtime ${SITE_RUNTIME_LABEL}, pool telemetry, mining guides, and protocol docs.`,
  keywords: "blockchain, consciousness mining, ZION, cryptocurrency, native rust, cosmic harmony, WARP bridge, mainnet launch, countdown, V3",
  openGraph: {
    type: 'website',
    locale: 'cs_CZ',
    siteName: 'ZION TerraNova',
    images: [{ url: '/LogoStargate.jpg', width: 1024, height: 1024, alt: 'ZION TerraNova' }],
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="dark" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <body className={`${inter.variable} ${jetbrains.variable} antialiased bg-black text-white w-full`} style={{ maxWidth: '100%', overflowX: 'hidden' }}>
        <GlobalErrorBoundary>
          <ThemeProvider>
            <ObservatoryProvider>
              <LanguageProvider>
                <WalletProvider>
                  <ZionWalletProvider>
                    <AuthProvider>
                    <ClientBackgrounds />
                    <div className="relative z-10 overflow-x-clip w-full">
                      <Navigation />
                      <HeroSection />
                      <main className="zion-shell min-h-screen">
                        {children}
                      </main>
                      <Footer />
                    </div>
                    <script dangerouslySetInnerHTML={{__html: `
                      (function() {
                        function findOverflow() {
                          const docWidth = document.documentElement.clientWidth;
                          const overflowing = [];
                          document.querySelectorAll('*').forEach(function(el) {
                            if (el.scrollWidth > docWidth) {
                              overflowing.push({tag: el.tagName, class: el.className, id: el.id, scrollWidth: el.scrollWidth, docWidth: docWidth});
                            }
                          });
                          if (overflowing.length > 0) {
                            console.warn('[OVERFLOW DETECTOR] Elements wider than viewport:', overflowing);
                          } else {
                            console.log('[OVERFLOW DETECTOR] No overflow found');
                          }
                        }
                        if (document.readyState === 'loading') {
                          document.addEventListener('DOMContentLoaded', findOverflow);
                        } else {
                          findOverflow();
                        }
                        setTimeout(findOverflow, 3000);
                      })();
                    `}} />
                    </AuthProvider>
                  </ZionWalletProvider>
                </WalletProvider>
              </LanguageProvider>
            </ObservatoryProvider>
          </ThemeProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
