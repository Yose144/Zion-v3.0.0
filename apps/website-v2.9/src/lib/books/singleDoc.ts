// Split a single markdown file into reader "chapters" by heading boundaries.
// Used by BookDef.singleDoc — one fetch, heading-derived TOC, same reader UX
// as chaptered books.

import type { BookChapter, SingleDocSpec } from './types';

export interface SingleDocBook {
  chapters: BookChapter[];
  parts: { cs: string; en: string }[];
  /** md body per chapter slug (heading line included). */
  content: Record<string, string>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

interface Heading {
  level: number;
  text: string;
  line: number;
}

export function splitSingleDoc(md: string, spec: SingleDocSpec): SingleDocBook {
  const lines = md.split('\n');
  const headings: Heading[] = [];
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^```/.test(line.trim())) inFence = !inFence;
    if (inFence) return;
    const m = line.match(/^(#{1,3})\s+(.*)$/);
    if (m) headings.push({ level: m[1].length, text: m[2].trim(), line: i });
  });

  const chapters: BookChapter[] = [];
  const parts: { cs: string; en: string }[] = [spec.introPartTitle];
  const content: Record<string, string> = {};
  const usedSlugs = new Set<string>();
  let part = 0;
  let chNum = 0;
  let sectionStart = -1;
  let currentSlug: string | null = null;
  let pendingPartStart = -1;
  let preamble: string[] = [];

  const flush = (endLine: number) => {
    if (currentSlug === null) {
      preamble = lines.slice(0, endLine);
      return;
    }
    content[currentSlug] = lines.slice(sectionStart, endLine).join('\n');
  };

  // First chapter boundary = first chapter heading OR first part heading.
  let started = false;
  for (const h of headings) {
    const isPart = spec.partMatch ? h.level === spec.partMatch.level && spec.partMatch.re.test(h.text) : false;
    const isChapter = !isPart && h.level === spec.chapterMatch.level && spec.chapterMatch.re.test(h.text);
    if (!isPart && !isChapter && !started) continue;

    if (isPart) {
      if (started) flush(h.line);
      part = parts.length;
      parts.push({ cs: h.text.replace(/^#+\s*/, ''), en: h.text.replace(/^#+\s*/, '') });
      currentSlug = null;
      // part heading + its intro lines get prepended to the part's first chapter
      pendingPartStart = h.line;
      started = true;
      continue;
    }
    if (isChapter) {
      if (started && currentSlug !== null) flush(h.line);
      chNum += 1;
      let slug = slugify(h.text);
      if (!slug) slug = `kap-${chNum}`;
      while (usedSlugs.has(slug)) slug = `${slug}-x`;
      usedSlugs.add(slug);
      chapters.push({
        slug,
        part,
        num: { cs: `${spec.chapterNumPrefix.cs} ${chNum}`, en: `${spec.chapterNumPrefix.en} ${chNum}` },
        title: { cs: h.text, en: h.text },
      });
      currentSlug = slug;
      sectionStart = pendingPartStart >= 0 ? pendingPartStart : h.line;
      pendingPartStart = -1;
      started = true;
    }
  }
  if (started) flush(lines.length);

  // No chapter headings matched → whole doc = one chapter (intro part).
  if (chapters.length === 0) {
    const slug = 'obsah';
    chapters.push({
      slug,
      part: 0,
      num: { cs: spec.chapterNumPrefix.cs + ' 1', en: spec.chapterNumPrefix.en + ' 1' },
      title: { cs: spec.introPartTitle.cs, en: spec.introPartTitle.en },
    });
    content[slug] = md;
  } else {
    // Prepend preamble (title etc.) into the first chapter.
    const first = chapters[0].slug;
    if (preamble.length) content[first] = preamble.join('\n') + '\n\n' + (content[first] ?? '');
  }

  return { chapters, parts, content };
}
