#!/usr/bin/env node
/**
 * Pokladna bez databáze: opakované orderId a rezervace posledního kusu.
 *
 * Cizí e-mail nesmí v odpovědi dostat jméno, adresu, peněženku ani podpis.
 * Dva souběžné nároky na jeden kus: druhý updateMany neprojde a sklad
 * nesmí spadnout pod nulu.
 *
 *   node e2e/order-guard.mjs
 */

import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { build } = require('esbuild');

const dir = await mkdtemp(join(tmpdir(), 'zion-order-guard-'));
const outfile = join(dir, 'shop-order-guard.mjs');
await build({
  entryPoints: [resolve(here, '../src/lib/shop-order-guard.ts')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'warning',
});
const {
  aggregateOrderQuantities,
  duplicateOrderDecision,
  emailsMatch,
  reserveProductStock,
  StockConflictError,
} = await import(pathToFileURL(outfile).href);

const checks = [];
const check = (name, condition) => {
  checks.push({ name, ok: Boolean(condition) });
  if (!condition) console.error(`FAIL ${name}`);
};

const BANK = { account: '1/0100', iban: 'CZ00', bic: 'TEST' };
const stored = {
  orderId: 'ORD-2026110701',
  status: 'pending',
  paymentStatus: 'pending',
  totalCzk: 590,
  payment: 'transfer',
  customerEmail: 'Buyer@Shop.test',
  customerName: 'Tajný Kupující',
  customerPhone: '+420777111222',
  addressStreet: 'Skrytá 12',
  customerWalletAddress: 'zion1secretwallet',
  customerWalletSeed: 'seed words must not leak',
  fireConsentName: 'Podpis Ohně',
};

const match = duplicateOrderDecision(stored, '  buyer@shop.test ', BANK);
const matchJson = JSON.stringify(match.body);
check('shoda e-mailu vrací 200', match.status === 200 && match.body.success === true);
check('shoda nese jen veřejný stav', match.body.data.order.orderId === 'ORD-2026110701'
  && match.body.data.order.totalCzk === 590
  && match.body.data.order.payment === 'transfer'
  && match.body.data.bank.amount === 590
  && match.body.data.bank.vs === '2026110701');
check('shoda nevrací jméno, telefon, adresu, peněženku ani podpis',
  !matchJson.includes('Tajný')
  && !matchJson.includes('+420777')
  && !matchJson.includes('Skrytá')
  && !matchJson.includes('zion1secret')
  && !matchJson.includes('seed words')
  && !matchJson.includes('Podpis')
  && !matchJson.includes('Buyer@')
  && !matchJson.includes('buyer@'));

const foreign = duplicateOrderDecision(stored, 'other@shop.test', BANK);
const foreignJson = JSON.stringify(foreign.body);
check('cizí e-mail je 409', foreign.status === 409 && foreign.body.duplicate === true && foreign.body.success === false);
check('cizí odpověď nemá pole zákazníka',
  foreign.body.data == null
  && !foreignJson.includes('Tajný')
  && !foreignJson.includes('Skrytá')
  && !foreignJson.includes('zion1secret')
  && !foreignJson.includes('seed words')
  && !foreignJson.includes('Podpis')
  && !foreignJson.includes('Buyer@')
  && !foreignJson.includes('buyer@')
  && !foreignJson.includes('590'));

check('e-mail se porovnává bez velikosti písmen a mezer', emailsMatch('A@B.cz', ' a@b.cz '));
check('jiný e-mail nesedí', !emailsMatch('a@b.cz', 'b@b.cz'));

const totals = aggregateOrderQuantities([
  { externalId: 'lamp-001', quantity: 1 },
  { externalId: 'book-001', quantity: 2 },
  { externalId: 'lamp-001', quantity: 1 },
]);
check('dva řádky lampionu jsou dva kusy', totals.get('lamp-001') === 2 && totals.get('book-001') === 2);

function memoryStore(rows) {
  const products = new Map(rows.map((row) => [row.externalId, { ...row }]));
  return {
    products,
    tx: {
      shopProduct: {
        async updateMany({ where, data }) {
          const ids = typeof where.externalId === 'string'
            ? [where.externalId]
            : where.externalId.in;
          let count = 0;
          for (const id of ids) {
            const row = products.get(id);
            if (!row) continue;
            if (where.stock.gte != null && row.stock < where.stock.gte) continue;
            if (where.stock.lte != null && row.stock > where.stock.lte) continue;
            if (data.stock?.decrement != null) row.stock -= data.stock.decrement;
            if (data.inStock === false) row.inStock = false;
            count += 1;
          }
          return { count };
        },
      },
    },
  };
}

const last = memoryStore([{ externalId: 'lamp-001', stock: 1, inStock: true }]);
await reserveProductStock(last.tx, [['lamp-001', 1]]);
check('poslední kus se odečte a označí jako vyprodaný',
  last.products.get('lamp-001').stock === 0 && last.products.get('lamp-001').inStock === false);
let secondRejected = false;
try {
  await reserveProductStock(last.tx, [['lamp-001', 1]]);
} catch (err) {
  secondRejected = err instanceof StockConflictError && err.externalId === 'lamp-001';
}
check('druhý nárok na poslední kus spadne', secondRejected);
check('neúspěšný nárok sklad neposune pod nulu', last.products.get('lamp-001').stock === 0);

const short = memoryStore([{ externalId: 'lamp-001', stock: 1, inStock: true }]);
let summedRejected = false;
try {
  await reserveProductStock(short.tx, aggregateOrderQuantities([
    { externalId: 'lamp-001', quantity: 1 },
    { externalId: 'lamp-001', quantity: 1 },
  ]));
} catch (err) {
  summedRejected = err instanceof StockConflictError;
}
check('dva řádky po jednom kusu neprojdou proti skladu 1', summedRejected);
check('odmítnutý součet sklad nezmění', short.products.get('lamp-001').stock === 1);

const plenty = memoryStore([{ externalId: 'book-001', stock: 4, inStock: true }]);
await reserveProductStock(plenty.tx, [['book-001', 1]]);
check('zbývající sklad zůstane v prodeji',
  plenty.products.get('book-001').stock === 3 && plenty.products.get('book-001').inStock === true);

await rm(dir, { recursive: true, force: true });
const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ total: checks.length, failed: failed.length, checks }, null, 1));
process.exit(failed.length === 0 ? 0 : 1);
