/**
 * Ledger (podvojné účetnictví) — Omnity.One s.r.o., neplátce DPH, bez zaměstnanců.
 * Plán: UCETNICTVI-PLAN.md (root). Účtový rozvrh = podmnožina vyhl. 500/2002 Sb.
 * Částky v haléřích (amountHal). Strany: "MD" = má dát, "DAL" = dal.
 */

import { prisma } from '@/lib/db';

export type EntrySide = 'MD' | 'DAL';

export interface PostingLine {
  accountCode: string;
  side: EntrySide;
  amountHal: number;
}

export interface PostEntryInput {
  date: Date;
  description: string;
  documentRef?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  lines: PostingLine[];
  postedBy?: string | null;
}

// ── Směrná účtová osnova (vyhl. 500/2002 Sb., podmnožina) ──────────
// crypto účty = interní rozšíření (159.9), viz plán §3.4
export const CHART_OF_ACCOUNTS: ReadonlyArray<{
  code: string;
  name: string;
  cls: number;
  synthetic?: string;
}> = [
  // Třída 0 — dlouhodobý majetek
  { code: '013', name: 'Software', cls: 0 },
  { code: '022', name: 'Samostatné movité věci a soubory movitých věcí', cls: 0 },
  { code: '081', name: 'Oprávky k softwaru', cls: 0 },
  { code: '082', name: 'Oprávky k samostatným movitým věcem', cls: 0 },
  // Třída 1 — zásoby
  { code: '112', name: 'Materiál na skladě', cls: 1 },
  { code: '131', name: 'Zboží na skladě a v prodejně', cls: 1 },
  { code: '132', name: 'Zboží na cestě', cls: 1 },
  { code: '159', name: 'Ostatní zásoby', cls: 1 },
  { code: '159.9', name: 'Krypto-inventarizace (ZION/wZION/ostatní)', cls: 1, synthetic: '159' },
  // Třída 2 — finanční účty
  { code: '211', name: 'Peněžní prostředky v pokladně', cls: 2 },
  { code: '221', name: 'Bankovní účty (Fio)', cls: 2 },
  { code: '261', name: 'Peníze na cestě', cls: 2 },
  { code: '311', name: 'Odběratelé', cls: 2 },
  { code: '314', name: 'Poskytnuté zálohy', cls: 2 },
  { code: '315', name: 'Ostatní pohledávky', cls: 2 },
  { code: '321', name: 'Dodavatelé', cls: 2 },
  { code: '324', name: 'Přijaté zálohy', cls: 2 },
  { code: '325', name: 'Ostatní závazky', cls: 2 },
  { code: '341', name: 'Daň z příjmů', cls: 2 },
  { code: '342', name: 'Ostatní přímé daně', cls: 2 },
  { code: '343', name: 'Daň z přidané hodnoty (IO režim)', cls: 2 },
  { code: '345', name: 'Ostatní daně a poplatky', cls: 2 },
  { code: '365', name: 'Ostatní pohledávky ke společníkům', cls: 2 },
  { code: '366', name: 'Závazky ke společníkům a účastníkům', cls: 2 },
  { code: '378', name: 'Jiné pohledávky', cls: 2 },
  { code: '379', name: 'Jiné závazky', cls: 2 },
  { code: '381', name: 'Náklady příštích období', cls: 2 },
  { code: '383', name: 'Výnosy příštích období', cls: 2 },
  { code: '384', name: 'Výdaje příštích období', cls: 2 },
  { code: '385', name: 'Příjmy příštích období', cls: 2 },
  { code: '388', name: 'Dohadné účty aktivní', cls: 2 },
  { code: '389', name: 'Dohadné účty pasivní', cls: 2 },
  { code: '391', name: 'Opravná položka k pohledávkám', cls: 2 },
  { code: '395', name: 'Vnitřní zúčtování', cls: 2 },
  // Třída 4 — vlastní kapitál
  { code: '411', name: 'Základní kapitál', cls: 4 },
  { code: '413', name: 'Ostatní kapitálové fondy', cls: 4 },
  { code: '421', name: 'Zákonný rezervní fond', cls: 4 },
  { code: '423', name: 'Statutární fondy', cls: 4 },
  { code: '428', name: 'Nerozdělený zisk minulých let', cls: 4 },
  { code: '429', name: 'Neuhrazená ztráta minulých let', cls: 4 },
  { code: '431', name: 'Výsledek hospodaření ve schvalovacím řízení', cls: 4 },
  // Třída 5 — náklady
  { code: '501', name: 'Spotřeba materiálu', cls: 5 },
  { code: '502', name: 'Spotřeba energie', cls: 5 },
  { code: '504', name: 'Prodané zboží', cls: 5 },
  { code: '511', name: 'Opravy a udržování', cls: 5 },
  { code: '512', name: 'Cestovné', cls: 5 },
  { code: '513', name: 'Náklady na reprezentaci', cls: 5 },
  { code: '518', name: 'Ostatní služby', cls: 5 },
  { code: '521', name: 'Mzdové náklady', cls: 5 },
  { code: '527', name: 'Zákonné sociální náklady', cls: 5 },
  { code: '531', name: 'Daň silniční', cls: 5 },
  { code: '532', name: 'Daň z nemovitosti', cls: 5 },
  { code: '538', name: 'Ostatní daně a poplatky', cls: 5 },
  { code: '542', name: 'Prodaný materiál', cls: 5 },
  { code: '543', name: 'Manka, škody, dary a pojistné plnění v provozní oblasti', cls: 5 },
  { code: '545', name: 'Ostatní pokuty a penále', cls: 5 },
  { code: '548', name: 'Ostatní provozní náklady', cls: 5 },
  { code: '551', name: 'Odpisy dlouhodobého nehmotného a hmotného majetku', cls: 5 },
  { code: '562', name: 'Úroky', cls: 5 },
  { code: '563', name: 'Kurzové ztráty', cls: 5 },
  { code: '568', name: 'Ostatní finanční náklady', cls: 5 },
  { code: '591', name: 'Daň z příjmů z běžné činnosti – splatná', cls: 5 },
  // Třída 6 — výnosy
  { code: '601', name: 'Tržby za vlastní výrobky', cls: 6 },
  { code: '602', name: 'Tržby z prodeje služeb', cls: 6 },
  { code: '604', name: 'Tržby za zboží', cls: 6 },
  { code: '642', name: 'Tržby z prodeje materiálu', cls: 6 },
  { code: '644', name: 'Smluvní pokuty a úroky z prodlení', cls: 6 },
  { code: '648', name: 'Ostatní provozní výnosy', cls: 6 },
  { code: '662', name: 'Úroky', cls: 6 },
  { code: '663', name: 'Kurzové zisky', cls: 6 },
  { code: '668', name: 'Ostatní finanční výnosy', cls: 6 },
];

