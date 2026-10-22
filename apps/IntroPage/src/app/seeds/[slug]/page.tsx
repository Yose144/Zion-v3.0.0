import seedsData from "../../data/seeds-data.json";
import SeedsDetailClient from "./SeedsDetailClient";

export async function generateStaticParams() {
  return seedsData.strains.map((strain) => ({ slug: strain.slug }));
}

export default function Page({ params }: { params: { slug: string } }) {
  return <SeedsDetailClient slug={params.slug} />;
}
