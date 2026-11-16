import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EvoluZion — cesta ZION TerraNova",
  description:
    "EvoluZion: manifest, vize a vývoj ZION TerraNova — od nativního Proof-of-Work blockchainu k OASIS, Free World a Protokolu péče.",
  alternates: { canonical: "/evoluzion/" },
  openGraph: {
    title: "EvoluZion — cesta ZION TerraNova",
    description: "Manifest a vize ZION TerraNova: blockchain, OASIS, Free World a Protokol péče.",
    url: "/evoluzion/",
    type: "website",
  },
};

export default function EvoluzionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
