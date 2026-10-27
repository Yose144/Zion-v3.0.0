// Derive a chaptered book definition from the korpus file listing in
// doc-manifest.json (generated at prebuild from public/docs). Korpus books
// keep the NN-Name.md convention; `*_EN.md` are EN variants fetched by the
// reader's enFallback, `full.md` is the concatenated whole — excluded.

import manifest from '@/lib/doc-manifest.json';
import type { BookChapter, Lang } from './types';

const FILES = new Set((manifest as { files: string[] }).files);

function humanize(slug: string): string {
  return slug
    .replace(/^\d+-/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface KorpusBookData {
  chapters: BookChapter[];
  parts: { cs: string; en: string }[];
}

export function korpusChapters(dir: string): KorpusBookData {
  const prefix = `korpus/${dir}/`;
  const slugs = [...FILES]
    .filter(
      (f) =>
        f.startsWith(prefix) &&
        f.endsWith('.md') &&
        !f.endsWith('_EN.md') &&
        f.slice(prefix.length) !== 'full.md',
    )
    .map((f) => f.slice(prefix.length, -3))
    .sort();

  const isIndexSlug = (s: string) => /^00-/.test(s) || /^readme$/i.test(s);
  const ordered = [...slugs.filter(isIndexSlug), ...slugs.filter((s) => !isIndexSlug(s))];

  const chapters: BookChapter[] = ordered.map((slug, i) => {
    const m = slug.match(/^(\d+)-/);
    const isIndex = isIndexSlug(slug);
    const isEpilog = /^epilog/i.test(slug);
    const num = isIndex ? 'Index' : isEpilog ? 'Epilog' : m ? String(parseInt(m[1], 10)) : `${i}`;
    return {
      slug,
      part: isIndex ? 0 : 1,
      num: { cs: num, en: num },
      title: { cs: humanize(slug), en: humanize(slug) },
    };
  });

  return {
    chapters,
    parts: [
      { cs: 'O knize', en: 'About the book' },
      { cs: 'Kapitoly', en: 'Chapters' },
    ],
  };
}

export const korpusDocPath =
  (dir: string) =>
  (slug: string, lang: Lang): string =>
    lang === 'en' ? `/docs/korpus/${dir}/${slug}_EN.md` : `/docs/korpus/${dir}/${slug}.md`;
