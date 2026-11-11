import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { shopProducts } from '@/data/shopProducts';

// POST /api/shop/seed — seed the e-shop product catalog
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    // No default secret — must be explicitly configured (fail closed).
    const secret = process.env.SHOP_SEED_SECRET ?? process.env.SHOP_SEED;
    if (!secret) {
      return NextResponse.json({ success: false, error: 'Seed secret not configured' }, { status: 500 });
    }
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let count = 0;
    for (const product of shopProducts) {
      // `filesUrl` (odkaz na digitální dodávku) je v produkci nastavený
      // operátorem a v katalogu být nemusí — kdyby upsert posílal `null`,
      // zákazník po zaplacení nedostane odkaz. `undefined` = pole nechat být.
      //
      // Posíláme **jen sloupce, které model `ShopProduct` zná**. Katalog
      // může nést i prezentační pole, která do DB nepatří — rozprostření
      // celého objektu by shodilo seed na „Unknown argument“.
      const data = {
        name: product.name,
        category: product.category,
        description: product.description,
        priceCzk: product.priceCzk,
        oldPriceCzk: product.oldPriceCzk ?? null,
        image: product.image,
        badge: product.badge ?? null,
        inStock: product.inStock,
        size: product.size ?? null,
        stock: product.stock,
        tokens: product.tokens,
        modelUrl: product.modelUrl ?? null,
        filesUrl: product.filesUrl ?? undefined,
        instructionsUrl: product.instructionsUrl ?? null,
        digital: product.digital,
        active: product.active,
      };
      await prisma.shopProduct.upsert({
        where: { externalId: product.externalId },
        update: data,
        create: { externalId: product.externalId, ...data },
      });
      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Failed to seed shop products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed shop products' },
      { status: 500 }
    );
  }
}
