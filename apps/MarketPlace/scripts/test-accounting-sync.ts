/**
 * Test auto-postingu ledgeru bez DB — prisma delegáty se přepíší in-memory
 * úložištěm. Spusť:  DATABASE_URL=x npx tsx scripts/test-accounting-sync.ts
 *
 * Scénáře kryjí opravy 2026-11-03:
 *   - storno zrušených objednávek (neplacená → 311, zaplacená → 325)
 *   - platba proti zaúčtované faktuře vs. přímé výnosy
 *   - dorovnání items vs totalCzk (sleva MD 604 / přebytek DAL 648)
 *   - idempotence druhého syncu, validace MD=DAL, P2002 retry
 */

import { prisma } from '../src/lib/db';
import {
  CHART_OF_ACCOUNTS,
  postEntry,
  syncOrdersToLedger,
  documentsWithLinks,
  trialBalance,
} from '../src/lib/accounting';

// ── in-memory úložiště ──────────────────────────────────────────────

interface Row { [k: string]: unknown }

const db = {
  ledgerAccount: [] as Row[],
  ledgerEntry: [] as Row[],
  ledgerEntryLine: [] as Row[],
  invoice: [] as Row[],
  shopOrder: [] as Row[],
};
let seq = 0;
let p2002Armed = 0; // kolikrát má create ještě hodit P2002

const OPS = ['in', 'not', 'startsWith', 'lt', 'lte', 'gt', 'gte'];

function matchCond(v: unknown, cond: Record<string, unknown>): boolean {
  for (const [k, c] of Object.entries(cond)) {
    if (k === 'in') { if (!(c as unknown[]).includes(v)) return false; }
    else if (k === 'not') {
      if (c === null ? v === null : (v === c || matchCond(v, c as Record<string, unknown>))) return false;
    }
    else if (k === 'startsWith') { if (typeof v !== 'string' || !v.startsWith(c as string)) return false; }
    else if (k === 'lt') { if (!((v as number) < (c as number))) return false; }
    else if (k === 'lte') { if (!((v as number) <= (c as number))) return false; }
    else if (k === 'gt') { if (!((v as number) > (c as number))) return false; }
    else if (k === 'gte') { if (!((v as number) >= (c as number))) return false; }
  }
  return true;
}

function matchWhere(row: Row, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    if (k === 'OR') {
      if (!(cond as Record<string, unknown>[]).some((w) => matchWhere(row, w))) return false;
      continue;
    }
    const v = row[k];
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      const keys = Object.keys(cond as Record<string, unknown>);
      const isOp = keys.length > 0 && keys.every((kk) => OPS.includes(kk));
      if (isOp) {
        if (!matchCond(v, cond as Record<string, unknown>)) return false;
      } else if (!matchWhere((v ?? {}) as Row, cond as Record<string, unknown>)) {
        return false;
      }
    } else if (v !== cond) return false;
  }
  return true;
}

