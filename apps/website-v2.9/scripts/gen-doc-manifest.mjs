#!/usr/bin/env node
/**
 * Generates src/lib/doc-manifest.json — the index of every file under
 * public/docs that the link-resolver (src/lib/docLinks.ts) can route to.
 * Also indexes archive-content/ (Archive Pass gated books) into a separate
 * `archiveFiles` set so book chapter derivation keeps working without the
 * files being publicly served.
 * Runs via `prebuild`/`predev`; safe to run standalone.
 */
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = join(root, 'public', 'docs');
const archiveRoot = join(root, 'archive-content');
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

function scan(rootDir) {
  if (!existsSync(rootDir)) return [];
  const out = [];
  for (const f of walk(rootDir)) {
    out.push(relative(rootDir, f).split('\\').join('/'));
  }
  return out.sort();
}

const files = scan(docsRoot);
const archiveFiles = scan(archiveRoot);

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), files, archiveFiles }, null, 1) + '\n',
);
console.log(`doc-manifest: ${files.length} public + ${archiveFiles.length} archive files → ${relative(root, outFile)}`);
