#!/usr/bin/env node
/*
 * Merge scripts/i18n-additions.json into public/i18n/<lang>.json.
 *
 * public/i18n/ is the source of truth for translations (it started life as the
 * inline dictionaries of the old intro-tabs.js and was split out so the page
 * only downloads the language in use). Czech is authored inline in
 * maintenance.html; cs.json is a reference copy.
 *
 *   node scripts/i18n-apply-additions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'public/i18n');
const additions = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/i18n-additions.json'), 'utf8')
);

const sorted = (obj) =>
  Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));

let touched = 0;
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const lang = file.replace(/\.json$/, '');
  const file_path = path.join(DIR, file);
  const current = JSON.parse(fs.readFileSync(file_path, 'utf8'));
  const merged = sorted({ ...current, ...(additions[lang] || {}) });
  const next = JSON.stringify(merged, null, 2) + '\n';
  if (next !== fs.readFileSync(file_path, 'utf8')) {
    fs.writeFileSync(file_path, next);
    touched++;
  }
  console.log(`${lang}: ${Object.keys(merged).length} keys`);
}
console.log(`updated ${touched} file(s)`);
