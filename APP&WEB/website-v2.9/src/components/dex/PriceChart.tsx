'use client';

/**
 * PriceChart — lightweight SVG price chart for token pairs
 * Fetches price history from ZionDex Router API
 */

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

const ROUTER_URL = process.env.NEXT_PUBLIC_ZIONDEX_ROUTER_URL || 'https://dex.zionterranova.com';

interface PricePoint {
  timestamp: number;
  price: number;
}

interface Props {
  token: string;
  vsToken?: string;
  height?: number;
}

export default function PriceChart({ token, vsToken = 'USDT', height = 200 }: Props) {
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d'>('24h');

  useEffect(() => {
    const fetchPrices = async () => {
      setLoading(true);
      try {
        // Fetch price history from Router API
        // Endpoint: GET /prices/:token/history?tf=24h
        const resp = await fetch(`${ROUTER_URL}/prices/${token}/history?tf=${timeframe}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.prices && Array.isArray(data.prices)) {
            setPrices(data.prices);
          }
        }
      } catch {
        // No price history available — leave empty instead of placeholder data
      } finally {
        setLoading(false);
      }
    };

    void fetchPrices();
  }, [token, vsToken, timeframe]);

  // Calculate stats
  const currentPrice = prices.length > 0 ? prices[prices.length - 1].price : 0;
  const firstPrice = prices.length > 0 ? prices[0].price : 0;
  const change = currentPrice - firstPrice;
  const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;
  const isUp = change >= 0;

  // Chart dimensions
  const width = 600;
  const chartHeight = height - 40; // Leave room for labels
  const padding = { top: 10, right: 10, bottom: 20, left: 50 };

  // Calculate scales
  const prices_arr = prices.map(p => p.price);
  const minPrice = Math.min(...prices_arr, 0);
  const maxPrice = Math.max(...prices_arr, 1);
  const priceRange = maxPrice - minPrice || 1;

  const timestamps = prices.map(p => p.timestamp);
  const minTime = Math.min(...timestamps, 0);
  const maxTime = Math.max(...timestamps, 1);
  const timeRange = maxTime - minTime || 1;

  // Generate SVG path
  const pathData = prices.length > 0
    ? prices.map((p, i) => {
        const x = padding.left + (i / Math.max(prices.length - 1, 1)) * (width - padding.left - padding.right);
        const y = padding.top + (1 - (p.price - minPrice) / priceRange) * (chartHeight - padding.top - padding.bottom);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' ')
    : '';

  // Area path (for gradient fill)
  const areaPath = prices.length > 0
    ? `${pathData} L ${padding.left + (width - padding.left - padding.right)} ${chartHeight - padding.bottom} L ${padding.left} ${chartHeight - padding.bottom} Z`
    : '';

  return (
    <div className="bg-zinc-900/60 border border-zinc-700/30 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-zion-gold" />
          <h3 className="text-sm font-semibold text-white">
            {token}/{vsToken}
          </h3>
          {loading ? (
            <span className="text-xs text-zinc-500">Loading...</span>
          ) : prices.length === 0 ? (
            <span className="text-xs text-zinc-500">No data</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">${currentPrice.toFixed(4)}</span>
              <span className={`flex items-center gap-0.5 text-xs ${isUp ? 'text-zion-cyan' : 'text-zion-purple'}`}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Timeframe selector */}
        <div className="flex gap-1">
          {(['1h', '24h', '7d'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                timeframe === tf
                  ? 'bg-zion-gold/20 text-zion-gold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {prices.length === 0 ? (
        <div className="w-full flex items-center justify-center text-zinc-600 text-sm" style={{ height: `${chartHeight}px` }}>
          No price history
        </div>
      ) : (
      <>
      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        className="w-full"
        style={{ height: `${chartHeight}px` }}
      >
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = padding.top + ratio * (chartHeight - padding.top - padding.bottom);
          const price = maxPrice - ratio * priceRange;
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#27272a"
                strokeWidth="0.5"
              />
              <text
                x={padding.left - 5}
                y={y + 3}
                fill="#52525b"
                fontSize="10"
                textAnchor="end"
              >
                ${price.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#priceGradient)" />}

        {/* Price line */}
        {pathData && (
          <path
            d={pathData}
            fill="none"
            stroke={isUp ? '#22c55e' : '#ef4444'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}

        {/* Current price dot */}
        {prices.length > 0 && (
          <circle
            cx={padding.left + (width - padding.left - padding.right)}
            cy={padding.top + (1 - (currentPrice - minPrice) / priceRange) * (chartHeight - padding.top - padding.bottom)}
            r="3"
            fill={isUp ? '#22c55e' : '#ef4444'}
          />
        )}
      </svg>

      {/* Footer stats */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-zinc-500">Low: </span>
          <span className="text-zinc-300">${minPrice.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-zinc-500">High: </span>
          <span className="text-zinc-300">${maxPrice.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-zinc-500">Change: </span>
          <span className={isUp ? 'text-zion-cyan' : 'text-zion-purple'}>
            {change >= 0 ? '+' : ''}{change.toFixed(4)}
          </span>
        </div>
      </div>
      </>
      )}
    </div>
  );
}


