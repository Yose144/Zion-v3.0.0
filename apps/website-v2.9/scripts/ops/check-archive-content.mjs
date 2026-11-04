#!/usr/bin/env node
// Archive content health check (W1).
//
// Read-only audit of the Zion Archive source trees: flags empty files,
// duplicate numeric prefixes, stray non-book files, and reports honest EN
// coverage per book directory. Complements /api/archive/audit (which checks
// the registry's declared chapters against real files).
//
// Usage:
//   node apps/website-v2.9/scripts/ops/check-archive-content.mjs
//   node apps/website-v2.9/scripts/ops/check-archive-content.mjs --json out.json
//
// Exit code 1 when a hard problem is found (empty file, duplicate prefix).

import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const APP = join(HERE, '..', '..');
const ROOT = join(APP, '..', '..');

const TREES = [
  { id: 'archive-books', dir: join(APP, 'archive-content/books'), nested: 'kapitoly' },
  { id: 'archive-books-en', dir: join(APP, 'archive-content/en/books'), nested: 'kapitoly' },
  { id: 'archive-korpus', dir: join(APP, 'archive-content/korpus') },
  { id: 'public-books', dir: join(APP, 'public/docs/books'), nested: 'kapitoly' },
  { id: 'public-books-en', dir: join(APP, 'public/docs/en/books'), nested: 'kapitoly' },
  { id: 'public-korpus', dir: join(APP, 'public/docs/korpus') },
];

// Names that belong to the book structure itself; anything else is an
// auxiliary document (onboarding, marketing, changelog) that stays linkable
// through the docs viewer but is not a chapter.
const BOOK_FILE = /^(\d+-|00-|readme|prolog|epilog|full|BOOK-|UCEBNICE-|NIRVANA_)/i;
const EN = /_EN\.md$/i;

function listDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

function listMd(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

function auditDir(dir, treeId) {
  const files = listMd(dir);
  const base = files.filter((f) => !EN.test(f) && !/\/full\.md$/i.test(f));
  const en = files.filter((f) => EN.test(f));

  const empty = files
    .filter((f) => statSync(f).size < 200)
    .map((f) => relative(APP, f));

  const numbers = new Map();
  for (const file of base) {
    const name = file.split('/').pop() ?? '';
    const m = name.match(/^(\d+)-/);
    if (!m) continue;
    const key = String(parseInt(m[1], 10));
    numbers.set(key, (numbers.get(key) ?? 0) + 1);
  }
  const duplicates = [...numbers.entries()]
    .filter(([n, count]) => count > 1 && Number(n) > 0) // multiple 00-* front matter is fine
    .map(([n]) => n);

  const aux = base
    .map((f) => f.split('/').pop() ?? '')
    .filter((name) => !BOOK_FILE.test(name))
    .map((name) => name.replace(/\.md$/, ''));

  const enSlugs = new Set(
    en.map((f) => (f.split('/').pop() ?? '').replace(/_EN\.md$/i, '').replace(/\.md$/, '')),
  );
  const baseSlugs = new Set(base.map((f) => (f.split('/').pop() ?? '').replace(/\.md$/, '')));
  const enComplete = [...baseSlugs].filter((s) => enSlugs.has(s)).length;

  const isEnTree = /-en$/.test(treeId);
  return {
    dir: relative(APP, dir),
    files: files.length,
    base: base.length,
    en: en.length,
    // EN trees hold translations without the _EN suffix — coverage is n/a there.
    enCoverage: isEnTree ? null : base.length ? Number(((enComplete / base.length) * 100).toFixed(1)) : 0,
    empty,
    duplicates,
    aux,
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  trees: [],
  totals: { dirs: 0, files: 0, empty: 0, duplicates: 0, aux: 0 },
};

for (const tree of TREES) {
  const bookDirs = tree.nested
    ? listDirs(join(tree.dir)).map((d) => {
        const nested = join(d, tree.nested);
        return existsSync(nested) ? nested : d; // ekam-deeksha has BOOK-*.md directly
      })
    : listDirs(tree.dir);
  for (const dir of bookDirs) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    const row = { tree: tree.id, ...auditDir(dir, tree.id) };
    report.trees.push(row);
    report.totals.dirs += 1;
    report.totals.files += row.files;
    report.totals.empty += row.empty.length;
    report.totals.duplicates += row.duplicates.length;
    report.totals.aux += row.aux.length;
  }
}

const jsonFlag = process.argv.indexOf('--json');
if (jsonFlag > -1 && process.argv[jsonFlag + 1]) {
  const out = process.argv[jsonFlag + 1];
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(`[archive-audit] JSON → ${relative(ROOT, out)}`);
}

const pad = (v, n) => String(v).padEnd(n);
console.log(`\n${pad('tree', 20)}${pad('dir', 34)}${pad('md', 5)}${pad('EN', 5)}${pad('EN %', 7)}problems`);
for (const row of report.trees) {
  const problems = [];
  if (row.empty.length) problems.push(`empty:${row.empty.length}`);
  if (row.duplicates.length) problems.push(`dup:${row.duplicates.join(',')}`);
  if (row.aux.length) problems.push(`aux:${row.aux.length}`);
  console.log(
    `${pad(row.tree, 20)}${pad(row.dir.replace(/^archive-content\//, 'ac/').replace(/^public\/docs\//, 'pd/'), 34)}${pad(row.base, 5)}${pad(row.en, 5)}${pad(row.enCoverage === null ? 'n/a' : row.enCoverage + '%', 7)}${problems.join(' ') || 'ok'}`,
  );
}

const { dirs, files, empty, duplicates, aux } = report.totals;
console.log(`\n[archive-audit] ${dirs} dirs · ${files} md files · empty ${empty} · duplicate prefixes ${duplicates} · auxiliary docs ${aux}`);
process.exit(empty > 0 || duplicates > 0 ? 1 : 0);
