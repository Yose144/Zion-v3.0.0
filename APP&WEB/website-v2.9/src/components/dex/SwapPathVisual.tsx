'use client';

/**
 * SwapPathVisual — visualizes the multi-step swap path
 * Shows each step (swap, bridge) with chain icons and token flow
 */

import { ArrowRight, ArrowDown, Repeat, Globe } from 'lucide-react';

interface SwapStep {
  type: 'same_chain_swap' | 'bridge';
  chain?: string;
  from_chain?: string;
  to_chain?: string;
  dex?: string;
  from_token?: string;
  to_token?: string;
  asset?: string;
  amount_in?: string;
  amount?: string;
  expected_amount_out?: string;
  fee_bps?: number;
  estimated_time_secs?: number;
}

interface Props {
  steps: SwapStep[];
  expectedOutput: string;
  totalFeeBps: number;
  estimatedTimeSecs: number;
  priceImpactBps: number;
}

const CHAIN_COLORS: Record<string, string> = {
  zion: '#fbbf24',
  base: '#0052ff',
  arbitrum: '#28a0f0',
  bsc: '#f0b90b',
  polygon: '#8247e5',
  optimism: '#ff0420',
  avalanche: '#e84142',
  solana: '#14f195',
  tron: '#ff060a',
  stellar: '#7d5fff',
  cardano: '#0033ad',
  cosmos: '#2e3148',
  aptos: '#066928',
  sui: '#4da2ff',
  near: '#00ec97',
  ton: '#0098ea',
  bitcoin: '#f7931a',
  lightning: '#792ee5',
};

const CHAIN_NAMES: Record<string, string> = {
  zion: 'ZION L1',
  base: 'Base',
  arbitrum: 'Arbitrum',
  bsc: 'BNB Chain',
  polygon: 'Polygon',
  optimism: 'Optimism',
  avalanche: 'Avalanche',
  solana: 'Solana',
  tron: 'Tron',
  stellar: 'Stellar',
  cardano: 'Cardano',
  cosmos: 'Cosmos',
  aptos: 'Aptos',
  sui: 'Sui',
  near: 'NEAR',
  ton: 'TON',
  bitcoin: 'Bitcoin',
  lightning: 'Lightning',
};

function ChainDot({ chain }: { chain: string }) {
  const color = CHAIN_COLORS[chain] || '#71717a';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-zinc-400">{CHAIN_NAMES[chain] || chain}</span>
    </div>
  );
}

export default function SwapPathVisual({
  steps,
  expectedOutput,
  totalFeeBps,
  estimatedTimeSecs,
  priceImpactBps,
}: Props) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-zinc-900/60 border border-zinc-700/30 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Swap Path</h4>
        <span className="text-xs text-zinc-500">{steps.length} step{steps.length > 1 ? 's' : ''}</span>
      </div>

      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            {/* Step number */}
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zion-gold/20 border border-zion-gold/40 flex items-center justify-center text-xs font-bold text-zion-gold">
              {i + 1}
            </div>

            {/* Step content */}
            <div className="flex-1 flex items-center gap-2 text-sm">
              {step.type === 'same_chain_swap' && (
                <>
                  <ChainDot chain={step.chain || ''} />
                  <Repeat className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-white font-medium">{step.from_token}</span>
                  <ArrowRight className="w-3 h-3 text-zinc-500" />
                  <span className="text-white font-medium">{step.to_token}</span>
                  <span className="text-xs text-zinc-500">via {step.dex}</span>
                </>
              )}

              {step.type === 'bridge' && (
                <>
                  <ChainDot chain={step.from_chain || ''} />
                  <Globe className="w-3.5 h-3.5 text-zion-gold" />
                  <span className="text-white font-medium">{step.asset}</span>
                  <ArrowRight className="w-3 h-3 text-zinc-500" />
                  <ChainDot chain={step.to_chain || ''} />
                </>
              )}
            </div>

            {/* Fee */}
            {step.fee_bps !== undefined && (
              <span className="text-xs text-zinc-500">{(step.fee_bps / 100).toFixed(2)}%</span>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-zinc-700/30 grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">Expected output:</span>
          <span className="text-zion-gold font-medium">{expectedOutput}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Total fee:</span>
          <span className="text-zinc-300">{(totalFeeBps / 100).toFixed(2)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Price impact:</span>
          <span className={priceImpactBps > 100 ? 'text-zion-gold' : 'text-zinc-300'}>
            {(priceImpactBps / 100).toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Est. time:</span>
          <span className="text-zinc-300">~{Math.ceil(estimatedTimeSecs / 60)} min</span>
        </div>
      </div>
    </div>
  );
}
