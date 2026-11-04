import { getZionRpc, type ZionBlockHeader, type ZionNetworkInfo } from '@/lib/zion-rpc';

const RANGE_BLOCKS: Record<string, number> = {
  '1h': 60,
  '6h': 360,
  '24h': 1440,
  '7d': 10080,
  '30d': 43200,
  'all': 100000,
};

const CACHE_TTL_MS = 45_000;
const STALE_TTL_MS = 300_000;

type BlockHistory = {
  range: string;
  resolution: number;
  chainHeight: number;
  info: ZionNetworkInfo;
  headers: ZionBlockHeader[];
};

type CacheEntry = { value: BlockHistory; timestamp: number };

const historyCache = new Map<string, CacheEntry>();
const historyRequests = new Map<string, Promise<BlockHistory>>();

function normalizeRange(range: string): string {
  return Object.prototype.hasOwnProperty.call(RANGE_BLOCKS, range) ? range : '24h';
}

function normalizeResolution(resolution: number): number {
  if (!Number.isFinite(resolution) || resolution <= 0) return 0;
  return Math.min(10_000, Math.max(1, Math.floor(resolution)));
}

async function loadBlockHistory(range: string, resolution: number): Promise<BlockHistory> {
  const rpc = getZionRpc();
  const info = await rpc.getInfo();
  const chainHeight = Math.max(0, info.height);
  const blocksToFetch = Math.min(RANGE_BLOCKS[range], chainHeight);
  const step = resolution || Math.max(1, Math.floor(blocksToFetch / 200));

  if (blocksToFetch === 0) {
    return { range, resolution: step, chainHeight, info, headers: [] };
  }

  const startHeight = Math.max(0, chainHeight - blocksToFetch);

  // Sample *before* fetching. The previous version fetched every block in the
  // range and then kept every `step`-th header — for the 7d/30d/all ranges
  // that meant 10k–43k `getBlockByHeight` round-trips (one TCP socket each),
  // which is what made /api/blockchain/charts hang past the proxy timeout.
  // Now only the sampled heights (≤ ~200) are requested.
  const heights: number[] = [];
  for (let h = startHeight; h <= chainHeight; h += step) heights.push(h);
  if (heights.length === 0 || heights[heights.length - 1] !== chainHeight) heights.push(chainHeight);

  const CONCURRENCY = 25;
  const headers: ZionBlockHeader[] = [];
  for (let i = 0; i < heights.length; i += CONCURRENCY) {
    const batch = heights.slice(i, i + CONCURRENCY);
    const batchHeaders = await Promise.all(
      batch.map((height) => rpc.getBlockHeaderByHeight(height).catch(() => null)),
    );
    for (const header of batchHeaders) if (header) headers.push(header);
  }

  headers.sort((a, b) => a.height - b.height);

  return { range, resolution: step, chainHeight, info, headers };
}

export async function getBlockHistory(rangeParam: string, resolutionParam = 0): Promise<BlockHistory> {
  const range = normalizeRange(rangeParam);
  const resolution = normalizeResolution(resolutionParam);
  const key = `${range}:${resolution}`;
  const now = Date.now();
  const cached = historyCache.get(key);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) return cached.value;

  const active = historyRequests.get(key);
  if (active) return active;

  const request = loadBlockHistory(range, resolution)
    .then((value) => {
      historyCache.set(key, { value, timestamp: Date.now() });
      return value;
    })
    .catch((error) => {
      if (cached && now - cached.timestamp < STALE_TTL_MS) return cached.value;
      throw error;
    });

  historyRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (historyRequests.get(key) === request) historyRequests.delete(key);
  }
}
