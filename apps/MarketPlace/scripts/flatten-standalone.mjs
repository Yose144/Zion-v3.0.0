#!/usr/bin/env node
// Zploští standalone výstup Next 16.
//
// Next 16 si bere workspace root z `apps/package-lock.json`, takže se standalone
// strom posune do `.next/standalone/<App>/server.js` místo `.next/standalone/`
// `server.js`. Deploy skript i systemd unit ale počítají s plochým layoutem
// (a `apps/package-lock.json` nemůžeme jen tak smazat — mění root všem appkám).
//
// Skript je idempotentní: když je layout už plochý, nic nedělá.
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

const standalone = join(process.cwd(), '.next', 'standalone');
const appName = basename(process.cwd());
const nested = join(standalone, appName);

if (!existsSync(standalone)) {
  console.error('[flatten-standalone] .next/standalone neexistuje — přeskočeno');
  process.exit(0);
}

if (!existsSync(nested) || !existsSync(join(nested, 'server.js'))) {
  console.log('[flatten-standalone] standalone je už plochý — nic k práci');
  process.exit(0);
}

// Artefakty, které Next natrasoval z workspace rootu `apps/` a které do
// plochého layoutu nepatří (drobnosti ze stubu `apps/package.json`).
for (const stray of ['.next', 'public', 'node_modules']) {
  rmSync(join(standalone, stray), { recursive: true, force: true });
}

for (const entry of readdirSync(nested)) {
  renameSync(join(nested, entry), join(standalone, entry));
}
rmSync(nested, { recursive: true, force: true });

console.log(`[flatten-standalone] ${appName}/ → .next/standalone/ (plochý layout)`);
