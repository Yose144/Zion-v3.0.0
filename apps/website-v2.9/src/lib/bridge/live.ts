/**
 * Pure bridge-tracker decisions. No network and no Next.js, so the rules
 * can be checked without a running relay.
 */

import { FLOWERS_PER_ZION } from '../constants';

export type BridgeActivityStatus = 'finalized' | 'pending' | 'failed';
export type BridgeActivityDirection = 'lock' | 'outbound' | 'inbound';

export interface BridgeActivity {
  txid: string;
  block_height: number;
  sender: string;
  recipient_chain: string;
  recipient: string;
  amount_zion: string;
  amount_flowers: number;
  memo: string;
  confirmations: number;
  finalized: boolean;
  status: BridgeActivityStatus;
  direction: BridgeActivityDirection;
}

/** Relay metrics answered, and the cursor has actually moved. */
export function relayIsOnline(uptimeSeconds: number, lastL1Height: number): boolean {
  return uptimeSeconds > 0 || lastL1Height > 0;
}

function chainName(chain: unknown): string {
  if (!chain) return '';
  if (typeof chain === 'string') return chain;
  if (typeof chain === 'object') {
    const row = chain as { name?: unknown; family?: unknown };
    if (typeof row.name === 'string' && row.name) return row.name;
    if (typeof row.family === 'string') return row.family;
  }
  return '';
}

function chainFamily(chain: unknown): string {
  if (!chain || typeof chain !== 'object') return '';
  const family = (chain as { family?: unknown }).family;
  return typeof family === 'string' ? family.toLowerCase() : '';
}

function formatZion(flowers: number): string {
  if (!Number.isFinite(flowers)) return '0';
  const zion = flowers / FLOWERS_PER_ZION;
  return zion.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function warpStatus(raw: unknown): BridgeActivityStatus {
  const status = String(raw ?? '').toLowerCase();
  if (status === 'completed') return 'finalized';
  if (status === 'failed') return 'failed';
  return 'pending';
}

/** Map one WARP `/transfers` row. Returns null when the row has no identity. */
export function mapWarpTransfer(row: unknown, finality = 60): BridgeActivity | null {
  if (!row || typeof row !== 'object') return null;
  const transfer = row as Record<string, unknown>;
  const sourceHash = typeof transfer.source_tx_hash === 'string' ? transfer.source_tx_hash.trim() : '';
  const id = typeof transfer.id === 'string' ? transfer.id : '';
  const txid = sourceHash || id;
  if (!txid) return null;

  const flowers = Number(transfer.amount_flowers ?? 0);
  const status = warpStatus(transfer.status);
  const family = chainFamily(transfer.source_chain);
  const sourceIsL1 = family === 'zionl1' || family === 'zion-l1' || family === 'zion_l1';
  const direction: BridgeActivityDirection = sourceIsL1 ? 'outbound' : 'inbound';

  return {
    txid,
    block_height: 0,
    sender: typeof transfer.sender === 'string' ? transfer.sender : '',
    recipient_chain: chainName(transfer.dest_chain) || chainName(transfer.source_chain),
    recipient: typeof transfer.recipient === 'string' ? transfer.recipient : '',
    amount_zion: formatZion(flowers),
    amount_flowers: Number.isFinite(flowers) ? flowers : 0,
    memo: typeof transfer.memo === 'string' ? transfer.memo : '',
    confirmations: status === 'finalized' ? finality : 0,
    finalized: status === 'finalized',
    status,
    direction,
  };
}

/**
 * Recent L1 locks win over a WARP row with the same txid (they carry a
 * block height). WARP-only rows stay in the list so history outside the
 * lock scan window is still visible.
 */
export function mergeBridgeTransactions(
  locks: BridgeActivity[],
  warp: BridgeActivity[],
  limit: number,
): BridgeActivity[] {
  const byId = new Map<string, BridgeActivity>();
  for (const tx of warp) {
    if (tx.txid) byId.set(tx.txid, tx);
  }
  for (const tx of locks) {
    if (tx.txid) byId.set(tx.txid, tx);
  }
  return [...byId.values()]
    .sort((a, b) => {
      if (a.block_height === 0 && b.block_height === 0) return 0;
      if (a.block_height === 0) return 1;
      if (b.block_height === 0) return -1;
      return b.block_height - a.block_height;
    })
    .slice(0, Math.max(0, limit));
}
