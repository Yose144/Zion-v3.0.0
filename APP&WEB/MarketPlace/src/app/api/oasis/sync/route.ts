import { NextRequest, NextResponse } from 'next/server';
import {
  getQuests,
  getPlayerQuests,
  getAvatars,
  getPrizeTiers,
  getTerritories,
  avatarToArtifactMetadata,
  questToArtifactMetadata,
  prizeTierToArtifactMetadata,
  territoryToArtifactMetadata,
  type AvatarDef,
  type QuestDef,
  type PrizeTier,
  type Territory,
} from '@/lib/oasis-api';
import { uploadArtifactMetadata } from '@/lib/ipfs';
import { prisma } from '@/lib/db';

/**
 * GET /api/oasis/sync — fetch OASIS game data and sync to marketplace DB
 *
 * Query params:
 *   type = avatars | quests | prizes | territories | all (default: all)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'all';

  try {
    const results: Record<string, number> = {};

    if (type === 'all' || type === 'avatars') {
      const avatars = await getAvatars();
      if (avatars) {
        let count = 0;
        for (const avatar of avatars) {
          await prisma.artifact.upsert({
            where: {
              contractAddress_tokenId: {
                contractAddress: 'oasis-avatar',
                tokenId: BigInt(avatar.id),
              },
            },
            create: {
              tokenId: BigInt(avatar.id),
              contractAddress: 'oasis-avatar',
              category: 'avatar',
              name: avatar.name,
              description: avatar.subtitle,
              rarity: avatar.rarity.toLowerCase(),
              source: 'oasis',
              imageUri: '',
              creator: 'oasis-game',
              totalSupply: 1,
              circulatingSupply: 1,
            },
            update: {
              name: avatar.name,
              description: avatar.subtitle,
              rarity: avatar.rarity.toLowerCase(),
            },
          });
          count++;
        }
        results.avatars = count;
      }
    }

    if (type === 'all' || type === 'quests') {
      const quests = await getQuests();
      if (quests) {
        let count = 0;
        for (const quest of quests) {
          await prisma.artifact.upsert({
            where: {
              contractAddress_tokenId: {
                contractAddress: 'oasis-quest',
                tokenId: BigInt(hashToId(quest.quest_id)),
              },
            },
            create: {
              tokenId: BigInt(hashToId(quest.quest_id)),
              contractAddress: 'oasis-quest',
              category: 'quest_item',
              name: `Quest: ${quest.title}`,
              description: quest.description,
              rarity: 'rare',
              source: 'oasis',
              imageUri: '',
              creator: 'oasis-game',
              totalSupply: 1,
              circulatingSupply: 1,
            },
            update: {
              name: `Quest: ${quest.title}`,
              description: quest.description,
            },
          });
          count++;
        }
        results.quests = count;
      }
    }

    if (type === 'all' || type === 'prizes') {
      const prizeConfig = await getPrizeTiers();
      if (prizeConfig) {
        let count = 0;
        for (const tier of prizeConfig.tiers) {
          await prisma.artifact.upsert({
            where: {
              contractAddress_tokenId: {
                contractAddress: 'oasis-golden-egg',
                tokenId: BigInt(tier.rank),
              },
            },
            create: {
              tokenId: BigInt(tier.rank),
              contractAddress: 'oasis-golden-egg',
              category: 'golden_egg',
              name: `${tier.title} — Golden Egg Prize`,
              description: `Rank ${tier.rank}: ${tier.zion} ZION + ${tier.flowers} FLOWERS. ${tier.nft_reward}`,
              rarity: tier.rank <= 3 ? 'mythic' : tier.rank <= 10 ? 'legendary' : 'epic',
              source: 'oasis',
              imageUri: '',
              creator: 'oasis-game',
              totalSupply: 1,
              circulatingSupply: 1,
            },
            update: {
              name: `${tier.title} — Golden Egg Prize`,
              description: `Rank ${tier.rank}: ${tier.zion} ZION + ${tier.flowers} FLOWERS. ${tier.nft_reward}`,
            },
          });
          count++;
        }
        results.prizes = count;
      }
    }

    if (type === 'all' || type === 'territories') {
      const territoryMap = await getTerritories();
      if (territoryMap) {
        let count = 0;
        for (const [id, territory] of Object.entries(territoryMap.territories)) {
          await prisma.artifact.upsert({
            where: {
              contractAddress_tokenId: {
                contractAddress: 'oasis-territory',
                tokenId: BigInt(hashToId(id)),
              },
            },
            create: {
              tokenId: BigInt(hashToId(id)),
              contractAddress: 'oasis-territory',
              category: 'territory',
              name: `Territory: ${territory.name}`,
              description: territory.description,
              rarity: territory.defense_power > 500 ? 'legendary' : territory.defense_power > 100 ? 'rare' : 'uncommon',
              source: 'oasis',
              imageUri: '',
              creator: 'oasis-game',
              totalSupply: 1,
              circulatingSupply: 1,
            },
            update: {
              name: `Territory: ${territory.name}`,
              description: territory.description,
            },
          });
          count++;
        }
        results.territories = count;
      }
    }

    return NextResponse.json({ success: true, synced: results });
  } catch (error) {
    console.error('OASIS sync failed:', error);
    return NextResponse.json(
      { success: false, error: 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/oasis/mint — mint an NFT from an OASIS game artifact
 *
 * Body:
 *   { type: 'avatar' | 'quest' | 'prize' | 'territory', id: string, recipient: address }
 *
 * 1. Fetch artifact data from OASIS API
 * 2. Upload metadata to IPFS
 * 3. Return metadata URI for client-side minting via smart contract
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, id, recipient } = body as {
      type: 'avatar' | 'quest' | 'prize' | 'territory';
      id: string;
      recipient: string;
    };

    if (!type || !id || !recipient) {
      return NextResponse.json(
        { success: false, error: 'type, id, and recipient are required' },
        { status: 400 }
      );
    }

    let metadata: ReturnType<
      typeof avatarToArtifactMetadata |
      typeof questToArtifactMetadata |
      typeof prizeTierToArtifactMetadata |
      typeof territoryToArtifactMetadata
    > | null = null;

    switch (type) {
      case 'avatar': {
        const avatars = await getAvatars();
        const avatar = avatars?.find((a) => String(a.id) === id);
        if (!avatar) {
          return NextResponse.json({ success: false, error: 'Avatar not found' }, { status: 404 });
        }
        metadata = avatarToArtifactMetadata(avatar);
        break;
      }
      case 'quest': {
        const quests = await getQuests();
        const quest = quests?.find((q) => q.quest_id === id);
        if (!quest) {
          return NextResponse.json({ success: false, error: 'Quest not found' }, { status: 404 });
        }
        metadata = questToArtifactMetadata(quest, quest.xp_reward);
        break;
      }
      case 'prize': {
        const prizeConfig = await getPrizeTiers();
        const tier = prizeConfig?.tiers.find((t) => String(t.rank) === id);
        if (!tier) {
          return NextResponse.json({ success: false, error: 'Prize tier not found' }, { status: 404 });
        }
        metadata = prizeTierToArtifactMetadata(tier);
        break;
      }
      case 'territory': {
        const territoryMap = await getTerritories();
        const territory = territoryMap?.territories[id];
        if (!territory) {
          return NextResponse.json({ success: false, error: 'Territory not found' }, { status: 404 });
        }
        metadata = territoryToArtifactMetadata(territory);
        break;
      }
      default:
        return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
    }

    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Failed to build metadata' }, { status: 500 });
    }

    // Upload metadata to IPFS (skip if no Pinata keys configured)
    let ipfsUri = '';
    try {
      const ipfsResult = await uploadArtifactMetadata(metadata);
      ipfsUri = ipfsResult.uri;
    } catch (e) {
      console.warn('IPFS upload skipped (no keys?):', e);
    }

    return NextResponse.json({
      success: true,
      metadata,
      ipfsUri,
      recipient,
      // Client should call ZIONArtifact.mint(recipient, tokenId, amount, category, rarity, data)
      // where data = abi.encode(ipfsUri)
      mintParams: {
        to: recipient,
        amount: 1,
        category: metadata.properties.category,
        rarity: metadata.properties.rarity,
        metadataUri: ipfsUri,
      },
    });
  } catch (error) {
    console.error('OASIS mint failed:', error);
    return NextResponse.json(
      { success: false, error: 'Mint failed' },
      { status: 500 }
    );
  }
}

// Helper: hash a string to a uint256-safe numeric ID
function hashToId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