function sortRows(rows: Row[], orderBy?: Record<string, unknown> | Record<string, unknown>[]): Row[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      const [field, dir] = Object.entries(spec)[0] as [string, string];
      const get = (r: Row) =>
        field === 'entry' ? r.entry : field.split('.').reduce((o: unknown, p) => (o as Row)?.[p], r);
      const av = get(a);
      const bv = get(b);
      // vnořené orderBy (entry.date / entry.entryNumber) — pole entry je objekt
      let cmp = 0;
      if (field === 'entry' && typeof av === 'object') {
        const [sub, subDir] = Object.entries(dir as unknown as Record<string, string>)[0];
        const x = (av as Row)[sub] as string | number | Date;
        const y = (bv as Row)[sub] as string | number | Date;
        cmp = x < y ? -1 : x > y ? 1 : 0;
        if (subDir === 'desc') cmp = -cmp;
      } else {
        const x = av as string | number | Date;
        const y = bv as string | number | Date;
        cmp = x < y ? -1 : x > y ? 1 : 0;
        if (dir === 'desc') cmp = -cmp;
      }
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

function installMocks() {
  const p = prisma as Record<string, unknown>;

  p.ledgerAccount = {
    findMany: async () => db.ledgerAccount,
    findUnique: async ({ where }: { where: Row }) =>
      db.ledgerAccount.find((a) => a.code === where.code) ?? null,
    upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
      const ex = db.ledgerAccount.find((a) => a.code === where.code);
      if (ex) { Object.assign(ex, update); return ex; }
      const row = { id: `acc-${++seq}`, ...create };
      db.ledgerAccount.push(row);
      return row;
    },
  };

  p.ledgerEntry = {
    findFirst: async ({ where, orderBy }: { where?: Row; orderBy?: Row }) =>
      sortRows(db.ledgerEntry.filter((r) => matchWhere(r, where)), orderBy)[0] ?? null,
    findMany: async ({ where, orderBy }: { where?: Row; orderBy?: Row | Row[] }) =>
      sortRows(db.ledgerEntry.filter((r) => matchWhere(r, where)), orderBy),
    create: async ({ data }: { data: Row }) => {
      if (p2002Armed > 0) {
        p2002Armed--;
        const err = new Error('Unique constraint failed') as Error & { code: string };
        err.code = 'P2002';
        throw err;
      }
      if (db.ledgerEntry.some((e) => e.entryNumber === data.entryNumber)) {
        const err = new Error('Unique constraint failed') as Error & { code: string };
        err.code = 'P2002';
        throw err;
      }
      const entry: Row = { id: `e-${++seq}`, ...data, lines: [] };
      const lineCreates = (data.lines as Row)?.create as Row[] | undefined;
      delete entry.lines;
      const lines = (lineCreates ?? []).map((l) => {
        const line: Row = { id: `l-${++seq}`, entryId: entry.id, ...l, entry };
        db.ledgerEntryLine.push(line);
        return line;
      });
      entry.lines = lines;
      db.ledgerEntry.push(entry);
      return entry;
    },
  };

  p.ledgerEntryLine = {
    findMany: async ({ where, orderBy }: { where?: Row; orderBy?: Row[] }) =>
      sortRows(db.ledgerEntryLine.filter((r) => matchWhere(r, where)), orderBy),
    groupBy: async ({ by, where, _sum }: { by: string[]; where?: Row; _sum: Row }) => {
      const groups = new Map<string, Row>();
      for (const r of db.ledgerEntryLine.filter((l) => matchWhere(l, where))) {
        const key = by.map((k) => String(r[k])).join('|');
        const g = groups.get(key) ?? { _sum: { amountHal: 0 } };
        for (const k of by) g[k] = r[k];
        if ('amountHal' in _sum) g._sum.amountHal = (g._sum.amountHal as number) + (r.amountHal as number);
        groups.set(key, g);
      }
      return [...groups.values()];
    },
  };

  p.invoice = {
    findMany: async ({ where }: { where?: Row }) =>
      db.invoice.filter((r) => matchWhere(r, where)),
  };

  p.shopOrder = {
    findMany: async ({ where }: { where?: Row }) =>
      db.shopOrder.filter((r) => matchWhere(r, where)),
  };
}

function reset() {
  db.ledgerEntry = [];
  db.ledgerEntryLine = [];
  db.invoice = [];
  db.shopOrder = [];
  db.ledgerAccount = CHART_OF_ACCOUNTS.map((a) => ({
    id: `acc-${a.code}`, code: a.code, name: a.name, class: a.cls,
    synthetic: a.synthetic ?? null, active: true, system: true,
  }));
}

// ── pomocníci na data a aserce ──────────────────────────────────────

function makeOrder(id: string, over: Row = {}): Row {
  return {
    id, orderId: `ORD-${id}`, status: 'pending', paymentStatus: 'pending',
    payment: 'transfer', customerName: 'Test', totalCzk: 1000, shippingCzk: 100,
    items: [{ name: 'Zbozi', quantity: 1, priceCzk: 900, digital: false }],
    paidAt: null, updatedAt: new Date('2026-06-01'), invoices: [], ...over,
  };
}

function makeInvoice(id: string, order: Row, over: Row = {}): Row {
  return {
    id, invoiceNumber: `FV-${id}`, orderId: order.id, order, status: 'issued',
    totalCzk: order.totalCzk, issuedAt: new Date('2026-05-01'), ...over,
  };
}

function attach(order: Row, ...invs: Row[]) {
  order.invoices = invs.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber }));
  for (const i of invs) i.order = order;
}

function balanceOf(code: string): number {
  return db.ledgerEntryLine
    .filter((l) => l.accountCode === code)
    .reduce((s, l) => s + (l.side === 'MD' ? 1 : -1) * (l.amountHal as number), 0);
}

function entryBySource(sourceType: string, sourceId: string): Row | undefined {
  return db.ledgerEntry.find((e) => e.sourceType === sourceType && e.sourceId === sourceId);
}

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
}

// ── scénáře ─────────────────────────────────────────────────────────

