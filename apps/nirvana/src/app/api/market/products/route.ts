import { NextResponse } from 'next/server';

const PRODUCTS_URL =
  process.env.ZION_MARKET_PRODUCTS_URL ??
  'https://market.zionterranova.com/api/shop/products?pageSize=60';

interface ShelfItem {
  id: string;
  name: string;
  category: string;
  priceCzk: number;
  inStock: boolean;
}

function shelf(payload: unknown): ShelfItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const rows = (payload as { data?: unknown }).data;
  if (!Array.isArray(rows)) return [];
  const items: ShelfItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    if (typeof rec.id !== 'string' || typeof rec.name !== 'string') continue;
    if (typeof rec.priceCzk !== 'number') continue;
    items.push({
      id: rec.id,
      name: rec.name,
      category: typeof rec.category === 'string' ? rec.category : '',
      priceCzk: rec.priceCzk,
      inStock: rec.inStock !== false,
    });
  }
  return items;
}

export async function GET() {
  try {
    const res = await fetch(PRODUCTS_URL, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return NextResponse.json({ products: [] }, { status: 502 });
    const products = shelf(await res.json());
    return NextResponse.json({ products }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ products: [] }, { status: 502 });
  }
}
