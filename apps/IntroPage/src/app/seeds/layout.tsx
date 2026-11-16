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
  title: "Seeds — semínka ZION TerraNova",
  description:
    "Seeds: katalog semínek a kultivarů, které ZION TerraNova pěstuje v rámci komunitních projektů. Genetika, účinky a průvodce pěstováním.",
  alternates: { canonical: "/seeds/" },
  openGraph: {
    title: "Seeds — semínka ZION TerraNova",
    description: "Katalog semínek a kultivarů ZION TerraNova — genetika, účinky a pěstování.",
    url: "/seeds/",
    type: "website",
  },
};

export default function SeedsLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable}`}>{children}</div>;
}
