/**
 * ZION Bridge API Client
 * Fetches bridge status from Next.js proxy → Prometheus metrics endpoint (port 9101)
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
  // Canonical vault + E2E confirmation (added 2026-06-29, vault fix e6175b5b)
  l1_vault_address?: string;
  bridge_e2e_confirmed?: boolean;
  bridge_e2e_burn_tx?: string;
  bridge_e2e_unlock_block?: number;
  validator_threshold?: string;
  fetched_at: number;
}

export interface BridgeContractInfo {
  wzion_address: string;
  bridge_address: string;
  l1_bridge_address: string;
  network: string;
  chain_id: number;
  explorer_base: string;
}

/** Base Sepolia Testnet contracts (LIVE) */
export const BRIDGE_CONTRACTS_SEPOLIA: BridgeContractInfo = {
  wzion_address: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  bridge_address: '0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1',
  l1_bridge_address: 'zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0',
  network: 'Base Sepolia Testnet',
  chain_id: 84532,
  explorer_base: 'https://sepolia.basescan.org/address/',
};

/** Base Mainnet contracts — ZIONBridge v3 deployed 2026-06-29 (no timelock for premine). */
export const BRIDGE_CONTRACTS_MAINNET: BridgeContractInfo = {
  wzion_address: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  bridge_address: '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467',
  l1_bridge_address: 'zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0',
  network: 'Base Mainnet',
  chain_id: 8453,
  explorer_base: 'https://basescan.org/address/',
};

/** Active contract set — mainnet 5/5 bridge is live */
export const BRIDGE_CONTRACTS = BRIDGE_CONTRACTS_MAINNET;

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
export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_MAINNET_HEX_ID = '0x2105'; // 8453 in hex

/** Base Sepolia Testnet chain ID */
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_HEX_ID = '0x14a34'; // 84532 in hex

/** @deprecated — use BASE_MAINNET_CHAIN_ID */
export const BASE_CHAIN_ID = BASE_MAINNET_CHAIN_ID;

/** @deprecated — use BASE_MAINNET_HEX_ID */
export const BASE_HEX_ID = BASE_MAINNET_HEX_ID;

/** Add / switch MetaMask to Base Mainnet */
export async function switchToBaseMainnet(): Promise<void> {
  const { ethereum } = window as Window & { ethereum?: unknown };
  if (!ethereum) throw new Error('MetaMask not found');
  const eth = ethereum as {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  };
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_MAINNET_HEX_ID }],
    });
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_MAINNET_HEX_ID,
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

/** Add / switch MetaMask to Base Sepolia Testnet */
export async function switchToBaseSepolia(): Promise<void> {
  const { ethereum } = window as Window & { ethereum?: unknown };
  if (!ethereum) throw new Error('MetaMask not found');
  const eth = ethereum as {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  };
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_SEPOLIA_HEX_ID }],
    });
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_SEPOLIA_HEX_ID,
            chainName: 'Base Sepolia Testnet',
            nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://sepolia.base.org'],
            blockExplorerUrls: ['https://sepolia.basescan.org'],
          },
        ],
      });
    } else {
      throw e;
    }
  }
}

/** @deprecated — use switchToBaseMainnet() */
export const switchToBase = switchToBaseMainnet;
