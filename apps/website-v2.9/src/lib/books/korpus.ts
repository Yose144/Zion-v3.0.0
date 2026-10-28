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

  const isReadme = (s: string) => /^(00-)?readme$/i.test(s);
  // other 00-* files (prolog/outline/…) are front matter, not the index
  const isFront = (s: string) => !isReadme(s) && /^00-/.test(s);
  const ordered = [
    ...slugs.filter(isReadme),
    ...slugs.filter(isFront),
    ...slugs.filter((s) => !isReadme(s) && !isFront(s)),
  ];

  const frontNum = (slug: string) =>
    /prolog/i.test(slug)
      ? { cs: 'Prolog', en: 'Prologue' }
      : /outline|osnova|obsah/i.test(slug)
        ? { cs: 'Osnova', en: 'Outline' }
        : { cs: 'Úvod', en: 'Intro' };

  const chapters: BookChapter[] = ordered.map((slug, i) => {
    const m = slug.match(/^(\d+)-/);
    const isIndex = isReadme(slug);
    const isEpilog = /^epilog/i.test(slug);
    const num: { cs: string; en: string } = isIndex
      ? { cs: 'Index', en: 'Index' }
      : isEpilog
        ? { cs: 'Epilog', en: 'Epilogue' }
        : isFront(slug)
          ? frontNum(slug)
          : { cs: m ? String(parseInt(m[1], 10)) : `${i}`, en: m ? String(parseInt(m[1], 10)) : `${i}` };
    return {
      slug,
      part: isIndex || isFront(slug) ? 0 : 1,
      num,
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

/** Count of *_EN.md translations present for a korpus book. */
export function korpusEnCount(dir: string): number {
  const prefix = `korpus/${dir}/`;
  return [...FILES].filter((f) => f.startsWith(prefix) && f.endsWith('_EN.md')).length;
}

/** Honest language fact for a korpus book ('CZ' / 'CZ (+EN části)' / 'CZ + EN'). */
export function korpusLangs(dir: string, chapterCount: number): string {
  const en = korpusEnCount(dir);
  if (en === 0) return 'CZ';
  if (en >= chapterCount) return 'CZ + EN';
  return 'CZ (+EN části)';
}
