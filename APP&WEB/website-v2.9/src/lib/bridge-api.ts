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
  network: 'Base Mainnet',
  chain_id: 8453,
  explorer_base: 'https://basescan.org/address/',
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

// ─── wZION contract ABI (minimal) ─────────────────────────────────────────────

export const WZION_ABI = [
  // ERC-20 standard
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  // Bridge-specific
  'function burn(uint256 amount, string calldata l1Recipient) external',
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event BurnForBridge(address indexed burner, uint256 amount, string l1Recipient)',
] as const;

/** Base Mainnet chain ID */
export const BASE_CHAIN_ID = 8453;
export const BASE_HEX_ID = '0x2105'; // 8453 in hex

/** @deprecated — use BASE_CHAIN_ID */
export const BASE_SEPOLIA_CHAIN_ID = BASE_CHAIN_ID;

/** Add / switch MetaMask to Base Mainnet */
export async function switchToBase(): Promise<void> {
  const { ethereum } = window as Window & { ethereum?: unknown };
  if (!ethereum) throw new Error('MetaMask not found');
  const eth = ethereum as {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  };
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_HEX_ID }],
    });
  } catch (e: unknown) {
    // 4902 = chain not added yet
    if ((e as { code?: number }).code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_HEX_ID,
            chainName: 'Base',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org'],
          },
        ],
      });
    } else {
      throw e;
    }
  }
}

/** @deprecated — use switchToBase() */
export const switchToBaseSepolia = switchToBase;
