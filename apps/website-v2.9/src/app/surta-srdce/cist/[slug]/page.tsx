import { redirect } from 'next/navigation';
import { SURTA_CHAPTERS } from '../../chapters';

export function generateStaticParams() {
  return SURTA_CHAPTERS.map((c) => ({ slug: c.slug }));
}

export default async function ChapterRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/surta-srdce/cist#${slug}`);
}