const ACCOUNT_CLASS: Record<string, number> = Object.fromEntries(
  CHART_OF_ACCOUNTS.map((a) => [a.code, a.cls])
);

const REVENUE_SERVICE = '602';
const REVENUE_GOODS = '604';
const REVENUE_OTHER = '648';
const RECEIVABLES = '311';
const REFUND_LIABILITY = '325'; // závazek k vrácení po zrušení zaplacené objednávky
const BANK = '221';
const CRYPTO_INVENTORY = '159.9';

// ── COA seed ──────────────────────────────────────────────────────

export async function seedChartOfAccounts(): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const a of CHART_OF_ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where: { code: a.code },
      update: { name: a.name, class: a.cls, synthetic: a.synthetic ?? null },
      create: { code: a.code, name: a.name, class: a.cls, synthetic: a.synthetic ?? null, system: true },
    });
    upserted++;
  }
  return { upserted };
}

// ── Číslování dokladů U-<rok>-<pořadí> ────────────────────────────

async function nextEntryNumber(year: number): Promise<string> {
  const last = await prisma.ledgerEntry.findFirst({
    where: { entryNumber: { startsWith: `U-${year}-` } },
    orderBy: { entryNumber: 'desc' },
    select: { entryNumber: true },
  });
  const seq = last ? parseInt(last.entryNumber.split('-')[2], 10) + 1 : 1;
  return `U-${year}-${String(seq).padStart(4, '0')}`;
}

