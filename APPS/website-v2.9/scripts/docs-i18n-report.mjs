#!/usr/bin/env node
/**
 * Inventory: for each doc path referenced in src/app/docs/page.tsx,
 * check public/docs/{cs|en}/file vs public/docs/file.
 *
 * Load order in the app: `${lang}/${file}` then `file` (fallback).
 *
 * Usage: node scripts/docs-i18n-report.mjs
 *        node scripts/docs-i18n-report.mjs --json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pageTsx = path.join(__dirname, '../src/app/docs/page.tsx');
const docsRoot = path.join(__dirname, '../public/docs');

const src = fs.readFileSync(pageTsx, 'utf8');
const re = /file:\s*'([^']+)'/g;
const files = [
  ...new Set(
    [...src.matchAll(re)]
      .map((m) => m[1])
      .filter((f) => f !== '__philosophy__'),
  ),
].sort();

function exists(rel) {
  return fs.existsSync(path.join(docsRoot, rel));
}

const rows = [];
for (const f of files) {
  const hasCs = exists(path.join('cs', f));
  const hasEn = exists(path.join('en', f));
  const hasRoot = exists(f);
  let status;
  if (hasCs && hasEn) status = 'cs+en';
  else if (hasCs && !hasEn) status = 'cs-only';
  else if (!hasCs && hasEn) status = 'en-only';
  else if (hasRoot) status = 'root-only';
  else status = 'MISSING';

  rows.push({ file: f, hasCs, hasEn, hasRoot, status });
}

const counts = rows.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] ?? 0) + 1;
  return acc;
}, {});

const json = process.argv.includes('--json');

if (json) {
  console.log(JSON.stringify({ counts, rows }, null, 2));
  process.exit(0);
}

console.log(`Docs i18n inventory — ${rows.length} paths from page.tsx (public/docs/)`);
console.log('');
for (const r of rows) {
  const flags = `${r.hasCs ? 'C' : '·'}${r.hasEn ? 'E' : '·'}${r.hasRoot ? 'R' : '·'}`;
  console.log(`${r.status.padEnd(12)} [${flags}] ${r.file}`);
}
console.log('');
console.log('Legend: C=cz/en file exists, E=en/…, R=root fallback. Status cs+en = both locales; root-only = same markdown for both UI langs until translated.');
console.log('Counts: ' + JSON.stringify(counts));
