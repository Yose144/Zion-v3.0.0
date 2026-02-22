/**
 * ZION Bridge API Client
 * Fetches bridge status from Next.js proxy → Prometheus metrics endpoint (port 9100)
 */

export interface BridgeStatus {
  online: boolean;
  uptime_seconds: number;
  last_l1_height: number;
  last_evm_block: number;
  l1_locks_detected: number;
  l1_locks_finalized: number;
  evm_mints_submitted: number;
  evm_mints_confirmed: number;
  evm_burns_detected: number;
  l1_unlocks_submitted: number;
  l1_unlocks_confirmed: number;
  errors_total: number;
  fetched_at: number;
}

export interface BridgeContractInfo {
  wzion_address: string;
  bridge_address: string;
  network: string;
  chain_id: number;
  explorer_base: string;
}

export const BRIDGE_CONTRACTS: BridgeContractInfo = {
  wzion_address: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  bridge_address: '0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721',
  network: 'Base Sepolia (Testnet)',
  chain_id: 84532,
  explorer_base: 'https://sepolia.basescan.org/address/',
};

const defaultStatus: BridgeStatus = {
  online: false,
  uptime_seconds: 0,
  last_l1_height: 0,
  last_evm_block: 0,
  l1_locks_detected: 0,
  l1_locks_finalized: 0,
  evm_mints_submitted: 0,
  evm_mints_confirmed: 0,
  evm_burns_detected: 0,
  l1_unlocks_submitted: 0,
  l1_unlocks_confirmed: 0,
  errors_total: 0,
  fetched_at: Date.now(),
};

/**
 * Fetch bridge status via internal Next.js API proxy.
 * Falls back to offline status on any error.
 */
export async function getBridgeStatus(): Promise<BridgeStatus> {
  try {
    const res = await fetch('/api/bridge/status', {
      next: { revalidate: 10 },
    });
    if (!res.ok) return { ...defaultStatus, fetched_at: Date.now() };
    return await res.json();
  } catch {
    return { ...defaultStatus, fetched_at: Date.now() };
  }
}

/** Format uptime in human readable form */
export function formatUptime(seconds: number): string {
  if (seconds <= 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Calculate bridge efficiency as percentage */
export function bridgeEfficiency(status: BridgeStatus): number {
  const { l1_locks_finalized, l1_locks_detected } = status;
  if (l1_locks_detected === 0) return 100;
  return Math.round((l1_locks_finalized / l1_locks_detected) * 100);
}
