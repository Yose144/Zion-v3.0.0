// ── L2 Marketplace event indexer ─────────────────────────────────────
// Scans ZIONMarketplace logs on Base L2 and syncs them into Postgres:
//   ListingCreated    → upsert Listing (chainListingId link) + activePrice
//   ListingPurchased  → decrement qty / mark sold + Sale row
//   L1Settled         → same as purchase (paid on L1)
//   ListingCancelled  → status cancelled
//   BidPlaced         → Bid row + listing.highestBid{,der} + bidCount
//   AuctionSettled    → status sold + Sale row
//
// Idempotent via EventLog @@unique([txHash, logIndex]). State is kept in
// ShopSetting key `l2_indexer_block`. Blocks trail the tip by
// L2_CONFIRMATIONS for reorg safety.

import { decodeEventLog, type Log, type PublicClient } from 'viem';
import type { PrismaClient } from '@prisma/client';
import { MARKETPLACE_EVENT_ABIS } from '@/lib/contracts';
import { getPublicClient, MARKETPLACE_ADDR } from '@/lib/server-chain';

const STATE_KEY = 'l2_indexer_block';
const CHAIN_KEY = 'l2_indexer_chain';
// Public Base RPCs limit eth_getLogs to ~200 blocks; configurable for paid RPCs.
const CHUNK = BigInt(process.env.INDEXER_LOG_CHUNK ?? '200');
const CONFIRMATIONS = BigInt(process.env.L2_CONFIRMATIONS ?? '12');
const HASH_CHAIN_MAX = 128;

export interface IndexerTickResult {
  fromBlock: bigint;
  toBlock: bigint;
  tip: bigint;
  events: number;
  applied: number;
  done: boolean;
}

type MarketLog = Log & { args?: Record<string, unknown>; eventName?: string };

async function getLastBlock(prisma: PrismaClient): Promise<bigint> {
  const row = await prisma.shopSetting.findUnique({ where: { key: STATE_KEY } });
  if (row) return BigInt(row.value);
  // First run: start near the tip unless L2_INDEXER_START is set
  if (process.env.L2_INDEXER_START) return BigInt(process.env.L2_INDEXER_START);
  const tip = await getPublicClient().getBlockNumber();
  return tip > 20_000n ? tip - 20_000n : 0n;
}

async function setLastBlock(prisma: PrismaClient, height: bigint) {
  await prisma.shopSetting.upsert({
    where: { key: STATE_KEY },
    create: { key: STATE_KEY, value: height.toString() },
    update: { value: height.toString() },
  });
}

// ── Reorg tracking ───────────────────────────────────────────────────
// We persist the hash of each processed tip block (`l2_indexer_chain`,
// newest last). On every tick the stored hash at the cursor is compared
// with the live chain; on mismatch we walk back to the common ancestor
// and roll derived rows back so the next scan re-applies canonical
// events. Base reorgs are rare/shallow, but a wrong read-model is worse.

interface HashPoint {
  n: number;
  h: string;
}

async function getHashChain(prisma: PrismaClient): Promise<HashPoint[]> {
  const row = await prisma.shopSetting.findUnique({ where: { key: CHAIN_KEY } });
  if (!row) return [];
  try {
    return JSON.parse(row.value) as HashPoint[];
  } catch {
    return [];
  }
}

async function setHashChain(prisma: PrismaClient, chain: HashPoint[]) {
  const trimmed = chain.slice(-HASH_CHAIN_MAX);
  await prisma.shopSetting.upsert({
    where: { key: CHAIN_KEY },
    create: { key: CHAIN_KEY, value: JSON.stringify(trimmed) },
    update: { value: JSON.stringify(trimmed) },
  });
}

/**
 * Undo all applied effects of events with blockNumber > ancestor.
 * Exact restores rely on txHash linkage (Sale.txHash, Bid.txHash,
 * Listing.txHash). ownerWallet is best-effort (denormalized display).
 */
