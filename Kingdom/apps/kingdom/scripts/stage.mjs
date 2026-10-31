#!/usr/bin/env node
/**
 * Příprava standalone stromu k nasazení.
 *
 * `output: standalone` v monorepu zanoří appku do `.next/standalone/apps/kingdom/`
 * a statiku je potřeba stageovat **vedle server.js**, ne do rootu standalone.
 * Přesně na tomhle spadl deploy 2026-10-30 v `apps/MarketPlace`.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

export function stageStandalone(appDir = APP_DIR) {
  const standaloneRoot = join(appDir, '.next', 'standalone');
  const appOut = join(standaloneRoot, 'apps', 'kingdom');

  if (!existsSync(join(appOut, 'server.js'))) {
    throw new Error('chybí .next/standalone/apps/kingdom/server.js — spusť `npm run build`');
  }

  const stage = (from, to, label) => {
    if (!existsSync(from)) return false;
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
    console.log(`staged ${label}`);
    return true;
  };

  stage(join(appDir, '.next', 'static'), join(appOut, '.next', 'static'), '.next/static');
  stage(join(appDir, 'public'), join(appOut, 'public'), 'public');

  return appOut;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  stageStandalone();
}
