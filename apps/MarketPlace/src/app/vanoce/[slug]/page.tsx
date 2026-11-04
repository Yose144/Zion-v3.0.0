import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { christmasProducts, getXmasProduct } from '@/data/christmasProducts';
import XmasProductPage from '@/components/xmas/XmasProductPage';

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return christmasProducts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = getXmasProduct(slug);
  if (!product) return {};
  return {
    title: `${product.title.cs} | ZION Market — Vánoční edice`,
    description: product.intro.cs,
  };
}

export default async function VanoceProductRoute({ params }: { params: Params }) {
  const { slug } = await params;
  const product = getXmasProduct(slug);
  if (!product) notFound();
  return <XmasProductPage product={product} />;
}