async function rollbackTo(
  prisma: PrismaClient,
  ancestor: bigint,
): Promise<{ orphaned: number }> {
  const orphaned = await prisma.eventLog.findMany({
    where: { blockNumber: { gt: ancestor } },
    orderBy: { blockNumber: 'desc' },
  });
  if (orphaned.length === 0) return { orphaned: 0 };

  const orphanedTx = new Set(orphaned.map((e) => e.txHash));
  const affectedArtifacts = new Set<string>();

  for (const ev of orphaned) {
    const args = (ev.data ?? {}) as Record<string, unknown>;
    const listingId = (args.listingId as string | undefined) ?? '0';
    const listing = await prisma.listing.findUnique({
      where: { chainListingId: BigInt(listingId) },
    });
    if (listing) affectedArtifacts.add(listing.artifactId);

    switch (ev.eventName) {
      case 'ListingCreated': {
        // Listing only exists because of this event — remove it.
        if (listing) {
          await prisma.bid.deleteMany({ where: { listingId: listing.id } });
          await prisma.sale.deleteMany({ where: { listingId: listing.id } });
          await prisma.listing.delete({ where: { id: listing.id } });
        }
        break;
      }
      case 'ListingPurchased':
      case 'L1Settled': {
        if (!listing) break;
        const sold = await prisma.sale.findMany({
          where: { listingId: listing.id, txHash: ev.txHash },
        });
        const qty = sold.reduce((s, x) => s + x.quantity, 0);
        await prisma.sale.deleteMany({ where: { listingId: listing.id, txHash: ev.txHash } });
        await prisma.listing.update({
          where: { id: listing.id },
          data: { quantity: listing.quantity + qty, status: 'active' },
        });
        break;
      }
      case 'AuctionSettled': {
        if (!listing) break;
        await prisma.sale.deleteMany({ where: { listingId: listing.id, txHash: ev.txHash } });
        await prisma.listing.update({ where: { id: listing.id }, data: { status: 'active' } });
        break;
      }
      case 'ListingCancelled': {
        if (!listing) break;
        await prisma.listing.update({ where: { id: listing.id }, data: { status: 'active' } });
        break;
      }
      case 'BidPlaced': {
        if (!listing) break;
        await prisma.bid.deleteMany({
          where: { listingId: listing.id, txHash: ev.txHash, logIndex: ev.logIndex },
        });
        // Recompute top bid from remaining rows
        const top = await prisma.bid.findFirst({
          where: { listingId: listing.id },
          orderBy: { amount: 'desc' },
        });
        const count = await prisma.bid.count({ where: { listingId: listing.id } });
        await prisma.listing.update({
          where: { id: listing.id },
          data: {
            highestBid: top?.amount ?? null,
            highestBidder: top?.bidder ?? null,
            bidCount: count,
          },
        });
        break;
      }
    }
  }

  await prisma.eventLog.deleteMany({ where: { blockNumber: { gt: ancestor } } });
  for (const artifactId of affectedArtifacts) {
    await recomputeActivePrice(prisma, artifactId).catch(() => {});
  }
  void orphanedTx;
  return { orphaned: orphaned.length };
}

/**
 * Walk the stored hash chain back until it agrees with the live chain.
 * Returns the common ancestor block number, or null if the stored chain
 * can't be reconciled (reorg deeper than HASH_CHAIN_MAX — caller resets).
 */
interface BlockHashFetcher {
  getBlock(args: { blockNumber: bigint }): Promise<{ hash: `0x${string}` | null }>;
}

async function findCommonAncestor(
  prisma: PrismaClient,
  client: BlockHashFetcher,
  chain: HashPoint[],
): Promise<{ ancestor: bigint; keep: number } | null> {
  for (let i = chain.length - 1; i >= 0; i--) {
    const p = chain[i];
    const live = await client.getBlock({ blockNumber: BigInt(p.n) }).catch(() => null);
    if (live && live.hash === p.h) {
      return { ancestor: BigInt(p.n), keep: i + 1 };
    }
  }
  return null;
}

/** Recompute denormalized floor price for an artifact (cheapest active listing). */
async function recomputeActivePrice(prisma: PrismaClient, artifactId: string) {
  const cheapest = await prisma.listing.findFirst({
    where: { artifactId, status: 'active' },
    orderBy: { price: 'asc' },
    select: { price: true },
  });
  await prisma.artifact.update({
    where: { id: artifactId },
    data: { activePrice: cheapest?.price ?? null },
  });
}

