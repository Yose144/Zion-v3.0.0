import type { ZionDexConfig, QuoteResponse, SwapRecord, SwapResponse, PoolInfo, HealthResponse } from './types';
import { RouterClient } from './router';
import { SwapManager } from './swap';
import { LiquidityManager } from './liquidity';

/// Main ZionDex SDK entry point
///
/// @example
/// ```typescript
/// import { ZionDex } from '@zion/dex-sdk';
///
/// const dex = new ZionDex({
///   routerUrl: 'https://dex.zionterranova.com',
/// });
///
/// // Get a quote
/// const quote = await dex.quote({
///   srcChain: 'solana',
///   srcToken: 'USDC',
///   destChain: 'base',
///   destToken: 'wZION',
///   amount: '1000',
/// });
///
/// // Execute swap
/// const swap = await dex.swap({
///   quoteId: quote.quote_id,
///   sender: 'zion1...',
///   recipient: '0x...',
///   maxSlippageBps: 200,
/// });
///
/// // Track status
/// const final = await dex.waitForCompletion(swap.swap_id);
/// console.log('Swap completed:', final.amount_out);
/// ```
export class ZionDex {
  public router: RouterClient;
  public swaps: SwapManager;
  public liquidity: LiquidityManager;

  constructor(config: ZionDexConfig) {
    this.router = new RouterClient(config.routerUrl);
    this.swaps = new SwapManager(this.router);
    this.liquidity = new LiquidityManager(this.router);
  }

  /// Get a quote
  async quote(req: import('./types').QuoteRequest): Promise<QuoteResponse> {
    return this.router.quote(req);
  }

  /// Execute a swap
  async swap(req: import('./types').SwapRequest): Promise<SwapResponse> {
    return this.router.swap(req);
  }

  /// Get swap status
  async getSwap(id: string): Promise<SwapRecord> {
    return this.router.getSwap(id);
  }

  /// Wait for swap completion
  async waitForCompletion(swapId: string, timeoutMs?: number): Promise<SwapRecord> {
    return this.swaps.waitForCompletion(swapId, timeoutMs);
  }

  /// Subscribe to swap updates
  subscribe(swapId: string, onUpdate: (swap: SwapRecord) => void, onError?: (err: Error) => void): WebSocket {
    return this.swaps.subscribe(swapId, onUpdate, onError);
  }

  /// List pools
  async listPools(): Promise<PoolInfo[]> {
    return this.liquidity.listPools();
  }

  /// Health check
  async health(): Promise<HealthResponse> {
    return this.router.health();
  }
}
