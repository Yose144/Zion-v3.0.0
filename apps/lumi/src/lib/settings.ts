import type { Prisma } from '@/generated/prisma';

type Tx = Prisma.TransactionClient;

const PREFIX = process.env.LUMI_INVOICE_PREFIX || 'LF';

/**
 * Číselná řada faktur. Drží se v `Setting` (`invoice_seq_<rok>`), aby přežila
 * restart i deploy. Volá se uvnitř transakce, která zakládá objednávku —
 * jinak by dva souběžné požadavky dostaly stejné číslo.
 */
export async function nextInvoiceNumber(tx: Tx, now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const key = `invoice_seq_${year}`;
  const current = await tx.setting.findUnique({ where: { key } });
  const next = (current ? Number.parseInt(current.value, 10) || 0 : 0) + 1;
  await tx.setting.upsert({
    where: { key },
    update: { value: String(next) },
    create: { key, value: String(next) },
  });
  return `${PREFIX}-${year}-${String(next).padStart(4, '0')}`;
}

/** Variabilní symbol z čísla objednávky — 10 číslic, stabilní. */
export function variableSymbolFor(orderId: string): string {
  let hash = 0;
  for (let i = 0; i < orderId.length; i += 1) {
    hash = (hash * 31 + orderId.charCodeAt(i)) % 10_000_000_000;
  }
  const value = hash === 0 ? 1 : hash;
  return String(value).padStart(10, '0');
}
