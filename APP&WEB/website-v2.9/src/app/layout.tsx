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
import HeroSection from "@/components/HeroSection";
import BackgroundToggle from "@/components/BackgroundToggle";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import PerformanceShell from "@/components/PerformanceShell";
import { SITE_APP_URL, SITE_NETWORK_TOPOLOGY, SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL, SITE_VERSION } from '@/lib/site';

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
  minimumScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_APP_URL),
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
    images: [{ url: '/zion-social-banner.png', width: 1200, height: 630, alt: 'ZION TerraNova' }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="dark" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <head>
        <link rel="preconnect" href="https://prod.spline.design" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://widget.li.fi" />
        <link rel="dns-prefetch" href="https://open.spotify.com" />
        <link rel="dns-prefetch" href="https://api.spotify.com" />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} antialiased text-white w-full`} style={{ maxWidth: '100%', overflowX: 'hidden', background: 'transparent' }}>
        <ServiceWorkerRegistration />
        <GlobalErrorBoundary>
          <ThemeProvider>
            <ObservatoryProvider>
              <LanguageProvider>
                <WalletProvider>
                  <ZionWalletProvider>
                    <AuthProvider>
                    <PerformanceShell />
                    <BackgroundToggle />
                    <div className="relative z-10 overflow-x-clip w-full">
                      <Navigation />
                      <div className="site-hero">
                        <HeroSection />
                      </div>
                      <main className="zion-shell site-main min-h-screen">
                        {children}
                      </main>
                      <div className="site-footer">
                        <Footer />
                      </div>
                    </div>
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
