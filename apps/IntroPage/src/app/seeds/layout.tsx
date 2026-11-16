import type { Metadata } from "next";

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
  return children;
}
