// Unified book definitions for the Nirvana Hub library reader.
// One BookDef drives the shared <BookReader/> UI — chaptered books fetch
// per-slug markdown; single-doc books fetch one file and split it by headings.

import type { ComponentType } from 'react';

export interface BookChapter {
  slug: string;
  part: number;
  num: { cs: string; en: string };
  title: { cs: string; en: string };
}

export type Lang = 'cs' | 'en';
export type IconType = ComponentType<{ className?: string; style?: React.CSSProperties }>;

export interface HeadingMatch {
  level: number;
  re: RegExp;
}

export interface SingleDocSpec {
  /** Path of the whole markdown file relative to public root (e.g. /docs/books/ekam-deeksha/BOOK-FULL-VERSION.md). */
  docPath: (lang: Lang) => string;
  /** Heading that starts a new part (e.g. h1 `Část`). Null → all chapters in part 0. */
  partMatch: HeadingMatch | null;
  /** Heading that starts a new chapter. */
  chapterMatch: HeadingMatch;
  /** Title of part 0 shown for content before the first part heading. */
  introPartTitle: { cs: string; en: string };
  /** part label singular (e.g. 'Kapitola') used for generated `num` labels. */
  chapterNumPrefix: { cs: string; en: string };
}

export interface BookDef {
  id: string;
  /** RGB triple used for --rc accents, e.g. '251, 146, 60'. */
  accent: string;
  icon: IconType;
  partIcons: IconType[];
  kicker: { cs: string; en: string };
  title: { cs: string; en: string };
  subtitle: { cs: string; en: string };
  description: { cs: string; en: string };
  facts: { label: { cs: string; en: string }; value: string }[];
  notAvailable: { cs: string; en: string };
  czOnly: { cs: string; en: string };
  /** Chaptered book mode — per-slug markdown files. */
  chapters: BookChapter[];
  parts: { cs: string; en: string }[];
  docPath?: (slug: string, lang: Lang) => string;
  /** Single-doc mode — one file split by headings (genesis-style books). */
  singleDoc?: SingleDocSpec;
  /** Try Czech file when the EN one is missing. */
  enFallback?: boolean;
}
