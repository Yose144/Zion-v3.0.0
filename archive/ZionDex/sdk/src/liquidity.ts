import type { PoolInfo } from './types';
import { RouterClient } from './router';

/// Liquidity manager — browse pools, add/remove liquidity
export class LiquidityManager {
  private client: RouterClient;

  constructor(client: RouterClient) {
    this.client = client;
  }

  /// List all known pools
  async listPools(): Promise<PoolInfo[]> {
    const resp = await this.client.listPools();
    return resp.pools;
  }

  /// Filter pools by chain
  async poolsByChain(chain: string): Promise<PoolInfo[]> {
    const pools = await this.listPools();
    return pools.filter(p => p.chain === chain);
  }

  /// Filter pools by token
  async poolsByToken(token: string): Promise<PoolInfo[]> {
    const pools = await this.listPools();
    const upper = token.toUpperCase();
    return pools.filter(p =>
      p.token_a.toUpperCase() === upper || p.token_b.toUpperCase() === upper
    );
  }

  /// Get pool TVL (requires on-chain query — TODO)
  async getPoolTvl(pool: PoolInfo): Promise<{ tvlUsd: number; tokenAReserve: string; tokenBReserve: string }> {
    // TODO: Query pool contract for reserves
    // For now: return placeholder
    return {
      tvlUsd: 0,
      tokenAReserve: '0',
      tokenBReserve: '0',
    };
  }

  /// Add liquidity (requires signer — TODO)
  async addLiquidity(
    chain: string,
    tokenA: string,
    tokenB: string,
    amountA: string,
    amountB: string,
    tickLower: number = -887220,
    tickUpper: number = 887220,
  ): Promise<string> {
    // TODO: Build and submit addLiquidity TX via ethers
    throw new Error('addLiquidity not yet implemented — requires signer configuration');
  }

  /// Remove liquidity (requires signer — TODO)
  async removeLiquidity(
    poolId: string,
    tickLower: number,
    tickUpper: number,
    liquidity: string,
  ): Promise<{ amountA: string; amountB: string }> {
    // TODO: Build and submit removeLiquidity TX
    throw new Error('removeLiquidity not yet implemented — requires signer configuration');
  }
}
