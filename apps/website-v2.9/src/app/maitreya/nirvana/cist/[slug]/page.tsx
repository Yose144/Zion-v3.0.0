import { redirect } from 'next/navigation';
import { NIRVANA_CHAPTERS } from '@/lib/books/nirvana';

export function generateStaticParams() {
  return NIRVANA_CHAPTERS.map((c) => ({ slug: c.slug }));
}

export default async function ChapterRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/maitreya/nirvana/cist#${slug}`);
}
