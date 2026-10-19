import { redirect } from 'next/navigation';
import { KRAL_CHAPTERS } from '../../chapters';

export function generateStaticParams() {
  return KRAL_CHAPTERS.map((c) => ({ slug: c.slug }));
}

export default async function ChapterRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/kralovstvi-srdce/cist#${slug}`);
}
