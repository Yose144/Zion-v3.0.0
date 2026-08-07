import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zionterranova.com"),
  title: "ZION TerraNova — OASIS",
  description:
    "ZION TerraNova: native Rust multichain blockchain, OASIS metaverse, humanitarian fee split. One Love.",
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: "ZION TerraNova",
    images: [{ url: "/stargate/nebula.jpg", width: 1200, height: 630, alt: "ZION Stargate" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" className={`${inter.variable} dark`}>
      <body className="antialiased bg-rasta-black text-white min-h-screen w-full">
        {children}
      </body>
    </html>
  );
}
