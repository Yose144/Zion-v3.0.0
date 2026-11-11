import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { getProductViews } from '@/lib/catalog-server';
import { productById } from '@/data/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;
  const views = await getProductViews();
  return NextResponse.json({
    success: true,
    data: views.map((view) => ({
      ...view,
      name: productById(view.externalId)?.name ?? { cs: view.externalId, en: view.externalId, de: view.externalId },
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  let body: {
    externalId?: string;
    priceCzk?: number;
    oldPriceCzk?: number | null;
    stock?: number;
    active?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek.' }, { status: 400 });
  }

  const externalId = String(body.externalId ?? '').trim();
  if (!productById(externalId)) {
    return NextResponse.json({ success: false, error: 'Neznámý produkt.' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.priceCzk !== undefined) {
    const price = Number(body.priceCzk);
    if (!Number.isInteger(price) || price < 1 || price > 1_000_000) {
      return NextResponse.json({ success: false, error: 'Neplatná cena.' }, { status: 400 });
    }
    data.priceCzk = price;
  }
  if (body.oldPriceCzk !== undefined) {
    const old = body.oldPriceCzk === null ? null : Number(body.oldPriceCzk);
    if (old !== null && (!Number.isInteger(old) || old < 1 || old > 1_000_000)) {
      return NextResponse.json({ success: false, error: 'Neplatná původní cena.' }, { status: 400 });
    }
    data.oldPriceCzk = old;
  }
  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) {
      return NextResponse.json({ success: false, error: 'Neplatný sklad.' }, { status: 400 });
    }
    data.stock = stock;
  }
  if (body.active !== undefined) data.active = Boolean(body.active);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: 'Nic ke změně.' }, { status: 400 });
  }

  const updated = await prisma.product.update({ where: { externalId }, data });
  return NextResponse.json({ success: true, data: updated });
}
