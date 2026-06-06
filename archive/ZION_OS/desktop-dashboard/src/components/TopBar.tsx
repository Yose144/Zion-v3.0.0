import { RefreshCw, Pause, Play, AlertCircle } from 'lucide-react';
import type { V3Status } from '../lib/api';

interface Props {
  status: V3Status | null;
  autoRefresh: boolean;
  onToggleRefresh: () => void;
  onRefresh: () => void;
  lastError: string | null;
}

export default function TopBar({ status, autoRefresh, onToggleRefresh, onRefresh, lastError }: Props) {
  const isEdge = status?.topology === 'edge-primary';
  const edgeH = status?.edge_node?.chain_height ?? null;
  const localH = status?.node1?.chain_height ?? null;
  const heroH = edgeH ?? localH;
  const hr = status?.miner?.hashrate;
  const peers = status?.edge_node?.known_peers ?? status?.node1?.known_peers ?? 0;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10">
      <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 via-purple-500 to-cyan-400 flex items-center justify-center text-xs font-bold shadow-lg shadow-purple-500/20">
            Z
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">ZION V3 Command Center</div>
            <div className="text-[10px] text-gray-400 font-mono">
              {lastError ? (
                <span className="text-red-400 flex items-center gap-1"><AlertCircle size={10} /> {lastError}</span>
              ) : isEdge ? (
                `Edge ${fmt(edgeH)} · Local ${fmt(localH)} · ${status?.miner?.running ? 'Mining' : 'Idle'}`
              ) : (
                `Local ${fmt(localH)} · ${status?.miner?.running ? 'Mining' : 'Idle'}`
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs">
          <HeroPill label="Height" value={fmt(heroH)} color="text-amber-400" />
          <HeroPill label="Hashrate" value={hr ? hr.toFixed(2) : '—'} unit="KH/s" color="text-emerald-400" />
          <HeroPill label="Peers" value={String(peers)} color="text-cyan-400" />
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-1 rounded font-bold border ${isEdge ? 'bg-purple-700/30 text-purple-300 border-purple-500/20' : 'bg-blue-700/30 text-blue-300 border-blue-500/20'}`}>
            {isEdge ? '🌍 Edge-Primary' : '🔷 Local-Dev'}
          </span>
          <button onClick={onRefresh} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition" title="Refresh">
            <RefreshCw size={14} className="text-gray-300" />
          </button>
          <button onClick={onToggleRefresh} className={`p-1.5 rounded-lg border transition ${autoRefresh ? 'bg-emerald-700/30 border-emerald-500/30' : 'bg-gray-700/30 border-gray-500/30'}`} title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}>
            {autoRefresh ? <Pause size={14} className="text-emerald-400" /> : <Play size={14} className="text-gray-400" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroPill({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10">
      <span className="text-gray-400 text-[10px]">{label}</span>
      <span className={`font-mono font-bold text-xs ${color}`}>{value}</span>
      {unit && <span className="text-[10px] text-gray-500">{unit}</span>}
    </div>
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}
