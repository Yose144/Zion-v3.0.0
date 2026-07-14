import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { apiFetchExternal, EDGE_WEB } from '../lib/api';

interface BridgeStatus {
  online: boolean;
  uptime_seconds: number;
  last_l1_height: number;
  last_evm_block: number;
  l1_locks_detected: number;
  l1_locks_finalized: number;
  evm_mints_submitted: number;
  evm_mints_confirmed: number;
  evm_burns_detected: number;
  l1_unlocks_submitted: number;
  l1_unlocks_confirmed: number;
  errors_total: number;
  fetched_at: number;
}

function formatDuration(secs: number): string {
  if (secs <= 0) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function BridgePanel() {
  const [data, setData] = useState<BridgeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await apiFetchExternal<BridgeStatus>('/api/bridge/status', { timeout: 5000 });
      if (d) setData(d);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const online = data?.online ?? false;

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-blue-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bridge Relay</h3>
        </div>
        <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border ${
          online
            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            : 'text-red-400 bg-red-500/10 border-red-500/20'
        }`}>
          {online ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-gray-500 text-[9px] uppercase">L1 Locks</p>
          <p className="text-sm font-bold text-white">{data?.l1_locks_detected ?? 0}</p>
          <p className="text-[9px] text-gray-500">{data?.l1_locks_finalized ?? 0} finalized</p>
        </div>
        <div>
          <p className="text-gray-500 text-[9px] uppercase">EVM Mints</p>
          <p className="text-sm font-bold text-white">{data?.evm_mints_confirmed ?? 0}</p>
          <p className="text-[9px] text-gray-500">{data?.evm_mints_submitted ?? 0} submitted</p>
        </div>
        <div>
          <p className="text-gray-500 text-[9px] uppercase">L1 Unlocks</p>
          <p className="text-sm font-bold text-white">{data?.l1_unlocks_confirmed ?? 0}</p>
          <p className="text-[9px] text-gray-500">{data?.l1_unlocks_submitted ?? 0} submitted</p>
        </div>
        <div>
          <p className="text-gray-500 text-[9px] uppercase">Uptime</p>
          <p className="text-sm font-mono text-gray-200">{formatDuration(data?.uptime_seconds ?? 0)}</p>
          <p className="text-[9px] text-gray-500">{data?.errors_total ?? 0} errors</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[9px] text-gray-500">
          L1: #{data?.last_l1_height ?? '—'} · EVM: #{data?.last_evm_block ?? '—'}
        </span>
        <a
          href={`${EDGE_WEB}/bridge`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[9px] text-blue-400 hover:text-white"
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
