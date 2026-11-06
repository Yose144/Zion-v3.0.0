#!/usr/bin/env node
/**
 * Test rozkladu položek objednávky na řádky skladu.
 *
 * Proč: `releaseOrderStock` vrací sklad při zrušení objednávky — a vychází
 * z `order.items`, což je JSON z DB, ne typovaný objekt. Když se rozklad
 * pokazí (číselný string, chybějící `externalId`, nula kusů), sklad se vrátí
 * špatně nebo vůbec a nikdo si toho nevšimne, dokud se produkt „nevyprodá“.
 *
 * Testuje se **čistá funkce** `orderStockLines` (bez DB). Samotné přičtení
 * skladu ověřuje produkce end-to-end (test objednávka → bulk cancel → sklad).
 *
 * Použití (z `apps/MarketPlace/`):
 *   node e2e/order-stock.mjs
 */

import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { build } = require('esbuild');

const dir = await mkdtemp(join(tmpdir(), 'zion-stock-'));
const outfile = join(dir, 'order-stock.mjs');
// `order-stock` importuje `@/lib/db` (Prisma) — pro test stačí funkce, ale
// bundle by tahal celý Prisma client. Naštěstí se `prisma` vytváří až při
// volání, takže modul jde naimportovat; přesto ho raději označíme jako
// externí, aby test nepotřeboval DB engine.
await build({
  entryPoints: [resolve(here, '../src/lib/order-stock.ts')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  external: ['@prisma/client'],
  alias: { '@/lib/db': join(here, '_stub-db.mjs') },
  logLevel: 'warning',
});
const { orderStockLines } = await import(pathToFileURL(outfile).href);

const checks = [];
const check = (name, condition) => {
  checks.push({ name, ok: Boolean(condition) });
  if (!condition) console.error(`FAIL ${name}`);
};

check(
  'platné položky',
  JSON.stringify(orderStockLines([
    { externalId: 'lamp-001', quantity: 2 },
    { externalId: 'book-001', quantity: 1 },
  ])) === JSON.stringify([
    { externalId: 'lamp-001', quantity: 2 },
    { externalId: 'book-001', quantity: 1 },
  ]),
);

check('prázdné/null items = žádné řádky', orderStockLines(null).length === 0 && orderStockLines(undefined).length === 0);
check('chybí externalId = vynecháno', orderStockLines([{ quantity: 1 }]).length === 0);
check('nulové množství = vynecháno', orderStockLines([{ externalId: 'a', quantity: 0 }]).length === 0);
check('záporné množství = vynecháno', orderStockLines([{ externalId: 'a', quantity: -3 }]).length === 0);
check('nečíselné množství = vynecháno', orderStockLines([{ externalId: 'a', quantity: 'dva' }]).length === 0);
check(
  'číselný string se přijme',
  orderStockLines([{ externalId: 'a', quantity: '2' }])[0]?.quantity === 2,
);
check('prázdný externalId = vynecháno', orderStockLines([{ externalId: '   ', quantity: 1 }]).length === 0);

await rm(dir, { recursive: true, force: true });
const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ total: checks.length, failed: failed.length, checks }, null, 1));
process.exit(failed.length === 0 ? 0 : 1);
