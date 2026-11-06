#!/usr/bin/env node
/**
 * ZION Archive — CZ ⇄ EN parity check
 *
 * For every English chapter file with a Czech counterpart, compare the structure
 * that a translation must preserve: relative link set, heading count, table rows,
 * code fences and size ratio. Flags stubs and structural drift.
 *
 * Usage:
 *   node scripts/check-archive-parity.mjs            # summary
 *   node scripts/check-archive-parity.mjs --verbose  # per-file problems
 *   node scripts/check-archive-parity.mjs --json     # machine readable
 *
 * Exit code 1 when any file drifts (link set, headings, tables, stubs).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT = join(ROOT, 'archive-content');

const args = new Set(process.argv.slice(2));
const VERBOSE = args.has('--verbose');
const JSON_OUT = args.has('--json');

/** Walk a directory and return every .md file. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

const norm = (s) => s.replace(/%20/g, ' ');
// English files legitimately link to their English counterparts (`X_EN.md`),
// so compare link *targets* with the language suffix collapsed.
const canon = (l) => l.replace(/_(?:EN|CZ)\.md$/, '.md');
const links = (text) =>
  [...new Set((text.match(/\]\((\.\.?\/[^)]*)\)/g) || []).map((m) => canon(norm(m.slice(2, -1)))))].sort();

const count = (text, re) => (text.match(re) || []).length;

function stats(file) {
  const text = readFileSync(file, 'utf8');
  return {
    file,
    bytes: Buffer.byteLength(text, 'utf8'),
    links: links(text),
    h2: count(text, /^##\s+/gm),
    h3: count(text, /^###\s+/gm),
    tableRows: count(text, /^\|.*\|\s*$/gm),
    fences: count(text, /^```/gm),
    text,
  };
}

/**
 * Build CZ → EN pairs.
 *  - korpus convention: same directory, `<slug>.md` + `<slug>_EN.md`
 *  - dedicated readers: `books/<id>/kapitoly/*.md` + `en/books/<id>/kapitoly/*.md`
 */
function pairs() {
  const out = [];

  for (const file of walk(join(CONTENT, 'korpus'))) {
    if (!file.endsWith('_EN.md')) continue;
    const cz = file.replace(/_EN\.md$/, '.md');
    if (existsSync(cz)) out.push([cz, file]);
  }

  const enBooks = join(CONTENT, 'en', 'books');
  if (existsSync(enBooks)) {
    for (const id of readdirSync(enBooks)) {
      const enDir = join(enBooks, id, 'kapitoly');
      const czDir = join(CONTENT, 'books', id, 'kapitoly');
      if (!existsSync(enDir)) continue;
      for (const f of readdirSync(enDir)) {
        if (!f.endsWith('.md')) continue;
        const cz = join(czDir, f);
        if (existsSync(cz)) out.push([cz, join(enDir, f)]);
      }
    }
  }

  return out.sort((a, b) => a[1].localeCompare(b[1]));
}

const rows = [];
let problems = 0;

for (const [czFile, enFile] of pairs()) {
  const cz = stats(czFile);
  const en = stats(enFile);
  const issues = [];

  const missing = cz.links.filter((l) => !en.links.includes(l));
  const extra = en.links.filter((l) => !cz.links.includes(l));
  if (missing.length) issues.push(`links missing: ${missing.join(', ')}`);
  if (extra.length) issues.push(`links added: ${extra.join(', ')}`);

  if (en.h2 !== cz.h2) issues.push(`h2 ${en.h2} vs ${cz.h2}`);
  if (en.h3 !== cz.h3) issues.push(`h3 ${en.h3} vs ${cz.h3}`);
  if (en.tableRows !== cz.tableRows) issues.push(`table rows ${en.tableRows} vs ${cz.tableRows}`);
  if (en.fences !== cz.fences) issues.push(`code fences ${en.fences} vs ${cz.fences}`);

  const ratio = en.bytes / cz.bytes;
  if (ratio < 0.45) issues.push(`size ratio ${(ratio * 100).toFixed(0)} % (possible stub)`);

  if (issues.length) problems += 1;
  rows.push({
    file: relative(CONTENT, enFile),
    bytesCz: cz.bytes,
    bytesEn: en.bytes,
    ratio: Number(ratio.toFixed(2)),
    issues,
  });
}

if (JSON_OUT) {
  console.log(JSON.stringify({ pairs: rows.length, problems, rows }, null, 2));
  process.exit(problems ? 1 : 0);
}

console.log(`\nZION Archive — CZ ⇄ EN parity: ${rows.length} pairs, ${problems} with drift\n`);

if (VERBOSE || problems) {
  for (const r of rows) {
    if (!r.issues.length) continue;
    console.log(`  ✗ ${r.file}`);
    console.log(`      ${(r.bytesCz / 1024).toFixed(1)} kB → ${(r.bytesEn / 1024).toFixed(1)} kB (${(r.ratio * 100).toFixed(0)} %)`);
    for (const i of r.issues) console.log(`      · ${i}`);
  }
  console.log('');
}

if (!problems) console.log('  ✓ all pairs preserve links, headings, tables and code fences\n');
process.exit(problems ? 1 : 0);
