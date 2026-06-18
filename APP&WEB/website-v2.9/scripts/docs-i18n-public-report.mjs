#!/usr/bin/env node
/**
 * Full inventory: every markdown under public/docs excluding cs/ en/ subtree roots.
 * Each file needs both cs/<rel> and en/<rel>.
 *
 * Usage: node scripts/docs-i18n-public-report.mjs [--json]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.join(__dirname, '../public/docs');

function walk(dir, baseRel = '') {
  /** @type {string[]} */
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = baseRel ? `${baseRel}/${e.name}` : e.name;
    if (e.name === 'cs' || e.name === 'en') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, rel));
    else if (e.name.endsWith('.md')) out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}

function exists(rel) {
  return fs.existsSync(path.join(docsRoot, rel));
}

const files = walk(docsRoot).sort();

const rows = [];
for (const f of files) {
  const hasCs = exists(path.join('cs', f));
  const hasEn = exists(path.join('en', f));
  let status;
  if (hasCs && hasEn) status = 'cs+en';
  else if (hasCs && !hasEn) status = 'en-missing';
  else if (!hasCs && hasEn) status = 'cs-missing';
  else status = 'PAIR-MISSING';
  rows.push({ file: f, hasCs, hasEn, status });
}

const counts = rows.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] ?? 0) + 1;
  return acc;
}, {});

const json = process.argv.includes('--json');

if (json) {
  console.log(JSON.stringify({ counts, docsRoot: path.relative('', docsRoot), rows }, null, 2));
  process.exit(rows.some((r) => r.status !== 'cs+en') ? 2 : 0);
}

console.log(`Docs public i18n — ${rows.length} markdown files outside cs/en roots`);
console.log('');
for (const r of rows)
  console.log(`${r.status.padEnd(12)} ${r.file}`);
console.log('');
console.log('Counts: ' + JSON.stringify(counts));

const bad = rows.filter((r) => r.status !== 'cs+en');
process.exitCode = bad.length ? 2 : 0;
