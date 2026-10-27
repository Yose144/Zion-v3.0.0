import { redirect } from 'next/navigation';
import { MAITREYA_CHAPTERS } from '@/lib/books/maitreya';

export function generateStaticParams() {
  return MAITREYA_CHAPTERS.map((c) => ({ slug: c.slug }));
}

export default async function ChapterRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/maitreya/cist#${slug}`);
}
