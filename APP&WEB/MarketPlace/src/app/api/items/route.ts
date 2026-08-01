import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ArtifactCategory, Rarity } from '@/types';

// GET /api/items — list artifacts with filters
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const rarity = searchParams.get('rarity');
  const source = searchParams.get('source');
  const sort = searchParams.get('sort') ?? 'recent';
  const page = parseInt(searchParams.get('page') ?? '1');
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20');

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (rarity) where.rarity = rarity;
  if (source) where.source = source;

  // Prisma orderBy union — typed loosely to satisfy both flat + nested shapes
  const orderBy =
    sort === 'price_low' || sort === 'price_high'
      ? ({ listings: { _count: sort === 'price_low' ? 'asc' : 'desc' } } as const)
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

// POST /api/items — create artifact metadata (off-chain)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // TODO: Validate auth (wallet signature)
    // TODO: Upload metadata to IPFS

    const artifact = await prisma.artifact.create({
      data: {
        tokenId: BigInt(body.tokenId),
        contractAddress: body.contractAddress,
        category: body.category ?? ArtifactCategory.QuestItem,
        name: body.name,
        description: body.description ?? '',
        rarity: body.rarity ?? Rarity.Common,
        source: body.source ?? 'oasis',
        imageUri: body.imageUri ?? '',
        assetUri: body.assetUri,
        metadataUri: body.metadataUri ?? '',
        stats: body.stats,
        creator: body.creator,
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
