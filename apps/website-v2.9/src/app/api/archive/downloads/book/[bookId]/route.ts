import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { hasArchiveAccess } from '@/lib/archive-access';
import { recordAccess, recordDownload } from '@/lib/archive-metrics';
import { BOOKS } from '@/lib/books/registry';
import { createZipStore, type ZipEntry } from '@/lib/zip-store';

// Per-book offline bundle (Markdown, ZIP) built on demand from the gated
// sources. No binaries in git/deploy; the pass check happens before any file
// is read. CS chapters always included, EN only when a real translation exists
// (the short "language note" stubs are skipped).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function findRoot(candidates: string[]): string {
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

const ARCHIVE_ROOT = findRoot([
  resolve(process.cwd(), 'archive-content'),
  resolve(process.cwd(), '.next/standalone/archive-content'),
  resolve(process.cwd(), '../../archive-content'),
]);
const PUBLIC_DOCS = join(
  findRoot([
    resolve(process.cwd(), 'public'),
    resolve(process.cwd(), '.next/standalone/public'),
    resolve(process.cwd(), '../../public'),
  ]),
  'docs',
);

function readDoc(docPath: string): Buffer | null {
  let abs: string | null = null;
  if (docPath.startsWith('/api/archive/docs/')) {
    abs = join(ARCHIVE_ROOT, docPath.slice('/api/archive/docs/'.length));
  } else if (docPath.startsWith('/docs/')) {
    abs = join(PUBLIC_DOCS, docPath.slice('/docs/'.length));
  }
  if (!abs || !existsSync(abs)) return null;
  try {
    return readFileSync(abs);
  } catch {
    return null;
  }
}

function isStub(data: Buffer): boolean {
  return data.length < 1500 && /language note/i.test(data.toString('utf8'));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  if (!(await hasArchiveAccess())) {
    recordAccess(false);
    return new NextResponse('Archive Pass required', { status: 403 });
  }
  recordAccess(true);

  const { bookId } = await params;
  const book = BOOKS[bookId];
  if (!book) return new NextResponse('Unknown book', { status: 404 });

  const entries: ZipEntry[] = [];
  const readme = [
    `# ${book.title.en}`,
    '',
    book.subtitle.en,
    '',
    `Zion Archive — personal offline copy of “${book.title.en}”.`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'Folders:',
    '  cs/ — canonical Czech chapters',
    '  en/ — English chapters (only where a real translation exists)',
    '',
    'License: personal use. The archive is a paid library; please do not redistribute.',
    '',
  ].join('\n');
  entries.push({ name: `${bookId}/README.txt`, data: Buffer.from(readme, 'utf8') });

  if (book.singleDoc) {
    const cs = readDoc(book.singleDoc.docPath('cs'));
    if (cs) entries.push({ name: `${bookId}/cs/${bookId}.md`, data: cs });
    const en = readDoc(book.singleDoc.docPath('en'));
    if (en && !isStub(en)) entries.push({ name: `${bookId}/en/${bookId}.md`, data: en });
  } else if (book.docPath) {
    for (const chapter of book.chapters) {
      const cs = readDoc(book.docPath(chapter.slug, 'cs'));
      if (cs) entries.push({ name: `${bookId}/cs/${chapter.slug}.md`, data: cs });
      const en = readDoc(book.docPath(chapter.slug, 'en'));
      if (en && !isStub(en)) {
        entries.push({ name: `${bookId}/en/${chapter.slug}.md`, data: en });
      }
    }
  }

  if (entries.length <= 1) {
    return new NextResponse('No content', { status: 404 });
  }

  recordDownload(`book:${bookId}`);
  const zip = createZipStore(entries);
  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${bookId}-zion-archive.zip"`,
      'Cache-Control': 'no-store',
      'X-Archive-Download': `book:${bookId}`,
    },
  });
}
