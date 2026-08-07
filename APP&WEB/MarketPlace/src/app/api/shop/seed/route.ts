import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { shopProducts } from '@/data/shopProducts';

// POST /api/shop/seed — seed the e-shop product catalog
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    const secret =
      process.env.SHOP_SEED_SECRET ?? process.env.SHOP_SEED ?? 'zion-dev-seed';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let count = 0;
    for (const product of shopProducts) {
      await prisma.shopProduct.upsert({
        where: { externalId: product.externalId },
        update: product,
        create: product,
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
