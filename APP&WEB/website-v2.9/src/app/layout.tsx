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
    <html lang="cs" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} antialiased bg-black text-white overflow-x-hidden`}>
        <GlobalErrorBoundary>
          <ThemeProvider>
            <ObservatoryProvider>
              <LanguageProvider>
                <WalletProvider>
                  <ZionWalletProvider>
                    <ClientBackgrounds />
                    <div className="relative z-10">
                      <Navigation />
                      <HeroSection />
                      <main className="zion-shell min-h-screen">
                        {children}
                      </main>
                      <Footer />
                    </div>
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
