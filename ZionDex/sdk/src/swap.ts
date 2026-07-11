import type { SwapRecord, SwapStatus, StepStatus } from './types';
import { RouterClient } from './router';

/// Swap manager — wraps quote + execute + monitor
export class SwapManager {
  private client: RouterClient;

  constructor(client: RouterClient) {
    this.client = client;
  }

  /// Get a quote for a swap
  async quote(
    srcChain: string,
    srcToken: string,
    destChain: string,
    destToken: string,
    amount: string,
  ) {
    return this.client.quote({
      srcChain: srcChain as any,
      srcToken,
      destChain: destChain as any,
      destToken,
      amount,
    });
  }

  /// Execute a swap from a quote
  async execute(quoteId: string, sender: string, recipient: string, maxSlippageBps: number = 200) {
    return this.client.swap({
      quote_id: quoteId,
      sender,
      recipient,
      max_slippage_bps: maxSlippageBps,
    });
  }

  /// Poll swap status until completed or failed
  async waitForCompletion(swapId: string, timeoutMs: number = 600000, pollIntervalMs: number = 5000): Promise<SwapRecord> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const swap = await this.client.getSwap(swapId);

      if (swap.status === 'completed' || swap.status === 'failed' || swap.status === 'refunded') {
        return swap;
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Swap ${swapId} did not complete within ${timeoutMs}ms`);
  }

  /// Subscribe to swap updates via WebSocket
  subscribe(swapId: string, onUpdate: (swap: SwapRecord) => void, onError?: (err: Error) => void): WebSocket {
    const wsUrl = this.client['baseUrl'].replace(/^http/, 'ws') + `/stream`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'subscribe', swap_id: swapId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'swap_update' && msg.swap) {
          onUpdate(msg.swap as SwapRecord);
        }
      } catch (e) {
        if (onError) onError(e as Error);
      }
    };

    ws.onerror = (err) => {
      if (onError) onError(new Error('WebSocket error'));
    };

    return ws;
  }

  /// List recent swaps
  async list(limit: number = 20): Promise<SwapRecord[]> {
    return this.client.listSwaps(limit);
  }
}
