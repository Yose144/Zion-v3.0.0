/**
 * Pokladna: co smí vidět opakovaný požadavek a jak se rezervuje sklad.
 *
 * Dvě díry, které tu žily vedle sebe:
 *  - stejné `orderId` vracelo skoro celý řádek (jméno, adresa, peněženka,
 *    podpis ohně) každému, kdo ho zopakoval;
 *  - sklad se kontroloval po řádcích a odečítal nepodmíněně, takže dva řádky
 *    po jednom kusu prošly proti poslednímu kusu a souběh ho prodal dvakrát.
 *
 * Shoda e-mailu pouze omezuje replay; neprokazuje vlastnictví schránky.
 * Ani při shodě se nevrací soukromé údaje nebo přístupové kódy.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

export interface OrderQuantityLine {
  externalId: string;
  quantity: number;
}

export interface PublicOrderFields {
  id: string;
  orderId: string;
  status: string;
  totalCzk: number;
  createdAt: Date;
  customerEmail: string;
}

export interface PublicBank {
  account: string;
  iban: string;
  bic: string;
}

export class StockConflictError extends Error {
  readonly code = 'STOCK_CONFLICT';
  constructor(readonly externalId: string) {
    super(`out of stock: ${externalId}`);
    this.name = 'StockConflictError';
  }
}

export class InvalidQuantityError extends Error {
  constructor() {
    super('Each product quantity must be an integer from 1 to 99');
    this.name = 'InvalidQuantityError';
  }
}

interface StockWrite {
  shopProduct: {
    updateMany: (args: {
      where: {
        externalId: string | { in: string[] };
        stock: { gte: number } | { lte: number };
        active?: boolean;
        inStock?: boolean;
      };
      data: {
        stock?: { decrement: number };
        inStock?: boolean;
      };
    }) => Promise<{ count: number }>;
  };
}

/** Variabilní symbol z čísla objednávky — stejné pravidlo jako na faktuře. */
export function variableSymbol(orderId: string): string {
  return orderId.match(/(\d{10})/)?.[1] ?? orderId.replace(/\D/g, '').slice(0, 10);
}

function emailDigest(email: string): Buffer {
  return createHash('sha256').update(email.trim().toLowerCase()).digest();
}

/** Shoda e-mailu bez zkratky na prvním rozdílném znaku. */
export function emailsMatch(stored: string, provided: string): boolean {
  return timingSafeEqual(emailDigest(stored), emailDigest(provided));
}

/**
 * Součet kusů podle produktu. Dva řádky téhož `externalId` jsou jeden nárok
 * na sklad, ne dva nezávislé.
 */
export function aggregateOrderQuantities(lines: OrderQuantityLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line || typeof line.externalId !== 'string' || !line.externalId.trim()
        || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
      throw new InvalidQuantityError();
    }
    const total = (totals.get(line.externalId) ?? 0) + line.quantity;
    if (total > 99) throw new InvalidQuantityError();
    totals.set(line.externalId, total);
  }
  // All checkouts acquire product locks in the same order.
  return new Map([...totals].sort(([a], [b]) => a.localeCompare(b)));
}

/** Explicit public acknowledgement. Never spread a Prisma order row. */
export function orderAcknowledgement(order: Omit<PublicOrderFields, 'customerEmail'>) {
  return {
    id: order.id,
    orderId: order.orderId,
    status: order.status,
    totalCzk: order.totalCzk,
    createdAt: order.createdAt,
  };
}

/**
 * Odpověď na opakované orderId.
 * Shoda e-mailu: jen stav a veřejný bankovní blok.
 * Neshoda: 409, žádné pole zákazníka.
 */
export function duplicateOrderDecision(
  order: PublicOrderFields,
  requestEmail: string,
  bank: PublicBank,
): { status: 200 | 409; body: Record<string, unknown> } {
  if (!emailsMatch(order.customerEmail, requestEmail)) {
    return {
      status: 409,
      body: { success: false, duplicate: true, error: 'Order already exists' },
    };
  }
  return {
    status: 200,
    body: {
      success: true,
      duplicate: true,
      data: {
        order: orderAcknowledgement(order),
        invoice: null,
        duplicate: true,
        bank: {
          account: bank.account,
          iban: bank.iban,
          bic: bank.bic,
          vs: variableSymbol(order.orderId),
          amount: order.totalCzk,
          qrCode: null,
        },
      },
    },
  };
}

/**
 * Odečte sklad jen když ho zbývá dost. `count !== 1` = řádek nesplnil
 * podmínku (nebo neexistuje) a transakce se má vrátit. Vyprodaný řádek
 * dostane `inStock: false` ve stejném zápisu.
 */
export async function reserveProductStock(
  tx: StockWrite,
  quantities: Iterable<[string, number]>,
): Promise<void> {
  const entries = [...quantities].sort(([a], [b]) => a.localeCompare(b));
  for (const [externalId, quantity] of entries) {
    const updated = await tx.shopProduct.updateMany({
      where: { externalId, active: true, inStock: true, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (updated.count !== 1) throw new StockConflictError(externalId);
  }
  if (entries.length === 0) return;
  await tx.shopProduct.updateMany({
    where: { externalId: { in: entries.map(([id]) => id) }, stock: { lte: 0 } },
    data: { inStock: false },
  });
}
