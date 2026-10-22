'use client';

/**
 * TransactionStatus — real-time swap status tracker
 * Polls ZionDex Router API for swap status updates
 */

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, ArrowRight, Globe, Repeat } from 'lucide-react';

const ROUTER_URL = process.env.NEXT_PUBLIC_ZIONDEX_ROUTER_URL || 'https://dex.zionterranova.com';

interface StepStatus {
  step_index: number;
  step_type: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'refunded';
  tx_hash: string | null;
  error: string | null;
}

interface SwapRecord {
  id: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'refunded';
  steps: StepStatus[];
  amount_in: string;
  amount_out: string | null;
  src_chain: string;
  dest_chain: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  swapId: string;
  onComplete?: (swap: SwapRecord) => void;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string; spin?: boolean }> = {
  pending: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-500/10', label: 'Pending' },
  executing: { icon: Loader2, color: 'text-zion-gold', bg: 'bg-zion-gold/10', label: 'Executing', spin: true },
  completed: { icon: CheckCircle2, color: 'text-zion-cyan', bg: 'bg-zion-cyan/10', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-zion-purple', bg: 'bg-zion-purple/10', label: 'Failed' },
  refunded: { icon: ArrowRight, color: 'text-zion-gold', bg: 'bg-zion-gold/10', label: 'Refunded' },
};

export default function TransactionStatus({ swapId, onComplete }: Props) {
  const [swap, setSwap] = useState<SwapRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!swapId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const resp = await fetch(`${ROUTER_URL}/swaps/${swapId}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        if (cancelled) return;

        setSwap(data);
        setError(null);

        // Check if done
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'refunded') {
          if (onComplete) onComplete(data);
          return; // Stop polling
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    };

    // Initial fetch
    void poll();

    // Poll every 3 seconds
    const interval = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [swapId, onComplete]);

  if (error) {
    return (
      <div className="p-4 bg-zion-purple/10 border border-zion-purple/30 rounded-xl">
        <div className="flex items-center gap-2 text-zion-purple">
          <XCircle className="w-4 h-4" />
          <span className="text-sm">Failed to load swap status: {error}</span>
        </div>
      </div>
    );
  }

  if (!swap) {
    return (
      <div className="p-4 bg-zinc-900/60 border border-zinc-700/30 rounded-xl">
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading swap {swapId}...</span>
        </div>
      </div>
    );
  }

  const overallConfig = STATUS_CONFIG[swap.status] || STATUS_CONFIG.pending;
  const OverallIcon = overallConfig.icon;

  return (
    <div className="p-4 bg-zinc-900/60 border border-zinc-700/30 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${overallConfig.bg}`}>
            <OverallIcon className={`w-4 h-4 ${overallConfig.color} ${overallConfig.spin ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className={`text-sm font-medium ${overallConfig.color}`}>{overallConfig.label}</div>
            <div className="text-xs text-zinc-500">Swap ID: {swap.id.slice(0, 12)}...</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">{swap.src_chain} → {swap.dest_chain}</div>
          <div className="text-xs text-zinc-400">{swap.amount_in} → {swap.amount_out || '...'}</div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {swap.steps.map((step, i) => {
          const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
          const Icon = config.icon;
          return (
            <div key={i} className="flex items-center gap-3 p-2 bg-zinc-800/40 rounded-lg">
              <div className={`p-1 rounded ${config.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${config.color} ${config.spin ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {step.step_type === 'bridge' ? (
                    <Globe className="w-3 h-3 text-zion-gold" />
                  ) : (
                    <Repeat className="w-3 h-3 text-zinc-500" />
                  )}
                  <span className="text-xs text-white capitalize">
                    {step.step_type.replace(/_/g, ' ')}
                  </span>
                </div>
                {step.tx_hash && (
                  <div className="text-xs text-zinc-500 mt-0.5">
                    TX: {step.tx_hash.slice(0, 18)}...
                  </div>
                )}
                {step.error && (
                  <div className="text-xs text-zion-purple mt-0.5">{step.error}</div>
                )}
              </div>
              <span className={`text-xs ${config.color}`}>{config.label}</span>
            </div>
          );
        })}
      </div>

      {/* Timestamp */}
      <div className="mt-3 pt-3 border-t border-zinc-700/30 text-xs text-zinc-600">
        Started: {new Date(swap.created_at).toLocaleTimeString()}
        {swap.status === 'completed' && swap.updated_at && (
          <span className="ml-3">
            Completed: {new Date(swap.updated_at).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
