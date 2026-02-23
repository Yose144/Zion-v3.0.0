import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ObservatoryProvider } from "@/contexts/ObservatoryContext";
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
    default: 'ZION Blockchain v2.9.6 — On the Star',
    template: '%s | ZION TerraNova',
  },
  description: "ZION Terra Nova: Native Rust mining pool, consciousness-based blockchain, Cosmic Harmony algorithm, and multi-chain WARP bridges",
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
            <ClientBackgrounds />
            <div className="relative z-10">
              <Navigation />
              <main className="min-h-screen">
                {children}
              </main>
              <Footer />
            </div>
          </ObservatoryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
