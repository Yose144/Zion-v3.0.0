import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ObservatoryProvider } from "@/contexts/ObservatoryContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ClientBackgrounds from "@/components/ClientBackgrounds";

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
    default: 'ZION Blockchain v2.9.7 — Pre-MainNet Gate',
    template: '%s | ZION TerraNova',
  },
  description: "ZION TerraNova v2.9.7: Native Rust blockchain (52k LOC), Cosmic Harmony CHv3/CHv4 PoW, 6-layer architecture, TestNet live — MainNet target Dec 2026",
  keywords: "blockchain, consciousness mining, ZION, cryptocurrency, native rust, cosmic harmony, WARP bridge, testnet",
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
        <ThemeProvider>
          <ObservatoryProvider>
            <LanguageProvider>
            <ClientBackgrounds />
            <div className="relative z-10">
              <Navigation />
              <main className="zion-shell min-h-screen">
                {children}
              </main>
              <Footer />
            </div>
            </LanguageProvider>
          </ObservatoryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
