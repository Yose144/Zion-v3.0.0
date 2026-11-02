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
const RECEIVABLES = '311';
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

  const entryNumber = await nextEntryNumber(period);
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
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ['issued', 'sent', 'paid'] } },
    include: { order: true },
  });

  for (const inv of invoices) {
    const order = inv.order;
    try {
      if (order.status === 'cancelled') {
        // storno: obrácené strany, stejné částky — jen jednou
        const exists = await prisma.ledgerEntry.findFirst({
          where: { sourceType: 'invoice_storno', sourceId: inv.id },
        });
        if (exists) { res.skipped++; continue; }
        const items = (order.items as OrderItemLite[]) ?? [];
        const revLines = revenueLinesForOrder(items, order.shippingCzk ?? 0);
        const total = revLines.reduce((s, l) => s + l.amountHal, 0);
        const stornoLines: PostingLine[] = [
          { accountCode: RECEIVABLES, side: 'DAL', amountHal: total },
          ...revLines.map((l) => ({ ...l, side: 'MD' as const })),
        ];
        await postEntry({
          date: new Date(),
          description: `Storno faktury ${inv.invoiceNumber} (objednávka ${order.orderId} zrušena)`,
          documentRef: inv.invoiceNumber,
          sourceType: 'invoice_storno',
          sourceId: inv.id,
          lines: stornoLines,
          postedBy: 'auto-sync',
        });
        res.stornosPosted++;
        continue;
      }

      const items = (order.items as OrderItemLite[]) ?? [];
      const revLines = revenueLinesForOrder(items, order.shippingCzk ?? 0);
      const total = revLines.reduce((s, l) => s + l.amountHal, 0);
      const { created } = await postEntry({
        date: inv.issuedAt,
        description: `Faktura ${inv.invoiceNumber} — ${order.customerName} (${order.orderId})`,
        documentRef: inv.invoiceNumber,
        sourceType: 'invoice',
        sourceId: inv.id,
        lines: [{ accountCode: RECEIVABLES, side: 'MD', amountHal: total }, ...revLines],
        postedBy: 'auto-sync',
      });
      if (created) res.invoicesPosted++;
      else res.skipped++;
    } catch (e) {
      res.errors.push(`${inv.invoiceNumber}: ${e instanceof Error ? e.message : 'err'}`);
    }
  }

  // 2) Zaplacené objednávky → 221/159.9 / 311 (uhrada pohledávky)
  const paidOrders = await prisma.shopOrder.findMany({
    where: { paymentStatus: 'paid', status: { not: 'cancelled' } },
    include: { invoices: true },
  });

  for (const order of paidOrders) {
    // zaúčtuj platbu jen pokud existuje pohledávka z faktury — jinak přímý prodej
    const hasInvoiceEntry = order.invoices.length > 0;
    const creditAccount = hasInvoiceEntry ? RECEIVABLES : order.items
      ? (() => {
          // bez faktury: přímá úhrada výnosů — rozpad dle položek zvlášť níže
          return null;
        })()
      : null;

    const debitAccount =
      order.payment === 'crypto' ? CRYPTO_INVENTORY : BANK;

    try {
      const items = (order.items as OrderItemLite[]) ?? [];
      if (creditAccount) {
        const { created } = await postEntry({
          date: order.paidAt ?? order.updatedAt,
          description: `Úhrada objednávky ${order.orderId} (${order.payment}) — ${order.customerName}`,
          documentRef: order.invoices[0]?.invoiceNumber ?? order.orderId,
          sourceType: 'order_paid',
          sourceId: order.id,
          lines: [
            { accountCode: debitAccount, side: 'MD', amountHal: hal(order.totalCzk) },
            { accountCode: creditAccount, side: 'DAL', amountHal: hal(order.totalCzk) },
          ],
          postedBy: 'auto-sync',
        });
        if (created) res.paymentsPosted++; else res.skipped++;
      } else {
        // bez faktury — rovnou proti výnosovým účtům
        const revLines = revenueLinesForOrder(items, order.shippingCzk ?? 0);
        const total = revLines.reduce((s, l) => s + l.amountHal, 0);
        const { created } = await postEntry({
          date: order.paidAt ?? order.updatedAt,
          description: `Přímá úhrada ${order.orderId} (${order.payment}) — ${order.customerName}`,
          documentRef: order.orderId,
          sourceType: 'order_paid',
          sourceId: order.id,
          lines: [{ accountCode: debitAccount, side: 'MD', amountHal: total }, ...revLines],
          postedBy: 'auto-sync',
        });
        if (created) res.paymentsPosted++; else res.skipped++;
      }
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
