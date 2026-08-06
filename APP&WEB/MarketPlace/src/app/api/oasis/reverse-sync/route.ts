import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  notifyMarketSale,
  notifyMarketListing,
  notifyTerritoryTransfer,
  notifyGoldenEggClaim,
  notifyAvatarMint,
} from '@/lib/oasis-api';

/**
 * POST /api/oasis/reverse-sync — Market → OASIS bidirectional sync
 *
 * Notifies the OASIS game service about marketplace events so the game
 * state stays in sync.  This is the reverse direction of GET /api/oasis/sync.
 *
 * Body:
 *   { event: 'sale' | 'listing' | 'territory_transfer' | 'golden_egg_claim' | 'avatar_mint',
 *     ...event-specific fields }
 *
 * Events:
 *   sale:              { saleId, buyerAddress, sellerAddress, contractAddress, tokenId, price, txHash? }
 *   listing:           { listingId, sellerAddress, contractAddress, tokenId, price, saleType }
 *   territory_transfer:{ territoryId, newController, previousController?, txHash? }
 *   golden_egg_claim:  { buyerAddress, tierRank, txHash? }
 *   avatar_mint:       { avatarId, owner, txHash? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event } = body as { event: string };

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'event type is required' },
        { status: 400 },
      );
    }

    const results: Record<string, unknown> = { event };

    switch (event) {
      case 'sale': {
        const {
          saleId,
          buyerAddress,
          sellerAddress,
          contractAddress,
          tokenId,
          price,
          txHash,
        } = body as {
          saleId?: string;
          buyerAddress: string;
          sellerAddress: string;
          contractAddress: string;
          tokenId: string;
          price: string;
          txHash?: string;
        };

        if (!buyerAddress || !sellerAddress || !contractAddress || !tokenId) {
          return NextResponse.json(
            { success: false, error: 'buyerAddress, sellerAddress, contractAddress, tokenId are required' },
            { status: 400 },
          );
        }

        // Look up artifact to get category and name
        const artifact = await prisma.artifact.findUnique({
          where: {
            contractAddress_tokenId: {
              contractAddress,
              tokenId: BigInt(tokenId),
            },
          },
        });

        const category = artifact?.category ?? 'unknown';
        const name = artifact?.name ?? `Token #${tokenId}`;

        // Notify OASIS
        const oasisResult = await notifyMarketSale({
          buyerAddress,
          sellerAddress,
          artifactCategory: category,
          artifactName: name,
          contractAddress,
          tokenId,
          price,
          txHash,
        });

        results.notified = oasisResult !== null;
        results.oasisResponse = oasisResult;

        // If it's a territory sale, also notify territory transfer
        if (category === 'territory' && artifact?.source === 'oasis') {
          const territoryResult = await notifyTerritoryTransfer({
            territoryId: String(artifact.tokenId),
            newController: buyerAddress,
            previousController: sellerAddress,
            txHash,
          });
          results.territoryTransfer = territoryResult;
        }

        // If it's a golden egg sale, also notify golden egg claim
        if (category === 'golden_egg' && artifact?.source === 'oasis') {
          const goldenEggResult = await notifyGoldenEggClaim({
            buyerAddress,
            tierRank: Number(artifact.tokenId),
            txHash,
          });
          results.goldenEggClaim = goldenEggResult;
        }

        // If it's an avatar sale, also notify avatar mint
        if (category === 'avatar' && artifact?.source === 'oasis') {
          const avatarResult = await notifyAvatarMint({
            avatarId: Number(artifact.tokenId),
            owner: buyerAddress,
            txHash,
          });
          results.avatarMint = avatarResult;
        }

        break;
      }

      case 'listing': {
        const {
          listingId,
          sellerAddress,
          contractAddress,
          tokenId,
          price,
          saleType,
        } = body as {
          listingId?: string;
          sellerAddress: string;
          contractAddress: string;
          tokenId: string;
          price: string;
          saleType: string;
        };

        if (!sellerAddress || !contractAddress || !tokenId) {
          return NextResponse.json(
            { success: false, error: 'sellerAddress, contractAddress, tokenId are required' },
            { status: 400 },
          );
        }

        const artifact = await prisma.artifact.findUnique({
          where: {
            contractAddress_tokenId: {
              contractAddress,
              tokenId: BigInt(tokenId),
            },
          },
        });

        const category = artifact?.category ?? 'unknown';

        const oasisResult = await notifyMarketListing({
          sellerAddress,
          artifactCategory: category,
          contractAddress,
          tokenId,
          price,
          saleType: saleType ?? 'fixed',
        });

        results.notified = oasisResult !== null;
        results.oasisResponse = oasisResult;
        break;
      }

      case 'territory_transfer': {
        const { territoryId, newController, previousController, txHash } = body as {
          territoryId: string;
          newController: string;
          previousController?: string;
          txHash?: string;
        };

        if (!territoryId || !newController) {
          return NextResponse.json(
            { success: false, error: 'territoryId and newController are required' },
            { status: 400 },
          );
        }

        const oasisResult = await notifyTerritoryTransfer({
          territoryId,
          newController,
          previousController,
          txHash,
        });

        results.notified = oasisResult !== null;
        results.oasisResponse = oasisResult;
        break;
      }

      case 'golden_egg_claim': {
        const { buyerAddress, tierRank, txHash } = body as {
          buyerAddress: string;
          tierRank: number;
          txHash?: string;
        };

        if (!buyerAddress || tierRank === undefined) {
          return NextResponse.json(
            { success: false, error: 'buyerAddress and tierRank are required' },
            { status: 400 },
          );
        }

        const oasisResult = await notifyGoldenEggClaim({
          buyerAddress,
          tierRank,
          txHash,
        });

        results.notified = oasisResult !== null;
        results.oasisResponse = oasisResult;
        break;
      }

      case 'avatar_mint': {
        const { avatarId, owner, txHash } = body as {
          avatarId: number;
          owner: string;
          txHash?: string;
        };

        if (avatarId === undefined || !owner) {
          return NextResponse.json(
            { success: false, error: 'avatarId and owner are required' },
            { status: 400 },
          );
        }

        const oasisResult = await notifyAvatarMint({
          avatarId,
          owner,
          txHash,
        });

        results.notified = oasisResult !== null;
        results.oasisResponse = oasisResult;
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown event type: ${event}` },
          { status: 400 },
        );
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('OASIS reverse-sync failed:', error);
    return NextResponse.json(
      { success: false, error: 'Reverse sync failed' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/oasis/reverse-sync — Check reverse sync status
 *
 * Returns whether the OASIS game service is reachable for reverse sync.
 */
export async function GET() {
  try {
    const oasisApiUrl = process.env.OASIS_API_URL ?? 'http://127.0.0.1:8094';
    const res = await fetch(`${oasisApiUrl}/api/v1/oasis/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const reachable = res.ok;
    return NextResponse.json({
      success: true,
      reachable,
      endpoint: `${oasisApiUrl}/api/v1/oasis`,
      events: ['sale', 'listing', 'territory_transfer', 'golden_egg_claim', 'avatar_mint'],
    });
  } catch {
    return NextResponse.json({
      success: true,
      reachable: false,
      endpoint: (process.env.OASIS_API_URL ?? 'http://127.0.0.1:8094') + '/api/v1/oasis',
      events: ['sale', 'listing', 'territory_transfer', 'golden_egg_claim', 'avatar_mint'],
    });
  }
}
