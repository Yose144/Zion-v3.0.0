import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

/**
 * Admin stock — products are grouped by `digital`:
 *   - virtual (digital=true): no stock counting, only availability (`inStock`)
 *   - physical (digital=false): stock in packs/units + availability
 *
 * The catalog seed must not overwrite stock/inStock/active for existing rows —
 * those belong to the admin after the first creation.
 */
export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const products = await prisma.shopProduct.findMany({
      orderBy: [{ digital: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error('Failed to load admin products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load products' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json().catch(() => null);
    const raw = Array.isArray(body?.updates) ? body.updates : body?.id ? [body] : null;
    if (!raw || raw.length === 0) {
      return NextResponse.json({ success: false, error: 'No updates' }, { status: 400 });
    }
    if (raw.length > 200) {
      return NextResponse.json({ success: false, error: 'Too many updates' }, { status: 400 });
    }

    const updated = [];
    for (const item of raw) {
      const id = typeof item?.id === 'string' ? item.id : '';
      if (!id) continue;

      const data: {
        stock?: number;
        inStock?: boolean;
        active?: boolean;
      } = {};

      if (typeof item.stock === 'number' && Number.isInteger(item.stock) && item.stock >= 0 && item.stock <= 1_000_000) {
        data.stock = item.stock;
      }
      if (typeof item.inStock === 'boolean') data.inStock = item.inStock;
      if (typeof item.active === 'boolean') data.active = item.active;
      if (Object.keys(data).length === 0) continue;

      updated.push(
        await prisma.shopProduct.update({
          where: { id },
          data,
        })
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Failed to update admin products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update products' },
      { status: 500 }
    );
  }
}

/**
 * Bulk availability:
 *   { action: "lock-all-except", keep: ["zion-pass-001", "book-001"] }
 *   { action: "unlock-all" }
 * Useful for the launch-lock without touching every row by hand.
 */
export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json().catch(() => null);
    if (body?.action === 'lock-all-except') {
      const keep = Array.isArray(body.keep)
        ? body.keep.filter((id: unknown) => typeof id === 'string' && id.length > 0)
        : [];
      const result = await prisma.shopProduct.updateMany({
        where: { externalId: { notIn: keep } },
        data: { inStock: false },
      });
      return NextResponse.json({ success: true, action: 'lock-all-except', count: result.count, keep });
    }

    if (body?.action === 'unlock-all') {
      const result = await prisma.shopProduct.updateMany({
        data: { inStock: true },
      });
      return NextResponse.json({ success: true, action: 'unlock-all', count: result.count });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to bulk update products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to bulk update products' },
      { status: 500 }
    );
  }
}
