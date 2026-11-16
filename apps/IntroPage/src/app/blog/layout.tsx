import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kronika — blog ZION TerraNova",
  description:
    "Blog a kronika ZION TerraNova: vývoj sítě, OASIS, Amenti, Free World a příběhy komunity. Otevřený kód, transparentní pravidla.",
  alternates: { canonical: "/blog/" },
  openGraph: {
    title: "Kronika — blog ZION TerraNova",
    description: "Vývoj sítě, OASIS, Amenti a Free World. Příběhy komunity ZION TerraNova.",
    url: "/blog/",
    type: "website",
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
