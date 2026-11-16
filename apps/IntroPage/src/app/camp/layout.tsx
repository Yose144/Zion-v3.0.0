import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Base Camp — ZION TerraNova",
  description:
    "Base Camp ZION TerraNova: setkání komunity, workshopy, pobyty a sdílené projekty. Místo, kde se digitální ekosystém potkává s fyzickým světem.",
  alternates: { canonical: "/camp/" },
  openGraph: {
    title: "Base Camp — ZION TerraNova",
    description: "Setkání, workshopy a pobyty komunity ZION TerraNova.",
    url: "/camp/",
    type: "website",
  },
};

export default function CampLayout({ children }: { children: React.ReactNode }) {
  return children;
}
