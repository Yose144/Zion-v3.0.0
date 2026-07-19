/**
 * ZION Explorer — Server-Sent Events Stream (V4)
 *
 * Provides real-time updates for new blocks and mempool changes.
 * Internally polls the ZION daemon RPC at a configurable interval
 * and emits SSE events to connected clients.
 *
 * Events:
 *   - "stats"    — network stats snapshot (height, hashrate, difficulty, mempool)
 *   - "new_block" — emitted when chain height increases (includes block header)
 *   - "mempool_update" — emitted when mempool TX count changes
 *   - "ping"     — keepalive every 15s
 *
 * Query params:
 *   - interval — poll interval in seconds (default: 15, min: 5, max: 60)
 *
 * Usage (client-side):
 *   const es = new EventSource('/api/blockchain/sse?interval=15');
 *   es.addEventListener('new_block', (e) => { ... });
 *   es.addEventListener('stats', (e) => { ... });
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  const searchParams = request.nextUrl.searchParams;
  const intervalSec = Math.min(60, Math.max(5, parseInt(searchParams.get('interval') || '15')));
  const intervalMs = intervalSec * 1000;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastHeight = 0;
      let lastMempoolCount = -1;
      let isClosed = false;

      // Send initial comment to establish connection
      const sendEvent = (event: string, data: unknown) => {
        if (isClosed) return;
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          isClosed = true;
        }
      };

      const sendComment = (text: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`: ${text}\n\n`));
        } catch {
          isClosed = true;
        }
      };

      // Polling loop
      const poll = async () => {
        if (isClosed) return;

        try {
          // Fetch chain info + mempool in parallel
          const [info, mempool] = await Promise.all([
            rpc.getInfo().catch(() => null),
            rpc.rpcCall<any>('getMempoolInfo').catch(() => null),
          ]);

          if (!info) {
            sendComment('RPC unavailable, retrying...');
            return;
          }

          const currentHeight = info.height ?? 0;
          const mempoolCount = (info as any).mempool_transactions ?? info.tx_pool_size ?? mempool?.size ?? mempool?.count ?? 0;
          const mempoolSize = mempool?.size_bytes ?? 0;

          // Always send stats snapshot
          const statsPayload = {
            height: currentHeight,
            tip_hash: (info as any).tip_hash ?? info.top_block_hash ?? '',
            difficulty: info.difficulty ?? 0,
            network_hashrate: (info as any).network_hashrate ?? (info as any).hashrate ?? 0,
            mempool_size: mempoolCount,
            mempool_bytes: mempoolSize,
            protocol_version: (info as any).protocol_version ?? info.version ?? '',
            consensus_profile: (info as any).consensus_profile ?? '',
            timestamp: Date.now(),
          };
          sendEvent('stats', statsPayload);

          // New block detected
          if (lastHeight > 0 && currentHeight > lastHeight) {
            try {
              // Fetch the new block header for a richer event
              const block = await rpc.getBlock(currentHeight).catch(() => null);
              const blockEvent = {
                height: currentHeight,
                hash: block?.hash ?? (info as any).tip_hash ?? info.top_block_hash ?? '',
                prev_hash: block?.prev_hash ?? '',
                timestamp: block?.timestamp ?? 0,
                difficulty: block?.difficulty ?? info.difficulty ?? 0,
                reward: block?.reward ? block.reward / ATOMIC_UNITS_PER_ZION : 0,
                tx_count: block?.num_txes ?? block?.v3_transactions?.length ?? 0,
                miner: block?.miner_address ?? '',
              };
              sendEvent('new_block', blockEvent);
            } catch {
              // Fallback: send minimal block event
              sendEvent('new_block', {
                height: currentHeight,
                hash: (info as any).tip_hash ?? info.top_block_hash ?? '',
                timestamp: Date.now(),
              });
            }
          }

          // Mempool change detected
          if (lastMempoolCount >= 0 && mempoolCount !== lastMempoolCount) {
            sendEvent('mempool_update', {
              count: mempoolCount,
              size_bytes: mempoolSize,
              prev_count: lastMempoolCount,
              timestamp: Date.now(),
            });
          }

          lastHeight = currentHeight;
          lastMempoolCount = mempoolCount;
        } catch (err) {
          sendComment(`poll error: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      };

      // Initial poll immediately
      await poll();

      // Set up interval
      const pollTimer = setInterval(poll, intervalMs);

      // Keepalive ping every 15s
      const pingTimer = setInterval(() => {
        sendEvent('ping', { timestamp: Date.now() });
      }, 15000);

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(pollTimer);
        clearInterval(pingTimer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
