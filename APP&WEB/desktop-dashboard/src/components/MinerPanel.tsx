import { Pickaxe, Zap, Power, RotateCw, Square } from 'lucide-react';
import type { V3Status } from '../lib/api';
import { controlAction } from '../lib/api';

interface Props {
  miner: V3Status['miner'] | undefined;
}

export default function MinerPanel({ miner }: Props) {
  const m = miner || { running: false, hashrate: null, gpu_backend: null, gpu_device: null, shares_accepted: 0, shares_rejected: 0, pool_addr: null, current_height: null };
  const running = m.running;

  return (
    <section className="zion-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Pickaxe size={18} className="text-amber-400" />
          <h2 className="text-sm font-bold">Miner</h2>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${running ? 'bg-emerald-700/40 text-emerald-300' : 'bg-red-700/40 text-red-300'}`}>
          {running ? 'LIVE' : 'DOWN'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <div className="text-3xl font-bold text-gradient">{m.hashrate ? m.hashrate.toFixed(2) : '—'}</div>
          <div className="text-[10px] text-gray-400 mt-1">KH/s</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <div className="text-3xl font-bold text-emerald-400">{m.shares_accepted ?? '—'}</div>
          <div className="text-[10px] text-gray-400 mt-1">Shares OK / {m.shares_rejected ?? '—'}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <div className="text-[10px] text-gray-400">Device</div>
          <div className="text-xs font-mono text-white truncate">
            {(m.gpu_backend ? m.gpu_backend + ': ' : '') + (m.gpu_device ?? 'cpu')}
          </div>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <div className="text-[10px] text-gray-400">Pool</div>
          <div className="text-xs font-mono text-white truncate">{m.pool_addr ?? '—'}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => controlAction('start-miner')} className="flex-1 py-2 rounded-lg bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5">
          <Power size={12} /> Start
        </button>
        <button onClick={() => controlAction('stop-miner')} className="flex-1 py-2 rounded-lg bg-red-700/40 hover:bg-red-700/60 border border-red-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5">
          <Square size={12} /> Stop
        </button>
        <button onClick={() => controlAction('restart-miner')} className="flex-1 py-2 rounded-lg bg-amber-700/40 hover:bg-amber-700/60 border border-amber-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5">
          <RotateCw size={12} /> Restart
        </button>
      </div>
    </section>
  );
}
