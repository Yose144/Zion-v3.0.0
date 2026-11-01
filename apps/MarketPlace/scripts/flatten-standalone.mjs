#!/usr/bin/env node
// Zploští standalone výstup Next 16.
//
// Next bere workspace root z nejbližšího lockfile. Od K1.2 (jeden root lockfile)
// je strom zanořený podle cesty ve workspace: `.next/standalone/apps/<App>/server.js`
// a **sdílený `node_modules` leží o úroveň výš** (`.next/standalone/node_modules`).
//
// Deploy skript i systemd unit počítají s plochým layoutem (`WorkingDirectory`
// + `node server.js`), proto tenhle skript obsah appky překopíruje do
// `.next/standalone/` a zanořený adresář uklidí.
//
// ⚠️ Sdílený `node_modules` v rootu standalone stromu se NESMÍ mazat — je to
// runtime appky (`next`, `react`, …). Přesně tahle chyba artefakt jednou
// rozbila (verifikátor `scripts/ops/check-next-deploys.sh` to odhalil).
//
// Idempotentní: když je layout už plochý, nic nedělá.
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';

const standalone = join(process.cwd(), '.next', 'standalone');

if (!existsSync(standalone)) {
  console.error('[flatten-standalone] .next/standalone neexistuje — přeskočeno');
  process.exit(0);
}

if (existsSync(join(standalone, 'server.js'))) {
  console.log('[flatten-standalone] standalone je už plochý — nic k práci');
  process.exit(0);
}

/** Najdi server.js v hloubce (apps/<App>/server.js apod.). */
function findServerDir(dir, depth = 0) {
  if (depth > 4) return null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  if (entries.some((e) => e.isFile() && e.name === 'server.js')) return dir;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    const hit = findServerDir(join(dir, entry.name), depth + 1);
    if (hit) return hit;
  }
  return null;
}

const nested = findServerDir(standalone);
if (!nested) {
  console.error('[flatten-standalone] server.js nenalezen — build je rozbitý, nic neměním');
  process.exit(1);
}

// Zkopíruj obsah appky nahoru (přepiš stejná jména, nic nemaž).
cpSync(nested, standalone, { recursive: true, force: true });

// Uklidit zanořený adresář a jeho rodiče, pokud zůstaly prázdné.
rmSync(nested, { recursive: true, force: true });
const parent = join(nested, '..');
if (parent !== standalone && existsSync(parent) && readdirSync(parent).length === 0) {
  rmSync(parent, { recursive: true, force: true });
}

console.log(
  `[flatten-standalone] ${relative(standalone, nested)}/ → .next/standalone/ (plochý layout)`,
);
