// ── Server-side chain clients (Base L2) ──────────────────────────────
// Used by API routes / indexer. Chain follows NEXT_PUBLIC_CHAIN_ID.

import { createPublicClient, createWalletClient, fallback, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { CHAIN_ID, ZION_MARKETPLACE_ADDRESS, ZION_ARTIFACT_NFT_ADDRESS, WZION_ADDRESS } from '@/lib/contracts';

export const activeChain = CHAIN_ID === 84532 ? baseSepolia : base;
export const RPC_URL =
  process.env.BASE_RPC_URL ??
  process.env.NEXT_PUBLIC_BASE_RPC_URL ??
  (activeChain.id === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org');

/**
 * Ordered RPC list — first wins, others are automatic fallbacks.
 * `BASE_RPC_URLS` (comma-separated) takes precedence; otherwise
 * BASE_RPC_URL followed by sensible public defaults.
 */
export const RPC_URLS: string[] = (() => {
  const env = process.env.BASE_RPC_URLS;
  if (env) return env.split(',').map((u) => u.trim()).filter(Boolean);
  const defaults =
    activeChain.id === 84532
      ? ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com']
      : ['https://base-rpc.publicnode.com', 'https://mainnet.base.org', 'https://base.drpc.org'];
  return [RPC_URL, ...defaults.filter((u) => u !== RPC_URL)];
})();

function transport() {
  const endpoints = RPC_URLS.map((url) => http(url, { timeout: 15_000 }));
  return endpoints.length === 1 ? endpoints[0] : fallback(endpoints, { rank: false });
}

// Infer the concrete client type from the builder — the union chain type and
// viem/wagmi type duplication make the generic PublicClient annotation brittle.
function buildPublicClient() {
  return createPublicClient({
    chain: activeChain,
    transport: transport(),
  });
}
export type ServerPublicClient = ReturnType<typeof buildPublicClient>;

let _public: ServerPublicClient | null = null;
export function getPublicClient(): ServerPublicClient {
  if (!_public) _public = buildPublicClient();
  return _public;
}

export function getMinterAccount(): PrivateKeyAccount {
  const key = process.env.MINTER_PRIVATE_KEY ?? '';
  if (!key) throw new Error('MINTER_PRIVATE_KEY not configured');
  const k = key.startsWith('0x') ? key : `0x${key}`;
  return privateKeyToAccount(k as `0x${string}`);
}

export function getWalletClient() {
  return createWalletClient({
    account: getMinterAccount(),
    chain: activeChain,
    transport: transport(),
  });
}
export type ServerWalletClient = ReturnType<typeof getWalletClient>;

export const MARKETPLACE_ADDR = ZION_MARKETPLACE_ADDRESS as `0x${string}`;
export const NFT_ADDR = ZION_ARTIFACT_NFT_ADDRESS as `0x${string}`;
export const WZION_ADDR = WZION_ADDRESS as `0x${string}`;

/** Contracts are only usable once addresses are configured. */
export function contractsConfigured(): boolean {
  return Boolean(ZION_MARKETPLACE_ADDRESS && ZION_ARTIFACT_NFT_ADDRESS);
}
