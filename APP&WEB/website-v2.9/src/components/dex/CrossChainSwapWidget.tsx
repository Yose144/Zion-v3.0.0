'use client';

/**
 * CrossChainSwapWidget — main swap UI for ZionDex
 * Uses the local Next.js proxy (/api/swap) which forwards to the V31
 * multichain DEX (zion-multichain port 8454) for quotes and execution.
 *
 * The backend expects zion_l1_types::Asset shaped bodies:
 *   { "from": { "id": { "chain": "base", "contract": "0x...", "ticker": "wZION" },
 *               "decimals": 18, "name": "wZION" },
 *     "to":   { ... },
 *     "amount": "123456" }
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowDownUp, Loader2, Zap, AlertCircle, CheckCircle2, Settings } from 'lucide-react';
import ChainSelector from './ChainSelector';
import TokenSelector, { TOKENS_BY_CHAIN } from './TokenSelector';
import SwapPathVisual from './SwapPathVisual';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from '@/components/LoginModal';
import { CONTRACTS } from '@/lib/defi-contracts';

const API_BASE = '/api/swap';

// Canonical contract addresses for supported non-native tokens by chain.
// Native tokens have `null` contract. Unknown tokens fall back to null.
const TOKEN_CONTRACTS: Record<string, Record<string, string | null>> = {
  base: {
    wZION: CONTRACTS.wZION,
    USDT: CONTRACTS.USDT,
    USDC: CONTRACTS.USDC,
    WETH: CONTRACTS.WETH,
    // Beta test tokens — have active AMM pools with liquidity
    tZION: '0xC5E79b8C6475137aC3a982651097a219B63b0c33',
    tUSDT: '0x677693fbFDe6a9EeA655033fffF93054B559552C',
    tWETH: '0xcE5Df8e83B87f462835b51Ac6B2A4c53fafA620F',
  },
  arbitrum: {
    wZION: CONTRACTS.wZION,
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  bsc: {
    wZION: CONTRACTS.wZION,
    USDT: '0x55d398326f99059fF775485246999027B3197955',
  },
  polygon: {
    wZION: CONTRACTS.wZION,
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  },
  optimism: {
    wZION: CONTRACTS.wZION,
    USDC: '0x0b2C639c533813f4Aa9D7837CAbe68763ed8Fff1',
    WETH: '0x4200000000000000000000000000000000000006',
  },
  avalanche: {
    wZION: CONTRACTS.wZION,
    USDC: '0xB97EF9Ef8734C71904D800722F4eF32e8f4A1B44',
    WAVAX: '0xB31f66AA3C1e785abF6950e3C83D0d7b48bb84a9',
  },
  solana: {
    ZION: null,
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    SOL: null,
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  tron: {
    ZION: null,
    USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    TRX: null,
  },
  stellar: { ZION: null, USDC: null, XLM: null },
  cardano: { ZION: null, ADA: null },
  cosmos: { ZION: null, ATOM: null },
  aptos: { ZION: null, USDC: null, APT: null },
  sui: { ZION: null, USDC: null, SUI: null },
  near: { ZION: null, USDC: null, NEAR: null },
  ton: { ZION: null, USDT: null, TON: null },
  zion: { ZION: null },
  bitcoin: { BTC: null },
  lightning: { BTC: null },
};

// Map UI chain ids to the canonical ChainId enum strings used by the Rust API.
const CHAIN_API_NAMES: Record<string, string> = {
  zion: 'zion_l1',
  base: 'base',
  arbitrum: 'arbitrum',
  bsc: 'bsc',
  polygon: 'polygon',
  optimism: 'optimism',
  avalanche: 'avalanche',
  solana: 'solana',
  tron: 'tron',
  stellar: 'stellar',
  cardano: 'cardano',
  cosmos: 'cosmos',
  aptos: 'aptos',
  sui: 'sui',
  near: 'near',
  ton: 'ton',
  bitcoin: 'bitcoin',
  lightning: 'lightning',
};

const API_TO_UI_CHAIN: Record<string, string> = Object.fromEntries(
  Object.entries(CHAIN_API_NAMES).map(([ui, api]) => [api, ui])
) as Record<string, string>;

interface Asset {
  id: {
    chain: string;
    contract: string | null;
    ticker: string;
  };
  decimals: number;
  name: string;
}

interface Route {
  route: Array<{ chain: string; contract: string | null; ticker: string }>;
  expected_out: string;
  slippage_bps: number;
  total_fee_bps: number;
}

interface QuoteData {
  routes: Route[];
}

interface SwapResult {
  amount_out: string;
}

type SwapPhase = 'idle' | 'quoting' | 'quoted' | 'executing' | 'success' | 'error';

function getTokenMeta(chain: string, symbol: string) {
  return TOKENS_BY_CHAIN[chain]?.find(t => t.symbol === symbol);
}

function buildAsset(chain: string, symbol: string): Asset {
  const meta = getTokenMeta(chain, symbol);
  const chainApi = CHAIN_API_NAMES[chain] ?? chain;
  const contract = TOKEN_CONTRACTS[chain]?.[symbol] ?? null;
  return {
    id: {
      chain: chainApi,
      contract,
      ticker: symbol,
    },
    decimals: meta?.decimals ?? 18,
    name: meta?.name ?? symbol,
  };
}

function toAtomicAmount(amount: string, decimals: number): string {
  // Validate as a positive number first
  const value = parseFloat(amount);
  if (Number.isNaN(value) || value <= 0) return '0';

  // Use string math to avoid floating point precision loss for u128 values.
  const [intPart = '0', fracPart = ''] = amount.split('.');
  const cleanInt = intPart.replace(/^0+/, '') || '0';
  const cleanFrac = (fracPart || '').replace(/0+$/, '').slice(0, decimals);
  const paddedFrac = cleanFrac.padEnd(decimals, '0');

  if (cleanInt === '0' && !cleanFrac) return '0';
  return (cleanInt + paddedFrac).replace(/^0+/, '') || '0';
}

/**
 * Build a JSON body string with u128 fields as raw JSON numbers (not strings).
 * This avoids precision loss for values > Number.MAX_SAFE_INTEGER (2^53-1),
 * which the V31 backend's serde deserializer requires.
 */
