import { redirect } from 'next/navigation';
import { getBook } from '@/lib/books/registry';

export function generateStaticParams() {
  return (getBook('mariacaminho')?.chapters ?? []).map((c) => ({ slug: c.slug }));
}

export default async function ChapterRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/zion-archive/mariacaminho/cist#${slug}`);
}
