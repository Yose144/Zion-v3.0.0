'use client';

/**
 * TokenSelector — dropdown for selecting token on a chain
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import TokenIcon from './TokenIcon';

export interface TokenOption {
  symbol: string;
  name: string;
  decimals: number;
  isNative?: boolean;
}

const TOKENS_BY_CHAIN: Record<string, TokenOption[]> = {
  zion: [
    { symbol: 'ZION', name: 'ZION (native)', decimals: 6, isNative: true },
  ],
  base: [
    { symbol: 'wZION', name: 'Wrapped ZION', decimals: 18 },
    { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
    { symbol: 'tZION', name: 'Test ZION (Beta)', decimals: 18 },
    { symbol: 'tUSDT', name: 'Test USDT (Beta)', decimals: 6 },
    { symbol: 'tWETH', name: 'Test WETH (Beta)', decimals: 18 },
  ],
  arbitrum: [
    { symbol: 'wZION', name: 'Wrapped ZION', decimals: 18 },
    { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
    { symbol: 'ARB', name: 'Arbitrum', decimals: 18 },
  ],
  bsc: [
    { symbol: 'wZION', name: 'Wrapped ZION', decimals: 18 },
    { symbol: 'USDT', name: 'Tether USD', decimals: 18 },
    { symbol: 'BNB', name: 'BNB', decimals: 18, isNative: true },
  ],
  polygon: [
    { symbol: 'wZION', name: 'Wrapped ZION', decimals: 18 },
    { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { symbol: 'WMATIC', name: 'Wrapped MATIC', decimals: 18 },
  ],
  optimism: [
    { symbol: 'wZION', name: 'Wrapped ZION', decimals: 18 },
    { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  ],
  avalanche: [
    { symbol: 'wZION', name: 'Wrapped ZION', decimals: 18 },
    { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { symbol: 'WAVAX', name: 'Wrapped AVAX', decimals: 18 },
  ],
  solana: [
    { symbol: 'ZION', name: 'ZION (SPL)', decimals: 9 },
    { symbol: 'USDC', name: 'USD Coin (SPL)', decimals: 6 },
    { symbol: 'SOL', name: 'Solana', decimals: 9, isNative: true },
  ],
  tron: [
    { symbol: 'ZION', name: 'ZION (TRC)', decimals: 6 },
    { symbol: 'USDT', name: 'Tether USD (TRC)', decimals: 6 },
    { symbol: 'TRX', name: 'Tron', decimals: 6, isNative: true },
  ],
  stellar: [
    { symbol: 'ZION', name: 'ZION (Stellar)', decimals: 7 },
    { symbol: 'USDC', name: 'USD Coin (Stellar)', decimals: 7 },
    { symbol: 'XLM', name: 'Stellar Lumens', decimals: 7, isNative: true },
  ],
  cardano: [
    { symbol: 'ZION', name: 'ZION (Cardano)', decimals: 6 },
    { symbol: 'ADA', name: 'Cardano', decimals: 6, isNative: true },
  ],
  cosmos: [
    { symbol: 'ZION', name: 'ZION (Cosmos)', decimals: 6 },
    { symbol: 'ATOM', name: 'Cosmos Hub', decimals: 6, isNative: true },
  ],
  aptos: [
    { symbol: 'ZION', name: 'ZION (Aptos)', decimals: 8 },
    { symbol: 'USDC', name: 'USD Coin (Aptos)', decimals: 6 },
    { symbol: 'APT', name: 'Aptos', decimals: 8, isNative: true },
  ],
  sui: [
    { symbol: 'ZION', name: 'ZION (Sui)', decimals: 9 },
    { symbol: 'USDC', name: 'USD Coin (Sui)', decimals: 6 },
    { symbol: 'SUI', name: 'Sui', decimals: 9, isNative: true },
  ],
  near: [
    { symbol: 'ZION', name: 'ZION (NEAR)', decimals: 24 },
    { symbol: 'USDC', name: 'USD Coin (NEAR)', decimals: 6 },
    { symbol: 'NEAR', name: 'NEAR', decimals: 24, isNative: true },
  ],
  ton: [
    { symbol: 'ZION', name: 'ZION (TON)', decimals: 9 },
    { symbol: 'USDT', name: 'Tether USD (TON)', decimals: 6 },
    { symbol: 'TON', name: 'Toncoin', decimals: 9, isNative: true },
  ],
  bitcoin: [
    { symbol: 'BTC', name: 'Bitcoin', decimals: 8, isNative: true },
  ],
  lightning: [
    { symbol: 'BTC', name: 'Bitcoin (Lightning)', decimals: 8, isNative: true },
  ],
};

interface Props {
  label: string;
  chain: string;
  value: string;
  onChange: (symbol: string) => void;
}

export default function TokenSelector({ label, chain, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const tokens = TOKENS_BY_CHAIN[chain] || [];
  const selected = tokens.find(t => t.symbol === value);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          disabled={tokens.length === 0}
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/80 border border-zinc-700/50 rounded-xl hover:border-zion-gold/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            {selected && <TokenIcon symbol={selected.symbol} size={20} />}
            <span className="text-sm font-bold text-white">
              {selected ? selected.symbol : 'Select token'}
            </span>
            {selected && (
              <span className="text-xs text-zinc-500">{selected.name}</span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
            {tokens.map(token => (
              <button
                key={token.symbol}
                onClick={() => {
                  onChange(token.symbol);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/80 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={token.symbol} size={20} />
                  <span className="text-sm font-bold text-white">{token.symbol}</span>
                  <span className="text-xs text-zinc-500">{token.name}</span>
                </div>
                {token.symbol === value && <Check className="w-4 h-4 text-zion-gold" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { TOKENS_BY_CHAIN };
