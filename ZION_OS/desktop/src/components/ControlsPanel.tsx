import { useState, useCallback, useEffect } from 'react';
import { Play, Square, RefreshCw, Power, RotateCw } from 'lucide-react';
import { controlAction, apiFetch, type V3Status } from '../lib/api';

interface Props {
  className?: string;
  status?: V3Status | null;
}

export default function ControlsPanel({ className = '', status }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<V3Status | null>(null);

  const st = status ?? localStatus;

  const refreshStatus = useCallback(async () => {
    try {
      const s = await apiFetch<V3Status>('/api/status');
      setLocalStatus(s);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!status) {
      refreshStatus();
      const id = setInterval(refreshStatus, 5000);
      return () => clearInterval(id);
    }
  }, [refreshStatus, status]);

  const nodeRunning = st?.node1?.running ?? false;
  const minerRunning = st?.miner?.running ?? false;
  const poolRunning = st?.pool?.running ?? false;

  const doAction = async (action: string, label?: string) => {
    setLoading(action);
    setLastAction(`Running ${label || action}…`);
    try {
      const res = await controlAction(action);
      if (res?.ok) {
        setLastAction(`✓ ${label || action}`);
      } else {
        setLastAction(`✗ ${label || action}: ${res?.error || 'failed'}`);
      }
      await refreshStatus();
    } catch (e: any) {
      setLastAction(`✗ ${label || action}: ${e.message || 'error'}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`zion-card ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300 flex items-center gap-2">
          <Power size={14} className="text-amber-400" /> Service Controls
        </h3>
        <button
          onClick={refreshStatus}
          disabled={!!loading}
          className="p-1 rounded bg-white/5 hover:bg-white/10 transition"
          title="Refresh status"
        >
          <RefreshCw size={12} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <StatusRow label="Node" running={nodeRunning} />
        <StatusRow label="Pool" running={poolRunning} />
        <StatusRow label="Miner" running={minerRunning} />
      </div>

      {/* Node controls */}
      <div className="text-[10px] text-gray-500 mb-1">Node</div>
      <div className="flex gap-1.5 mb-2">
        <CtrlBtn icon={<Play size={10} />} label="Start" color="emerald" disabled={!!loading || nodeRunning}
          onClick={() => doAction('start-node1', 'Start Node')} />
        <CtrlBtn icon={<Square size={10} />} label="Stop" color="red" disabled={!!loading || !nodeRunning}
          onClick={() => doAction('stop-node1', 'Stop Node')} />
        <CtrlBtn icon={<RotateCw size={10} />} label="Restart" color="amber" disabled={!!loading}
          onClick={() => doAction('restart-node1', 'Restart Node')} />
      </div>

      {/* Pool controls */}
      <div className="text-[10px] text-gray-500 mb-1">Pool</div>
      <div className="flex gap-1.5 mb-2">
        <CtrlBtn icon={<Play size={10} />} label="Start" color="emerald" disabled={!!loading || poolRunning}
          onClick={() => doAction('start-pool', 'Start Pool')} />
        <CtrlBtn icon={<Square size={10} />} label="Stop" color="red" disabled={!!loading || !poolRunning}
          onClick={() => doAction('stop-pool', 'Stop Pool')} />
        <CtrlBtn icon={<RotateCw size={10} />} label="Restart" color="amber" disabled={!!loading}
          onClick={() => doAction('restart-pool', 'Restart Pool')} />
      </div>

      {/* Miner controls */}
      <div className="text-[10px] text-gray-500 mb-1">Miner</div>
      <div className="flex gap-1.5">
        <CtrlBtn icon={<Play size={10} />} label="Start" color="emerald" disabled={!!loading || minerRunning}
          onClick={() => doAction('start-miner', 'Start Miner')} />
        <CtrlBtn icon={<Square size={10} />} label="Stop" color="red" disabled={!!loading || !minerRunning}
          onClick={() => doAction('stop-miner', 'Stop Miner')} />
        <CtrlBtn icon={<RotateCw size={10} />} label="Restart" color="amber" disabled={!!loading}
          onClick={() => doAction('restart-miner', 'Restart Miner')} />
      </div>

      {lastAction && (
        <div className="mt-2 text-[10px] text-gray-400 font-mono truncate">{lastAction}</div>
      )}
    </div>
  );
}

function StatusRow({ label, running }: { label: string; running: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-300">{label}</span>
      <span className={`zion-badge ${running ? 'zion-badge-green' : 'zion-badge'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
        {running ? 'RUNNING' : 'STOPPED'}
      </span>
    </div>
  );
}

function CtrlBtn({ icon, label, color, disabled, onClick }: {
  icon: React.ReactNode; label: string; color: 'emerald' | 'red' | 'amber'; disabled: boolean; onClick: () => void;
}) {
  const colors = {
    emerald: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/20 hover:bg-emerald-600/30',
    red: 'bg-red-600/20 text-red-300 border-red-500/20 hover:bg-red-600/30',
    amber: 'bg-amber-600/20 text-amber-300 border-amber-500/20 hover:bg-amber-600/30',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border text-[10px] font-semibold transition disabled:opacity-40 ${colors[color]}`}
    >
      {icon} {label}
    </button>
  );
}
