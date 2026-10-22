/**
 * ZION Explorer V4 — Typed API Client
 *
 * Thin typed wrappers around the existing `apiClient` fetch helper.
 * All functions return strongly-typed responses matching `types.ts`.
 */

import { apiClient } from '@/lib/api';
import type {
  ExplorerStats,
  ExplorerBlock,
  ExplorerBlockListItem,
  ExplorerTransaction,
  ExplorerTxListItem,
  ExplorerAddress,
  ExplorerMempool,
  ExplorerPeers,
  ExplorerRichList,
  ExplorerSearchResult,
  BroadcastResult,
  VerifyMessageResult,
} from './types';

// ── Blockchain ──────────────────────────────────────────────────────────────

export async function getStats(): Promise<ExplorerStats> {
  return apiClient<ExplorerStats>('/blockchain/stats');
}

export async function getBlocks(limit = 20, offset = 0): Promise<ExplorerBlockListItem[]> {
  return apiClient<ExplorerBlockListItem[]>(`/blockchain/blocks?limit=${limit}&offset=${offset}`);
}

export async function getBlock(heightOrHash: number | string): Promise<ExplorerBlock> {
  const param = typeof heightOrHash === 'number' ? `height=${heightOrHash}` : `hash=${heightOrHash}`;
  return apiClient<ExplorerBlock>(`/blockchain/block?${param}`);
}

export async function getTransaction(hash: string): Promise<ExplorerTransaction> {
  return apiClient<ExplorerTransaction>(`/blockchain/tx?hash=${encodeURIComponent(hash)}`);
}

export async function getTransactions(limit = 20, offset = 0): Promise<{ count: number; total_tx_count: number; transactions: ExplorerTxListItem[]; items: ExplorerTxListItem[] }> {
  return apiClient(`/blockchain/transactions?limit=${limit}&offset=${offset}`);
}

export async function getAddress(address: string): Promise<ExplorerAddress> {
  return apiClient<ExplorerAddress>(`/blockchain/address?address=${encodeURIComponent(address)}`);
}

export async function getMempool(): Promise<ExplorerMempool> {
  return apiClient<ExplorerMempool>('/blockchain/mempool');
}

export async function getPeers(): Promise<ExplorerPeers> {
  return apiClient<ExplorerPeers>('/blockchain/peers');
}

export async function getRichList(): Promise<ExplorerRichList> {
  return apiClient<ExplorerRichList>('/blockchain/richlist');
}

export async function getCharts(): Promise<Record<string, unknown>> {
  return apiClient('/blockchain/charts');
}

export async function getEmission(): Promise<Record<string, unknown>> {
  return apiClient('/blockchain/emission');
}

// ── Search ──────────────────────────────────────────────────────────────────

export async function search(query: string): Promise<ExplorerSearchResult> {
  return apiClient<ExplorerSearchResult>(`/blockchain/search?q=${encodeURIComponent(query)}`);
}

// ── Broadcast ───────────────────────────────────────────────────────────────

export async function broadcastTransaction(transaction: unknown, model?: 'account' | 'utxo'): Promise<BroadcastResult> {
  return apiClient<BroadcastResult>('/blockchain/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction, model }),
  });
}

export async function broadcastRaw(rawHex: string): Promise<BroadcastResult> {
  return apiClient<BroadcastResult>('/blockchain/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: rawHex }),
  });
}

// ── Verify Message ──────────────────────────────────────────────────────────

export async function verifyMessage(params: {
  publicKey: string;
  message: string;
  signature: string;
  address?: string;
}): Promise<VerifyMessageResult> {
  return apiClient<VerifyMessageResult>('/blockchain/verify-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}
