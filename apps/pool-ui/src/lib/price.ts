// Live ZION price — read directly on-chain from the wZION/USDT
// Uniswap V3 0.3% pool on Base (same source the app.zionterranova.com
// /api/defi/price endpoint uses). Client-side fetch works because
// public Base RPC endpoints send `Access-Control-Allow-Origin: *`
// (dapp traffic), so the static pool UI needs no proxy.
//
// price = (sqrtPriceX96 / 2^96)^2 · 10^(dec0 - dec1)  [token1 per token0]
// token0 = wZION (18 dec), token1 = USDT (6 dec) → ×1e12.

const POOL = '0x186b46c2f04153999d44D25179cD623fD62Bfda2'; // wZION/USDT 0.3%
const SLOT0 = '0x3850c7bd'; // slot0()
const Q96 = 7.9228162514264338e28; // 2^96

// sqrtPriceX96 (~9e20) exceeds Number.MAX_SAFE_INTEGER, but the relative
// rounding (~1e-7) is far below display precision — accumulate manually
// so no BigInt/es2020 lib requirement is needed.
function hexToNumber(hex: string): number {
  let n = 0;
  for (const ch of hex) n = n * 16 + parseInt(ch, 16);
  return n;
}
const RPCS = [
  'https://base.publicnode.com',
  'https://mainnet.base.org',
  'https://base-rpc.publicnode.com',
];

// Official seed price — same fallback the defi API documents.
export const SEED_PRICE_USD = 0.0002;

export interface ZionPrice {
  usd: number;
  source: 'onchain' | 'seed';
}

// ── CoinGecko market prices ────────────────────────────────────────────
// Free tier, CORS-open. Every listed coin the pool serves is fetched in
// one call; unlisted coins (KRX) stay absent and render as '—'.

import type { CoinId } from './types';

export const COINGECKO_ID: Partial<Record<CoinId, string>> = {
  qtc: 'quantus',
  prl: 'pearl-2',
  zec: 'zcash',
  vrsc: 'verus-coin',
  rtm: 'raptoreum',
  zano: 'zano',
  zcl: 'zclassic',
  mewc: 'meowcoin',
  evr: 'evrmore',
  phx: 'phoenixcoin',
};

export interface MarketPrice {
  usd: number;
  change_24h: number | null;
}

export async function fetchMarketPrices(): Promise<Record<string, MarketPrice>> {
  const ids = Object.values(COINGECKO_ID).join(',');
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(8000), cache: 'no-store' },
    );
    if (!res.ok) return {};
    const raw = (await res.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number | null }
    >;
    const out: Record<string, MarketPrice> = {};
    for (const [coin, cgId] of Object.entries(COINGECKO_ID)) {
      const p = raw[cgId as string];
      if (p?.usd != null) out[coin] = { usd: p.usd, change_24h: p.usd_24h_change ?? null };
    }
    return out;
  } catch {
    return {};
  }
}

/** USD price history from CoinGecko market_chart (hourly points for
 *  days<=90). Returns [] on rate-limit/error — callers degrade to
 *  client-accumulated series or hide the chart. */
export async function fetchPriceHistory(
  cgId: string,
  days = 1,
): Promise<{ ts: number; usd: number }[]> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`,
      { signal: AbortSignal.timeout(10000), cache: 'no-store' },
    );
    if (!res.ok) return [];
    const raw = (await res.json()) as { prices?: [number, number][] };
    return (raw.prices ?? []).map(([ts, usd]) => ({ ts, usd }));
  } catch {
    return [];
  }
}

export async function fetchZionPrice(): Promise<ZionPrice | null> {
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to: POOL, data: SLOT0 }, 'latest'],
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { result?: string };
      const hex = json.result;
      if (!hex || hex === '0x') continue;
      const sqrtPriceX96 = hexToNumber(hex.slice(2, 66));
      if (sqrtPriceX96 === 0) continue;
      const sqrt = sqrtPriceX96 / Q96;
      const usd = sqrt * sqrt * 1e12;
      if (!Number.isFinite(usd) || usd <= 0) continue;
      return { usd, source: 'onchain' };
    } catch {
      /* try next RPC */
    }
  }
  // RPC unreachable — fall back to the documented seed price so the
  // UI still shows the official reference rate.
  return { usd: SEED_PRICE_USD, source: 'seed' };
}