// ── Jádro: zaúčtování dokladu ─────────────────────────────────────

export async function postEntry(input: PostEntryInput) {
  if (!input.lines || input.lines.length < 2) {
    throw new Error('Doklad musí mít alespoň 2 řádky (MD a DAL)');
  }
  let md = 0;
  let dal = 0;
  for (const l of input.lines) {
    if (!Number.isInteger(l.amountHal) || l.amountHal <= 0) {
      throw new Error(`Neplatná částka u účtu ${l.accountCode}`);
    }
    if (!(l.accountCode in ACCOUNT_CLASS)) {
      // účet může existovat v DB i mimo seed — ověř
      const acc = await prisma.ledgerAccount.findUnique({ where: { code: l.accountCode } });
      if (!acc) throw new Error(`Neznámý účet ${l.accountCode} — nejdřív založ v účtovém rozvrhu`);
    }
    if (l.side === 'MD') md += l.amountHal;
    else if (l.side === 'DAL') dal += l.amountHal;
    else throw new Error('Strana musí být MD nebo DAL');
  }
  if (md !== dal) {
    throw new Error(`Nevyvážený doklad: MD ${md} ≠ DAL ${dal} haléřů`);
  }

  const period = input.date.getFullYear();

  // idempotence: stejný sourceType+sourceId už zaúčtovaný → vrať existující
  if (input.sourceType && input.sourceId) {
    const existing = await prisma.ledgerEntry.findFirst({
      where: { sourceType: input.sourceType, sourceId: input.sourceId },
      include: { lines: true },
    });
    if (existing) return { entry: existing, created: false };
  }

  // Souběžné doklady si mohou vybrat stejné číslo (findFirst + create není
  // atomické). P2002 = unique conflict → přečti číslo znovu a opakuj.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    const entryNumber = await nextEntryNumber(period);
    try {
      const entry = await prisma.ledgerEntry.create({
        data: {
          entryNumber,
          date: input.date,
          description: input.description.slice(0, 500),
          documentRef: input.documentRef?.slice(0, 100) ?? null,
          sourceType: input.sourceType ?? 'manual',
          sourceId: input.sourceId ?? null,
          period,
          postedBy: input.postedBy ?? null,
          lines: {
            create: input.lines.map((l) => ({
              accountCode: l.accountCode,
              side: l.side,
              amountHal: l.amountHal,
            })),
          },
        },
        include: { lines: true },
      });
      return { entry, created: true };
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002' && attempt < MAX_ATTEMPTS) continue;
      throw e;
    }
  }
}

// ── Auto-posting: faktury + zaplacené objednávky ──────────────────

interface OrderItemLite {
  name?: string;
  quantity?: number;
  priceCzk?: number;
  digital?: boolean;
}

function hal(czk: number): number {
  return Math.round(czk * 100);
}

function revenueLinesForOrder(items: OrderItemLite[], shippingCzk: number) {
  const byAccount = new Map<string, number>();
  const add = (acc: string, amountHal: number) =>
    byAccount.set(acc, (byAccount.get(acc) ?? 0) + amountHal);

  for (const it of items) {
    const qty = Math.max(1, Math.round(it.quantity ?? 1));
    const price = Number(it.priceCzk ?? 0);
    add(it.digital ? REVENUE_SERVICE : REVENUE_GOODS, hal(qty * price));
  }
  if (shippingCzk > 0) add(REVENUE_SERVICE, hal(shippingCzk));

  return [...byAccount.entries()].map(([accountCode, amountHal]) => ({
    accountCode,
    side: 'DAL' as const,
    amountHal,
  }));
}

