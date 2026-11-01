#!/usr/bin/env node
/**
 * Příprava standalone stromu k nasazení.
 *
 * `output: standalone` v monorepu zanoří appku podle workspace rootu a statiku
 * je potřeba stageovat **vedle server.js**, ne do rootu standalone. Přesně na
 * tomhle spadl deploy 2026-10-30 v `apps/MarketPlace`.
 *
 * Hloubka zanoření se mění: `.next/standalone/apps/kingdom/` (dokud měl Kingdom
 * vlastní lockfile) vs `.next/standalone/Kingdom/apps/kingdom/` (od chvíle, co
 * je lockfile v rootu repa). Proto se server.js **hledá**, nekonstruuje.
 */
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Najdi adresář se server.js v standalone stromu (libovolná hloubka). */
function findServerDir(dir, depth = 0) {
  if (depth > 5 || !existsSync(dir)) return null;
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && e.name === 'server.js')) return dir;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    const hit = findServerDir(join(dir, entry.name), depth + 1);
    if (hit) return hit;
  }
  return null;
}

export function stageStandalone(appDir = APP_DIR) {
  const standaloneRoot = join(appDir, '.next', 'standalone');
  const appOut = findServerDir(standaloneRoot);

  if (!appOut) {
    throw new Error(
      `chybí server.js kdekoli pod ${standaloneRoot} — spusť \`npm run build\``,
    );
  }
  console.log(`standalone: ${appOut.slice(standaloneRoot.length + 1)}/`);

  const stage = (from, to, label) => {
    if (!existsSync(from)) return false;
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
    console.log(`staged ${label}`);
    return true;
  };

  stage(join(appDir, '.next', 'static'), join(appOut, '.next', 'static'), '.next/static');
  stage(join(appDir, 'public'), join(appOut, 'public'), 'public');

  /*
   * Unit má `WorkingDirectory=…/current/apps/kingdom` a `node server.js`, takže
   * artefakt musí být **plochý**: app dir + sdílený node_modules vedle sebe.
   * Sdílený node_modules leží o úroveň výš (od root lockfilu v repu), a mazat
   * ho by znamenalo artefakt bez `next` — přesně to jednou rozbilo market.
   */
  /*
   * Unikátní jméno stage adresáře: dvě souběžné session (nebo build + deploy)
   * by si jinak mazaly stejný `.next/standalone-flat` a rsync padal na
   * „file has vanished" (kód 24). Cestu vypisujeme na poslední řádek pro
   * deploy skript.
   */
  const flat = join(appDir, '.next', `standalone-flat-${process.pid}`);
  rmSync(flat, { recursive: true, force: true });
  cpSync(appOut, flat, { recursive: true });

  /*
   * `node_modules` není jen v rootu standalone stromu — Next ho trasuje po
   * úrovních (`standalone/node_modules` = jen `dist`, plný `next` je výš, např.
   * `standalone/Kingdom/node_modules`). Slijeme je od nejhlubšího k rootu;
   * hlubší vyhrává (force: false = nepřepisuj existující).
   */
  const levels = [];
  for (let dir = appOut; dir.startsWith(standaloneRoot) && dir !== standaloneRoot; dir = dirname(dir)) {
    levels.push(dir);
  }
  levels.push(standaloneRoot);
  let merged = 0;
  for (const level of levels) {
    const nm = join(level, 'node_modules');
    if (!existsSync(nm)) continue;
    cpSync(nm, join(flat, 'node_modules'), { recursive: true, force: false, errorOnExist: false });
    merged += 1;
  }
  console.log(`node_modules: slit z ${merged} úrovní`);
  if (!existsSync(join(flat, 'node_modules', 'next'))) {
    throw new Error('ve stage chybí node_modules/next — artefakt by nenaběhl');
  }
  console.log(`flat: .next/${basename(flat)}/ (${existsSync(join(flat, 'server.js')) ? 'server.js ok' : 'CHYBÍ server.js'})`);

  return flat;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flat = stageStandalone();
  // Poslední řádek = cesta k artefaktu (deploy skript ji čte).
  console.log(flat);
}
