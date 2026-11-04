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
 *
 * Truncated pastes ("zion1abc…def") are reported explicitly instead of being
 * silently treated as a block hash — that used to route users to
 * /explorer/block?id=zion1… and show an unrelated "block not found" page.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { cacheControl } from '@/lib/server-cache';

interface SearchResult {
  type: 'block' | 'transaction' | 'address';
  href: string;
  title: string;
  meta: string;
  data?: Record<string, unknown>;
}

const ZION_ADDRESS_RE = /^zion1[0-9a-z]{30,64}$/i;
const ACCOUNT_ADDRESS_RE = /^[A-Za-z][A-Za-z0-9]{30,70}$/;

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();
  const rawQuery = (request.nextUrl.searchParams.get('q') || request.nextUrl.searchParams.get('query') || '').trim();

  if (!rawQuery) {
    return NextResponse.json({ query: '', results: [] });
  }

  // Normalise "zion1abc…def" / "zion1abc...def" — keep the trimmed text for
  // display, resolve against the sanitised value when it is unambiguous.
  const isTruncatedAddress = /^zion1[0-9a-z]+[…]/i.test(rawQuery) || /^zion1[0-9a-z]+\.{2,}/i.test(rawQuery);
  if (isTruncatedAddress) {
    return NextResponse.json(
      {
        query: rawQuery,
        results: [],
        code: 'truncated_address',
        hint: 'Adresa je zkrácená (obsahuje „…"). Zkopíruj celou adresu z peněženky nebo z exploreru.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const q = rawQuery.replace(/[\s]/g, '');
  if (/[…]/.test(q) || q.includes('...')) {
    return NextResponse.json(
      {
        query: rawQuery,
        results: [],
        code: 'invalid_query',
        hint: 'Hledaný výraz obsahuje výpustku. Vlož celý hash nebo celou adresu.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
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

  // 4) Address (zion1... or legacy Z... prefix). Pure hex strings are block/tx
  //    hashes, never addresses — don't burn an RPC call on them.
  const looksLikeAddress = ZION_ADDRESS_RE.test(q)
    || (ACCOUNT_ADDRESS_RE.test(q) && !/^[a-fA-F0-9]{40,}$/.test(q));
  if (looksLikeAddress) {
    try {
      // Totals-only read: `getAddressBalance` pages getUtxos (limit 0), so a
      // 130k-UTXO payout wallet costs ~2 ms instead of a 27 MB payload.
      const balance = await rpc.getAddressBalance(q);
      results.push({
        type: 'address',
        href: `/explorer/address?addr=${encodeURIComponent(q)}`,
        title: `Address ${q.slice(0, 12)}…${q.slice(-8)}`,
        meta: `Balance: ${balance.balance_zion.toLocaleString(undefined, { maximumFractionDigits: 6 })} ZION`,
        data: { address: q, balance: balance.balance_zion, tx_count: balance.utxo_count },
      });
    } catch { /* not found */ }
  }

  // Deduplicate by href
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.href)) return false;
    seen.add(r.href);
    return true;
  });

  const payload: Record<string, unknown> = { query: q, results: unique };
  if (unique.length === 0) {
    payload.hint = /^zion1/i.test(q)
      ? 'Adresa nebyla nalezena nebo nemá žádné UTXO v této síti.'
      : 'Nic nenalezeno. Zadej výšku bloku, hash transakce/bloku nebo celou ZION adresu.';
  }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': cacheControl({ maxAge: 5, sMaxAge: 5, swr: 15 }) },
  });
}
