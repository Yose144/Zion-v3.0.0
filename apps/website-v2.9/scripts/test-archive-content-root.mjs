#!/usr/bin/env node
/**
 * Two trees, one relative path. Production reads the standalone copy.
 * Development reads the source tree. ARCHIVE_CONTENT_ROOT overrides both.
 *
 *   node scripts/test-archive-content-root.mjs
 */

import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { build } = require('esbuild');

const dir = await mkdtemp(join(tmpdir(), 'zion-archive-root-'));
const outfile = join(dir, 'archive-content-root.mjs');
await build({
  entryPoints: [join(here, '../src/lib/archive-content-root.ts')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'warning',
});
const { archiveContentRoot } = await import(pathToFileURL(outfile).href);

const rel = join('books', 'same.md');
const source = join(dir, 'archive-content', 'books');
const standalone = join(dir, '.next', 'standalone', 'archive-content', 'books');
await mkdir(source, { recursive: true });
await mkdir(standalone, { recursive: true });
await writeFile(join(source, 'same.md'), 'from-source\n');
await writeFile(join(standalone, 'same.md'), 'from-standalone\n');

const checks = [];
const check = (name, ok) => {
  checks.push({ name, ok });
  if (!ok) console.error('FAIL', name);
};

const devRoot = archiveContentRoot(dir, { NODE_ENV: 'development' });
const prodRoot = archiveContentRoot(dir, { NODE_ENV: 'production' });
const override = join(dir, 'archive-content');
const forced = archiveContentRoot(dir, {
  NODE_ENV: 'production',
  ARCHIVE_CONTENT_ROOT: override,
});

check('dev reads the source tree', (await readFile(join(devRoot, rel), 'utf8')) === 'from-source\n');
check('production reads the standalone copy', (await readFile(join(prodRoot, rel), 'utf8')) === 'from-standalone\n');
check('override wins in production', (await readFile(join(forced, rel), 'utf8')) === 'from-source\n');
check('dev and production chose different trees', devRoot !== prodRoot);

await rm(dir, { recursive: true, force: true });
const failed = checks.filter((item) => !item.ok);
console.log(JSON.stringify({ total: checks.length, failed: failed.length, checks }, null, 2));
if (failed.length) process.exit(1);
