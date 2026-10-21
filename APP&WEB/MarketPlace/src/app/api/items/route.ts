import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ArtifactCategory, Rarity } from '@/types';
import { requireAdminAuth } from '@/lib/admin-guard';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// GET /api/items — list artifacts with filters
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const rarity = searchParams.get('rarity');
  const source = searchParams.get('source');
  const sort = searchParams.get('sort') ?? 'recent';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20') || 20));

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (rarity) where.rarity = rarity;
  if (source) where.source = source;

  // Price sorts use the denormalized floor price (cheapest active listing),
  // maintained by the indexer / listings-register.
  const orderBy =
    sort === 'price_low'
      ? ({ activePrice: { sort: 'asc', nulls: 'last' } } as const)
      : sort === 'price_high'
        ? ({ activePrice: { sort: 'desc', nulls: 'last' } } as const)
        : sort === 'rarity'
          ? ({ rarity: 'desc' } as const)
          : ({ createdAt: 'desc' } as const);

  try {
    const [artifacts, total] = await Promise.all([
      prisma.artifact.findMany({
        where,
        include: {
          listings: {
            where: { status: 'active' },
            take: 1,
            orderBy: { price: 'asc' },
            select: {
              id: true,
              chainListingId: true,
              saleType: true,
              price: true,
              quantity: true,
              status: true,
              highestBid: true,
              bidCount: true,
              expiresAt: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.artifact.count({ where }),
    ]);

    return NextResponse.json({
      data: artifacts,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (error) {
    console.error('Failed to fetch artifacts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artifacts' },
      { status: 500 }
    );
  }
}

// POST /api/items — create artifact metadata (off-chain). Admin only;
// user-facing mints go through /api/mint.
export async function POST(req: NextRequest) {
  const denied = requireAdminAuth(req);
  if (denied) return denied;

  const rl = rateLimit(`items-post:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Rate limited', retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    if (!body?.name || body.tokenId == null || !body.contractAddress) {
      return NextResponse.json(
        { success: false, error: 'name, tokenId and contractAddress are required' },
        { status: 400 },
      );
    }

    const artifact = await prisma.artifact.create({
      data: {
        tokenId: BigInt(body.tokenId),
        contractAddress: String(body.contractAddress).toLowerCase(),
        category: body.category ?? ArtifactCategory.QuestItem,
        name: String(body.name).slice(0, 200),
        description: String(body.description ?? '').slice(0, 10_000),
        rarity: body.rarity ?? Rarity.Common,
        source: body.source ?? 'oasis',
        imageUri: body.imageUri ?? '',
        assetUri: body.assetUri,
        metadataUri: body.metadataUri ?? '',
        stats: body.stats,
        creator: String(body.creator ?? '').toLowerCase(),
        totalSupply: body.totalSupply ?? 1,
        circulatingSupply: body.totalSupply ?? 1,
      },
    });

    return NextResponse.json({ success: true, data: artifact }, { status: 201 });
  } catch (error) {
    console.error('Failed to create artifact:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create artifact' },
      { status: 500 }
    );
  }
}
