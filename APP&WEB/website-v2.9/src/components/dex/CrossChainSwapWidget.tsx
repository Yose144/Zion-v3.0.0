'use client';

/**
 * CrossChainSwapWidget — main swap UI for ZionDex
 * Uses ZionDex Router API for quotes and execution
 */

import { useState, useCallback, useEffect } from 'react';
import { ArrowDownUp, Loader2, Zap, AlertCircle, CheckCircle2, Settings } from 'lucide-react';
import ChainSelector from './ChainSelector';
import TokenSelector from './TokenSelector';
import SwapPathVisual from './SwapPathVisual';
import { useWallet } from '@/contexts/WalletContext';

const ROUTER_URL = process.env.NEXT_PUBLIC_ZIONDEX_ROUTER_URL || 'https://zionterranova.com/dex-api';

type SwapPhase = 'idle' | 'quoting' | 'quoted' | 'executing' | 'success' | 'error';

interface QuoteData {
  quote_id: string;
  path: {
    steps: any[];
    expected_output: string;
    min_output: string;
    total_fee_bps: number;
    estimated_time_secs: number;
    price_impact_bps: number;
  };
  expires_at: string;
}

interface SwapResult {
  swap_id: string;
  status: string;
  steps: any[];
  monitor_url: string;
}

export default function CrossChainSwapWidget() {
  const { connected, account, connect } = useWallet();
  const [srcChain, setSrcChain] = useState('solana');
  const [destChain, setDestChain] = useState('base');
  const [srcToken, setSrcToken] = useState('USDC');
  const [destToken, setDestToken] = useState('wZION');
  const [amount, setAmount] = useState('100');
  const [slippageBps, setSlippageBps] = useState(200); // 2%
  const [showSettings, setShowSettings] = useState(false);

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [phase, setPhase] = useState<SwapPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null);
  const [recipient, setRecipient] = useState('');

  // Reset token when chain changes
  useEffect(() => {
    setSrcToken('');
  }, [srcChain]);

  useEffect(() => {
    setDestToken('');
  }, [destChain]);

  // Fetch quote
  const fetchQuote = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !srcToken || !destToken) {
      setQuote(null);
      setPhase('idle');
      return;
    }

    setPhase('quoting');
    setError(null);

    try {
      const resp = await fetch(`${ROUTER_URL}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          src_chain: srcChain,
          src_token: srcToken,
          dest_chain: destChain,
          dest_token: destToken,
          amount: amount,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Quote failed: ${text}`);
      }

      const data = await resp.json();
      setQuote(data);
      setPhase('quoted');
    } catch (e: any) {
      setError(e.message || 'Failed to get quote');
      setPhase('error');
      setQuote(null);
    }
  }, [srcChain, srcToken, destChain, destToken, amount]);

  // Debounced quote fetch
  useEffect(() => {
    const timer = setTimeout(() => void fetchQuote(), 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // Execute swap
  const executeSwap = useCallback(async () => {
    if (!quote) return;

    setPhase('executing');
    setError(null);

    try {
      const resp = await fetch(`${ROUTER_URL}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_id: quote.quote_id,
          sender: account || 'user',
          recipient: recipient || account || 'user',
          max_slippage_bps: slippageBps,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Swap failed: ${text}`);
      }

      const data = await resp.json();
      setSwapResult(data);
      setPhase('success');
    } catch (e: any) {
      setError(e.message || 'Swap execution failed');
      setPhase('error');
    }
  }, [quote, recipient, slippageBps, account]);

  // Swap chains (reverse direction)
  const swapChains = () => {
    setSrcChain(destChain);
    setDestChain(srcChain);
    setSrcToken(destToken);
    setDestToken(srcToken);
  };

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
                {quote ? parseFloat(quote.path.expected_output).toFixed(6) : '0.0'}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {phase === 'quoting' && 'Fetching best price...'}
                {phase === 'quoted' && `Min: ${parseFloat(quote!.path.min_output).toFixed(6)}`}
                {phase === 'idle' && 'Enter amount to get quote'}
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
        {quote && (
          <SwapPathVisual
            steps={quote.path.steps}
            expectedOutput={quote.path.expected_output}
            totalFeeBps={quote.path.total_fee_bps}
            estimatedTimeSecs={quote.path.estimated_time_secs}
            priceImpactBps={quote.path.price_impact_bps}
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
              <div>Swap submitted! ID: {swapResult.swap_id}</div>
              <div className="text-xs text-zion-cyan/70 mt-1">Status: {swapResult.status}</div>
            </div>
          </div>
        )}

        {/* Execute button */}
        <button
          onClick={connected ? executeSwap : connect}
          disabled={(!connected && !quote) || phase === 'quoting' || phase === 'executing'}
          className="zion-button-primary w-full mt-4"
          style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
        >
          {phase === 'quoting' && <Loader2 className="w-4 h-4 animate-spin" />}
          {phase === 'executing' && <Loader2 className="w-4 h-4 animate-spin" />}
          {!connected && 'Connect Wallet to Swap'}
          {phase === 'quoting' && 'Getting quote...'}
          {phase === 'executing' && 'Executing swap...'}
          {connected && phase === 'quoted' && 'Swap'}
          {connected && phase === 'idle' && 'Enter amount'}
          {connected && phase === 'success' && 'Swap Again'}
          {connected && phase === 'error' && 'Retry'}
        </button>

        {/* Footer */}
        <div className="mt-3 text-center">
          <span className="text-xs text-zinc-600">
            Powered by ZionDex Router · {ROUTER_URL.replace('http://', '').replace('https://', '')}
          </span>
        </div>
      </div>
    </div>
  );
}