function buildSwapBody(
  from: object,
  to: object,
  amount: string,
  extra?: object,
  rawNumeric?: Record<string, string>,
): string {
  const base = { from, to, ...extra };
  const jsonStr = JSON.stringify(base);
  const parts: string[] = [`"amount":${amount}`];
  if (rawNumeric) {
    for (const [k, v] of Object.entries(rawNumeric)) {
      parts.push(`"${k}":${v}`);
    }
  }
  // Insert raw numeric fields before the closing brace
  return jsonStr.replace(/}$/, `,${parts.join(',')}}`);
}

function buildSteps(route: Route['route']) {
  return route.map((asset, i) => {
    if (i === route.length - 1) return null;
    const next = route[i + 1];
    const fromChain = API_TO_UI_CHAIN[asset.chain] ?? asset.chain;
    const toChain = API_TO_UI_CHAIN[next.chain] ?? next.chain;
    if (asset.chain === next.chain) {
      return {
        type: 'same_chain_swap' as const,
        chain: fromChain,
        from_token: asset.ticker,
        to_token: next.ticker,
        dex: 'ZionDex AMM',
      };
    }
    return {
      type: 'bridge' as const,
      from_chain: fromChain,
      to_chain: toChain,
      asset: asset.ticker,
    };
  }).filter(Boolean);
}

function linkedAddressForChain(
  linkedAddresses: { chainType: string; chainId?: string | null; address: string }[] | undefined,
  chain: string,
): string | undefined {
  if (!linkedAddresses) return undefined;
  if (chain === 'zion' || chain === 'zion-l1') {
    return linkedAddresses.find((la) => la.chainType === 'zion-l1')?.address;
  }
  const evm = linkedAddresses.find(
    (la) => la.chainType === 'evm' && (la.chainId === chain || !la.chainId),
  );
  if (evm) return evm.address;
  // Fallback: first address of any matching family.
  return linkedAddresses.find((la) => la.chainType === chain)?.address;
}