async function main() {
  installMocks();

  // S1: faktura zaúčtovaná → objednávka zrušena (neplacená) → storno na 311
  console.log('S1 nezaplacená zrušená objednávka — storno proti 311');
  {
    reset();
    const o = makeOrder('o1');
    const i = makeInvoice('i1', o);
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);

    let r = await syncOrdersToLedger();
    check('faktura zaúčtována', r.invoicesPosted === 1);
    check('311 nese pohledávku 1000', balanceOf('311') === 100_000);

    // cancel-flow: faktura 'issued' → 'cancelled'
    o.status = 'cancelled'; i.status = 'cancelled';
    r = await syncOrdersToLedger();
    check('storno zaúčtováno', r.stornosPosted === 1, JSON.stringify(r));
    const st = entryBySource('invoice_storno', 'i1');
    check('storno existuje', !!st);
    check('storno DAL jde na 311', (st?.lines as Row[]).some((l) => l.accountCode === '311' && l.side === 'DAL'));
    check('311 vynulována', balanceOf('311') === 0);
    check('604 vynulována', balanceOf('604') === 0);
    check('325 zůstane prázdná', balanceOf('325') === 0);
  }

  // S2: zaplacená objednávka plně zaúčtovaná → pak zrušena → závazek 325
  console.log('S2 zaplacená zrušená (po syncu) — 325 místo phantom 311');
  {
    reset();
    const o = makeOrder('o2', { status: 'paid', paymentStatus: 'paid', paidAt: new Date('2026-05-05') });
    const i = makeInvoice('i2', o, { status: 'issued' });
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);

    let r = await syncOrdersToLedger();
    check('faktura + platba zaúčtovány', r.invoicesPosted === 1 && r.paymentsPosted === 1);
    check('311 vynulována po úhradě', balanceOf('311') === 0);

    // cancel-flow: zaplacená faktura zůstává 'paid'
    o.status = 'cancelled'; i.status = 'paid';
    r = await syncOrdersToLedger();
    check('storno zaúčtováno', r.stornosPosted === 1, JSON.stringify(r));
    const st = entryBySource('invoice_storno', 'i2');
    check('storno DAL jde na 325', (st?.lines as Row[]).some((l) => l.accountCode === '325' && l.side === 'DAL'));
    check('311 je 0 (žádná phantom pohledávka)', balanceOf('311') === 0);
    check('221 drží peníze', balanceOf('221') === 100_000);
    check('325 závazek k vrácení', balanceOf('325') === -100_000);
    check('604 revenue vynulována', balanceOf('604') === 0);
  }

  // S3: zaplacená + zrušená objednávka, nikdy nezaúčtovaná → jen 221/325
  console.log('S3 zaplacená zrušená (nikdy synced) — jediný doklad 221/325');
  {
    reset();
    const o = makeOrder('o3', { status: 'cancelled', paymentStatus: 'paid', paidAt: new Date('2026-05-05') });
    const i = makeInvoice('i3', o, { status: 'cancelled' });
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);

    const r = await syncOrdersToLedger();
    check('nic z faktury nezaúčtováno', r.invoicesPosted === 0 && r.stornosPosted === 0);
    check('platba zaúčtována', r.paymentsPosted === 1, JSON.stringify(r));
    check('dokladů je 1', db.ledgerEntry.length === 1);
    const e = db.ledgerEntry[0];
    check('doklad je 221/325', (e.lines as Row[]).some((l) => l.accountCode === '221' && l.side === 'MD')
      && (e.lines as Row[]).some((l) => l.accountCode === '325' && l.side === 'DAL'));
    check('311 prázdná', balanceOf('311') === 0);
    check('60x prázdná', balanceOf('604') === 0);
  }

  // S4: faktura zaúčtovaná → objednávka zaplacena i zrušena před dalším syncem
  console.log('S4 invoice synced → paid+cancelled před sync #2');
  {
    reset();
    const o = makeOrder('o4');
    const i = makeInvoice('i4', o);
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);

    await syncOrdersToLedger();
    o.status = 'cancelled'; o.paymentStatus = 'paid'; o.paidAt = new Date('2026-05-10');
    i.status = 'cancelled'; // cancel-flow ruší 'issued' fakturu

    const r = await syncOrdersToLedger();
    check('storno + platba', r.stornosPosted === 1 && r.paymentsPosted === 1, JSON.stringify(r));
    check('311 = 0', balanceOf('311') === 0);
    check('325 závazek', balanceOf('325') === -100_000);
    check('221 peníze', balanceOf('221') === 100_000);
    check('604 = 0', balanceOf('604') === 0);
  }

  // S5: happy path — faktura, pak platba, 311 se vyrovná
  console.log('S5 happy path faktura → úhrada');
  {
    reset();
    const o = makeOrder('o5');
    const i = makeInvoice('i5', o);
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);

    await syncOrdersToLedger();
    o.paymentStatus = 'paid'; o.status = 'paid'; o.paidAt = new Date('2026-05-06');
    i.status = 'paid';
    const r = await syncOrdersToLedger();
    check('platba zaúčtována proti 311', r.paymentsPosted === 1);
    const pe = entryBySource('order_paid', 'o5');
    check('payment DAL 311', (pe?.lines as Row[]).some((l) => l.accountCode === '311' && l.side === 'DAL'));
    check('311 = 0', balanceOf('311') === 0);
    check('221 = 1000', balanceOf('221') === 100_000);
    check('604 výnos 900', balanceOf('604') === -90_000);
    check('602 doprava 100', balanceOf('602') === -10_000);
  }

  // S6: zaplacená objednávka bez faktury → přímé výnosy
  console.log('S6 paid bez faktury → přímá úhrada výnosů');
  {
    reset();
    const o = makeOrder('o6', { status: 'paid', paymentStatus: 'paid', paidAt: new Date('2026-05-05') });
    db.shopOrder.push(o);
    const r = await syncOrdersToLedger();
    check('platba zaúčtována', r.paymentsPosted === 1);
    check('311 prázdná (žádná faktura)', balanceOf('311') === 0);
    check('221 = 1000', balanceOf('221') === 100_000);
    check('výnos = 1000 celkem', balanceOf('604') + balanceOf('602') + balanceOf('648') === -100_000);
  }

  // S6b: zaplacená objednávka, faktura existuje ale jen draft (nezaúčtovaná)
  // → platba nesmí jít proti 311 (žádná MD pohledávka nevznikla)
  console.log('S6b paid + draft faktura → přímé výnosy, ne 311');
  {
    reset();
    const o = makeOrder('o6b', { status: 'paid', paymentStatus: 'paid', paidAt: new Date('2026-05-05') });
    const i = makeInvoice('i6b', o, { status: 'draft' });
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);
    const r = await syncOrdersToLedger();
    check('platba zaúčtována', r.paymentsPosted === 1);
    const pe = entryBySource('order_paid', 'o6b');
    check('žádný řádek na 311', !(pe?.lines as Row[]).some((l) => l.accountCode === '311'));
    check('311 = 0', balanceOf('311') === 0);
  }

  // S7: sleva — součet položek (1200) > totalCzk (1000) → MD 604 dorovnání
  console.log('S7 sleva: položky > doklad → MD řádek na 604');
  {
    reset();
    const o = makeOrder('o7', { totalCzk: 1000, items: [{ name: 'a', quantity: 1, priceCzk: 1100 }] });
    const i = makeInvoice('i7', o, { totalCzk: 1000 });
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);
    const r = await syncOrdersToLedger();
    check('faktura zaúčtována', r.invoicesPosted === 1, JSON.stringify(r.errors));
    const e = entryBySource('invoice', 'i7');
    check('MD 604 sleva 200', (e?.lines as Row[]).some((l) => l.accountCode === '604' && l.side === 'MD' && l.amountHal === 20_000));
    check('311 = přesně 1000', balanceOf('311') === 100_000);
  }

  // S8: položky (900) < totalCzk (1000) → DAL 648 dorovnání
  console.log('S8 přebytek: položky < doklad → DAL 648');
  {
    reset();
    const o = makeOrder('o8', { totalCzk: 1000, shippingCzk: 0, items: [{ name: 'a', quantity: 1, priceCzk: 900 }] });
    const i = makeInvoice('i8', o, { totalCzk: 1000 });
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);
    const r = await syncOrdersToLedger();
    check('faktura zaúčtována', r.invoicesPosted === 1, JSON.stringify(r.errors));
    const e = entryBySource('invoice', 'i8');
    check('DAL 648 diff 100', (e?.lines as Row[]).some((l) => l.accountCode === '648' && l.side === 'DAL' && l.amountHal === 10_000));
  }

  // S9: druhý sync nic nového nezaúčtuje
  console.log('S9 idempotence');
  {
    reset();
    const o = makeOrder('o9', { status: 'paid', paymentStatus: 'paid', paidAt: new Date() });
    const i = makeInvoice('i9', o, { status: 'paid' });
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);
    await syncOrdersToLedger();
    const n = db.ledgerEntry.length;
    const r = await syncOrdersToLedger();
    check('žádné nové doklady', r.invoicesPosted === 0 && r.paymentsPosted === 0 && r.stornosPosted === 0);
    check('počet dokladů beze změny', db.ledgerEntry.length === n);
  }

  // S10: nevyvážený manuální doklad odmítnut
  console.log('S10 validace MD=DAL');
  {
    reset();
    let threw = false;
    try {
      await postEntry({
        date: new Date(), description: 'x',
        lines: [
          { accountCode: '221', side: 'MD', amountHal: 100 },
          { accountCode: '602', side: 'DAL', amountHal: 99 },
        ],
      });
    } catch { threw = true; }
    check('nevyvážený doklad hází', threw);
  }

  // S11: documentsWithLinks — unposted počítá i storno-situace
  console.log('S11 unposted report');
  {
    reset();
    const o = makeOrder('o11');
    const i = makeInvoice('i11', o);
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);
    let d = await documentsWithLinks(2026);
    check('1 faktura nezaúčtovaná', d.unposted.invoices === 1);
    await syncOrdersToLedger();
    o.status = 'cancelled'; i.status = 'cancelled';
    d = await documentsWithLinks(2026);
    check('zrušená se zaúčtovanou fakturou = chybí storno', d.unposted.invoices === 1);
    await syncOrdersToLedger();
    d = await documentsWithLinks(2026);
    check('po stornu čisto', d.unposted.invoices === 0);
  }

  // S11b: zrušená, nikdy zaúčtovaná faktura se do unposted nepočítá
  console.log('S11b zrušená nezaúčtovaná faktura ≠ unposted');
  {
    reset();
    const o = makeOrder('o11b', { status: 'cancelled' });
    const i = makeInvoice('i11b', o, { status: 'cancelled' });
    attach(o, i);
    db.shopOrder.push(o); db.invoice.push(i);
    const d = await documentsWithLinks(2026);
    check('unposted = 0', d.unposted.invoices === 0);
  }

  // S12: P2002 → retry přečte číslo znovu
  console.log('S12 P2002 retry číslování');
  {
    reset();
    p2002Armed = 1;
    const r = await postEntry({
      date: new Date('2026-03-03'), description: 'retry',
      lines: [
        { accountCode: '221', side: 'MD', amountHal: 500 },
        { accountCode: '602', side: 'DAL', amountHal: 500 },
      ],
    });
    check('doklad vytvořen po retry', r.created === true);
    check('číslo U-2026-0001', r.entry.entryNumber === 'U-2026-0001');
  }

  // S13: předvaha sedí přes všechny scénáře (MD=DAL invariant)
  console.log('S13 předvaha MD=DAL');
  {
    reset();
    // o3ok: faktura zaúčtovaná → pak zrušena nezaplacená (storno 311)
    const o3ok = makeOrder('c');
    const i3ok = makeInvoice('fc', o3ok);
    attach(o3ok, i3ok);
    db.shopOrder.push(o3ok); db.invoice.push(i3ok);
    await syncOrdersToLedger();
    o3ok.status = 'cancelled'; i3ok.status = 'cancelled';

    // o1: zaplacená s fakturou (normální flow); o2: zaplacená zrušená
    // bez syncu (crypto → 159.9 / 325)
    const o1 = makeOrder('a', { status: 'paid', paymentStatus: 'paid', paidAt: new Date() });
    const i1 = makeInvoice('fa', o1, { status: 'paid' });
    attach(o1, i1);
    const o2 = makeOrder('b', { status: 'cancelled', paymentStatus: 'paid', paidAt: new Date(), payment: 'crypto' });
    const i2 = makeInvoice('fb', o2, { status: 'cancelled' });
    attach(o2, i2);
    db.shopOrder.push(o1, o2); db.invoice.push(i1, i2);

    await syncOrdersToLedger();
    const tb = await trialBalance(2026);
    const md = tb.reduce((s, r) => s + r.mdHal, 0);
    const dal = tb.reduce((s, r) => s + r.dalHal, 0);
    check('MD = DAL', md === dal, `${md} vs ${dal}`);
    check('crypto platba na 159.9', balanceOf('159.9') === 100_000);
    check('325 závazek (o2)', balanceOf('325') === -100_000);
    check('311 = 0', balanceOf('311') === 0);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
