import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/profile/[address]/activity — sales + bids for a user
export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address.toLowerCase();

    const [sales, bids] = await Promise.all([
      prisma.sale.findMany({
        where: {
          OR: [{ buyer: address }, { seller: address }],
        },
        include: { artifact: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.bid.findMany({
        where: { bidder: address },
        include: {
          listing: {
            include: { artifact: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const activity = [
      ...sales.map((s) => ({
        id: s.id,
        type: s.buyer.toLowerCase() === address ? 'Purchase' : 'Sale',
        item: s.artifact.name,
        price: formatPrice(s.price),
        time: s.createdAt.toISOString(),
        txHash: s.txHash,
      })),
      ...bids.map((b) => ({
        id: b.id,
        type: 'Bid',
        item: b.listing.artifact.name,
        price: formatPrice(b.amount),
        time: b.createdAt.toISOString(),
        txHash: '',
      })),
    ].sort((a, b) => +new Date(b.time) - +new Date(a.time));

    return NextResponse.json({ success: true, data: activity });
  } catch (error) {
    console.error('Failed to fetch profile activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile activity' },
      { status: 500 }
    );
  }
}

function formatPrice(wei: bigint): string {
  try {
    const n = BigInt(wei);
    const divisor = 10n ** 18n;
    const whole = n / divisor;
    const fraction = (n % divisor).toString().padStart(18, '0').slice(0, 4);
    const frac = fraction.replace(/0+$/, '') || '0';
    const value = `${whole}.${frac}`;
    return `${parseFloat(value).toLocaleString('en-US', { maximumFractionDigits: 4 })} wZION`;
  } catch {
    return `${wei} wZION`;
  }
}