// Rozdíl mezi součtem položek a účtovanou částkou: nadbytek jde na 648
// (ostatní výnosy, typicky zaokrouhlení), schodek = sleva na MD výnosového
// účtu. Vrací 0–1 řádků; používá se i pro dorovnání stran dokladu.
function diffLine(diffHal: number): PostingLine[] {
  if (diffHal > 0) return [{ accountCode: REVENUE_OTHER, side: 'DAL', amountHal: diffHal }];
  if (diffHal < 0) return [{ accountCode: REVENUE_GOODS, side: 'MD', amountHal: -diffHal }];
  return [];
}

// Výnosové řádky dorovnané přesně na fakturovanou částku — jinak by na 311
// (a v obratu 60x) zůstal nesoulad, když se items v JSONu liší od totalCzk.
function reconcileRevenueLines(lines: PostingLine[], targetHal: number): PostingLine[] {
  const sum = lines.reduce((s, l) => s + l.amountHal, 0);
  if (sum === targetHal) return lines;
  if (lines.length === 0) {
    return [{ accountCode: REVENUE_GOODS, side: 'DAL', amountHal: targetHal }];
  }
  return [...lines, ...diffLine(targetHal - sum)];
}

// Storna se staví převrácením stran výnosových řádků (zrcadlí i slevový MD řádek).
function flipSides(lines: PostingLine[]): PostingLine[] {
  return lines.map((l) => ({ ...l, side: l.side === 'MD' ? 'DAL' : 'MD' }));
}

export interface SyncResult {
  invoicesPosted: number;
  paymentsPosted: number;
  stornosPosted: number;
  skipped: number;
  errors: string[];
}

