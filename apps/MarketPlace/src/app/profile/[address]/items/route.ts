import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/profile/[address]/items — artifacts + listings for a user
export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address.toLowerCase();

    const [created, listed, profile] = await Promise.all([
      prisma.artifact.findMany({
        where: { creator: address },
        include: {
          listings: {
            where: { status: 'active' },
            take: 1,
            orderBy: { price: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.listing.findMany({
        where: { seller: address, status: 'active' },
        include: { artifact: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.userProfile.findUnique({
        where: { address },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        created,
        listed,
        stats: {
          owned: profile?.itemsOwned ?? created.length,
          listedCount: listed.length,
          volume: formatVolume(profile?.totalSales ?? 0),
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch profile items:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile items' },
      { status: 500 }
    );
  }
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