async function applyEvent(
  prisma: PrismaClient,
  log: MarketLog,
): Promise<'applied' | 'skipped' | 'unknown'> {
  const txHash = log.transactionHash ?? '';
  const logIndex = log.logIndex ?? 0;

  // Idempotency — EventLog unique(txHash, logIndex)
  try {
    await prisma.eventLog.create({
      data: {
        blockNumber: log.blockNumber ?? 0n,
        txHash,
        logIndex,
        eventName: log.eventName ?? 'unknown',
        contractAddress: log.address,
        data: log.args ? JSON.parse(JSON.stringify(log.args, (_, v) => (typeof v === 'bigint' ? v.toString() : v))) : {},
      },
    });
  } catch {
    return 'skipped'; // already processed
  }

  const args = (log.args ?? {}) as Record<string, unknown>;
  const listingId = (args.listingId as bigint | undefined) ?? 0n;

  switch (log.eventName) {
    case 'ListingCreated': {
      const nftAddress = (args.nftAddress as string).toLowerCase();
      const tokenId = args.tokenId as bigint;
      let artifact = await prisma.artifact.findFirst({
        where: { contractAddress: { equals: nftAddress, mode: 'insensitive' }, tokenId },
      });
      if (!artifact) {
        // Artifact not yet registered (minted outside the app) — record it
        // so the listing still surfaces; metadata can be enriched later.
        artifact = await prisma.artifact.create({
          data: {
            tokenId,
            contractAddress: nftAddress,
            name: `Artifact #${tokenId}`,
            description: '',
            imageUri: '',
            creator: (args.seller as string).toLowerCase(),
            source: 'marketplace',
          },
        });
      }
      const listing = await prisma.listing.upsert({
        where: { chainListingId: listingId },
        create: {
          artifactId: artifact.id,
          chainListingId: listingId,
          tokenId,
          contractAddress: nftAddress,
          seller: (args.seller as string).toLowerCase(),
          saleType: args.isAuction ? 'auction' : 'fixed',
          price: args.pricePerItem as bigint,
          quantity: Number(args.quantity),
          txHash,
          expiresAt: args.expiryTime && (args.expiryTime as bigint) > 0n
            ? new Date(Number(args.expiryTime) * 1000)
            : null,
        },
        update: {
          status: 'active',
          price: args.pricePerItem as bigint,
          quantity: Number(args.quantity),
        },
      });
      void listing;
      await recomputeActivePrice(prisma, artifact.id);
      return 'applied';
    }


    case 'ListingPurchased':
    case 'L1Settled': {
      const listing = await prisma.listing.findUnique({ where: { chainListingId: listingId } });
      if (!listing) return 'unknown';
      const qty = Number(args.quantity ?? 0);
      const remaining = Math.max(0, listing.quantity - qty);
      await prisma.listing.update({
        where: { id: listing.id },
        data: { quantity: remaining, status: remaining === 0 ? 'sold' : 'active' },
      });
      await prisma.sale.create({
        data: {
          listingId: listing.id,
          artifactId: listing.artifactId,
          tokenId: listing.tokenId,
          buyer: (args.buyer as string).toLowerCase(),
          seller: listing.seller,
          price: args.totalPrice as bigint,
          quantity: qty,
          txHash,
        },
      });
      await prisma.artifact.update({
        where: { id: listing.artifactId },
        data: { ownerWallet: (args.buyer as string).toLowerCase() },
      }).catch(() => {});
      await recomputeActivePrice(prisma, listing.artifactId);
      return 'applied';
    }

    case 'ListingCancelled': {
      const listing = await prisma.listing.findUnique({ where: { chainListingId: listingId } });
      if (!listing) return 'unknown';
      await prisma.listing.update({ where: { id: listing.id }, data: { status: 'cancelled' } });
      await recomputeActivePrice(prisma, listing.artifactId);
      return 'applied';
    }

    case 'BidPlaced': {
      const listing = await prisma.listing.findUnique({ where: { chainListingId: listingId } });
      if (!listing) return 'unknown';
      const bidder = (args.bidder as string).toLowerCase();
      const amount = args.amount as bigint;
      await prisma.bid.create({
        data: { listingId: listing.id, bidder, amount, txHash, logIndex },
      });
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          highestBid: amount,
          highestBidder: bidder,
          bidCount: { increment: 1 },
        },
      });
      return 'applied';
    }

    case 'AuctionSettled': {
      const listing = await prisma.listing.findUnique({ where: { chainListingId: listingId } });
      if (!listing) return 'unknown';
      await prisma.listing.update({ where: { id: listing.id }, data: { status: 'sold' } });
      await prisma.sale.create({
        data: {
          listingId: listing.id,
          artifactId: listing.artifactId,
          tokenId: listing.tokenId,
          buyer: (args.winner as string).toLowerCase(),
          seller: listing.seller,
          price: args.amount as bigint,
          quantity: listing.quantity,
          txHash,
        },
      });
      await prisma.artifact.update({
        where: { id: listing.artifactId },
        data: { ownerWallet: (args.winner as string).toLowerCase() },
      }).catch(() => {});
      await recomputeActivePrice(prisma, listing.artifactId);
      return 'applied';
    }

    default:
      return 'unknown';
  }
}