export async function syncOrdersToLedger(): Promise<SyncResult> {
  const res: SyncResult = { invoicesPosted: 0, paymentsPosted: 0, stornosPosted: 0, skipped: 0, errors: [] };

  // 1) Faktury → 311 / 60x (vystavení = vznik pohledávky + výnos)
  // Cancel-flow nastaví fakturám status 'cancelled' — ty je potřeba zahrnout,
  // jinak by storno větev nikdy neproběhla a výnos + pohledávka zůstaly
  // v knihách navždy (pro storno ale musí být faktura už zaúčtovaná).
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { status: { in: ['issued', 'sent', 'paid'] } },
        { status: 'cancelled', order: { status: 'cancelled' } },
      ],
    },
    include: { order: true },
  });

  for (const inv of invoices) {
    const order = inv.order;
    try {
      if (order.status === 'cancelled') {
        const wasPosted = await prisma.ledgerEntry.findFirst({
          where: { sourceType: 'invoice', sourceId: inv.id },
          select: { id: true },
        });
        if (!wasPosted) { res.skipped++; continue; }

        // U zaplacené objednávky je 311 už vyrovnaná (faktura MD + úhrada DAL)
        // — storno revenue proto jde proti 325 závazku k vrácení, ne zpět na
        // 311 (to by vytvořilo fiktivní pohledávku).
        const paidEntry = await prisma.ledgerEntry.findFirst({
          where: { sourceType: 'order_paid', sourceId: order.id },
          select: { id: true },
        });
        const settled = order.paymentStatus === 'paid' || !!paidEntry;

        const items = (order.items as OrderItemLite[]) ?? [];
        const totalHal = hal(inv.totalCzk);
        const revLines = reconcileRevenueLines(
          revenueLinesForOrder(items, order.shippingCzk ?? 0), totalHal);
        const stornoLines: PostingLine[] = [
          ...flipSides(revLines),
          {
            accountCode: settled ? REFUND_LIABILITY : RECEIVABLES,
            side: 'DAL',
            amountHal: totalHal,
          },
        ];
        const { created } = await postEntry({
          date: new Date(),
          description: settled
            ? `Storno faktury ${inv.invoiceNumber} — zaplacená objednávka ${order.orderId} zrušena, závazek k vrácení`
            : `Storno faktury ${inv.invoiceNumber} — objednávka ${order.orderId} zrušena`,
          documentRef: inv.invoiceNumber,
          sourceType: 'invoice_storno',
          sourceId: inv.id,
          lines: stornoLines,
          postedBy: 'auto-sync',
        });
        if (created) res.stornosPosted++; else res.skipped++;
        continue;
      }

      const items = (order.items as OrderItemLite[]) ?? [];
      const totalHal = hal(inv.totalCzk);
      const revLines = reconcileRevenueLines(
        revenueLinesForOrder(items, order.shippingCzk ?? 0), totalHal);
      const { created } = await postEntry({
        date: inv.issuedAt,
        description: `Faktura ${inv.invoiceNumber} — ${order.customerName} (${order.orderId})`,
        documentRef: inv.invoiceNumber,
        sourceType: 'invoice',
        sourceId: inv.id,
        lines: [{ accountCode: RECEIVABLES, side: 'MD', amountHal: totalHal }, ...revLines],
        postedBy: 'auto-sync',
      });
      if (created) res.invoicesPosted++;
      else res.skipped++;
    } catch (e) {
      res.errors.push(`${inv.invoiceNumber}: ${e instanceof Error ? e.message : 'err'}`);
    }
  }

  // 2) Zaplacené objednávky → 221/159.9 MD. Kreditní strana:
  //    zaúčtovaná faktura → 311 (uhrada pohledávky), jinak přímé výnosy,
  //    zrušená bez faktury → 325 (peníze dorazily, závazek k vrácení).
  const paidOrders = await prisma.shopOrder.findMany({
    where: { paymentStatus: 'paid' },
    include: { invoices: { select: { id: true, invoiceNumber: true } } },
  });

  for (const order of paidOrders) {
    const debitAccount = order.payment === 'crypto' ? CRYPTO_INVENTORY : BANK;

    try {
      // Rozhoduje existence účetního zápisu faktury — Invoice řádek sám
      // nestačí (draft/cancelled faktura se neúčtuje → 311 by šla do minusu).
      const postedInvoice = order.invoices.length
        ? await prisma.ledgerEntry.findFirst({
            where: {
              sourceType: 'invoice',
              sourceId: { in: order.invoices.map((i) => i.id) },
            },
            select: { id: true },
          })
        : null;

      const totalHal = hal(order.totalCzk);
      let lines: PostingLine[];
      let description: string;
      if (order.status === 'cancelled' && !postedInvoice) {
        lines = [
          { accountCode: debitAccount, side: 'MD', amountHal: totalHal },
          { accountCode: REFUND_LIABILITY, side: 'DAL', amountHal: totalHal },
        ];
        description = `Úhrada zrušené objednávky ${order.orderId} (${order.payment}) — závazek k vrácení`;
      } else if (postedInvoice) {
        lines = [
          { accountCode: debitAccount, side: 'MD', amountHal: totalHal },
          { accountCode: RECEIVABLES, side: 'DAL', amountHal: totalHal },
        ];
        description = `Úhrada objednávky ${order.orderId} (${order.payment}) — ${order.customerName}`;
      } else {
        const items = (order.items as OrderItemLite[]) ?? [];
        const revLines = reconcileRevenueLines(
          revenueLinesForOrder(items, order.shippingCzk ?? 0), totalHal);
        lines = [{ accountCode: debitAccount, side: 'MD', amountHal: totalHal }, ...revLines];
        description = `Přímá úhrada ${order.orderId} (${order.payment}) — ${order.customerName}`;
      }

      const { created } = await postEntry({
        date: order.paidAt ?? order.updatedAt,
        description,
        documentRef: order.invoices[0]?.invoiceNumber ?? order.orderId,
        sourceType: 'order_paid',
        sourceId: order.id,
        lines,
        postedBy: 'auto-sync',
      });
      if (created) res.paymentsPosted++; else res.skipped++;
    } catch (e) {
      res.errors.push(`${order.orderId}: ${e instanceof Error ? e.message : 'err'}`);
    }
  }

  return res;
}

// ── Výstupy ───────────────────────────────────────────────────────

export interface TrialBalanceRow {
  accountCode: string;
  name: string;
  cls: number;
  mdHal: number;
  dalHal: number;
  balanceHal: number; // >0 = MD aktivní, <0 = DAL pasivní
}

