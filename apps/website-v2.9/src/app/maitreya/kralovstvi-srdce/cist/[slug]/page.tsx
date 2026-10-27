import { redirect } from 'next/navigation';
import { KRAL_CHAPTERS } from '@/lib/books/kralovstvi-srdce';

export function generateStaticParams() {
  return KRAL_CHAPTERS.map((c) => ({ slug: c.slug }));
}

export default async function ChapterRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/maitreya/kralovstvi-srdce/cist#${slug}`);
}
