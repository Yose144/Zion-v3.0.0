// Direct WARP L3 relay HTTP API client.

import { httpGet, httpPost } from '../lib/client';
import { WARP, endpointUrl, type ServiceEndpoint } from '../config/services';

export interface WarpChain {
  id: string;
  name?: string;
  chain_id?: number | string;
  rpc_url?: string;
  enabled?: boolean;
  symbol?: string;
}

export interface WarpTransfer {
  id: string;
  source_chain?: string;
  destination_chain?: string;
  sender?: string;
  recipient?: string;
  amount?: number;
  status?: string;
  created_at?: number;
  completed_at?: number;
}

export interface WarpHealth {
  status?: string;
  version?: string;
  transfers_total?: number;
  transfers_pending?: number;
  ok?: boolean;
}

export interface WarpChainsPayload {
  ok: boolean;
  data: WarpChain[];
  error?: string;
}

export interface WarpTransfersPayload {
  ok: boolean;
  data: WarpTransfer[];
  total: number;
  error?: string;
}

function warpUrl(path: string, ep: ServiceEndpoint = WARP): string {
  return endpointUrl(ep, path);
}

export async function checkWarpHealth(ep: ServiceEndpoint = WARP): Promise<boolean> {
  const h = await httpGet<WarpHealth>(warpUrl('/health', ep), 2000);
  return !!h && (h.status === 'ok' || h.ok === true);
}

export async function fetchWarpChains(ep: ServiceEndpoint = WARP): Promise<WarpChain[] | null> {
  const res = await httpGet<WarpChainsPayload>(warpUrl('/chains', ep), 3000);
  return res?.data ?? null;
}

export async function fetchWarpTransfers(ep: ServiceEndpoint = WARP): Promise<WarpTransfer[] | null> {
  const res = await httpGet<WarpTransfersPayload>(warpUrl('/transfers', ep), 3000);
  return res?.data ?? null;
}

export async function initiateWarpTransfer(
  payload: { source_chain: string; destination_chain: string; recipient: string; amount: number; memo?: string },
  ep: ServiceEndpoint = WARP,
): Promise<{ ok: boolean; transfer?: WarpTransfer; error?: string } | null> {
  return httpPost<{ ok: boolean; transfer?: WarpTransfer; error?: string }>(warpUrl('/transfer', ep), payload, 8000);
}
