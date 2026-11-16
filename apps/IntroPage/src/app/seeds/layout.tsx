import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import "./seeds.css";

const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-seeds-display",
  display: "swap",
});

const body = Source_Sans_3({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-seeds-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZION Seeds — One Love, One Seed | ZION TerraNova",
  description:
    "Pět strainů ZION Seeds: E = MC², Genesis, Jaganath Krishna, Paramajoti Hiranyagarbha a Ramayana. Příběh, genetika, účinky a průvodce pěstováním.",
  alternates: { canonical: "/seeds/" },
  openGraph: {
    title: "ZION Seeds — One Love, One Seed",
    description: "Pět strainů ZION Seeds — příběh, genetika, účinky a průvodce pěstováním.",
    url: "/seeds/",
    type: "website",
    images: [{ url: "/images/seeds/seeds-hero.webp", width: 1672, height: 941, alt: "ZION Seeds" }],
  },
};

export default function SeedsLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable}`}>{children}</div>;
}
