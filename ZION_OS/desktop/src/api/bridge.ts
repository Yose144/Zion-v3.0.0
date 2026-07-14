// Direct bridge watcher HTTP API client.

import { httpGet } from '../lib/client';
import { BRIDGE, endpointUrl, type ServiceEndpoint } from '../config/services';

export interface BridgeHealth {
  status?: string;
  ok?: boolean;
  error?: string;
}

export interface BridgeLock {
  id?: string;
  txid?: string;
  sender?: string;
  recipient_chain?: string;
  recipient?: string;
  amount_zion?: number;
  created_at?: number;
  confirmed?: boolean;
}

function bridgeUrl(path: string, ep: ServiceEndpoint = BRIDGE): string {
  return endpointUrl(ep, path);
}

export async function checkBridgeHealth(ep: ServiceEndpoint = BRIDGE): Promise<boolean> {
  const h = await httpGet<BridgeHealth>(bridgeUrl('/health', ep), 2000);
  return !!h && (h.status === 'ok' || h.ok === true);
}

export async function fetchBridgeLocks(ep: ServiceEndpoint = BRIDGE): Promise<{ ok: boolean; locks: BridgeLock[]; error?: string } | null> {
  return httpGet<{ ok: boolean; locks: BridgeLock[]; error?: string }>(bridgeUrl('/locks', ep), 4000);
}
