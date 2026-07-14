// Direct atomic-swap and swap-aggregator HTTP API clients.

import { httpGet, httpPost } from '../lib/client';
import { ATOMIC_SWAP, SWAP_AGGREGATOR, endpointUrl, type ServiceEndpoint } from '../config/services';

export interface SwapHealth {
  status?: string;
  ok?: boolean;
  error?: string;
}

export interface SwapOffer {
  id?: string;
  maker?: string;
  taker?: string;
  from_asset?: string;
  to_asset?: string;
  amount?: number;
  status?: string;
  created_at?: number;
}

export interface AggregatorSwap {
  id?: string;
  chain_in?: string;
  chain_out?: string;
  amount_in?: number;
  amount_out?: number;
  status?: string;
  created_at?: number;
}

function swapUrl(path: string, ep: ServiceEndpoint = ATOMIC_SWAP): string {
  return endpointUrl(ep, path);
}

function aggUrl(path: string, ep: ServiceEndpoint = SWAP_AGGREGATOR): string {
  return endpointUrl(ep, path);
}

export async function checkSwapHealth(ep: ServiceEndpoint = ATOMIC_SWAP): Promise<boolean> {
  const h = await httpGet<SwapHealth>(swapUrl('/health', ep), 2000);
  return !!h && (h.status === 'ok' || h.ok === true);
}

export async function checkSwapAggregatorHealth(ep: ServiceEndpoint = SWAP_AGGREGATOR): Promise<boolean> {
  const h = await httpGet<SwapHealth>(aggUrl('/health', ep), 2000);
  return !!h && (h.status === 'ok' || h.ok === true);
}

export async function fetchSwapOffers(ep: ServiceEndpoint = ATOMIC_SWAP): Promise<{ ok: boolean; offers: SwapOffer[]; error?: string } | null> {
  return httpGet<{ ok: boolean; offers: SwapOffer[]; error?: string }>(swapUrl('/offers', ep), 4000);
}

export async function fetchSwapAggregatorSwaps(ep: ServiceEndpoint = SWAP_AGGREGATOR): Promise<{ ok: boolean; swaps: AggregatorSwap[]; error?: string } | null> {
  return httpGet<{ ok: boolean; swaps: AggregatorSwap[]; error?: string }>(aggUrl('/swaps', ep), 4000);
}

export async function initiateSwap(payload: { from: string; to: string; amount: number }, ep: ServiceEndpoint = ATOMIC_SWAP): Promise<{ ok: boolean; error?: string } | null> {
  return httpPost<{ ok: boolean; error?: string }>(swapUrl('/initiate', ep), payload, 8000);
}
