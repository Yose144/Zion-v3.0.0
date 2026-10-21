#!/usr/bin/env npx tsx
/**
 * ZION MarketPlace — L2 event indexer daemon.
 *
 * Continuously scans ZIONMarketplace logs on Base L2 and syncs
 * listings/sales/bids into Postgres (see src/lib/indexer.ts).
 *
 * Usage:
 *   npx tsx scripts/l2-indexer.ts
 *
 * Env:
 *   DATABASE_URL            — Postgres connection string (required)
 *   NEXT_PUBLIC_CHAIN_ID    — 8453 mainnet / 84532 sepolia (default 8453)
 *   BASE_RPC_URL            — L2 RPC (default per-chain public endpoint)
 *   NEXT_PUBLIC_MARKETPLACE_ADDRESS — deployed marketplace contract (required)
 *   INDEXER_POLL_S          — poll interval seconds (default 15)
 *   L2_CONFIRMATIONS        — blocks lag for reorg safety (default 12)
 *   L2_INDEXER_START        — first-run start block (default: tip-20000)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Minimal .env loader (Next.js does this automatically; tsx does not)
for (const envFile of ['.env.local', '.env']) {
  const p = join(process.cwd(), envFile);
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"(.*)"\s*$/) ?? line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  }
}

const POLL_S = parseInt(process.env.INDEXER_POLL_S ?? '15', 10);

async function main() {
  // Lazy imports so env is loaded before clients are constructed
  const { PrismaClient } = await import('@prisma/client');
  const { runIndexerTick } = await import('../src/lib/indexer');

  const prisma = new PrismaClient();

  console.log('════════════════════════════════════════════════════════');
  console.log('  ZION MarketPlace — L2 event indexer');
  console.log('════════════════════════════════════════════════════════');
  console.log(`  Chain:      ${process.env.NEXT_PUBLIC_CHAIN_ID ?? '8453'}`);
  console.log(`  RPC:        ${process.env.BASE_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_RPC_URL ?? '(chain default)'}`);
  console.log(`  Market:     ${process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ?? '(NOT SET)'}`);
  console.log(`  Poll:       ${POLL_S}s`);
  console.log('════════════════════════════════════════════════════════\n');

  if (!process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS) {
    console.error('NEXT_PUBLIC_MARKETPLACE_ADDRESS not set — nothing to index');
    process.exit(1);
  }

  for (;;) {
    try {
      const r = await runIndexerTick(prisma);
      if (r.events > 0 || !r.done) {
        console.log(
          `[${new Date().toISOString()}] blocks ${r.fromBlock}→${r.toBlock} (tip ${r.tip}) ` +
          `events=${r.events} applied=${r.applied}${r.done ? '' : ' [catching up]'}`,
        );
      }
    } catch (e) {
      console.error(`[${new Date().toISOString()}] tick error:`, e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, POLL_S * 1000));
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
