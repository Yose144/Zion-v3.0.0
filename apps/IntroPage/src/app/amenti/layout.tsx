import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Síně Amenti — on-chain archiv vědomí | ZION TerraNova",
  description:
    "Síně Amenti: živá knihovna ZION ekosystému — kroniky, legendy a proroctví ukotvené v transparentní síti. Propojení s Rainbow Bridge 44:44, OASIS a DAO governance.",
  alternates: { canonical: "/amenti/" },
  openGraph: {
    title: "Síně Amenti — on-chain archiv vědomí",
    description:
      "Kroniky, legendy a proroctví ZION ekosystému ukotvené on-chain. Vstup do knihovny Amenti.",
    url: "/amenti/",
    type: "website",
  },
};

export default function AmentiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
