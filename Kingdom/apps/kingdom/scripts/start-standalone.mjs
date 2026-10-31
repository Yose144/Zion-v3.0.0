#!/usr/bin/env node
/**
 * Start standalone serveru bez `next start`.
 *
 * `output: standalone` v monorepu zanoří appku do `.next/standalone/apps/kingdom/`
 * a **statiku je potřeba stageovat vedle server.js**, ne do rootu standalone.
 * Přesně na tomhle spadl deploy 2026-10-30 v `apps/MarketPlace` — odtud ten skript.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const standaloneRoot = join(appDir, '.next', 'standalone');
const appOut = join(standaloneRoot, 'apps', 'kingdom');

if (!existsSync(join(appOut, 'server.js'))) {
  console.error('chybí .next/standalone — spusť nejdřív `npm run build`');
  process.exit(1);
}

function stage(from, to, label) {
  if (!existsSync(from)) return;
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`staged ${label}`);
}

stage(join(appDir, '.next', 'static'), join(appOut, '.next', 'static'), '.next/static');
stage(join(appDir, 'public'), join(appOut, 'public'), 'public');

const port = process.env.PORT ?? '3020';
console.log(`start → http://127.0.0.1:${port}`);

const child = spawn(process.execPath, [join(appOut, 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port, HOSTNAME: process.env.HOSTNAME ?? '127.0.0.1' },
});

child.on('exit', (code) => process.exit(code ?? 0));
