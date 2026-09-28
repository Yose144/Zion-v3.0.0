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

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Service URLs (from env or defaults — Edge production ports)
const POOL_API = process.env.POOL_API_URL ?? 'http://127.0.0.1:8080'; // zion-v31-pool HTTP API
const MC_API = process.env.MC_API_URL ?? 'http://127.0.0.1:8453'; // warpd (transfers)
const MC_API_V1 = process.env.MC_API_V1_URL ?? 'http://127.0.0.1:8454'; // multichain ApiServer (swap/DEX)
const DAO_API = process.env.DAO_API_URL ?? 'http://127.0.0.1:8456'; // zion-v31-dao
const NODE_RPC = process.env.NODE_RPC_URL ?? 'http://127.0.0.1:9445';

const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS ?? 30_000);

// ── J6: Mining stats sync ─────────────────────────────────────────────

async function syncMiningStats() {
  try {
    // Pool-level totals from /stats (routing counters)
    const statsResp = await fetch(`${POOL_API}/stats`, {
      signal: AbortSignal.timeout(5000),
    });
    if (statsResp.ok) {
      const data = await statsResp.json() as Record<string, unknown>;
      const routing = (data.routing as Record<string, unknown>) ?? {};
      const totalAccepted = (routing.total_accepted as number) ?? 0;
      const totalSubmits = (routing.total_submits as number) ?? 0;
      const totalRejected = (routing.total_rejected as number) ?? 0;
      const totalStale = (routing.total_stale as number) ?? 0;
      const poolHashrate = ((data.pool as Record<string, unknown>)?.hashrate as number)
        ?? (data.total_hashrate as number) ?? 0;

      const poolAddr = 'zion-pool';
      const worker = await prisma.miningWorker.upsert({
        where: { address: poolAddr },
        update: {
          hashrate: poolHashrate,
          shares: totalSubmits,
          accepted: totalAccepted,
          rejected: totalRejected,
          lastShareAt: new Date(),
        },
        create: {
          address: poolAddr,
          workerName: 'pool',
          pool: 'zion-pool',
          coin: 'ZION',
          algorithm: 'ekam_deeksha',
          hashrate: poolHashrate,
          shares: totalSubmits,
          accepted: totalAccepted,
          rejected: totalRejected,
          lastShareAt: new Date(),
        },
      });

      await prisma.miningStats.create({
        data: {
          workerId: worker.id,
          hashrate: poolHashrate,
          shares: totalSubmits,
          accepted: totalAccepted,
          rejected: totalRejected,
          stale: totalStale,
          uptime: Math.floor(Date.now() / 1000) - Math.floor(worker.createdAt.getTime() / 1000),
        },
      });
    }

    // Per-miner stats from /miners (zion-v31-pool HTTP API shape:
    // { count, miners: [{ address, worker, hashrate_hps, valid_shares,
    //   invalid_shares, blocks_found, last_share_time (epoch s) }] })
    const minersResp = await fetch(`${POOL_API}/miners?limit=200`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!minersResp.ok) return;
    const payload = await minersResp.json() as Record<string, unknown>;
    const miners = (payload.miners as Array<Record<string, unknown>>) ?? [];

    for (const miner of miners) {
      const addr = (miner.address as string) ?? '';
      const workerName = ((miner.worker as string) ?? addr).split('.').pop() || addr;
      if (!addr) continue;
      const mHashrate = (miner.hashrate_hps as number) ?? 0;
      const mAccepted = (miner.valid_shares as number) ?? 0;
      const mRejected = (miner.invalid_shares as number) ?? 0;
      const lastShareSec = (miner.last_share_time as number) ?? 0;
      const lastShareAt = lastShareSec > 0 ? new Date(lastShareSec * 1000) : new Date();

      await prisma.miningWorker.upsert({
        where: { address: workerName === addr ? addr : `${addr}.${workerName}` },
        update: {
          hashrate: mHashrate,
          accepted: mAccepted,
          rejected: mRejected,
          lastShareAt,
        },
        create: {
          address: workerName === addr ? addr : `${addr}.${workerName}`,
          workerName,
          pool: 'zion-pool',
          coin: 'ZION',
          algorithm: 'ekam_deeksha',
          hashrate: mHashrate,
          accepted: mAccepted,
          rejected: mRejected,
          lastShareAt,
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
    // zion-v31-dao shape: { success, data: { proposals: [...], total } }
    // proposal fields: id, title, description, status ("Active"|"Passed"|
    // "Failed"|"Executed"), votes_for/_against/_abstain, total_votes,
    // voter_count, proposer, proposal_type, voting_ends_at, created_at
    const resp = await fetch(`${DAO_API}/api/dao/proposals?limit=200`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return;
    const body = await resp.json() as Record<string, unknown>;
    const data = (body.data as Record<string, unknown>) ?? body;
    const proposals = (data.proposals as Array<Record<string, unknown>>) ?? [];

    for (const p of proposals) {
      const proposalId = Number(p.id ?? p.proposal_id ?? 0);
      if (!proposalId) continue;

      const status = String(p.status ?? 'Active').toLowerCase();
      const votingEnds = p.voting_ends_at
        ? new Date(p.voting_ends_at as string)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.daoProposal.upsert({
        where: { proposalId },
        update: {
          title: (p.title as string) ?? '',
          description: (p.description as string) ?? '',
          status,
          yesVotes: Number(p.votes_for ?? p.yes_votes ?? 0),
          noVotes: Number(p.votes_against ?? p.no_votes ?? 0),
          expiresAt: votingEnds,
        },
        create: {
          proposalId,
          title: (p.title as string) ?? '',
          description: (p.description as string) ?? '',
          proposer: (p.proposer as string) ?? '',
          status,
          yesVotes: Number(p.votes_for ?? p.yes_votes ?? 0),
          noVotes: Number(p.votes_against ?? p.no_votes ?? 0),
          expiresAt: votingEnds,
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
    // warpd shape: { ok, data: [{ id, source_chain: {name,family},
    //   dest_chain: {...}, sender, recipient, amount_flowers, fee_flowers,
    //   status ("Pending"|"Completed"|...), source_tx_hash, dest_tx_hash,
    //   created_at, updated_at, memo }] }
    const resp = await fetch(`${MC_API}/transfers`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return;
    const body = await resp.json() as Record<string, unknown>;
    const transfers = (body.data as Array<Record<string, unknown>>)
      ?? (Array.isArray(body) ? body : []);

    for (const t of transfers) {
      const id = (t.id as string) ?? `${t.source_tx_hash}-${t.dest_tx_hash}`;
      if (!id) continue;

      // Schema statuses: pending | confirmed | failed — normalize warp states.
      const raw = ((t.status as string) ?? 'pending').toLowerCase();
      const status = ['completed', 'settled', 'confirmed'].includes(raw)
        ? 'confirmed'
        : ['failed', 'refunded', 'expired'].includes(raw)
          ? 'failed'
          : 'pending';
      const existing = await prisma.bridgeTransaction.findUnique({ where: { id } });
      if (existing && existing.status === 'confirmed') continue;

      const srcChain = (t.source_chain as Record<string, unknown>)?.name
        ?? (t.source_chain as string) ?? '';
      const dstChain = (t.dest_chain as Record<string, unknown>)?.name
        ?? (t.dest_chain as string) ?? '';
      const amount = BigInt(String(t.amount_flowers ?? t.amount ?? 0));
      const isOutboundL1 = String(srcChain).includes('zion');

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
          txType: isOutboundL1 ? 'lock' : 'release',
          sourceChain: String(srcChain),
          destChain: String(dstChain),
          amount,
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
    // Multichain ApiServer (port 8454) has /v1/swap/order/:id but no public
    // orders list — this no-ops cleanly until such an endpoint exists.
    const resp = await fetch(`${MC_API_V1}/v1/swap/orders`, {
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
      data: (params.data ?? undefined) as Prisma.InputJsonValue | undefined,
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