export async function trialBalance(period: number): Promise<TrialBalanceRow[]> {
  const lines = await prisma.ledgerEntryLine.findMany({
    where: { entry: { period } },
  });
  const acc = new Map<string, { md: number; dal: number }>();
  for (const l of lines) {
    const cur = acc.get(l.accountCode) ?? { md: 0, dal: 0 };
    if (l.side === 'MD') cur.md += l.amountHal;
    else cur.dal += l.amountHal;
    acc.set(l.accountCode, cur);
  }
  const names = new Map<string, { name: string; cls: number }>();
  const accounts = await prisma.ledgerAccount.findMany();
  for (const a of accounts) names.set(a.code, { name: a.name, cls: a.class });

  return [...acc.entries()]
    .map(([accountCode, v]) => ({
      accountCode,
      name: names.get(accountCode)?.name ?? accountCode,
      cls: names.get(accountCode)?.cls ?? parseInt(accountCode[0] ?? '9', 10),
      mdHal: v.md,
      dalHal: v.dal,
      balanceHal: v.md - v.dal,
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode, 'cs'));
}

export function formatHal(amountHal: number): string {
  const sign = amountHal < 0 ? '−' : '';
  const abs = Math.abs(amountHal);
  const czk = Math.floor(abs / 100);
  const hal = abs % 100;
  return `${sign}${czk.toLocaleString('cs-CZ')},${String(hal).padStart(2, '0')}`;
}

// ── F2: Hlavní kniha per účet ─────────────────────────────────────
// Zůstatek je vždy MD − DAL: kladný = MD (aktivní/debetní), záporný = DAL (pasivní).

export interface GeneralLedgerLine {
  entryId: string;
  entryNumber: string;
  date: Date;
  description: string;
  documentRef: string | null;
  sourceType: string | null;
  side: EntrySide;
  amountHal: number;
  balanceHal: number;
}

export interface GeneralLedgerResult {
  accountCode: string;
  name: string;
  cls: number;
  period: number;
  openingHal: number;
  mdHal: number;
  dalHal: number;
  closingHal: number;
  lines: GeneralLedgerLine[];
}

export async function generalLedger(
  accountCode: string,
  period: number
): Promise<GeneralLedgerResult | null> {
  const account = await prisma.ledgerAccount.findUnique({ where: { code: accountCode } });
  if (!account) return null;

  // počáteční stav = vše z předchozích období
  const opening = await prisma.ledgerEntryLine.findMany({
    where: { accountCode, entry: { period: { lt: period } } },
    select: { side: true, amountHal: true },
  });
  const openingHal = opening.reduce(
    (s, l) => s + (l.side === 'MD' ? l.amountHal : -l.amountHal),
    0
  );

  const raw = await prisma.ledgerEntryLine.findMany({
    where: { accountCode, entry: { period } },
    include: {
      entry: {
        select: {
          id: true,
          entryNumber: true,
          date: true,
          description: true,
          documentRef: true,
          sourceType: true,
        },
      },
    },
    orderBy: [{ entry: { date: 'asc' } }, { entry: { entryNumber: 'asc' } }],
  });

  let running = openingHal;
  let mdHal = 0;
  let dalHal = 0;
  const lines: GeneralLedgerLine[] = raw.map((l) => {
    const delta = l.side === 'MD' ? l.amountHal : -l.amountHal;
    if (l.side === 'MD') mdHal += l.amountHal;
    else dalHal += l.amountHal;
    running += delta;
    return {
      entryId: l.entry.id,
      entryNumber: l.entry.entryNumber,
      date: l.entry.date,
      description: l.entry.description,
      documentRef: l.entry.documentRef,
      sourceType: l.entry.sourceType,
      side: l.side === 'DAL' ? 'DAL' : 'MD',
      amountHal: l.amountHal,
      balanceHal: running,
    };
  });

  return {
    accountCode,
    name: account.name,
    cls: account.class,
    period,
    openingHal,
    mdHal,
    dalHal,
    closingHal: running,
    lines,
  };
}

// ── F2: Inventurní soupis stavů (rozvahové účty k 31. 12.) ────────

export type InventoryKind = 'asset' | 'liability' | 'equity';

export interface InventoryRow {
  accountCode: string;
  name: string;
  cls: number;
  kind: InventoryKind;
  balanceHal: number; // MD − DAL
}

export interface InventoryReport {
  period: number;
  rows: InventoryRow[];
  assetsHal: number;
  liabilitiesHal: number;
  equityHal: number;
  profitHal: number;
  controlDiffHal: number;
  mdTotalHal: number;
  dalTotalHal: number;
  balanced: boolean;
}

export async function inventoryReport(period: number): Promise<InventoryReport> {
  const grouped = await prisma.ledgerEntryLine.groupBy({
    by: ['accountCode', 'side'],
    where: { entry: { period: { lte: period } } },
    _sum: { amountHal: true },
  });

  const balanceByAccount = new Map<string, number>();
  let mdTotalHal = 0;
  let dalTotalHal = 0;
  for (const g of grouped) {
    const amount = g._sum.amountHal ?? 0;
    if (g.side === 'MD') mdTotalHal += amount;
    else dalTotalHal += amount;
    const delta = g.side === 'MD' ? amount : -amount;
    balanceByAccount.set(g.accountCode, (balanceByAccount.get(g.accountCode) ?? 0) + delta);
  }

  const accounts = await prisma.ledgerAccount.findMany();
  const meta = new Map(accounts.map((a) => [a.code, a]));

  const rows: InventoryRow[] = [];
  let profitHal = 0; // −(Σ třída 5 + Σ třída 6)

  for (const [accountCode, balanceHal] of balanceByAccount) {
    const account = meta.get(accountCode);
    const cls = account?.class ?? parseInt(accountCode[0] ?? '9', 10);
    if (balanceHal === 0) continue;

    if (cls === 5 || cls === 6) {
      profitHal -= balanceHal;
      continue;
    }
    if (cls !== 0 && cls !== 1 && cls !== 2 && cls !== 4) continue;

    let kind: InventoryKind;
    if (cls === 4) kind = 'equity';
    else if (cls === 2) kind = balanceHal >= 0 ? 'asset' : 'liability';
    else kind = 'asset';

    rows.push({
      accountCode,
      name: account?.name ?? accountCode,
      cls,
      kind,
      balanceHal,
    });
  }

  rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode, 'cs'));

  let assetsHal = 0;
  let liabilitiesHal = 0;
  let equityHal = 0;
  for (const r of rows) {
    if (r.kind === 'asset') assetsHal += r.balanceHal;
    else if (r.kind === 'liability') liabilitiesHal -= r.balanceHal;
    else equityHal -= r.balanceHal;
  }

  return {
    period,
    rows,
    assetsHal,
    liabilitiesHal,
    equityHal,
    profitHal,
    controlDiffHal: assetsHal - liabilitiesHal - equityHal - profitHal,
    mdTotalHal,
    dalTotalHal,
    balanced: mdTotalHal === dalTotalHal,
  };
}

