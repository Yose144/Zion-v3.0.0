import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://zionterranova.com"),
  title: "ZION TerraNova ® OASIS",
  description:
    "ZION TerraNova: native Rust multichain blockchain, OASIS metaverse, humanitarian fee split. One Love.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: "ZION TerraNova",
    images: [{ url: "/zion-social-banner.png", width: 1200, height: 630, alt: "ZION TerraNova" }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <head>
        <link rel="stylesheet" href="/assets/css/main.css" precedence="default" />
        <link rel="stylesheet" href="/stargate/stargate-theme.css" precedence="default" />
        <noscript>
          <link rel="stylesheet" href="/assets/css/noscript.css" />
        </noscript>
      </head>
      <body
        className={`${inter.variable} ${jetbrains.variable} is-preload`}
      >
        {children}
      </body>
    </html>
  );
}
