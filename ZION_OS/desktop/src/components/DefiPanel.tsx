import { useState, useEffect, useCallback } from 'react';
import { Droplets, TrendingUp, Activity, ExternalLink } from 'lucide-react';
import { apiFetchExternal, EDGE_WEB } from '../lib/api';

interface DefiPrice {
  ok: boolean;
  source: string;
  price: {
    usd_per_wzion: number;
    weth_per_wzion: number;
    wzion_per_weth: number;
    weth_usd: number;
    tick: number;
  };
  liquidity: string;
  tvl: {
    weth: number;
    wzion: number;
    usd: number;
  };
  fetchedAt: number;
}

export default function DefiPanel() {
  const [data, setData] = useState<DefiPrice | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await apiFetchExternal<DefiPrice>('/api/defi/price', { timeout: 5000 });
      if (d) setData(d);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const price = data?.price?.usd_per_wzion ?? 0.0002;
  const tvlUsd = data?.tvl?.usd ?? 0;
  const liquidity = data?.liquidity ? Number(data.liquidity) : 0;
  const wethUsd = data?.price?.weth_usd ?? 0;
  const isLive = data?.source === 'live';

  return (
    <div className="zion-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-cyan-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">DeFi Pool</h3>
        </div>
        <span className={`zion-badge ${isLive ? 'zion-badge-green' : 'zion-badge-amber'}`}>
          {data?.source ?? '—'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1 text-gray-500 text-[9px] uppercase">
            <TrendingUp className="h-3 w-3" /> Price
          </div>
          <p className="text-lg font-bold text-white">${price.toFixed(6)}</p>
          <p className="text-[9px] text-gray-500">USD / wZION</p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-gray-500 text-[9px] uppercase">
            <Activity className="h-3 w-3" /> TVL
          </div>
          <p className="text-lg font-bold text-white">${tvlUsd.toFixed(2)}</p>
          <p className="text-[9px] text-gray-500">in pools</p>
        </div>
        <div>
          <p className="text-gray-500 text-[9px] uppercase">Liquidity</p>
          <p className="text-sm font-mono text-cyan-400">
            {liquidity > 0 ? liquidity.toLocaleString() : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-[9px] uppercase">ETH/USD</p>
          <p className="text-sm font-mono text-gray-200">${wethUsd.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[9px] text-gray-500">Uniswap V3 · wZION/WETH 1% · Base</span>
        <a
          href={`${EDGE_WEB}/defi`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[9px] text-cyan-400 hover:text-white"
        >
          Open <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {loading && !data && (
        <p className="mt-2 text-[9px] text-gray-600">Loading…</p>
      )}
    </div>
  );
}
