'use client';

/**
 * BridgeTracker — live pipeline visualization of bridge operations.
 * Shows lock→confirm→mint (L1→L2) and burn→detect→unlock (L2→L1) with
 * real-time counts from the bridge relay Prometheus metrics.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  ShieldCheck,
  Coins,
  Flame,
  Eye,
  Unlock,
  Activity,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { getBridgeStatus, formatUptime, type BridgeStatus } from '@/lib/bridge-api';
import { usePolling } from '@/hooks/usePolling';

const BridgeTrackerCopy = {
  bridgePipeline: { cs: `Bridge Pipeline`, en: `Bridge Pipeline` },
  online: { cs: `Online`, en: `Online` },
  offline: { cs: `Offline`, en: `Offline` },
  refresh: { cs: `Obnovit`, en: `Refresh` },
  l1L2LockMint: { cs: `L1 → L2 (Lock → Mint)`, en: `L1 → L2 (Lock → Mint)` },
  l2L1BurnUnlock: { cs: `L2 → L1 (Burn → Unlock)`, en: `L2 → L1 (Burn → Unlock)` },
  l1Height: { cs: `L1 height`, en: `L1 height` },
  evmBlock: { cs: `EVM block`, en: `EVM block` },
  errors: { cs: `chyb`, en: `errors` },
  updated: { cs: `Aktualizováno`, en: `Updated` },
};

interface PipelineStep {
  id: string;
  label: string;
  labelCs: string;
  icon: typeof Lock;
  count: number;
  color: string;
}

export default function BridgeTracker() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  const fetchStatus = async () => {
    try {
      const data = await getBridgeStatus();
      setStatus(data);
      setLastUpdated(Date.now());
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  usePolling(fetchStatus, 10000);

  const s = status ?? ({} as Partial<BridgeStatus>);
  const online = s.online ?? false;

  // L1→L2 pipeline
  const l1ToL2Steps: PipelineStep[] = [
    { id: 'lock', label: 'L1 Locks Detected', labelCs: 'L1 Locky Detekovány', icon: Lock, count: s.l1_locks_detected ?? 0, color: 'text-cyan-400' },
    { id: 'confirm', label: 'Locks Finalized (5/5)', labelCs: 'Locky Finalizovány (5/5)', icon: ShieldCheck, count: s.l1_locks_finalized ?? 0, color: 'text-blue-400' },
    { id: 'mint', label: 'wZION Mints Confirmed', labelCs: 'wZION Minty Potvrzeny', icon: Coins, count: s.evm_mints_confirmed ?? 0, color: 'text-emerald-400' },
  ];

  // L2→L1 pipeline
  const l2ToL1Steps: PipelineStep[] = [
    { id: 'burn', label: 'wZION Burns Detected', labelCs: 'wZION Spálení Detekována', icon: Flame, count: s.evm_burns_detected ?? 0, color: 'text-orange-400' },
    { id: 'submit', label: 'L1 Unlocks Submitted', labelCs: 'L1 Odemčení Odeslána', icon: Eye, count: s.l1_unlocks_submitted ?? 0, color: 'text-amber-400' },
    { id: 'unlock', label: 'L1 Unlocks Confirmed', labelCs: 'L1 Odemčení Potvrzena', icon: Unlock, count: s.l1_unlocks_confirmed ?? 0, color: 'text-green-400' },
  ];

  return (
    <div className="zion-rainbow-card backdrop-blur-xl p-6 md:p-8 space-y-6" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl border ${online ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-gray-500/30 bg-gray-500/5'}`}>
            <Activity className={`h-5 w-5 ${online ? 'text-emerald-400' : 'text-gray-400'}`} />
            {online && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {BridgeTrackerCopy.bridgePipeline[cs ? 'cs' : 'en']}
            </h3>
            <p className="text-xs text-gray-500">
              {online
                ? `${BridgeTrackerCopy.online[cs ? 'cs' : 'en']} · ${formatUptime(s.uptime_seconds ?? 0)}`
                : BridgeTrackerCopy.offline[cs ? 'cs' : 'en']}
            </p>
          </div>
        </div>
        <button
          onClick={() => void fetchStatus()}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title={BridgeTrackerCopy.refresh[cs ? 'cs' : 'en']}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* L1 → L2 Pipeline */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Lock className="h-3 w-3 text-cyan-400" />
          {BridgeTrackerCopy.l1L2LockMint[cs ? 'cs' : 'en']}
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {l1ToL2Steps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="relative"
            >
              <div className="zion-rainbow-sub p-4" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
                <step.icon className={`h-5 w-5 ${step.color} mb-2`} />
                <p className="text-2xl font-bold tabular-nums text-white">
                  {step.count.toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-500 mt-1 leading-tight">
                  {cs ? step.labelCs : step.label}
                </p>
              </div>
              {/* Arrow between steps */}
              {i < l1ToL2Steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 text-gray-600">
                  →
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* L2 → L1 Pipeline */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Flame className="h-3 w-3 text-orange-400" />
          {BridgeTrackerCopy.l2L1BurnUnlock[cs ? 'cs' : 'en']}
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {l2ToL1Steps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.24 + i * 0.08 }}
              className="relative"
            >
              <div className="zion-rainbow-sub p-4" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
                <step.icon className={`h-5 w-5 ${step.color} mb-2`} />
                <p className="text-2xl font-bold tabular-nums text-white">
                  {step.count.toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-500 mt-1 leading-tight">
                  {cs ? step.labelCs : step.label}
                </p>
              </div>
              {i < l2ToL1Steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 text-gray-600">
                  →
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{BridgeTrackerCopy.l1Height[cs ? 'cs' : 'en']}:</span>
          <span className="font-mono text-gray-300">{(s.last_l1_height ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{BridgeTrackerCopy.evmBlock[cs ? 'cs' : 'en']}:</span>
          <span className="font-mono text-gray-300">{(s.last_evm_block ?? 0).toLocaleString()}</span>
        </div>
        {(s.errors_total ?? 0) > 0 && (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-3 w-3" />
            <span>{s.errors_total} {BridgeTrackerCopy.errors[cs ? 'cs' : 'en']}</span>
          </div>
        )}
        {lastUpdated && (
          <div className="ml-auto text-gray-600">
            {BridgeTrackerCopy.updated[cs ? 'cs' : 'en']}: {new Date(lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
