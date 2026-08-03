/// Chain identifiers supported by ZionDex
export type ChainId =
  | 'zion' | 'base' | 'arbitrum' | 'bsc' | 'polygon' | 'optimism' | 'avalanche'
  | 'solana' | 'tron' | 'stellar' | 'bitcoin' | 'cardano' | 'cosmos'
  | 'aptos' | 'sui' | 'near' | 'ton';

/// Token identifier
export interface TokenRef {
  chain: ChainId;
  symbol: string;
  address?: string;
  decimals?: number;
}

/// Quote request
export interface QuoteRequest {
  srcChain: ChainId;
  srcToken: string;
  destChain: ChainId;
  destToken: string;
  amount: string;
}

/// A single step in a swap path
export interface SwapStep {
  type: 'same_chain_swap' | 'bridge';
  chain?: ChainId;
  from_chain?: ChainId;
  to_chain?: ChainId;
  dex?: string;
  from_token?: TokenRef;
  to_token?: TokenRef;
  asset?: TokenRef;
  amount_in?: string;
  amount?: string;
  expected_amount_out?: string;
  fee_bps?: number;
  estimated_time_secs?: number;
}

/// A complete swap path
export interface SwapPath {
  steps: SwapStep[];
  expected_output: string;
  min_output: string;
  total_fee_bps: number;
  estimated_time_secs: number;
  price_impact_bps: number;
}

/// Quote response
export interface QuoteResponse {
  quote_id: string;
  path: SwapPath;
  expires_at: string;
}

/// Swap execution request
export interface SwapRequest {
  quote_id: string;
  sender: string;
  recipient: string;
  max_slippage_bps: number;
}

/// Swap status
export type SwapStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'refunded';

/// Step status
export interface StepStatus {
  step_index: number;
  step_type: string;
  status: SwapStatus;
  tx_hash: string | null;
  error: string | null;
}

/// Swap execution response
export interface SwapResponse {
  swap_id: string;
  status: SwapStatus;
  steps: StepStatus[];
  monitor_url: string;
}

/// Swap record (full state)
export interface SwapRecord {
  id: string;
  quote_id: string;
  sender: string;
  recipient: string;
  src_chain: ChainId;
  dest_chain: ChainId;
  amount_in: string;
  amount_out: string | null;
  status: SwapStatus;
  steps: StepStatus[];
  created_at: string;
  updated_at: string;
}

/// Health response
export interface HealthResponse {
  status: string;
  version: string;
  chains: ChainId[];
  uptime_secs: number;
}

/// Pool info
export interface PoolInfo {
  chain: ChainId;
  dex: string;
  token_a: string;
  token_b: string;
  address: string;
  fee_bps: number;
  enabled: boolean;
}

/// SDK configuration
export interface ZionDexConfig {
  routerUrl: string;
  warpUrl?: string;
  signer?: any; // ethers.Signer
}
