/**
 * Cross-chain Bridge Helper
 * Convenience wrapper around the L2 bridge transfer endpoints.
 */

import type { MultichainWalletClient } from './wallet-client.js';
import type { BridgeResult } from './types.js';

export class BridgeHelper {
  private client: MultichainWalletClient;

  constructor(client: MultichainWalletClient) {
    this.client = client;
  }

  /**
   * Bridge an asset from one chain to another.
   * @param from  Source chain name (e.g. "ethereum").
   * @param to    Destination chain name (e.g. "zion-l1").
   * @param amount Raw amount string (u128).
   * @param recipient Recipient address on the destination chain.
   */
  async bridgeAsset(
    from: string,
    to: string,
    amount: string,
    recipient: string,
  ): Promise<BridgeResult> {
    return this.client.bridge({ from, to, amount, recipient });
  }

  /** Poll the status of an in-flight bridge transfer. */
  async getBridgeStatus(transferId: string): Promise<Record<string, unknown>> {
    return this.client.getBridgeStatus(transferId);
  }
}
