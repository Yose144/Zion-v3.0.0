import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

function booksDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, 'canon', 'books');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(process.cwd(), '../../canon/books');
}

function firstHeading(markdown: string, fallback: string): string {
  for (const line of markdown.split('\n')) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) return match[2].replace(/[*_`]/g, '').trim() || fallback;
  }
  return fallback;
}

export async function GET() {
  try {
    const root = booksDir();
    const entries = await readdir(root, { withFileTypes: true });
    const books = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = path.join(root, entry.name, '00-README.md');
      let text: string;
      try {
        text = await readFile(file, 'utf8');
      } catch {
        continue;
      }
      books.push({ id: entry.name, title: firstHeading(text, entry.name) });
    }
    books.sort((a, b) => a.title.localeCompare(b.title, 'cs'));
    return NextResponse.json({ books }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ books: [] }, { status: 502 });
  }
}
