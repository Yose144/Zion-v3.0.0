export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DOWNLOADS_DIR = process.env.ZION_DOWNLOADS_DIR || '/opt/zion/downloads';

export async function GET() {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    return NextResponse.json({ files: [] });
  }

  const entries = fs.readdirSync(DOWNLOADS_DIR)
    .filter(f => /^[a-zA-Z0-9._-]+$/.test(f))
    .map(name => {
      const stat = fs.statSync(path.join(DOWNLOADS_DIR, name));
      return { name, size: stat.size, modified: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));

  return NextResponse.json({ files: entries });
}
