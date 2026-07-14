import { useState } from 'react';
import { Pickaxe, Power, RotateCw, Square, Flame, Cpu, Zap } from 'lucide-react';
import type { V3Status } from '../lib/api';
import { controlAction } from '../lib/api';

interface Props {
  miner: V3Status['miner'] | undefined;
}

const ALGO_LABELS: Record<string, string> = {
  'deeksha_lite_v1': 'Lite V1',
  'deeksha_lite_fire': 'Fire',
  'cosmic_harmony_ekam_deeksha_v2': 'Ekam V2',
};

const ALGO_LIST = [
  { key: 'deeksha_lite_v1', label: 'Lite V1', class: 'bg-sky-700/40 text-sky-300 border-sky-500/30' },
  { key: 'deeksha_lite_fire', label: 'Fire', class: 'bg-orange-700/40 text-orange-300 border-orange-500/30' },
  { key: 'cosmic_harmony_ekam_deeksha_v2', label: 'Ekam V2', class: 'bg-violet-700/40 text-violet-300 border-violet-500/30' },
];

export default function MinerPanel({ miner }: Props) {
  const m = miner || { running: false, hashrate: null, gpu_backend: null, gpu_device: null, shares_accepted: 0, shares_rejected: 0, pool_addr: null, current_height: null, current_algorithm: null };
  const running = m.running;
  const algo = m.current_algorithm ?? 'deeksha_lite_fire';
  const algoLabel = ALGO_LABELS[algo] ?? algo;
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const doAction = async (action: string, env?: Record<string, string>) => {
    setBusy(action);
    setMsg(`Running ${action}…`);
    try {
      const res = await controlAction(action, env);
      if (res?.ok) {
        setMsg(`✓ ${action}`);
      } else {
        setMsg(`✗ ${action}: ${res?.error || 'failed'}`);
      }
    } catch (e: any) {
      setMsg(`✗ ${action}: ${e.message || 'error'}`);
    } finally {
      setBusy(null);
    }
  };

  const switchAlgo = (newAlgo: string) => {
    if (newAlgo === algo) return;
    doAction('restart-miner', { ZION_MINER_ALGORITHM: newAlgo });
  };

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
        <div className="bg-white/5 rounded-xl p-3 col-span-2">
          <div className="text-[10px] text-gray-400 mb-1.5">Algorithm</div>
          <div className="flex gap-1.5">
            {ALGO_LIST.map((a) => (
              <button
                key={a.key}
                onClick={() => switchAlgo(a.key)}
                disabled={!!busy}
                title={a.label}
                className={`flex-1 py-1 rounded text-[10px] font-semibold border transition disabled:opacity-40 ${algo === a.key ? a.class : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
              >
                {a.key === 'deeksha_lite_fire' && <Flame size={10} className="inline mr-0.5" />}
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={() => doAction('start-miner-gpu')}
          disabled={!!busy}
          className="py-2 rounded-lg bg-purple-700/40 hover:bg-purple-700/60 border border-purple-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Zap size={12} /> GPU
        </button>
        <button
          onClick={() => doAction('start-miner-cpu')}
          disabled={!!busy}
          className="py-2 rounded-lg bg-blue-700/40 hover:bg-blue-700/60 border border-blue-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Cpu size={12} /> CPU
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => doAction('start-miner')}
          disabled={!!busy}
          className="flex-1 py-2 rounded-lg bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Power size={12} /> Start
        </button>
        <button
          onClick={() => doAction('stop-miner')}
          disabled={!!busy}
          className="flex-1 py-2 rounded-lg bg-red-700/40 hover:bg-red-700/60 border border-red-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Square size={12} /> Stop
        </button>
        <button
          onClick={() => doAction('restart-miner')}
          disabled={!!busy}
          className="flex-1 py-2 rounded-lg bg-amber-700/40 hover:bg-amber-700/60 border border-amber-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <RotateCw size={12} className={busy === 'restart-miner' ? 'animate-spin' : ''} /> Restart
        </button>
      </div>

      {msg && <div className="mt-2 text-[10px] font-mono text-gray-400 truncate">{msg}</div>}
    </section>
  );
}
