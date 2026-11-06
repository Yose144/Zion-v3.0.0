/**
 * Vrácení skladu při zrušení objednávky.
 *
 * Objednávka při vytvoření **odečítá** sklad (`stock: decrement`) a při
 * zrušení ho musí **přidat zpět**. Dřív to nedělalo nic: zrušená objednávka
 * držela kus navěky a produkt se mohl tvářit jako vyprodaný (oversell riziko
 * naopak u otevřené objednávky). Od 2026-11-06 to řeší jeden soubor, protože
 * zrušit objednávku jde **ze dvou míst**:
 *
 *   - detail objednávky (`/api/admin/orders/[id]/status`),
 *   - hromadná akce (`/api/admin/orders/bulk`, akce `cancelled`).
 *
 * Když se to druhé zapomnělo, hromadné zrušení sklad nevrátilo — a nikdo si
 * toho nevšiml, protože se to neprojeví hned, ale až při dalším prodeji.
 *
 * Pravidla:
 *  1. **Idempotence je na volajícím.** Funkce sklad jen přičte; kdo ji volá,
 *     musí mít atomický claim (`updateMany` s `status != cancelled`), aby
 *     dvojí cancel nepřidal kus dvakrát.
 *  2. **Nikdy neshodit zrušení objednávky.** Když produkt mezitím zmizel,
 *     zrušení musí projít a jen se zaloguje chyba.
 *  3. **Zaplacená faktura zůstává.** Peníze se pohnuly, vrácení je samostatný
 *     proces (dobropis), ne tichá změna stavu. Ruší se jen nezaplacené.
 */

import { prisma } from '@/lib/db';

export interface StockLine {
  externalId: string;
  quantity: number;
}

/** Položky objednávky → řádky skladu (bez neplatných hodnot). */
export function orderStockLines(items: unknown): StockLine[] {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((item) => {
      const record = item as { externalId?: unknown; quantity?: unknown };
      return {
        externalId: typeof record?.externalId === 'string' ? record.externalId.trim() : '',
        quantity: Number(record?.quantity ?? 0),
      };
    })
    .filter((line) => line.externalId && Number.isFinite(line.quantity) && line.quantity > 0);
}

/**
 * Vrátí sklad a zruší nezaplacené faktury objednávky.
 * Volat **jen** když je zrušení prokazatelně poprvé (claim prošel).
 */
export async function releaseOrderStock(order: {
  id: string;
  items: unknown;
}): Promise<void> {
  const lines = orderStockLines(order.items);
  if (lines.length === 0) {
    // Digitální objednávka bez skladu — pořád je co rušit (faktura).
    await cancelUnpaidInvoices(order.id);
    return;
  }

  try {
    await prisma.$transaction(
      lines.map((line) =>
        prisma.shopProduct.update({
          where: { externalId: line.externalId },
          data: { stock: { increment: line.quantity } },
        }),
      ),
    );
    // Produkt, který se mezitím vyprodal, je zase skladem.
    await prisma.shopProduct.updateMany({
      where: {
        externalId: { in: lines.map((line) => line.externalId) },
        stock: { gt: 0 },
        inStock: false,
      },
      data: { inStock: true },
    });
  } catch (err) {
    // Produkt mohl být smazaný — zrušení objednávky kvůli tomu nesmí selhat.
    console.error('Stock restore on cancel failed:', err);
  }

  await cancelUnpaidInvoices(order.id);
}

async function cancelUnpaidInvoices(orderDatabaseId: string): Promise<void> {
  try {
    await prisma.invoice.updateMany({
      where: { orderId: orderDatabaseId, status: { in: ['draft', 'issued'] } },
      data: { status: 'cancelled' },
    });
  } catch (err) {
    console.error('Invoice cancel failed:', err);
  }
}
