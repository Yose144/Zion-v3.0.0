import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMarketAuth, isAuthDenied } from '@/lib/zis';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { getWalletClient, getMinterAccount, getPublicClient, NFT_ADDR, contractsConfigured } from '@/lib/server-chain';
import { ARTIFACT_NFT_ABI } from '@/lib/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATEGORIES = new Set([
  'avatar', 'ship', 'ship_skin', 'quest_item', 'consumable',
  'territory', 'golden_egg', 'badge', 'music', 'art',
]);
const RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']);

function toBytes32(input: string): `0x${string}` {
  const bytes = new TextEncoder().encode(input.trim().toLowerCase());
  const padded = new Uint8Array(32);
  padded.set(bytes.slice(0, 32));
  return `0x${[...padded].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * POST /api/mint — backend-gated artifact mint.
 * The server wallet (MINTER_PRIVATE_KEY, MINTER_ROLE on ZIONArtifact) mints
 * to the authenticated user's address. Requires a ZIS session.
 *
 * Body: { to, tokenId?, amount?, category, rarity, name?, description?, imageUri?, metadataUri?, stats? }
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`mint:${clientIp(req)}`, 20, 60_000);
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
      { success: false, error: 'NFT contract not configured' },
      { status: 503 },
    );
  }

  let body: {
    to?: string;
    tokenId?: string | number;
    amount?: number;
    category?: string;
    rarity?: string;
    name?: string;
    description?: string;
    imageUri?: string;
    assetUri?: string;
    metadataUri?: string;
    stats?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const to = (body.to ?? '').toLowerCase();
  const allowed = new Set(
    [auth.primaryAddress, ...(auth.linkedAddresses ?? []).map((a) => a.address)]
      .filter(Boolean)
      .map((a) => a.toLowerCase()),
  );
  if (!allowed.has(to)) {
    return NextResponse.json(
      { success: false, error: 'to must be one of your linked addresses' },
      { status: 403 },
    );
  }

  const category = (body.category ?? 'quest_item').toLowerCase().replace(/\s+/g, '_');
  const rarity = (body.rarity ?? 'common').toLowerCase();
  if (!CATEGORIES.has(category) || !RARITIES.has(rarity)) {
    return NextResponse.json(
      { success: false, error: 'Invalid category or rarity' },
      { status: 400 },
    );
  }

  const amount = Math.max(1, Math.min(1000, Number(body.amount ?? 1)));
  const tokenId = body.tokenId != null ? BigInt(body.tokenId) : BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));

  try {
    const pub = getPublicClient();
    // Reject reuse of an already-minted token id
    const exists = await pub.readContract({
      address: NFT_ADDR,
      abi: ARTIFACT_NFT_ABI,
      functionName: 'exists',
      args: [tokenId],
    }) as boolean;
    if (exists) {
      return NextResponse.json(
        { success: false, error: `tokenId ${tokenId} already minted` },
        { status: 409 },
      );
    }

    const minter = getMinterAccount();
    const wallet = getWalletClient();
    const hash = await wallet.writeContract({
      address: NFT_ADDR,
      abi: ARTIFACT_NFT_ABI,
      functionName: 'mint',
      args: [to as `0x${string}`, tokenId, BigInt(amount), toBytes32(category), toBytes32(rarity), '0x'],
      account: minter,
      chain: wallet.chain,
    });

    // Upsert the Artifact row so the minted item is immediately listable
    const contractAddress = NFT_ADDR.toLowerCase();
    const artifact = await prisma.artifact.upsert({
      where: { contractAddress_tokenId: { contractAddress, tokenId } },
      create: {
        tokenId,
        contractAddress,
        category,
        name: body.name?.slice(0, 200) ?? `Artifact #${tokenId}`,
        description: (body.description ?? '').slice(0, 10_000),
        rarity,
        source: 'marketplace',
        imageUri: body.imageUri ?? '',
        assetUri: body.assetUri,
        metadataUri: body.metadataUri ?? '',
        stats: body.stats as never,
        creator: to,
        totalSupply: amount,
        circulatingSupply: amount,
        mintedAt: new Date(),
        ownerWallet: to,
      },
      update: {
        totalSupply: { increment: amount },
        circulatingSupply: { increment: amount },
      },
    });

    return NextResponse.json(
      { success: true, data: { txHash: hash, tokenId: tokenId.toString(), artifactId: artifact.id, minter: minter.address } },
      { status: 201 },
    );
  } catch (error) {
    console.error('Mint failed:', error);
    const msg = error instanceof Error ? error.message : 'Mint failed';
    return NextResponse.json({ success: false, error: msg.slice(0, 500) }, { status: 500 });
  }
}
