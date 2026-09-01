/**
 * DEX Swap Helper
 * High-level swap convenience with slippage protection and human-readable quotes.
 */

import type { MultichainWalletClient } from './wallet-client.js';
import type { Asset, SwapResult } from './types.js';

export interface HumanQuote {
  /** Input amount in human units (e.g. "1.5"). */
  inputDisplay: string;
  /** Expected output amount in human units. */
  outputDisplay: string;
  /** Effective exchange rate (output units per input unit). */
  rate: number;
  /** Estimated price impact in percent (0–100). */
  priceImpact: number;
}

export class SwapHelper {
  private client: MultichainWalletClient;

  constructor(client: MultichainWalletClient) {
    this.client = client;
  }

  /**
   * Build the canonical asset key used by the L2 API.
   * Format: "<chain>:<ticker>" or "<chain>:<contract>".
   */
  private assetKey(asset: Asset): string {
    return asset.id.contract
      ? `${asset.id.chain}:${asset.id.contract}`
      : `${asset.id.chain}:${asset.id.ticker}`;
  }

  /**
   * Execute a swap with automatic slippage protection.
   * Fetches a fresh quote, computes the minimum acceptable output from the
   * slippage tolerance (in basis points), then submits the swap.
   *
   * @param slippageBps Slippage tolerance in basis points (100 = 1%).
   */
  async swapWithSlippage(
    from: Asset,
    to: Asset,
    amount: string,
    slippageBps: number = 100,
  ): Promise<SwapResult> {
    const fromKey = this.assetKey(from);
    const toKey = this.assetKey(to);

    const quote = await this.client.getQuote(fromKey, toKey, amount);

    // Compute minAmountOut = expectedOut * (1 - slippageBps / 10000)
    const expectedOut = BigInt(quote.expectedOut);
    const minAmountOut =
      (expectedOut * BigInt(10_000 - slippageBps)) / BigInt(10_000);

    return this.client.executeSwap({
      from,
      to,
      amount,
      minAmountOut: minAmountOut.toString(),
    });
  }

  /**
   * Get a quote and present it in human-readable units.
   * Converts raw u128 amounts using each asset's decimals.
   */
  async getHumanQuote(
    from: Asset,
    to: Asset,
    amount: string,
  ): Promise<HumanQuote> {
    const fromKey = this.assetKey(from);
    const toKey = this.assetKey(to);

    const quote = await this.client.getQuote(fromKey, toKey, amount);

    const inputRaw = BigInt(amount);
    const outputRaw = BigInt(quote.expectedOut);

    const inputDisplay = this.toHuman(inputRaw, from.decimals);
    const outputDisplay = this.toHuman(outputRaw, to.decimals);

    const rate =
      Number(outputRaw) / Math.pow(10, to.decimals) /
      (Number(inputRaw) / Math.pow(10, from.decimals));

    // Price impact: compare the quoted rate against the pool's mid rate.
    // Without a separate mid-quote we approximate impact from the fee + the
    // ratio of input to pool reserves if available; here we use the fee as a
    // baseline and report 0 when unknown.
    const priceImpact = this.estimatePriceImpact(quote);

    return {
      inputDisplay,
      outputDisplay,
      rate,
      priceImpact,
    };
  }

  /** Convert a raw u128 string into a human-readable decimal string. */
  private toHuman(raw: bigint, decimals: number): string {
    const negative = raw < 0n;
    const abs = negative ? -raw : raw;
    const divisor = 10n ** BigInt(decimals);
    const whole = abs / divisor;
    const fraction = abs % divisor;
    let str = whole.toString();
    if (decimals > 0) {
      let fracStr = fraction.toString().padStart(decimals, '0');
      // Trim trailing zeros but keep at least one fractional digit.
      fracStr = fracStr.replace(/0+$/, '') || '0';
      if (fracStr !== '0') {
        str = `${str}.${fracStr}`;
      }
    }
    return negative ? `-${str}` : str;
  }

  /** Best-effort price-impact estimate from quote metadata. */
  private estimatePriceImpact(quote: { feeBps?: number; slippageBps?: number }): number {
    // The L2 quote may expose a dedicated priceImpact field in future; until
    // then we approximate using the fee basis points as a lower bound.
    const fee = quote.feeBps ?? 0;
    return fee / 100; // bps → percent
  }
}
