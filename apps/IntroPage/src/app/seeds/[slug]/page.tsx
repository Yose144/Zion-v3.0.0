import type { Metadata } from "next";
import seedsData from "../../data/seeds-data.json";
import SeedsDetailClient from "./SeedsDetailClient";

export async function generateStaticParams() {
  return seedsData.strains.map((strain) => ({ slug: strain.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const strain = seedsData.strains.find((s) => s.slug === slug);
  if (!strain) return { title: "Seeds — ZION TerraNova" };
  return {
    title: `${strain.name} — Seeds | ZION TerraNova`,
    description: strain.subtitle,
    alternates: { canonical: `/seeds/${slug}/` },
    openGraph: {
      title: `${strain.name} — Seeds`,
      description: strain.subtitle,
      url: `/seeds/${slug}/`,
      type: "website",
      images: strain.image ? [{ url: strain.image }] : undefined,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SeedsDetailClient slug={slug} />;
}
