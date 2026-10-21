import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMarketAuth, isAuthDenied } from '@/lib/zis';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { getPublicClient, MARKETPLACE_ADDR, contractsConfigured } from '@/lib/server-chain';
import { MARKETPLACE_ABI } from '@/lib/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/listings/register — register an on-chain listing in the DB so it
 * appears in the marketplace UI immediately (the indexer would pick it up
 * on the next tick anyway; this makes it instant).
 *
 * Verifies: the on-chain listing exists, is active, and its seller belongs
 * to the authenticated user.
 *
 * Body: { chainListingId: string|number, txHash?: string }
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`lreg:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Rate limited', retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  const auth = await requireMarketAuth();
  if (isAuthDenied(auth)) return auth;

  if (!contractsConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Marketplace contract not configured' },
      { status: 503 },
    );
  }

  let body: { chainListingId?: string | number; txHash?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  if (body.chainListingId == null) {
    return NextResponse.json({ success: false, error: 'chainListingId required' }, { status: 400 });
  }
  const chainListingId = BigInt(body.chainListingId);

  try {
    const pub = getPublicClient();
    const onchain = await pub.readContract({
      address: MARKETPLACE_ADDR,
      abi: MARKETPLACE_ABI,
      functionName: 'getListing',
      args: [chainListingId],
    }) as {
      listingId: bigint; seller: string; nftAddress: string; tokenId: bigint;
      quantity: bigint; pricePerItem: bigint; expiryTime: bigint;
      isAuction: boolean; active: boolean;
    };

    if (!onchain.active) {
      return NextResponse.json({ success: false, error: 'Listing not active on-chain' }, { status: 400 });
    }

    const myAddrs = new Set(
      [auth.primaryAddress, ...(auth.linkedAddresses ?? []).map((a) => a.address)]
        .filter(Boolean)
        .map((a) => a.toLowerCase()),
    );
    if (!myAddrs.has(onchain.seller.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: 'On-chain seller is not your address' },
        { status: 403 },
      );
    }

    const contractAddress = onchain.nftAddress.toLowerCase();
    const artifact = await prisma.artifact.findFirst({
      where: { contractAddress: { equals: contractAddress, mode: 'insensitive' }, tokenId: onchain.tokenId },
    });
    const artifactRow = artifact ?? (await prisma.artifact.create({
      data: {
        tokenId: onchain.tokenId,
        contractAddress,
        name: `Artifact #${onchain.tokenId}`,
        description: '',
        imageUri: '',
        creator: onchain.seller.toLowerCase(),
        source: 'marketplace',
      },
    }));

    const listing = await prisma.listing.upsert({
      where: { chainListingId },
      create: {
        artifactId: artifactRow.id,
        chainListingId,
        tokenId: onchain.tokenId,
        contractAddress,
        seller: onchain.seller.toLowerCase(),
        saleType: onchain.isAuction ? 'auction' : 'fixed',
        price: onchain.pricePerItem,
        quantity: Number(onchain.quantity),
        status: 'active',
        txHash: body.txHash,
        expiresAt: onchain.expiryTime > 0n ? new Date(Number(onchain.expiryTime) * 1000) : null,
      },
      update: {
        status: 'active',
        price: onchain.pricePerItem,
        quantity: Number(onchain.quantity),
        txHash: body.txHash ?? undefined,
      },
    });

    // Keep denormalized floor price fresh
    const cheapest = await prisma.listing.findFirst({
      where: { artifactId: artifactRow.id, status: 'active' },
      orderBy: { price: 'asc' },
      select: { price: true },
    });
    await prisma.artifact.update({
      where: { id: artifactRow.id },
      data: { activePrice: cheapest?.price ?? null },
    });

    return NextResponse.json({ success: true, data: listing }, { status: 201 });
  } catch (error) {
    console.error('Listing register failed:', error);
    const msg = error instanceof Error ? error.message : 'Register failed';
    return NextResponse.json({ success: false, error: msg.slice(0, 500) }, { status: 500 });
  }
}
