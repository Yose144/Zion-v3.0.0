import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import { markShopOrderPaid } from '@/lib/shop-zionpay';
import {
  revokeArchivePass,
  unrevokeArchivePass,
} from '@/lib/archive-pass';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * Bulk order actions — WooCommerce/Shopify parity.
 *
 * Lifecycle:  archive / unarchive (hide from the active list),
 *             trash / restore (soft delete), delete (hard — only orders
 *             already in trash; invoices are removed with the order and
 *             any archive pass is revoked).
 * Status:     paid runs the full paid pipeline per order (invoice,
 *             wallet, native payout, pass, emails); the other statuses
 *             are plain transitions with a statusHistory entry. Cancel
 *             also revokes the archive pass.
 */

const STATUS_ACTIONS = new Set(['processing', 'shipped', 'completed', 'cancelled']);
const ACTIONS = new Set(['archive', 'unarchive', 'trash', 'restore', 'delete', 'paid', ...STATUS_ACTIONS]);

interface BulkBody {
  ids?: string[];
  action?: string;
}

function appendHistory(
  existing: unknown,
  entry: Record<string, unknown>,
): Prisma.InputJsonValue {
  const hist = Array.isArray(existing) ? [...existing] : [];
  hist.push(entry);
  return hist as Prisma.InputJsonValue;
}

export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const body = (await request.json()) as BulkBody;
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string') : [];
    const action = body.action ?? '';

    if (!ACTIONS.has(action)) {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }
    if (ids.length === 0 || ids.length > 250) {
      return NextResponse.json(
        { success: false, error: 'ids required (1..250)' },
        { status: 400 }
      );
    }

    const orders = await prisma.shopOrder.findMany({
      where: { OR: [{ id: { in: ids } }, { orderId: { in: ids } }] },
    });
    if (orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No matching orders' },
        { status: 404 }
      );
    }

    const now = new Date();
    const results: { orderId: string; ok: boolean; error?: string }[] = [];

    for (const order of orders) {
      try {
        switch (action) {
          case 'archive':
            await prisma.shopOrder.update({
              where: { id: order.id },
              data: { archivedAt: now },
            });
            break;
          case 'unarchive':
            await prisma.shopOrder.update({
              where: { id: order.id },
              data: { archivedAt: null },
            });
            break;
          case 'trash': {
            // Trash is a reversible soft-delete: the order is not cancelled
            // and the customer keeps the pass they paid for. Revoking here
            // killed the ZAP code permanently while `restore` did not bring
            // it back (real bug 2026-11-03 — customers saw "pass expired"
            // after an admin tidied the order list). Revocation belongs to
            // `cancelled` and permanent `delete` only.
            await prisma.shopOrder.update({
              where: { id: order.id },
              data: { deletedAt: now },
            });
            break;
          }
          case 'restore': {
            await prisma.shopOrder.update({
              where: { id: order.id },
              data: { deletedAt: null },
            });
            // Orders trashed before the fix above still carry a revoked
            // pass — restoring the order restores the customer's code.
            try {
              unrevokeArchivePass(order.orderId);
            } catch (err) {
              console.error('Archive pass unrevoke failed:', err);
            }
            break;
          }
          case 'delete': {
            // Shopify parity: permanent delete only from trash.
            if (!order.deletedAt) {
              results.push({
                orderId: order.orderId,
                ok: false,
                error: 'Order must be in trash first',
              });
              continue;
            }
            try {
              revokeArchivePass(order.orderId);
            } catch (err) {
              console.error('Archive pass revoke failed:', err);
            }
            await prisma.$transaction([
              prisma.invoice.deleteMany({ where: { orderId: order.id } }),
              prisma.shopSetting.deleteMany({
                where: {
                  key: { in: [`tokens:${order.orderId}`, `zionpay:${order.orderId}`] },
                },
              }),
              prisma.shopOrder.delete({ where: { id: order.id } }),
            ]);
            break;
          }
          case 'paid': {
            const res = await markShopOrderPaid(order.orderId, { by: 'admin-bulk' });
            if (!res.ok) {
              results.push({ orderId: order.orderId, ok: false, error: res.error });
              continue;
            }
            break;
          }
          default: {
            // processing | shipped | completed | cancelled
            if (order.status === action) break;
            const data: Prisma.ShopOrderUpdateInput = {
              status: action,
              statusHistory: appendHistory(order.statusHistory, {
                status: action,
                paymentStatus: order.paymentStatus,
                at: now.toISOString(),
                by: 'admin-bulk',
              }),
            };
            if (action === 'shipped') data.shippedAt = now;
            await prisma.shopOrder.update({ where: { id: order.id }, data });
            if (action === 'cancelled') {
              try {
                revokeArchivePass(order.orderId);
              } catch (err) {
                console.error('Archive pass revoke failed:', err);
              }
            } else if (order.status === 'cancelled') {
              // Reopening a cancelled order (any non-cancel transition) puts
              // the customer's pass back in force — symmetry with cancel.
              try {
                unrevokeArchivePass(order.orderId);
              } catch (err) {
                console.error('Archive pass unrevoke failed:', err);
              }
            }
            break;
          }
        }
        results.push({ orderId: order.orderId, ok: true });
      } catch (err) {
        results.push({
          orderId: order.orderId,
          ok: false,
          error: err instanceof Error ? err.message : 'Action failed',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        total: orders.length,
        okCount: results.filter((r) => r.ok).length,
        results,
      },
    });
  } catch (error) {
    console.error('Bulk order action failed:', error);
    return NextResponse.json(
      { success: false, error: 'Bulk action failed' },
      { status: 500 }
    );
  }
}
