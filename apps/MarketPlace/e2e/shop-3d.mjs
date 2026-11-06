#!/usr/bin/env node
/**
 * MARKETPLACE — 3D náhled produktu (stejný model jako ve hře).
 *
 * Ověřuje **funkci, ne vzhled**: že se v modalu produktu opravdu stáhne
 * herní GLB (`/shop/models3d/<loď>.glb`), že se vykreslí plátno a že se
 * neobjeví chybová hláška. Model se dá vykreslit i prázdný — proto se
 * kontroluje i resource timing, ne jen existence `<canvas>`.
 *
 * Proč samostatný skript: marketplace je jiná appka než Nirvana a její
 * produkty dřív ukazovaly holé STL (CAD šedá). Kdyby se modely rozešly,
 * zákazník by viděl jinou loď, než dostane ve hře.
 *
 * Spuštění (standalone server v `apps/MarketPlace`):
 *   PORT=3105 node .next/standalone/server.js &
 *   node apps/MarketPlace/e2e/shop-3d.mjs
 *
 * Pozn.: port si vyber jiný než 3100/3101 — **dva next-servery umí sdílet
 * stejný port** (SO_REUSEPORT) a ten starší pak servíruje starý build,
 * takže se objeví „nemožné" 404 na soubory, které na disku jsou.
 */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launch } from '../../nirvana/e2e/_browser.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const BASE = process.env.MARKET_URL ?? 'http://127.0.0.1:3105';
const SHOTS = resolve(repo, '.artifacts/render/marketplace');

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

async function waitFor(fn, timeout = 20000, label = 'stav') {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await fn();
    if (value) return value;
    await sleep(150);
  }
  throw new Error(`timeout: ${label}`);
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  if (!process.env.ZION_GPU) process.env.ZION_GPU = 'metal';

  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  console.log('\n▸ katalog stíhaček');
  await page.goto(`${BASE}/shop?category=starfighters`, { waitUntil: 'networkidle' });
  const cards = await waitFor(
    () => page.evaluate(() => document.querySelectorAll('.zion-rainbow-sub[role="button"]').length),
    25000,
    'karty produktů',
  );
  check('katalog má produkty', cards >= 7, `cards=${cards}`);
  await page.screenshot({ path: `${SHOTS}/shop-catalog.png` });

  console.log('\n▸ detail produktu s 3D náhledem');
  // Pozor: první karta v kategorii je Millennium Falcon, který **lokální model
  // nemá** (odkaz na Thingiverse) — ukazuje proto fotografii. Kliká se proto
  // na loď, která model má; jinak test měří produkt, který 3D vůbec nemá.
  const opened = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.zion-rainbow-sub[role="button"]'));
    const target = cards.find((card) => /X-Wing/i.test(card.textContent ?? ''));
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return Boolean(target);
  });
  check('v katalogu je X-Wing s modelem', opened);
  await waitFor(() => page.evaluate(() => Boolean(document.querySelector('[role="dialog"]'))), 15000, 'modal');
  await waitFor(
    () => page.evaluate(() => Boolean(document.querySelector('[role="dialog"] canvas'))),
    25000,
    '3D plátno v modalu',
  );
  check('modal otevřel 3D náhled', true);

  // Pozor: prázdné pole je v JS truthy, takže `waitFor` by ho vrátil hned
  // a test by hlásil chybu dřív, než request vůbec vznikne. Predikát musí
  // vracet `null`, dokud seznam není neprázdný.
  const loaded = await waitFor(
    () =>
      page
        .evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((name) => name.includes('/shop/models3d/')),
        )
        .then((list) => (list.length > 0 ? list : null)),
    25000,
    'stažení GLB',
  );
  check('stáhl se herní GLB model', loaded.length > 0, loaded.join(', '));
  check('cesta míří do /shop/models3d/', loaded[0]?.includes('/shop/models3d/'), loaded[0]);

  const state = await page.evaluate(() => ({
    failed: document.body.textContent?.includes('3D náhled se nepodařilo načíst') ?? false,
    hint: document.body.textContent?.includes('táhni pro otočení') ?? false,
  }));
  check('model se nenačetl jako chyba', state.failed === false);
  check('náhled má nápovědu k otáčení', state.hint === true);

  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/shop-3d.png` });

  const ignored = (line) => line.includes('401') || line.includes('prisma') || line.includes('DATABASE');
  check('v konzoli nejsou chyby', errors.filter((line) => !ignored(line)).length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n▸ Millennium Falcon (od 2026-11-06 má lokální model)');
  await page.evaluate(() => document.querySelector('[role="dialog"] button[aria-label]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await sleep(400);
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.zion-rainbow-sub[role="button"]'));
    cards.find((card) => /Falcon/i.test(card.textContent ?? ''))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await waitFor(() => page.evaluate(() => Boolean(document.querySelector('[role="dialog"]'))), 15000, 'modal Falcona');
  // GLB se načítá asynchronně — canvas existuje dřív než model. Čeká se na
  // resource entry, ne na to, že „tam něco je" (jinak test hlásí chybu, která
  // není: soubor se stáhne o pár set ms později).
  const falconGlb = await waitFor(
    () =>
      page
        .evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((name) => name.includes('/shop/models3d/falcon.glb')),
        )
        .then((list) => (list.length > 0 ? list : null)),
    20000,
    'falcon.glb',
  );
  const falcon = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector('[role="dialog"] canvas')),
    image: Boolean(document.querySelector('[role="dialog"] img')),
  }));
  // Dřív tu byl opak (Falcon model neměl a ukazoval fotografii). Když se model
  // přidá, test musí tvrdit novou pravdu — jinak hlídá minulost.
  check('Falcon má 3D náhled', falcon.canvas === true && falcon.image === false, JSON.stringify(falcon));
  check('a stáhl se falcon.glb', falconGlb.length > 0, JSON.stringify(falconGlb));

  await browser.close();
  console.log(`\n${failed === 0 ? '✓' : '✗'} shop-3d: ${passed} prošlo, ${failed} selhalo\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
