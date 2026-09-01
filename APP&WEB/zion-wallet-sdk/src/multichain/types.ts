/**
 * Multichain shared types.
 * Used by the L2 wallet client, DEX swap, and bridge helpers.
 */

/** A supported blockchain family. */
export type ChainFamily = 'evm' | 'bitcoin' | 'zion-l1' | 'solana' | 'cosmos' | 'polkadot' | 'cardano';

/** Identifies a chain within a family (e.g. ethereum, base, bitcoin-mainnet). */
export interface ChainId {
  name: string;
  family: ChainFamily;
}

/** On-chain identifier for an asset (native coin or ERC-20/token contract). */
export interface AssetId {
  chain: string;
  ticker: string;
  /** Contract / token address for non-native assets. */
  contract?: string;
}

/** A tradeable asset with metadata. */
export interface Asset {
  id: AssetId;
  decimals: number;
  name: string;
}

/** A u128 amount carried as a decimal string to avoid precision loss. */
export interface Amount {
  raw: string;
}

/** A balance entry for a single asset. */
export interface Balance {
  assetKey: string;
  amount: string;
  decimals: number;
  ticker: string;
  chain: string;
}

/** A derived deposit address for a given chain. */
export interface DepositAddress {
  chain: string;
  address: string;
  publicKey?: string;
  derivationPath: string;
  purpose: string;
}

/** A DEX quote for a swap. */
export interface Quote {
  from: Asset;
  to: Asset;
  amountIn: string;
  expectedOut: string;
  route: string[];
  feeBps: number;
  slippageBps: number;
}

/** Parameters for executing a swap. */
export interface SwapParams {
  from: Asset;
  to: Asset;
  amount: string;
  minAmountOut?: string;
  recipient?: string;
}

/** Result of a swap execution. */
export interface SwapResult {
  orderId: string;
  status: string;
  amountOut: string;
  txHash?: string;
  route: string[];
}

/** Parameters for a withdrawal to an external address. */
export interface WithdrawParams {
  asset: string;
  amount: string;
  recipient: string;
}

/** Result of a withdrawal request. */
export interface WithdrawResult {
  withdrawalId: string;
  status: string;
}

/** Parameters for a cross-chain bridge transfer. */
export interface BridgeParams {
  from: string;
  to: string;
  amount: string;
  recipient: string;
}

/** Result of a bridge transfer. */
export interface BridgeResult {
  transferId: string;
  status: string;
}

/** A full snapshot of the user's multichain wallet state. */
export interface WalletSnapshot {
  userId: string;
  addresses: DepositAddress[];
  balances: Balance[];
  orders: unknown[];
  deposits: unknown[];
  withdrawals: unknown[];
}

/** Liquidity pool info for an AMM pair. */
export interface PoolInfo {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  feeBps: number;
}