/**
 * Run one indexer pass: scan marketplace logs between the stored cursor
 * and (tip - confirmations), capped to `maxRange` blocks per call.
 */
export async function runIndexerTick(
  prisma: PrismaClient,
  opts: { maxRange?: bigint; client?: PublicClient } = {},
): Promise<IndexerTickResult> {
  const client = opts.client ?? getPublicClient();
  const tip = await client.getBlockNumber();
  const safeTip = tip > CONFIRMATIONS ? tip - CONFIRMATIONS : 0n;

  // ── Reorg check ────────────────────────────────────────────────────
  const chain = await getHashChain(prisma);
  if (chain.length > 0) {
    const top = chain[chain.length - 1];
    const live = await client.getBlock({ blockNumber: BigInt(top.n) }).catch(() => null);
    if (live && live.hash !== top.h) {
      console.warn(`[indexer] reorg detected at block ${top.n}`);
      const found = await findCommonAncestor(prisma, client, chain);
      if (!found) {
        // Reorg deeper than our tracked window — full rescan is the only
        // safe answer. Reset cursor to the oldest tracked block and let
        // events re-apply (derived rows from orphaned txs are removed).
        const oldest = chain[0];
        console.error(`[indexer] deep reorg — rescanning from ${oldest.n}`);
        await rollbackTo(prisma, BigInt(oldest.n));
        await setLastBlock(prisma, BigInt(oldest.n));
        await setHashChain(prisma, []);
      } else {
        const rolled = await rollbackTo(prisma, found.ancestor);
        console.warn(`[indexer] rolled back ${rolled.orphaned} orphaned events to block ${found.ancestor}`);
        await setLastBlock(prisma, found.ancestor);
        await setHashChain(prisma, chain.slice(0, found.keep));
      }
    }
  }

  const fromBlock = (await getLastBlock(prisma)) + 1n;
  const maxRange = opts.maxRange ?? 50_000n;
  const toBlock = fromBlock + maxRange < safeTip ? fromBlock + maxRange : safeTip;

  const result: IndexerTickResult = {
    fromBlock,
    toBlock,
    tip: safeTip,
    events: 0,
    applied: 0,
    done: toBlock >= safeTip,
  };
  if (fromBlock > safeTip) return result;

  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    const end = start + CHUNK - 1n > toBlock ? toBlock : start + CHUNK - 1n;
    const logs = (await client.getLogs({
      address: MARKETPLACE_ADDR,
      fromBlock: start,
      toBlock: end,
    })) as MarketLog[];

    for (const log of logs) {
      if (!log.eventName && log.args === undefined) {
        // Raw log — decode via our event ABIs
        try {
          const decoded = decodeEventLog({
            abi: MARKETPLACE_EVENT_ABIS,
            data: log.data,
            topics: log.topics,
          });
          (log as MarketLog).eventName = decoded.eventName;
          (log as MarketLog).args = decoded.args as Record<string, unknown>;
        } catch {
          continue;
        }
      }
      result.events++;
      const r = await applyEvent(prisma, log);
      if (r === 'applied') result.applied++;
    }
  }

  await setLastBlock(prisma, toBlock);

  // Record the canonical hash of the processed tip for reorg detection.
  const tipBlock = await client.getBlock({ blockNumber: toBlock }).catch(() => null);
  if (tipBlock) {
    const updated = (await getHashChain(prisma)).filter((p) => p.n < Number(toBlock));
    updated.push({ n: Number(toBlock), h: tipBlock.hash });
    await setHashChain(prisma, updated);
  }

  result.done = toBlock >= safeTip;
  return result;
}
