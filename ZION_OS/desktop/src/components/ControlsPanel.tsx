import { useState, useCallback, useEffect } from 'react';
import { Play, Square, RefreshCw } from 'lucide-react';
import { startLocalBackup, stopLocalBackup, getLocalBackupStatus } from '../lib/api';

interface Props {
  className?: string;
}

export default function ControlsPanel({ className = '' }: Props) {
  const [nodeRunning, setNodeRunning] = useState(false);
  const [minerRunning, setMinerRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const st = await getLocalBackupStatus();
      setNodeRunning(st.node_running);
      setMinerRunning(st.miner_running);
    } catch (e) {
      console.error('getLocalBackupStatus error', e);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 5000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  const handleStart = async () => {
    setLoading(true);
    setLastAction('Starting backup node + miner...');
    try {
      const out = await startLocalBackup();
      setLastAction(out.split('\n').pop() || 'Started');
      await refreshStatus();
    } catch (e: any) {
      setLastAction(`Error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setLastAction('Stopping backup node + miner...');
    try {
      const out = await stopLocalBackup();
      setLastAction(out.split('\n').pop() || 'Stopped');
      await refreshStatus();
    } catch (e: any) {
      setLastAction(`Error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`zion-card ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">Local Services</h3>
        <button
          onClick={refreshStatus}
          disabled={loading}
          className="p-1 rounded bg-white/5 hover:bg-white/10 transition"
          title="Refresh status"
        >
          <RefreshCw size={12} className="text-gray-400" />
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <StatusRow label="Backup Node" running={nodeRunning} />
        <StatusRow label="Local Miner" running={minerRunning} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleStart}
          disabled={loading || (nodeRunning && minerRunning)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/20 text-xs hover:bg-emerald-600/30 transition disabled:opacity-40"
        >
          <Play size={12} />
          Start
        </button>
        <button
          onClick={handleStop}
          disabled={loading || (!nodeRunning && !minerRunning)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600/20 text-red-300 border border-red-500/20 text-xs hover:bg-red-600/30 transition disabled:opacity-40"
        >
          <Square size={12} />
          Stop
        </button>
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
      <span className={`flex items-center gap-1 text-[10px] font-bold ${running ? 'text-emerald-400' : 'text-gray-500'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-emerald-400' : 'bg-gray-600'}`} />
        {running ? 'RUNNING' : 'STOPPED'}
      </span>
    </div>
  );
}
