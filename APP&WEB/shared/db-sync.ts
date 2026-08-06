/**
 * ZION DB Sync Service — syncs data from V31 Rust services to the shared
 * PostgreSQL database so all web apps (Market, OASIS, Dashboard) can query
 * a unified data layer.
 *
 * This module runs as a background poller that periodically fetches data
 * from V31 service APIs and upserts into the shared Prisma database.
 *
 * Services synced:
 *   J6 — Mining stats (pool API → MiningWorker, MiningStats)
 *   J7 — DAO proposals (dao API → DaoProposal, DaoVote)
 *   J8 — Bridge transactions (multichain API → BridgeTransaction)
 *   J9 — DEX orders (multichain API → DexOrder)
 *   J10 — Notifications (cross-app event aggregation → Notification)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Service URLs (from env or defaults)
const POOL_API = process.env.POOL_API_URL ?? 'http://127.0.0.1:8444';
const MC_API = process.env.MC_API_URL ?? 'http://127.0.0.1:8453';
const DAO_API = process.env.DAO_API_URL ?? 'http://127.0.0.1:8092';
const NODE_RPC = process.env.NODE_RPC_URL ?? 'http://127.0.0.1:9445';

const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS ?? 30_000);

// ── J6: Mining stats sync ─────────────────────────────────────────────

async function syncMiningStats() {
  try {
    const resp = await fetch(`${POOL_API}/stats`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return;
    const data = await resp.json() as Record<string, unknown>;

    // Upsert pool-level mining worker entry
    const poolAddr = (data.pool_address as string) ?? 'zion-pool';
    const hashrate = (data.hashrate as number) ?? 0;
    const shares = (data.shares_total as number) ?? 0;
    const accepted = (data.shares_accepted as number) ?? 0;
    const rejected = (data.shares_rejected as number) ?? 0;

    await prisma.miningWorker.upsert({
      where: { address: poolAddr },
      update: {
        hashrate,
        shares,
        accepted,
        rejected,
        lastShareAt: new Date(),
      },
      create: {
        address: poolAddr,
        workerName: 'pool',
        pool: 'zion-pool',
        coin: 'ZION',
        algorithm: 'ekam_deeksha',
        hashrate,
        shares,
        accepted,
        rejected,
        lastShareAt: new Date(),
      },
    });

    // Insert stats snapshot
    const worker = await prisma.miningWorker.findUnique({ where: { address: poolAddr } });
    if (worker) {
      await prisma.miningStats.create({
        data: {
          workerId: worker.id,
          hashrate,
          shares,
          accepted,
          rejected,
          stale: 0,
          uptime: Math.floor(Date.now() / 1000) - Math.floor(worker.createdAt.getTime() / 1000),
        },
      });
    }

    // Sync individual miners if available
    const miners = (data.miners as Array<Record<string, unknown>>) ?? [];
    for (const miner of miners) {
      const addr = (miner.address as string) ?? (miner.worker as string);
      if (!addr) continue;
      const mHashrate = (miner.hashrate as number) ?? 0;
      const mAccepted = (miner.accepted as number) ?? 0;
      const mRejected = (miner.rejected as number) ?? 0;

      await prisma.miningWorker.upsert({
        where: { address: addr },
        update: {
          hashrate: mHashrate,
          accepted: mAccepted,
          rejected: mRejected,
          lastShareAt: new Date(),
        },
        create: {
          address: addr,
          workerName: (miner.worker as string) ?? addr,
          pool: 'zion-pool',
          coin: 'ZION',
          algorithm: 'ekam_deeksha',
          hashrate: mHashrate,
          accepted: mAccepted,
          rejected: mRejected,
          lastShareAt: new Date(),
        },
      });
    }
  } catch (e) {
    console.error('[J6] Mining stats sync error:', e);
  }
}

// ── J7: DAO proposals sync ────────────────────────────────────────────

async function syncDaoProposals() {
  try {
    const resp = await fetch(`${DAO_API}/api/dao/proposals?status=active`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return;
    const proposals = await resp.json() as Array<Record<string, unknown>>;

    for (const p of proposals) {
      const proposalId = Number(p.id ?? p.proposal_id ?? 0);
      if (!proposalId) continue;

      await prisma.daoProposal.upsert({
        where: { proposalId },
        update: {
          title: (p.title as string) ?? '',
          description: (p.description as string) ?? '',
          status: (p.status as string) ?? 'active',
          yesVotes: Number(p.yes_votes ?? p.yesVotes ?? 0),
          noVotes: Number(p.no_votes ?? p.noVotes ?? 0),
        },
        create: {
          proposalId,
          title: (p.title as string) ?? '',
          description: (p.description as string) ?? '',
          proposer: (p.proposer as string) ?? '',
          status: (p.status as string) ?? 'active',
          yesVotes: Number(p.yes_votes ?? p.yesVotes ?? 0),
          noVotes: Number(p.no_votes ?? p.noVotes ?? 0),
          expiresAt: p.expires_at ? new Date(p.expires_at as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
  } catch (e) {
    console.error('[J7] DAO sync error:', e);
  }
}

// ── J8: Bridge transactions sync ──────────────────────────────────────

async function syncBridgeTransactions() {
  try {
    const resp = await fetch(`${MC_API}/bridge/transfers`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return;
    const transfers = await resp.json() as Array<Record<string, unknown>>;

    for (const t of transfers) {
      const id = (t.id as string) ?? `${t.source_tx_hash}-${t.dest_tx_hash}`;
      if (!id) continue;

      const status = ((t.status as string) ?? 'pending').toLowerCase();
      const existing = await prisma.bridgeTransaction.findUnique({ where: { id } });
      if (existing && existing.status === 'confirmed') continue;

      await prisma.bridgeTransaction.upsert({
        where: { id },
        update: {
          status,
          completedAt: status === 'confirmed' ? new Date() : undefined,
          sourceTxHash: (t.source_tx_hash as string) ?? undefined,
          destTxHash: (t.dest_tx_hash as string) ?? undefined,
        },
        create: {
          id,
          txType: (t.direction as string) ?? 'lock',
          sourceChain: (t.source_chain as string) ?? '',
          destChain: (t.dest_chain as string) ?? '',
          amount: BigInt((t.amount as number) ?? 0),
          sender: (t.sender as string) ?? '',
          recipient: (t.recipient as string) ?? '',
          sourceTxHash: (t.source_tx_hash as string) ?? undefined,
          destTxHash: (t.dest_tx_hash as string) ?? undefined,
          status,
        },
      });
    }
  } catch (e) {
    console.error('[J8] Bridge sync error:', e);
  }
}

// ── J9: DEX orders sync ───────────────────────────────────────────────

async function syncDexOrders() {
  try {
    const resp = await fetch(`${MC_API}/dex/orders`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return;
    const orders = await resp.json() as Array<Record<string, unknown>>;

    for (const o of orders) {
      const id = (o.id as string) ?? `${o.trader}-${o.token_in}-${o.token_out}-${o.created_at}`;
      if (!id) continue;

      const status = ((o.status as string) ?? 'pending').toLowerCase();
      const existing = await prisma.dexOrder.findUnique({ where: { id } });
      if (existing && existing.status === 'executed') continue;

      await prisma.dexOrder.upsert({
        where: { id },
        update: {
          status,
          amountOut: o.amount_out ? BigInt(o.amount_out as number) : undefined,
          txHash: (o.tx_hash as string) ?? undefined,
        },
        create: {
          id,
          orderType: (o.order_type as string) ?? 'swap',
          tokenIn: (o.token_in as string) ?? '',
          tokenOut: (o.token_out as string) ?? '',
          amountIn: BigInt((o.amount_in as number) ?? 0),
          amountOut: o.amount_out ? BigInt(o.amount_out as number) : undefined,
          trader: (o.trader as string) ?? '',
          txHash: (o.tx_hash as string) ?? undefined,
          status,
        },
      });
    }
  } catch (e) {
    console.error('[J9] DEX sync error:', e);
  }
}

// ── J10: Notifications — cross-app event aggregation ──────────────────
// This is triggered by webhooks from individual apps rather than polled.
// See APP&WEB/shared/notify.ts for the notification dispatch logic.

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data ?? undefined,
    },
  });
}

// ── Main sync loop ────────────────────────────────────────────────────

async function syncAll() {
  await Promise.allSettled([
    syncMiningStats(),
    syncDaoProposals(),
    syncBridgeTransactions(),
    syncDexOrders(),
  ]);
}

async function main() {
  console.log(`ZION DB Sync Service starting (interval: ${SYNC_INTERVAL_MS}ms)`);

  // Initial sync
  await syncAll();

  // Periodic sync
  setInterval(async () => {
    try {
      await syncAll();
    } catch (e) {
      console.error('Sync cycle error:', e);
    }
  }, SYNC_INTERVAL_MS);

  // Keep process alive
  console.log('DB Sync Service running. Press Ctrl-C to stop.');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