export default function CrossChainSwapWidget() {
  const pathname = usePathname();
  const { authenticated, user } = useAuth();
  const [srcChain, setSrcChain] = useState('base');
  const [destChain, setDestChain] = useState('base');
  const [srcToken, setSrcToken] = useState('wZION');
  const [destToken, setDestToken] = useState('USDT');
  const [amount, setAmount] = useState('100');
  const [slippageBps, setSlippageBps] = useState(200); // 2%
  const [showSettings, setShowSettings] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const [route, setRoute] = useState<Route | null>(null);
  const [phase, setPhase] = useState<SwapPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null);
  const [recipient, setRecipient] = useState('');
  const [fromAddress, setFromAddress] = useState<string | undefined>(undefined);

  // Keep a sensible token when chain changes (preserve if it exists, otherwise first token)
  useEffect(() => {
    const tokens = TOKENS_BY_CHAIN[srcChain] || [];
    const match = tokens.find((t) => t.symbol === srcToken);
    setSrcToken(match ? match.symbol : (tokens[0]?.symbol ?? ''));
  }, [srcChain]);

  useEffect(() => {
    const tokens = TOKENS_BY_CHAIN[destChain] || [];
    const match = tokens.find((t) => t.symbol === destToken);
    setDestToken(match ? match.symbol : (tokens[0]?.symbol ?? ''));
  }, [destChain]);

  // Pre-fill the source address from the authenticated user's linked addresses.
  useEffect(() => {
    setFromAddress(linkedAddressForChain(user?.linkedAddresses, srcChain));
  }, [srcChain, user]);

  const fromAsset = useMemo(() => buildAsset(srcChain, srcToken), [srcChain, srcToken]);
  const toAsset = useMemo(() => buildAsset(destChain, destToken), [destChain, destToken]);

  // Fetch quote
  const fetchQuote = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !srcToken || !destToken) {
      setRoute(null);
      setPhase('idle');
      return;
    }

    setPhase('quoting');
    setError(null);

    try {
      const amountAtomic = toAtomicAmount(amount, fromAsset.decimals);
      const body = buildSwapBody(fromAsset, toAsset, amountAtomic, { n: 3, max_hops: 3 });

      const resp = await fetch(`${API_BASE}/quote/multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Quote failed: ${text}`);
      }

      const data = await resp.json() as QuoteData;
      setRoute(data.routes[0] ?? null);
      setPhase('quoted');
    } catch (e: any) {
      setError(e.message || 'Failed to get quote');
      setPhase('error');
      setRoute(null);
    }
  }, [srcToken, destToken, amount, fromAsset, toAsset]);

  // Compute min output from quote and current slippage before any callback uses it.
  const minOutput = route
    ? (BigInt(route.expected_out) * BigInt(10000 - slippageBps) / BigInt(10000)).toString()
    : '0';

  // Debounced quote fetch
  useEffect(() => {
    const timer = setTimeout(() => void fetchQuote(), 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // Execute swap
  const executeSwap = useCallback(async () => {
    if (!route || !srcToken || !destToken) return;

    if (!authenticated) {
      setShowLogin(true);
      return;
    }

    setPhase('executing');
    setError(null);

    try {
      const amountAtomic = toAtomicAmount(amount, fromAsset.decimals);
      const extra = recipient.trim() ? { recipient: recipient.trim() } : undefined;
      const body = buildSwapBody(fromAsset, toAsset, amountAtomic, extra, {
        min_amount_out: minOutput,
      });

      const resp = await fetch(`${API_BASE}/execute-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Swap failed: ${text}`);
      }

      const data = await resp.json() as SwapResult;
      setSwapResult(data);
      setPhase('success');
    } catch (e: any) {
      setError(e.message || 'Swap execution failed');
      setPhase('error');
    }
  }, [route, srcToken, destToken, fromAsset, toAsset, amount, authenticated, recipient, minOutput]);

  // Swap chains (reverse direction)
  const swapChains = () => {
    setSrcChain(destChain);
    setDestChain(srcChain);
    setSrcToken(destToken);
    setDestToken(srcToken);
  };

  const displayOut = route ? (Number(route.expected_out) / 10 ** toAsset.decimals).toFixed(6) : '-';
  const displayMin = route ? (Number(minOutput) / 10 ** toAsset.decimals).toFixed(6) : '-';

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-zion-gold" />
            <h2 className="text-lg font-bold text-white">ZionDex Swap</h2>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mb-4 p-3 bg-zinc-800/50 border border-zinc-700/30 rounded-xl">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Slippage Tolerance: {(slippageBps / 100).toFixed(1)}%
            </label>
            <div className="flex gap-2 mt-2">
              {[50, 100, 200, 500].map(bps => (
                <button
                  key={bps}
                  onClick={() => setSlippageBps(bps)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    slippageBps === bps
                      ? 'bg-zion-gold/20 text-zion-gold border border-zion-gold/40'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700/30 hover:border-zinc-600'
                  }`}
                >
                  {bps / 100}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Source */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ChainSelector
              label="From Chain"
              value={srcChain}
              onChange={setSrcChain}
              excludeChain={destChain}
            />
            <TokenSelector
              label="Token"
              chain={srcChain}
              value={srcToken}
              onChange={setSrcToken}
            />
          </div>

          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-4 bg-zinc-900/80 border border-zinc-700/50 rounded-xl text-2xl font-bold text-white placeholder-zinc-600 focus:border-zion-gold/50 focus:outline-none transition-colors"
            />
          </div>
          {authenticated && fromAddress && (
            <div className="text-xs text-zinc-500">
              From address: <span className="font-mono text-zion-gold/80">{fromAddress}</span>
            </div>
          )}
        </div>

        {/* Swap direction button */}
        <div className="flex justify-center my-2">
          <button
            onClick={swapChains}
            className="p-2 bg-zinc-800 border border-zinc-700/50 rounded-lg hover:bg-zinc-700 hover:rotate-180 transition-all"
          >
            <ArrowDownUp className="w-4 h-4 text-zion-gold" />
          </button>
        </div>

        {/* Destination */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ChainSelector
              label="To Chain"
              value={destChain}
              onChange={setDestChain}
              excludeChain={srcChain}
            />
            <TokenSelector
              label="Token"
              chain={destChain}
              value={destToken}
              onChange={setDestToken}
            />
          </div>

          <div className="relative">
            <div className="w-full px-4 py-4 bg-zinc-900/40 border border-zinc-700/30 rounded-xl">
              <div className="text-2xl font-bold text-zion-gold">
                {phase === 'quoting' ? '…' : displayOut}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {phase === 'quoting' && 'Fetching best price...'}
                {phase === 'quoted' && `Min: ${displayMin}`}
                {phase === 'idle' && (amount && Number(amount) > 0 ? 'No route found' : 'Enter amount to get quote')}
                {phase === 'error' && (error?.startsWith('Swap failed') ? 'Swap failed' : 'Quote failed')}
                {phase === 'success' && 'Swap ready — quote available'}
              </div>
            </div>
          </div>
        </div>

        {/* Recipient address */}
        <div className="mt-3">
          <input
            type="text"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            placeholder="Recipient address (optional)"
            className="w-full px-4 py-2.5 bg-zinc-900/80 border border-zinc-700/50 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-zion-gold/50 focus:outline-none transition-colors"
          />
        </div>

        {/* Swap path visualization */}
        {route && (
          <SwapPathVisual
            steps={buildSteps(route.route) as any[]}
            expectedOutput={displayOut}
            totalFeeBps={route.total_fee_bps}
            estimatedTimeSecs={30}
            priceImpactBps={route.slippage_bps}
          />
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-zion-purple/10 border border-zion-purple/30 rounded-xl">
            <AlertCircle className="w-4 h-4 text-zion-purple flex-shrink-0 mt-0.5" />
            <span className="text-sm text-zion-purple">{error}</span>
          </div>
        )}

        {/* Success */}
        {phase === 'success' && swapResult && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-zion-cyan/10 border border-zion-cyan/30 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-zion-cyan flex-shrink-0 mt-0.5" />
            <div className="text-sm text-zion-cyan">
              <div>Swap executed</div>
              <div className="text-xs text-zion-cyan/70 mt-1">Output: {swapResult.amount_out}</div>
            </div>
          </div>
        )}

        {/* Execute button */}
        <button
          onClick={authenticated ? executeSwap : () => setShowLogin(true)}
          disabled={phase === 'quoting' || phase === 'executing' || (authenticated && !route)}
          className="zion-button-primary w-full mt-4"
          style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
        >
          {phase === 'quoting' && <Loader2 className="w-4 h-4 animate-spin" />}
          {phase === 'executing' && <Loader2 className="w-4 h-4 animate-spin" />}
          {!authenticated && 'Connect to Swap'}
          {phase === 'quoting' && 'Getting quote...'}
          {phase === 'executing' && 'Executing swap...'}
          {authenticated && phase === 'quoted' && 'Swap'}
          {authenticated && phase === 'idle' && 'Enter amount'}
          {authenticated && phase === 'success' && 'Swap Again'}
          {authenticated && phase === 'error' && 'Retry'}
        </button>

        {/* Footer */}
        <div className="mt-3 text-center">
          <span className="text-xs text-zinc-600">
            Powered by ZionDex Router · {API_BASE.replace('http://', '').replace('https://', '')}
          </span>
        </div>
      </div>

      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        redirectTo={pathname}
      />
    </div>
  );
}
