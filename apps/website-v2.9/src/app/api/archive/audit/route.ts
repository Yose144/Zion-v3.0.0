import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { resolve, join } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { BOOKS } from '@/lib/books/registry';

// Archive content audit (W1) — does every chapter declared in the registry
// resolve to a real file, and what is the honest EN coverage?
//
// Admin-only, same bearer token as /api/archive/entitlements
// (ARCHIVE_ADMIN_TOKEN). Disabled when the token is unset (fail closed).
// Read-only; no content is returned, only counts and missing slugs.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function authorized(req: NextRequest): boolean {
  const token = process.env.ARCHIVE_ADMIN_TOKEN;
  if (!token) return false;
  const header = req.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : (req.headers.get('x-admin-token') ?? '');
  return supplied.length > 0 && safeEqual(supplied, token);
}

function findRoot(candidates: string[]): string {
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

const ARCHIVE_ROOT = findRoot([
  resolve(process.cwd(), 'archive-content'),
  resolve(process.cwd(), '.next/standalone/archive-content'),
  resolve(process.cwd(), '../../archive-content'),
]);
const PUBLIC_ROOT = findRoot([
  resolve(process.cwd(), 'public'),
  resolve(process.cwd(), '.next/standalone/public'),
  resolve(process.cwd(), '../../public'),
]);
// reader paths are /docs/... — that maps to public/docs/..., not public/...
const PUBLIC_DOCS = join(PUBLIC_ROOT, 'docs');

/** Map a reader doc path onto the filesystem (archive-content or public). */
function resolveDoc(docPath: string): { abs: string; kind: 'archive' | 'public' } | null {
  if (docPath.startsWith('/api/archive/docs/')) {
    return { abs: join(ARCHIVE_ROOT, docPath.slice('/api/archive/docs/'.length)), kind: 'archive' };
  }
  if (docPath.startsWith('/docs/')) {
    return { abs: join(PUBLIC_DOCS, docPath.slice('/docs/'.length)), kind: 'public' };
  }
  return null;
}

// A short "language note" file is a placeholder, not a translation.
function isTranslationStub(absPath: string): boolean {
  try {
    if (statSync(absPath).size >= 1500) return false;
    const text = readFileSync(absPath, 'utf8');
    return /language note/i.test(text);
  } catch {
    return false;
  }
}

function exists(docPath: string): boolean {
  const resolved = resolveDoc(docPath);
  if (!resolved || !existsSync(resolved.abs)) return false;
  return !isTranslationStub(resolved.abs);
}

function isFrontMatter(slug: string, num: { cs: string; en: string }): boolean {
  return /^(00-)?readme$/i.test(slug) || num.cs === 'Index' || num.en === 'Index';
}

/** Count `### Kapitola N` headings in a single-doc book (quantum-revolution). */
function singleDocInfo(docPath: string): { exists: boolean; chapters: number } {
  const resolved = resolveDoc(docPath);
  if (!resolved || !existsSync(resolved.abs) || isTranslationStub(resolved.abs)) {
    return { exists: false, chapters: 0 };
  }
  try {
    const text = readFileSync(resolved.abs, 'utf8');
    const chapters = (text.match(/^###\s+Kapitola\s+\d+/gim) ?? []).length;
    return { exists: true, chapters };
  } catch {
    return { exists: false, chapters: 0 };
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const books = Object.values(BOOKS).map((book) => {
    const chapterSlugs = book.chapters.map((c) => c.slug);
    const duplicates = chapterSlugs.filter((slug, i) => chapterSlugs.indexOf(slug) !== i);
    const missingParts = book.chapters
      .filter((c) => !book.parts[c.part])
      .map((c) => c.slug);
    const frontMatter = book.chapters
      .filter((c) => isFrontMatter(c.slug, c.num))
      .map((c) => c.slug);

    if (book.singleDoc) {
      const cs = singleDocInfo(book.singleDoc.docPath('cs'));
      const en = singleDocInfo(book.singleDoc.docPath('en'));
      return {
        id: book.id,
        mode: 'single-doc',
        declaredChapters: 0,
        frontMatter,
        duplicates,
        missingParts,
        singleDoc: { cs, en },
        missingCs: cs.exists ? [] : [book.singleDoc.docPath('cs')],
        missingEn: en.exists ? [] : [book.singleDoc.docPath('en')],
      };
    }

    const missingCs: string[] = [];
    for (const chapter of book.chapters) {
      const csPath = book.docPath?.(chapter.slug, 'cs');
      if (!csPath || !exists(csPath)) missingCs.push(chapter.slug);
    }

    // EN coverage counts real chapters only — front matter is not translated.
    const translatable = book.chapters.filter((c) => !isFrontMatter(c.slug, c.num));
    const missingEn: string[] = [];
    for (const chapter of translatable) {
      const enPath = book.docPath?.(chapter.slug, 'en');
      if (!enPath || !exists(enPath)) missingEn.push(chapter.slug);
    }

    return {
      id: book.id,
      mode: 'chaptered',
      declaredChapters: book.chapters.length,
      translatableChapters: translatable.length,
      frontMatter,
      duplicates,
      missingParts,
      missingCs,
      missingEn,
      enCoverage: translatable.length
        ? Number((((translatable.length - missingEn.length) / translatable.length) * 100).toFixed(1))
        : 0,
    };
  });

  const totals = books.reduce(
    (acc, b) => {
      acc.books += 1;
      acc.declaredChapters += b.declaredChapters;
      acc.missingCs += b.missingCs.length;
      acc.missingEn += b.missingEn.length;
      acc.frontMatter += b.frontMatter.length;
      acc.duplicates += b.duplicates.length;
      acc.missingParts += b.missingParts.length;
      return acc;
    },
    {
      books: 0,
      declaredChapters: 0,
      missingCs: 0,
      missingEn: 0,
      frontMatter: 0,
      duplicates: 0,
      missingParts: 0,
    },
  );

  return NextResponse.json({
    ok: totals.missingCs === 0 && totals.duplicates === 0 && totals.missingParts === 0,
    generatedAt: new Date().toISOString(),
    roots: { archive: ARCHIVE_ROOT, public: PUBLIC_ROOT },
    totals,
    books,
  });
}
