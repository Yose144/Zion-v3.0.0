#!/usr/bin/env node
/**
 * Boundary check — vynucuje pravidla, která drží Kingdom v jednom kuse.
 * Běží v ms, bez závislostí. Když něco porušíš, build ti to nedovolí.
 *
 *  1. portál nesmí volat fetch/XHR/axios — jen přes manifest.reads → @zion/api
 *  2. portál nesmí mít vlastní překlady
 *  3. packages/world nesmí importovat React/Three/DOM
 *  4. apps/kingdom nesmí importovat relativní cestou ven z appky
 *  5. portál musí mít manifest.ts i Portal.tsx
 *  6. v Kingdomu nesmí být commitnutý .tgz
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const violations = [];
const rel = (path) => relative(root, path);

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const sources = walk(root).filter((path) => SOURCE_EXT.has(extname(path)));

/* ---------- 1 + 2: portály ---------- */

const portalsDir = join(root, 'apps', 'kingdom', 'src', 'portals');
const NETWORK = /\b(fetch|XMLHttpRequest|axios)\s*\(|\bnew\s+XMLHttpRequest\b/;

for (const path of sources) {
  if (!path.startsWith(portalsDir)) continue;
  const body = read(path);

  if (NETWORK.test(body)) {
    violations.push(`${rel(path)}: portál nesmí volat síť přímo — deklaruj reads[] a použij api.read()`);
  }
  if (/\/(i18n|translations|locales?)[/.]/.test(path) || /translations\.(ts|tsx)$/.test(path)) {
    violations.push(`${rel(path)}: vlastní překlady v portálu — použij @zion/i18n`);
  }
  if (body.includes('window.localStorage') && !path.endsWith('Portal.tsx')) {
    violations.push(`${rel(path)}: localStorage v portálu — stav drží Místnost`);
  }
}

/* ---------- 3: doména světa ---------- */

const worldDir = join(root, 'packages', 'world');
const WORLD_FORBIDDEN = [
  [/from\s+['"]react['"]/, 'react'],
  [/from\s+['"]three['"]/, 'three'],
  [/from\s+['"]@react-three\//, '@react-three'],
  [/from\s+['"]next\//, 'next'],
  [/\bwindow\./, 'window'],
  [/\bdocument\./, 'document'],
  [/\bMath\.random\(/, 'Math.random'],
  [/\bDate\.now\(/, 'Date.now'],
  [/\bperformance\.now\(/, 'performance.now'],
];

for (const path of sources) {
  if (!path.startsWith(worldDir)) continue;
  const body = read(path);
  for (const [pattern, name] of WORLD_FORBIDDEN) {
    if (pattern.test(body)) {
      violations.push(`${rel(path)}: doména světa nesmí používat ${name} — patří do @zion/scenes`);
    }
  }
}

/* ---------- 4 + 6: appka ---------- */

const appDir = join(root, 'apps', 'kingdom');

for (const path of sources) {
  if (!path.startsWith(appDir)) continue;
  const body = read(path);
  if (/from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\//.test(body)) {
    violations.push(`${rel(path)}: import relativní cestou ven z appky — použij @zion/* balíček`);
  }
}

for (const path of walk(root)) {
  if (path.endsWith('.tgz')) {
    violations.push(`${rel(path)}: commitnutý .tgz — použij workspace závislost`);
  }
}

/* ---------- 5: manifest + Portal ---------- */

if (existsSync(portalsDir)) {
  const stack = [portalsDir];
  while (stack.length) {
    const dir = stack.pop();
    const hasManifest = existsSync(join(dir, 'manifest.ts'));
    if (hasManifest) {
      if (!existsSync(join(dir, 'Portal.tsx'))) {
        violations.push(`${rel(dir)}: manifest.ts bez Portal.tsx`);
      }
      continue;
    }
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) stack.push(full);
    }
  }
}

/* ---------- report ---------- */

if (violations.length === 0) {
  console.log(`check: ${sources.length} souborů, 0 porušení`);
  process.exit(0);
}

console.error(`check: ${violations.length} porušení hranic\n`);
for (const violation of violations) console.error(`  ✗ ${violation}`);
process.exit(1);
