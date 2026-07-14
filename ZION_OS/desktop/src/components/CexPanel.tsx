import { useState, useEffect, useCallback } from 'react';
import { Building2, TrendingUp, TrendingDown, BarChart3, ExternalLink, RefreshCw } from 'lucide-react';
import { apiFetchExternal, EDGE_WEB } from '../lib/api';

interface CexListing {
  name: string;
  logo: string;
  url: string;
  status: 'listed' | 'applied' | 'planned' | 'rejected';
  pairs: string[];
  kyc_required: boolean;
  fee_spot?: string;
}

interface CexApiResponse {
  ok: boolean;
  cex: {
    listings: CexListing[];
    summary: {
      total_exchanges: number;
      listed: number;
      applied: number;
      planned: number;
      total_pairs: number;
    };
  };
  dex: {
    source: string;
    pairs: number;
    total_volume_24h: number;
    total_liquidity_usd: number;
    total_txns_24h?: number;
    total_buys_24h?: number;
    total_sells_24h?: number;
    best_price_usd?: number;
  };
  fetchedAt: number;
}

function formatVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  listed:   { label: 'Listed',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  applied:  { label: 'Applied',  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  planned:  { label: 'Planned',  color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  rejected: { label: 'Rejected', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
};

export default function CexPanel() {
  const [data, setData] = useState<CexApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await apiFetchExternal<CexApiResponse>('/api/cex/listings', { timeout: 8000 });
      if (d) setData(d);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const listings = data?.cex?.listings ?? [];
  const summary = data?.cex?.summary;
  const dex = data?.dex;
  const price = dex?.best_price_usd ?? 0;
  const isLive = dex?.source === 'dexscreener';

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-amber-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">CEX + DEX</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-2 py-0.5 rounded-full border ${
            isLive
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          }`}>
            {dex?.source ?? '—'}
          </span>
          <button onClick={refresh} className="text-gray-500 hover:text-white">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* DEX aggregate stats */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div>
          <p className="text-gray-500 text-[9px] uppercase">Price</p>
          <p className="text-sm font-bold text-white">${price.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[9px] uppercase">Vol 24h</p>
          <p className="text-sm font-bold text-white">{formatVol(dex?.total_volume_24h ?? 0)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[9px] uppercase">Liquidity</p>
          <p className="text-sm font-bold text-white">{formatVol(dex?.total_liquidity_usd ?? 0)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[9px] uppercase">Txns 24h</p>
          <p className="text-sm font-bold text-white">{dex?.total_txns_24h ?? 0}</p>
          <p className="text-[8px] text-gray-500">
            <span className="text-emerald-400">{dex?.total_buys_24h ?? 0}B</span>
            {' / '}
            <span className="text-red-400">{dex?.total_sells_24h ?? 0}S</span>
          </p>
        </div>
      </div>

      {/* CEX listings compact */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[9px] text-gray-500 uppercase">
          <span>Exchange</span>
          <span>{summary?.listed ?? 0}/{summary?.total_exchanges ?? 0} listed</span>
        </div>
        {listings.slice(0, 6).map((ex) => {
          const s = STATUS_STYLE[ex.status] ?? STATUS_STYLE.planned;
          return (
            <div key={ex.name} className="flex items-center justify-between text-[10px] py-1 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-white">{ex.name}</span>
                <span className="text-gray-600">{ex.pairs.length}p</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-full border ${s.bg} ${s.border} ${s.color} text-[8px] font-semibold`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[9px] text-gray-500">Uniswap V3 · Base · wZION/WETH</span>
        <a
          href={`${EDGE_WEB}/cex`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[9px] text-amber-400 hover:text-white"
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
