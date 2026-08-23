'use client';

/**
 * ChainSelector — dropdown for selecting source/destination chain
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface ChainOption {
  id: string;
  name: string;
  symbol: string;
  color: string;
  icon?: string;
}

const CHAINS: ChainOption[] = [
  { id: 'zion', name: 'ZION L1', symbol: 'ZION', color: '#fbbf24' },
  { id: 'base', name: 'Base', symbol: 'BASE', color: '#0052ff' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', color: '#28a0f0' },
  { id: 'bsc', name: 'BNB Chain', symbol: 'BSC', color: '#f0b90b' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', color: '#8247e5' },
  { id: 'optimism', name: 'Optimism', symbol: 'OP', color: '#ff0420' },
  { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX', color: '#e84142' },
  { id: 'solana', name: 'Solana', symbol: 'SOL', color: '#14f195' },
  { id: 'tron', name: 'Tron', symbol: 'TRX', color: '#ff060a' },
  { id: 'stellar', name: 'Stellar', symbol: 'XLM', color: '#7d5fff' },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA', color: '#0033ad' },
  { id: 'cosmos', name: 'Cosmos', symbol: 'ATOM', color: '#2e3148' },
  { id: 'aptos', name: 'Aptos', symbol: 'APT', color: '#066928' },
  { id: 'sui', name: 'Sui', symbol: 'SUI', color: '#4da2ff' },
  { id: 'near', name: 'NEAR', symbol: 'NEAR', color: '#00ec97' },
  { id: 'ton', name: 'TON', symbol: 'TON', color: '#0098ea' },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', color: '#f7931a' },
  { id: 'lightning', name: 'Lightning', symbol: 'LN', color: '#792ee5' },
];

interface Props {
  label: string;
  value: string;
  onChange: (chainId: string) => void;
  excludeChain?: string;
}

export default function ChainSelector({ label, value, onChange, excludeChain }: Props) {
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

  const selected = CHAINS.find(c => c.id === value);
  const available = CHAINS.filter(c => c.id !== excludeChain);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/80 border border-zinc-700/50 rounded-xl hover:border-zion-gold/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            {selected && (
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selected.color }}
              />
            )}
            <span className="text-sm font-medium text-white">
              {selected ? selected.name : 'Select chain'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
            {available.map(chain => (
              <button
                key={chain.id}
                onClick={() => {
                  onChange(chain.id);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/80 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: chain.color }}
                  />
                  <span className="text-sm text-white">{chain.name}</span>
                  <span className="text-xs text-zinc-500">{chain.symbol}</span>
                </div>
                {chain.id === value && <Check className="w-4 h-4 text-zion-gold" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { CHAINS };
