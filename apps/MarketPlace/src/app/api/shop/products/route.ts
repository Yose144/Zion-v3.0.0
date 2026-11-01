import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActiveTokenCampaigns, campaignTokens } from '@/lib/shop-campaign';

// GET /api/shop/products — list e-shop products with filters
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const sort = searchParams.get('sort') ?? 'recent';
  const page = parseInt(searchParams.get('page') ?? '1');
  const pageSize = parseInt(searchParams.get('pageSize') ?? '60');

  const where: Record<string, unknown> = { active: true };
  if (category) where.category = category;

  const orderBy =
    sort === 'price_low'
      ? { priceCzk: 'asc' as const }
      : sort === 'price_high'
      ? { priceCzk: 'desc' as const }
      : { createdAt: 'desc' as const };

  try {
    const [products, total, campaigns] = await Promise.all([
      prisma.shopProduct.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.shopProduct.count({ where }),
      getActiveTokenCampaigns(),
    ]);

    return NextResponse.json({
      data: products.map((p) =>
        campaigns[p.externalId] !== undefined
          ? { ...p, tokens: campaignTokens(campaigns, p.externalId, p.tokens) }
          : p,
      ),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (error) {
    console.error('Failed to fetch shop products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch shop products' },
      { status: 500 }
    );
  }
}
