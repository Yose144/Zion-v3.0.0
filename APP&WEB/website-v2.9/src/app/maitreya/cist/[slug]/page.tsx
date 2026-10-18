import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE_APP_URL } from '@/lib/site';
import { MAITREYA_CHAPTERS, maitreyaChapterBySlug } from '../../chapters';
import ChapterReader from './ChapterReader';

export function generateStaticParams() {
  return MAITREYA_CHAPTERS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = maitreyaChapterBySlug(slug);
  if (!found) return {};
  const { chapter } = found;
  return {
    title: `${chapter.title.cs} — Maitreya Buddha`,
    description: `${chapter.num.cs}: ${chapter.title.cs} — ${chapter.num.en}: ${chapter.title.en}. Kniha Pátá, ZION Terra Nova.`,
    alternates: { canonical: `${SITE_APP_URL}/maitreya/cist/${chapter.slug}` },
  };
}

export default async function MaitreyaChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!maitreyaChapterBySlug(slug)) notFound();
  return <ChapterReader slug={slug} />;
}
