import { prisma } from '@/lib/db';
import { orderToLike } from '@/lib/order';
import { sendOrderConfirmation } from '@/lib/email';
import { parseJson } from '@/lib/utils';

interface HistoryEntry {
  status: string;
  at: string;
  by: string;
  note?: string;
}

export function appendHistory(raw: string | null, entry: HistoryEntry): string {
  const history = parseJson<HistoryEntry[]>(raw, []);
  history.push(entry);
  return JSON.stringify(history.slice(-50));
}

/**
 * Označí objednávku jako zaplacenou. Idempotentní — webhook i ruční potvrzení
 * mohou přijít vícekrát a e-mail se pošle jen při prvním přechodu.
 */
export async function markOrderPaid(orderId: string, by = 'system'): Promise<boolean> {
  const existing = await prisma.order.findUnique({ where: { orderId } });
  if (!existing) return false;
  if (existing.paymentStatus === 'paid') return true;

  const updated = await prisma.order.update({
    where: { orderId },
    data: {
      paymentStatus: 'paid',
      status: existing.status === 'pending' ? 'paid' : existing.status,
      paidAt: new Date(),
      statusHistory: appendHistory(existing.statusHistory, {
        status: 'paid',
        at: new Date().toISOString(),
        by,
      }),
    },
  });

  void sendOrderConfirmation(orderToLike(updated), { paid: true }).catch((error) => console.error(error));
  return true;
}

export async function setOrderStatus(
  orderId: string,
  status: string,
  by: string,
  note?: string,
): Promise<boolean> {
  const existing = await prisma.order.findUnique({ where: { orderId } });
  if (!existing) return false;
  await prisma.order.update({
    where: { orderId },
    data: {
      status,
      statusHistory: appendHistory(existing.statusHistory, {
        status,
        at: new Date().toISOString(),
        by,
        ...(note ? { note } : {}),
      }),
    },
  });
  return true;
}
