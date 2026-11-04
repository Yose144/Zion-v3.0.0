/**
 * Explorer cache warm-up.
 *
 * Why: every deploy restarts `zion-website`, and the first visitor after a
 * restart pays for cold caches. Some explorer endpoints derive their data by
 * walking chain history (~200 sampled blocks), so a cold `/charts` call could
 * take seconds while the ZION node is busy.
 *
 * This module pre-populates the hot read-only endpoints through the app's own
 * HTTP surface (which is exactly what fills the route-level SWR caches), a few
 * seconds after boot and then periodically. Requests are fire-and-forget: any
 * failure is ignored, because this is purely an optimisation.
 *
 * Disable with `ZION_EXPLORER_WARMUP=0`.
 */

const HOT_INTERVAL_MS = 45_000;
const COOL_INTERVAL_MS = 5 * 60_000;

const HOT_PATHS = [
  '/api/blockchain/stats',
  '/api/blockchain/blocks?limit=20',
  '/api/blockchain/transactions?limit=20',
  '/api/blockchain/charts?type=difficulty&range=24h',
  '/api/blockchain/charts?type=hashrate&range=24h',
  '/api/blockchain/charts?type=blocktime&range=24h',
  '/api/blockchain/charts?type=emission&range=24h',
  '/api/blockchain/charts?type=blocksize&range=24h',
  '/api/blockchain/charts?type=txcount&range=24h',
];

const COOL_PATHS = [
  '/api/blockchain/emission',
  '/api/blockchain/consensus',
  '/api/blockchain/richlist?limit=100',
  '/api/blockchain/miners',
  '/api/blockchain/peers',
  '/api/blockchain/mempool',
];

/** Populate the same in-process caches the RPC client uses, without going
 *  through HTTP, for a sub-second warm-up of the node-facing client caches. */
export async function warmRpcClientCaches(): Promise<void> {
  try {
    const { getZionRpc } = await import('@/lib/zion-rpc');
    const rpc = getZionRpc();
    await Promise.all([
      rpc.getInfo().catch(() => null),
      rpc.getLastBlockHeader().catch(() => null),
    ]);
  } catch {
    /* warm-up is best effort */
  }
}

export function startExplorerWarmup(): void {
  if (process.env.ZION_EXPLORER_WARMUP === '0') return;

  const globalKey = '__zionExplorerWarmupStarted';
  const globalState = globalThis as unknown as Record<string, boolean>;
  if (globalState[globalKey]) return;
  globalState[globalKey] = true;

  const port = process.env.PORT || '3000';
  const base = `http://127.0.0.1:${port}`;

  const hit = (path: string) =>
    fetch(`${base}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      .then((res) => (res.body ? res.arrayBuffer() : null))
      .catch(() => null);

  const warmHot = () => Promise.all(HOT_PATHS.map(hit)).catch(() => undefined);
  const warmCool = () => Promise.all(COOL_PATHS.map(hit)).catch(() => undefined);

  // Give the HTTP server a moment to bind before calling ourselves.
  const kickoff = setTimeout(() => {
    void warmRpcClientCaches();
    void warmHot();
    setTimeout(() => void warmCool(), 2_000);
  }, 3_000);
  kickoff.unref?.();

  const hot = setInterval(() => void warmHot(), HOT_INTERVAL_MS);
  hot.unref?.();
  const cool = setInterval(() => void warmCool(), COOL_INTERVAL_MS);
  cool.unref?.();
}
