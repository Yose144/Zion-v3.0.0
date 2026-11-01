import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats — real marketplace aggregates for the homepage panels.
 * No auth required (public stats). Values come straight from the DB —
 * zeros are honest, the market only opens with OASIS.
 */
export async function GET() {
  const [artifacts, activeListings, activeAuctions, salesAgg, holders, categoryGroups] =
    await Promise.all([
      prisma.artifact.count(),
      prisma.listing.count({ where: { status: 'active' } }),
      prisma.listing.count({ where: { status: 'active', saleType: 'auction' } }),
      prisma.sale.aggregate({ _sum: { price: true }, _count: true }),
      prisma.artifact.findMany({
        where: { ownerWallet: { not: null } },
        select: { ownerWallet: true },
        distinct: ['ownerWallet'],
      }),
      prisma.artifact.groupBy({ by: ['category'], _count: { _all: true } }),
    ]);

  const categories: Record<string, number> = {};
  for (const g of categoryGroups) categories[g.category] = g._count._all;

  const volumeWei = salesAgg._sum.price ?? 0n;
  return NextResponse.json({
    artifacts,
    activeListings,
    activeAuctions,
    sales: salesAgg._count,
    volumeWei: volumeWei.toString(),
    volumeWzion: Number(volumeWei) / 1e18,
    holders: holders.length,
    categories,
  });
}
