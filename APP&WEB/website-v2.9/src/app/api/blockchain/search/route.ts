/**
 * ZION Explorer — Unified Search API
 *
 * Accepts ?q= and attempts to resolve the query across:
 * - block by height
 * - block by hash
 * - transaction by hash
 * - address info
 *
 * Returns all matching results so the frontend can present them
 * in a disambiguation / results page.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

interface SearchResult {
  type: 'block' | 'transaction' | 'address';
  href: string;
  title: string;
  meta: string;
  data?: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();
  const q = (request.nextUrl.searchParams.get('q') || request.nextUrl.searchParams.get('query') || '').trim();

  if (!q) {
    return NextResponse.json({ query: '', results: [] });
  }

  const results: SearchResult[] = [];

  // 1) Block by height (pure integer)
  if (/^\d+$/.test(q)) {
    try {
      const height = parseInt(q, 10);
      const block = await rpc.getBlock(height);
      if (block && block.hash) {
        results.push({
          type: 'block',
          href: `/explorer/block?id=${height}`,
          title: `Block #${height.toLocaleString()}`,
          meta: `Hash: ${block.hash.slice(0, 20)}…`,
          data: { hash: block.hash, height, timestamp: block.timestamp, num_txes: block.tx_hashes.length },
        });
      }
    } catch { /* not found */ }
  }

  // 2) Block by hash (hex, at least 10 chars)
  if (/^[a-fA-F0-9]{10,}$/.test(q)) {
    try {
      const block = await rpc.getBlock(q.toLowerCase());
      if (block && block.hash) {
        results.push({
          type: 'block',
          href: `/explorer/block?id=${q}`,
          title: `Block ${q.slice(0, 16)}…`,
          meta: `Height: ${block.height?.toLocaleString?.() ?? '—'}`,
          data: { hash: block.hash, height: block.height, timestamp: block.timestamp, num_txes: block.tx_hashes.length },
        });
      }
    } catch { /* not found */ }
  }

  // 3) Transaction by hash (64 hex chars)
  if (/^[a-fA-F0-9]{64}$/.test(q)) {
    try {
      const txs = await rpc.getTransactions([q.toLowerCase()]);
      if (txs.length > 0) {
        const tx = txs[0];
        results.push({
          type: 'transaction',
          href: `/explorer/tx?hash=${q}`,
          title: `Transaction ${q.slice(0, 12)}…${q.slice(-8)}`,
          meta: `Block: ${tx.block_height?.toLocaleString?.() ?? 'pool'}`,
          data: { tx_hash: tx.tx_hash, block_height: tx.block_height, fee: tx.fee },
        });
      }
    } catch { /* not found */ }
  }

  // 4) Address (zion1... or Z... prefix)
  if (/^(zion|ZION|Z)[a-zA-Z0-9]{40,}$/i.test(q)) {
    try {
      const info = await rpc.getWalletSnapshot(q);
      if (info) {
        const balanceZion = info.balance_zion ?? 0;
        results.push({
          type: 'address',
          href: `/explorer/address?addr=${encodeURIComponent(q)}`,
          title: `Address ${q.slice(0, 12)}…${q.slice(-8)}`,
          meta: `Balance: ${balanceZion.toLocaleString(undefined, { maximumFractionDigits: 6 })} ZION`,
          data: { address: q, balance: balanceZion, tx_count: info.utxo_count },
        });
      }
    } catch { /* not found */ }
  }

  // Deduplicate by href
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.href)) return false;
    seen.add(r.href);
    return true;
  });

  return NextResponse.json({ query: q, results: unique }, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
  });
}
