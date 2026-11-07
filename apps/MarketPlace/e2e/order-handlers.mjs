#!/usr/bin/env node
/**
 * Actual POST/GET handlers with real NextRequest/NextResponse, QR, pricing,
 * consent and stock guards. All service boundaries are fail-closed mocks:
 * no DB, real wallets, emails, payment module, env files or network access.
 * Serialized snapshot transactions test handler rollback, NOT PostgreSQL MVCC.
 * Run: node apps/MarketPlace/e2e/order-handlers.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const { NextRequest } = require('next/server');
const here = dirname(fileURLToPath(import.meta.url));
const slot = Symbol.for('zion.order-handler.fixture');
const clone = (value) => structuredClone(value);
const product = (externalId = 'book-001', stock = 5) => ({
  externalId, name: 'Fixture product', stock, inStock: true, active: true,
  priceCzk: 108, tokens: 10, digital: true,
});
const input = (orderId = 'FIXTURE-1234567890') => ({
  orderId, customer: { name: 'PRIVATE-NAME', email: 'buyer@example.invalid', phone: 'PRIVATE-PHONE',
    address: { street: 'PRIVATE-STREET', city: 'PRIVATE-CITY', zip: 'PRIVATE-ZIP' } },
  termsAccepted: true, shipping: { method: 'virtualni-nakup' }, payment: 'transfer',
  items: [{ externalId: 'book-001', quantity: 1 }], note: 'PRIVATE-NOTE',
});
const storedOrder = (over = {}) => ({
  id: 'fixture-db-id', orderId: 'FIXTURE-1234567890', status: 'pending', paymentStatus: 'unpaid',
  totalCzk: 108, shippingCzk: 0, createdAt: new Date('2026-11-07T00:00:00Z'),
  customerName: 'PRIVATE-NAME', customerEmail: 'buyer@example.invalid', customerPhone: 'PRIVATE-PHONE',
  addressStreet: 'PRIVATE-STREET', addressCity: 'PRIVATE-CITY', addressZip: 'PRIVATE-ZIP',
  payment: 'transfer', items: [], customerWalletSeed: 'PRIVATE-SEED',
  customerWalletSecretKey: 'PRIVATE-KEY', customerWalletPublicKey: 'PRIVATE-PUBLIC-KEY',
  customerWalletAddress: 'PRIVATE-WALLET', fireConsentName: 'PRIVATE-SIGNATURE',
  companyName: 'PRIVATE-COMPANY', note: 'PRIVATE-NOTE', trackingNumber: 'PRIVATE-TRACKING',
  archivePass: { code: 'PRIVATE-PASS' }, invoices: [{ html: 'PRIVATE-INVOICE-HTML' }], ...over,
});

class FixturePrismaError extends Error {
  constructor(code) { super('synthetic database error'); this.code = code; }
}
let state;
let transactionTail = Promise.resolve();
function reset({ products = [product()], orders = [] } = {}) {
  state = {
    products: new Map(products.map((p) => [p.externalId, clone(p)])),
    orders: new Map(orders.map((o) => [o.orderId, clone(o)])), expectations: new Map(), campaigns: [],
    effects: { wallet: 0, invoice: 0, adminEmail: 0, customerEmail: 0, walletEmail: 0, expectationWrite: 0 },
    transactions: 0, reservations: [], selects: [], allow: true,
  };
  transactionTail = Promise.resolve();
}
function barrier(count) {
  let release;
  const ready = new Promise((done) => { release = done; });
  return async () => { if (--count === 0) release(); await ready; };
}
const prisma = {
  shopOrder: { async findUnique(args) {
    state.selects.push(clone(args));
    if (state.lookupError) throw new Error('synthetic lookup failure');
    // Deliberately return the entire row, even for a select: response DTOs must
    // still not leak private data if a future caller broadens the DB query.
    const found = clone(state.orders.get(args.where.orderId) ?? null);
    if (state.lookupBarrier) await state.lookupBarrier();
    return found;
  } },
  shopProduct: { async findMany({ where }) {
    const found = clone([...state.products.values()].filter((p) => p.active && where.externalId.in.includes(p.externalId)));
    if (state.pricingBarrier) await state.pricingBarrier();
    return found;
  } },
  shopSetting: { async findMany() { return clone(state.campaigns); } },
  async $transaction(run) {
    const previous = transactionTail;
    let release;
    transactionTail = new Promise((done) => { release = done; });
    await previous;
    state.transactions++;
    if (state.beforeTransaction) {
      const change = state.beforeTransaction;
      state.beforeTransaction = null;
      change();
    }
    const before = clone({ products: state.products, orders: state.orders });
    try {
      return await run({
        shopOrder: { async create({ data }) {
          if (state.createError) throw state.createError;
          if (state.orders.has(data.orderId)) throw new FixturePrismaError('P2002');
          const row = storedOrder({ ...data, id: `fixture-${state.orders.size}`, createdAt: new Date() });
          state.orders.set(row.orderId, clone(row));
          return clone(row);
        } },
        shopProduct: { async updateMany({ where, data }) {
          if (data.stock?.decrement) {
            assert.equal(where.active, true);
            assert.equal(where.inStock, true);
            assert.equal(where.stock.gte, data.stock.decrement);
            state.reservations.push(where.externalId);
          }
          let count = 0;
          for (const row of state.products.values()) {
            const ids = typeof where.externalId === 'string' ? [where.externalId] : where.externalId.in;
            if (!ids.includes(row.externalId) || (where.active && !row.active) || (where.inStock && !row.inStock)
                || (where.stock.gte != null && row.stock < where.stock.gte)
                || (where.stock.lte != null && row.stock > where.stock.lte)) continue;
            if (data.stock) row.stock -= data.stock.decrement;
            if (data.inStock != null) row.inStock = data.inStock;
            count++;
          }
          return { count };
        } },
      });
    } catch (error) {
      state.products = before.products;
      state.orders = before.orders;
      throw error;
    } finally { release(); }
  },
};
const boundary = {
  prisma, Prisma: { JsonNull: null, PrismaClientKnownRequestError: FixturePrismaError },
  rateLimit: () => ({ ok: state.allow, retryAfterSec: 60 }), clientIp: () => 'fixture',
  generateCustomerWallet: () => {
    state.effects.wallet++;
    return { address: 'PRIVATE-WALLET', mnemonic: 'PRIVATE-SEED', secretKey: 'PRIVATE-KEY', publicKey: 'PRIVATE-PUBLIC-KEY' };
  },
  encryptSecret: (value) => `encrypted:${value}`,
  createInvoiceForOrder: async () => { state.effects.invoice++; return { invoice: { html: 'PRIVATE-INVOICE-HTML' }, html: 'PRIVATE-INVOICE-HTML' }; },
  sendAdminOrderNotification: async () => { state.effects.adminEmail++; },
  sendCustomerOrderConfirmation: async () => { state.effects.customerEmail++; },
  sendCustomerWalletEmail: async () => { state.effects.walletEmail++; },
  SHOP_VAULT: 'fixture-current-vault', shopPayMemo: (id) => `SHOPPAY:${id}`,
  storeExpectation: async (id, total) => {
    state.effects.expectationWrite++;
    const exp = { expectedFlowers: String(total * 10_000_000), amountZion: total * 10, vault: 'fixture-persisted-vault' };
    state.expectations.set(id, exp);
    return exp;
  },
  loadExpectation: async (id) => clone(state.expectations.get(id) ?? null),
};
globalThis[slot] = boundary;
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Network forbidden in order-handler fixtures'); };
const dir = await mkdtemp(join(tmpdir(), 'zion-order-handlers-'));
try {
  const mocks = {
    db: ['prisma'], email: ['sendAdminOrderNotification', 'sendCustomerOrderConfirmation', 'sendCustomerWalletEmail'],
    invoice: ['createInvoiceForOrder'], 'zion-l1': ['generateCustomerWallet'], crypto: ['encryptSecret'],
    'rate-limit': ['rateLimit', 'clientIp'],
    'shop-zionpay': ['SHOP_VAULT', 'shopPayMemo', 'storeExpectation', 'loadExpectation'],
    prisma: ['Prisma'],
  };
  const real = new Set(['shop-order-guard', 'fire-safety', 'shop-campaign', 'email-lang']);
  const outfile = join(dir, 'handlers.cjs');
  await build({
    stdin: { contents: `export { POST } from ${JSON.stringify(resolve(here, '../src/app/api/shop/orders/route.ts'))};
      export { GET } from ${JSON.stringify(resolve(here, '../src/app/api/shop/orders/[orderId]/route.ts'))};
      export { FIRE_CONSENT_VERSION } from ${JSON.stringify(resolve(here, '../src/lib/fire-safety.ts'))};`,
    resolveDir: here, loader: 'ts' },
    outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'warning',
    tsconfig: resolve(here, '../tsconfig.json'),
    plugins: [{ name: 'service-boundaries-only', setup(b) {
      b.onResolve({ filter: /^(@\/lib\/|@prisma\/client$|\.\/db$)/ }, ({ path }) => {
        const name = path === '@prisma/client' ? 'prisma' : path === './db' ? 'db' : path.slice('@/lib/'.length);
        if (mocks[name]) return { path: name, namespace: 'boundary' };
        if (real.has(name)) return { path: resolve(here, `../src/lib/${name}.ts`) };
        throw new Error(`Unmocked service import: ${path}`);
      });
      b.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({ contents:
        `const ctx = globalThis[Symbol.for('zion.order-handler.fixture')];\n` +
        mocks[path].map((key) => `export const ${key} = ctx.${key};`).join('\n'), loader: 'js' }));
      b.onResolve({ filter: /^(next\/server|qrcode)$/ }, ({ path }) => ({ path: require.resolve(path), external: true }));
    } }],
  });
  const { POST, GET, FIRE_CONSENT_VERSION } = require(outfile);
  async function post(body, raw = false) {
    const response = await POST(new NextRequest('http://fixture.invalid/api/shop/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ? body : JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  }
  function noPrivate(body) { assert.doesNotMatch(JSON.stringify(body), /PRIVATE-|encrypted:|buyer@example\.invalid/); }
  function acknowledgement(result) {
    assert.equal(result.status, 200);
    assert.deepEqual(Object.keys(result.body.data.order).sort(), ['createdAt', 'id', 'orderId', 'status', 'totalCzk']);
    assert.equal(result.body.data.invoice, null);
    assert.equal(result.cache, 'no-store');
    noPrivate(result.body);
  }

  await test('fresh order: consolidated quantities, authoritative price/campaign, explicit private-safe DTO', async () => {
    reset();
    state.campaigns = [{ key: 'campaign:book-001', value: JSON.stringify({ tokens: 150, endsAt: '2099-01-01' }) }];
    const body = input();
    body.items = [{ externalId: 'book-001', quantity: 1, priceCzk: 0 }, { externalId: 'book-001', quantity: 2 }];
    body.totalCzk = 0;
    const result = await post(body);
    acknowledgement(result);
    const saved = state.orders.get(body.orderId);
    assert.equal(saved.totalCzk, 324);
    assert.equal(saved.zionTokens, 450);
    assert.equal(saved.items.length, 1);
    assert.equal(saved.items[0].quantity, 3);
    assert.equal(state.products.get('book-001').stock, 2);
    assert.deepEqual(state.effects, { wallet: 1, invoice: 1, adminEmail: 1, customerEmail: 1, walletEmail: 1, expectationWrite: 0 });
  });

  await test('duplicate lines cannot each pass a stock=1 precheck', async () => {
    reset({ products: [product('book-001', 1)] });
    const body = input(); body.items.push({ ...body.items[0] });
    assert.equal((await post(body)).status, 409);
    assert.equal(state.transactions, 0);
    assert.equal(state.effects.wallet, 0);
    assert.equal(state.orders.size, 0);
  });

  await test('invalid/fractional/string/unsafe quantities and combined >99 are rejected before side effects', async () => {
    for (const quantity of [0, -1, 1.1, '2', null, true, 100, Number.MAX_SAFE_INTEGER]) {
      reset(); const body = input(); body.items[0].quantity = quantity;
      assert.equal((await post(body)).status, 400, `quantity ${quantity}`);
      assert.equal(state.transactions, 0); assert.equal(state.effects.wallet, 0);
    }
    reset(); const body = input(); body.items = [{ externalId: 'book-001', quantity: 50 }, { externalId: 'book-001', quantity: 50 }];
    assert.equal((await post(body)).status, 400);
    assert.equal(state.transactions, 0);
  });

  await test('last unit is reserved and atomically marked out of stock', async () => {
    reset({ products: [product('book-001', 1)] });
    acknowledgement(await post(input()));
    assert.equal(state.products.get('book-001').stock, 0);
    assert.equal(state.products.get('book-001').inStock, false);
  });

  await test('rollback removes order and earlier reservations if a later product loses its stock', async () => {
    reset({ products: [product('a', 1), product('b', 1)] });
    state.beforeTransaction = () => { state.products.get('b').stock = 0; };
    const body = input(); body.items = [{ externalId: 'b', quantity: 1 }, { externalId: 'a', quantity: 1 }];
    assert.equal((await post(body)).status, 409);
    assert.deepEqual(state.reservations, ['a', 'b']);
    assert.equal(state.products.get('a').stock, 1);
    assert.equal(state.products.get('b').stock, 0);
    assert.equal(state.orders.size, 0);
    assert.equal(state.effects.invoice + state.effects.adminEmail + state.effects.customerEmail + state.effects.walletEmail, 0);
  });

  await test('two concurrent orders cannot both reserve the last unit after stale prechecks', async () => {
    reset({ products: [product('book-001', 1)] }); state.pricingBarrier = barrier(2);
    const results = await Promise.all([post(input('FIRST')), post(input('SECOND'))]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(state.orders.size, 1); assert.equal(state.products.get('book-001').stock, 0);
    assert.equal(state.effects.invoice, 1); assert.equal(state.effects.customerEmail, 1);
  });

  await test('concurrent same-ID P2002 retry claims once and sends one set of delivery side effects', async () => {
    reset(); state.pricingBarrier = barrier(2);
    const results = await Promise.all([post(input()), post(input())]);
    results.forEach(acknowledgement);
    assert.equal(results.filter((r) => r.body.duplicate).length, 1);
    assert.equal(state.orders.size, 1); assert.equal(state.products.get('book-001').stock, 4);
    assert.equal(state.reservations.length, 1);
    assert.equal(state.effects.invoice, 1); assert.equal(state.effects.customerEmail, 1); assert.equal(state.effects.walletEmail, 1);
  });

  await test('different-email concurrent same-ID loser receives only generic conflict', async () => {
    reset(); state.pricingBarrier = barrier(2);
    const other = input(); other.customer.email = 'other@example.invalid';
    const results = await Promise.all([post(input()), post(other)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const denied = results.find((r) => r.status === 409);
    assert.deepEqual(denied.body, { success: false, duplicate: true, error: 'Order already exists' });
    assert.equal(state.effects.invoice, 1); assert.equal(state.effects.customerEmail, 1);
  });

  await test('sequential matching-email retry returns public DTO without wallet/invoice/email/stock changes', async () => {
    reset(); await post(input());
    const effects = clone(state.effects);
    const body = input(); body.customer.email = 'BUYER@example.invalid'; body.items[0].quantity = 99;
    const result = await post(body); acknowledgement(result);
    assert.equal(result.body.duplicate, true); assert.equal(result.body.data.bank.amount, 108);
    assert.deepEqual(state.effects, effects); assert.equal(state.transactions, 1);
    assert.equal(state.products.get('book-001').stock, 4);
  });

  await test('different-email sequential retry never discloses existing customer or payment details', async () => {
    reset({ orders: [storedOrder()] }); const body = input(); body.customer.email = 'other@example.invalid';
    const result = await post(body);
    assert.equal(result.status, 409); assert.equal(result.body.data, undefined); noPrivate(result.body);
    assert.equal(state.transactions, 0); assert.equal(state.effects.wallet, 0);
  });

  await test('ZION retry loads the persisted vault/amount and never rewrites expectation at current rate', async () => {
    reset({ orders: [storedOrder({ payment: 'zion', totalCzk: 216 })] });
    state.expectations.set('FIXTURE-1234567890', { vault: 'fixture-old-vault', amountZion: 999, expectedFlowers: '999000000' });
    const result = await post(input()); acknowledgement(result);
    assert.equal(result.body.data.zion.address, 'fixture-old-vault');
    assert.equal(result.body.data.zion.amountZion, 999); assert.equal(result.body.data.bank.amount, 216);
    assert.match(result.body.data.zion.uri, /^zion:fixture-old-vault\?amount=999&memo=SHOPPAY/);
    assert.equal(state.effects.expectationWrite, 0); assert.equal(state.effects.wallet, 0);
  });

  await test('fresh crypto alias uses ZION and writes expectation only once across retries', async () => {
    reset(); const body = input(); body.payment = 'crypto';
    acknowledgement(await post(body)); acknowledgement(await post(body));
    assert.equal(state.orders.get(body.orderId).payment, 'zion');
    assert.equal(state.effects.expectationWrite, 1);
  });

  await test('a paid public GET cannot expose PII, invoice HTML, wallet material or archive pass', async () => {
    reset({ orders: [storedOrder({ paymentStatus: 'paid' })] });
    const response = await GET(new NextRequest('http://fixture.invalid'), { params: Promise.resolve({ orderId: input().orderId }) });
    const body = await response.json(); assert.equal(response.status, 200); noPrivate(body);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Object.keys(body.data).sort(), ['createdAt', 'id', 'orderId', 'payment', 'paymentStatus', 'shippingCzk', 'status', 'totalCzk']);
    assert.deepEqual(Object.keys(state.selects[0].select).sort(), Object.keys(body.data).sort());
  });

  await test('missing public order returns 404, not a fabricated success', async () => {
    reset(); const response = await GET(new NextRequest('http://fixture.invalid'), { params: Promise.resolve({ orderId: 'missing' }) });
    assert.equal(response.status, 404); assert.equal((await response.json()).data, undefined);
  });

  await test('actual POST requires fire consent; valid consent stores server time but never returns signature', async () => {
    reset({ products: [product('lamp-001')] }); const body = input(); body.items[0].externalId = 'lamp-001';
    const denied = await post(body); assert.equal(denied.status, 400); assert.equal(denied.body.code, 'fire_consent_required');
    assert.equal(state.transactions, 0); assert.equal(state.effects.wallet, 0);
    body.fireSafety = { accepted: true, signature: 'PRIVATE-SIGNATURE', version: FIRE_CONSENT_VERSION, signedAt: '1900-01-01' };
    const before = Date.now(); acknowledgement(await post(body));
    const saved = state.orders.get(body.orderId); assert.equal(saved.fireConsentName, 'PRIVATE-SIGNATURE');
    assert.equal(saved.fireConsentVersion, FIRE_CONSENT_VERSION); assert.ok(saved.fireConsentAt.getTime() >= before);
  });

  await test('deactivated/unavailable products are guarded again inside the transaction', async () => {
    for (const field of ['active', 'inStock']) {
      reset(); state.beforeTransaction = () => { state.products.get('book-001')[field] = false; };
      assert.equal((await post(input())).status, 409); assert.equal(state.orders.size, 0);
      assert.equal(state.products.get('book-001').stock, 5); assert.equal(state.effects.invoice, 0);
    }
  });

  await test('P2002 without a readable winning row stays a generic conflict', async () => {
    reset(); state.createError = new FixturePrismaError('P2002');
    const result = await post(input()); assert.equal(result.status, 409); noPrivate(result.body);
    assert.equal(result.body.data, undefined); assert.equal(state.effects.invoice, 0);
  });

  await test('invalid JSON, terms coercion and rate limit fail before database side effects', async () => {
    reset(); assert.equal((await post('{broken', true)).status, 400);
    const body = input(); body.termsAccepted = 'yes'; assert.equal((await post(body)).status, 400);
    state.allow = false; assert.equal((await post(input())).status, 429);
    assert.equal(state.transactions, 0); assert.equal(state.effects.wallet, 0);
  });
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis[slot];
  await rm(dir, { recursive: true, force: true });
}
