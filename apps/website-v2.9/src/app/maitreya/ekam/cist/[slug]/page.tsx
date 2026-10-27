import { redirect } from 'next/navigation';
import { EKAM_BOOK } from '@/lib/books/registry';

export function generateStaticParams() {
  return EKAM_BOOK.chapters.map((c) => ({ slug: c.slug }));
}

export default async function ChapterRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/maitreya/ekam/cist#${slug}`);
}
