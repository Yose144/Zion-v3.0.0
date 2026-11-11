import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PRODUCTS, productBySlug } from '@/data/catalog';
import ProductDetailView from '@/components/product-detail-view';
import { pick } from '@/lib/i18n';

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) return {};
  return {
    title: pick(product.seo.title, 'cs'),
    description: pick(product.seo.description, 'cs'),
    openGraph: {
      title: pick(product.seo.title, 'cs'),
      description: pick(product.seo.description, 'cs'),
      images: [{ url: product.image }],
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();
  return <ProductDetailView product={product} />;
}
