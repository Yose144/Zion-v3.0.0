#!/usr/bin/env node
// Zploští standalone výstup Next 16.
//
// Next 16 bere workspace root z nejbližšího lockfile. Dokud měla každá appka
// svůj (`apps/package-lock.json`), zanořil se strom do `.next/standalone/<App>/`.
// Po K1.2 (jeden root lockfile) se zanořuje podle cesty ve workspace, tedy
// `.next/standalone/apps/MarketPlace/server.js`.
//
// Deploy skript i systemd unit počítají s plochým layoutem, proto tenhle skript
// najde server.js v libovolné hloubce a přesune jeho obsah do `.next/standalone/`.
// Je idempotentní: když je layout už plochý, nic nedělá.
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
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

/** Najdi server.js v hloubce (apps/MarketPlace/server.js apod.). */
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
    if (!entry.isDirectory()) continue;
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

// Artefakty, které Next natrasoval z workspace rootu a do plochého layoutu
// nepatří (obsahují jen cesty repa, ne runtime appky).
for (const stray of ['apps', '.next', 'public', 'node_modules']) {
  const path = join(standalone, stray);
  if (path !== nested && !nested.startsWith(path + '/')) {
    rmSync(path, { recursive: true, force: true });
  }
}

for (const entry of readdirSync(nested)) {
  renameSync(join(nested, entry), join(standalone, entry));
}
rmSync(nested, { recursive: true, force: true });
// Prázdné rodiče po přesunu (např. `apps/`).
for (const stray of ['apps']) {
  rmSync(join(standalone, stray), { recursive: true, force: true });
}

console.log(
  `[flatten-standalone] ${relative(standalone, nested)}/ → .next/standalone/ (plochý layout)`,
);
