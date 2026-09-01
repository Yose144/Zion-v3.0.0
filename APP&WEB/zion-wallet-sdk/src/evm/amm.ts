/**
 * On-chain AMM Client (ZIONDex)
 * Interacts with a Uniswap-V2-style router and pair contracts via ethers v6.
 */

import {
  Contract,
  JsonRpcProvider,
  Wallet,
  getAddress,
  type ContractRunner,
} from 'ethers';
import type { PoolInfo } from '../multichain/types.js';

// Uniswap V2-compatible router ABI (subset used by ZIONDex).
const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)',
  'function getAmountsIn(uint amountOut, address[] path) view returns (uint[] amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[] amounts)',
  'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] path, address to, uint deadline) returns (uint[] amounts)',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB)',
] as const;

// Uniswap V2-compatible pair ABI (subset).
const PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function feeBps() view returns (uint256)',
] as const;

export class AmmClient {
  private router: Contract;
  private provider: JsonRpcProvider;
  private wallet?: Wallet;

  constructor(routerAddress: string, provider: JsonRpcProvider, wallet?: Wallet) {
    this.provider = provider;
    this.wallet = wallet;
    const runner: ContractRunner = wallet ?? provider;
    this.router = new Contract(getAddress(routerAddress), ROUTER_ABI, runner);
  }

  /** Quote the expected output amounts for a given input through a path. */
  async getAmountsOut(amountIn: bigint, path: string[]): Promise<bigint[]> {
    const amounts = (await this.router.getAmountsOut(amountIn, path.map(getAddress))) as bigint[];
    return amounts;
  }

  /** Swap an exact amount of input tokens for as many output tokens as possible. */
  async swapExactTokensForTokens(
    amountIn: bigint,
    amountOutMin: bigint,
    path: string[],
    to: string,
    deadline: number,
  ): Promise<string> {
    const tx = await this.router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path.map(getAddress),
      getAddress(to),
      deadline,
    );
    return tx.hash as string;
  }

  /** Add liquidity for a token pair. Returns the tx hash. */
  async addLiquidity(
    tokenA: string,
    tokenB: string,
    amountA: bigint,
    amountB: bigint,
    amountAMin: bigint,
    amountBMin: bigint,
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error('addLiquidity requires a signer wallet');
    }
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 min
    const to = this.wallet.address;
    const tx = await this.router.addLiquidity(
      getAddress(tokenA),
      getAddress(tokenB),
      amountA,
      amountB,
      amountAMin,
      amountBMin,
      to,
      deadline,
    );
    return tx.hash as string;
  }

  /** Remove liquidity from a pair. Returns the tx hash. */
  async removeLiquidity(
    tokenA: string,
    tokenB: string,
    liquidity: bigint,
    amountAMin: bigint,
    amountBMin: bigint,
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error('removeLiquidity requires a signer wallet');
    }
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 min
    const to = this.wallet.address;
    const tx = await this.router.removeLiquidity(
      getAddress(tokenA),
      getAddress(tokenB),
      liquidity,
      amountAMin,
      amountBMin,
      to,
      deadline,
    );
    return tx.hash as string;
  }

  /** Fetch reserves and metadata for a pair contract. */
  async getPoolInfo(pairAddress: string): Promise<PoolInfo> {
    const pair = new Contract(getAddress(pairAddress), PAIR_ABI, this.provider);
    const [token0, token1, reserves, feeBps] = await Promise.all([
      pair.token0() as Promise<string>,
      pair.token1() as Promise<string>,
      pair.getReserves() as Promise<[bigint, bigint, number]>,
      (async () => {
        try {
          return ((await pair.feeBps()) as bigint);
        } catch {
          return 30n; // default 0.3% if not exposed
        }
      })(),
    ]);
    return {
      pairAddress: getAddress(pairAddress),
      token0,
      token1,
      reserve0: reserves[0].toString(),
      reserve1: reserves[1].toString(),
      feeBps: Number(feeBps),
    };
  }
}
