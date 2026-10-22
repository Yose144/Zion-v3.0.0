#!/usr/bin/env node
/**
 * Generates src/lib/doc-manifest.json — the index of every file under
 * public/docs that the link-resolver (src/lib/docLinks.ts) can route to.
 * Runs via `prebuild`/`predev`; safe to run standalone.
 */
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = join(root, 'public', 'docs');
const outFile = join(root, 'src', 'lib', 'doc-manifest.json');

const SERVE_EXTS = new Set(['.md', '.markdown', '.pdf', '.zip', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.txt', '.json', '.html', '.css']);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
      if (SERVE_EXTS.has(ext)) yield p;
    }
  }
}

const files = [];
for (const f of walk(docsRoot)) {
  files.push(relative(docsRoot, f).split('\\').join('/'));
}
files.sort();

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), files }, null, 1) + '\n',
);
console.log(`doc-manifest: ${files.length} files → ${relative(root, outFile)}`);
