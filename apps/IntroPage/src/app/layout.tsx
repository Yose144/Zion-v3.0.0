import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../../../shared/ui/tokens.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0d0d0d",
};

/** Bump when the hand-authored CSS/JS in public/ changes so caches invalidate. */
const ASSET_V = "20261112";

export const metadata: Metadata = {
  metadataBase: new URL("https://zionterranova.com"),
  title: "ZION TerraNova — Native Rust Blockchain & OASIS Ecosystem",
  description:
    "ZION TerraNova: native Rust Layer-1 blockchain — mining pool, explorer, wallet, multichain bridge, OASIS metaverse, humanitarian fee split. One Love · v3.2.0 Mainnet Beta (testing stage).",
  keywords:
    "ZION TerraNova, ZION blockchain, ZION coin, zionterranova, native rust blockchain, OASIS metaverse, consciousness mining, humanitarian crypto",
  alternates: { canonical: "/" },
  verification: {
    google: "UwFu4TK29yFmUS28A2W-rDVZeu6YNHXaF-zqGIdAgAE",
  },
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
        {/* Legacy HTML5UP stack (public/) — loaded here, not in the page body, so
            every route gets the same cascade and the browser can fetch them in
            parallel. Order matters: base template → stargate → rasta overrides.
            Font Awesome is gone: its 60 KB CSS + 77 KB webfont existed for four
            social icons, which are now inline SVG in the markup. */}
        <link rel="stylesheet" href={`/assets/css/main.css?v=${ASSET_V}`} precedence="default" />
        <link rel="stylesheet" href={`/stargate/stargate-theme.css?v=${ASSET_V}`} precedence="default" />
        <link rel="stylesheet" href={`/assets/css/intro-rasta.css?v=${ASSET_V}`} precedence="default" />
        <noscript>
          <link rel="stylesheet" href="/assets/css/noscript.css" />
        </noscript>
      </head>
      <body
        className={inter.variable}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