// ── F2: Doklady a návaznosti (Entry ↔ Invoice/Order) ──────────────

export interface DocumentRow {
  entryId: string;
  entryNumber: string;
  date: Date;
  description: string;
  documentRef: string | null;
  sourceType: string;
  totalHal: number;
  orderId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
}

export interface DocumentsReport {
  period: number;
  rows: DocumentRow[];
  unposted: { invoices: number; paidOrders: number };
}

export async function documentsWithLinks(period: number): Promise<DocumentsReport> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { period },
    include: { lines: { select: { side: true, amountHal: true } } },
    orderBy: [{ date: 'desc' }, { entryNumber: 'desc' }],
  });

  const invoiceIds = entries
    .filter((e) => e.sourceType === 'invoice' || e.sourceType === 'invoice_storno')
    .map((e) => e.sourceId)
    .filter((v): v is string => !!v);
  const orderIds = entries
    .filter((e) => e.sourceType === 'order_paid')
    .map((e) => e.sourceId)
    .filter((v): v is string => !!v);

  const invoices = invoiceIds.length
    ? await prisma.invoice.findMany({
        where: { id: { in: invoiceIds } },
        include: { order: { select: { orderId: true, id: true } } },
      })
    : [];
  const orders = orderIds.length
    ? await prisma.shopOrder.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, orderId: true },
      })
    : [];

  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const orderById = new Map(orders.map((o) => [o.id, o]));

  const rows: DocumentRow[] = entries.map((e) => {
    const totalHal = e.lines
      .filter((l) => l.side === 'MD')
      .reduce((s, l) => s + l.amountHal, 0);

    let orderId: string | null = null;
    let invoiceNumber: string | null = null;
    let invoiceStatus: string | null = null;

    if (e.sourceId && (e.sourceType === 'invoice' || e.sourceType === 'invoice_storno')) {
      const inv = invoiceById.get(e.sourceId);
      if (inv) {
        invoiceNumber = inv.invoiceNumber;
        invoiceStatus = inv.status;
        orderId = inv.order.orderId;
      }
    } else if (e.sourceId && e.sourceType === 'order_paid') {
      orderId = orderById.get(e.sourceId)?.orderId ?? null;
    }

    return {
      entryId: e.id,
      entryNumber: e.entryNumber,
      date: e.date,
      description: e.description,
      documentRef: e.documentRef,
      sourceType: e.sourceType ?? 'manual',
      totalHal,
      orderId,
      invoiceNumber,
      invoiceStatus,
    };
  });

  // co ještě není zaúčtované (F1 sync je idempotentní, tohle je kontrola úplnosti)
  const postedInvoiceIds = new Set(
    (
      await prisma.ledgerEntry.findMany({
        where: { sourceType: 'invoice', sourceId: { not: null } },
        select: { sourceId: true },
      })
    ).map((e) => e.sourceId as string)
  );
  const postedStornoIds = new Set(
    (
      await prisma.ledgerEntry.findMany({
        where: { sourceType: 'invoice_storno', sourceId: { not: null } },
        select: { sourceId: true },
      })
    ).map((e) => e.sourceId as string)
  );
  const postedOrderIds = new Set(
    (
      await prisma.ledgerEntry.findMany({
        where: { sourceType: 'order_paid', sourceId: { not: null } },
        select: { sourceId: true },
      })
    ).map((e) => e.sourceId as string)
  );

  const invoiceCandidates = await prisma.invoice.findMany({
    where: {
      OR: [
        { status: { in: ['issued', 'sent', 'paid'] } },
        { status: 'cancelled', order: { status: 'cancelled' } },
      ],
    },
    include: { order: { select: { status: true } } },
  });
  const unpostedInvoices = invoiceCandidates.filter((inv) =>
    // storno dává smysl jen nad zaúčtovanou fakturou — nezaúčtovanou zrušenou
    // netřeba hlásit (sync ji správně přeskočí)
    inv.order.status === 'cancelled'
      ? postedInvoiceIds.has(inv.id) && !postedStornoIds.has(inv.id)
      : !postedInvoiceIds.has(inv.id)
  ).length;

  const paidOrders = await prisma.shopOrder.findMany({
    // i zrušené zaplacené objednávky se účtují (325 závazek k vrácení)
    where: { paymentStatus: 'paid' },
    select: { id: true },
  });
  const unpostedPaidOrders = paidOrders.filter((o) => !postedOrderIds.has(o.id)).length;

  return { period, rows, unposted: { invoices: unpostedInvoices, paidOrders: unpostedPaidOrders } };
}

// ── F2: CSV ──────────────────────────────────────────────────────
// Česká konvence: středník jako oddělovač, desetinná čárka, UTF-8 BOM (Excel).

export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values: ReadonlyArray<string | number | null | undefined>): string {
  return values.map(csvCell).join(';');
}

export function halToCsvAmount(amountHal: number): string {
  const sign = amountHal < 0 ? '-' : '';
  const abs = Math.abs(amountHal);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export function csvDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
