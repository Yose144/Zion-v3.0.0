import { Globe, Wallet, Blocks, Users } from 'lucide-react';
import type { V3Status } from '../lib/api';

interface Props {
  pool: V3Status['pool'] | undefined;
  poolEdge: V3Status['pool_edge'] | undefined;
}

export default function PoolPanel({ pool, poolEdge }: Props) {
  const p = pool || { running: false, active_sessions: undefined, blocks_found: undefined, fee_split: undefined, pool_wallet: undefined };
  const pe = poolEdge || { running: false, active_miners: undefined, blocks_found: undefined };
  const running = p.running || pe.running || false;

  return (
    <section className="zion-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-cyan-400" />
          <h2 className="text-sm font-bold">Pool</h2>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${running ? 'bg-emerald-700/40 text-emerald-300' : 'bg-red-700/40 text-red-300'}`}>
          {running ? 'LIVE' : 'DOWN'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <div className="text-3xl font-bold text-cyan-400">{fmt(pe.active_miners ?? p.active_sessions ?? 0)}</div>
          <div className="text-[10px] text-gray-400 mt-1">Active Miners</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <div className="text-3xl font-bold text-zion-gold">{fmt(pe.blocks_found ?? p.blocks_found ?? 0)}</div>
          <div className="text-[10px] text-gray-400 mt-1">Blocks Found</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <div className="text-[10px] text-gray-400">Fee Split</div>
          <div className="text-xs font-mono text-amber-400">{p.fee_split ?? '—'}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <div className="text-[10px] text-gray-400">Payout Wallet</div>
          <div className="text-xs font-mono text-white truncate">{p.pool_wallet ? p.pool_wallet.slice(0, 20) + '…' : '—'}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => window.open('http://127.0.0.1:8766/#payout', '_self')} className="flex-1 py-2 rounded-lg bg-purple-700/40 hover:bg-purple-700/60 border border-purple-500/30 text-xs font-semibold transition">
          💰 Payouts
        </button>
        <button onClick={() => window.open('http://127.0.0.1:8766/#explorer', '_self')} className="flex-1 py-2 rounded-lg bg-blue-700/40 hover:bg-blue-700/60 border border-blue-500/30 text-xs font-semibold transition">
          🔍 Explorer
        </button>
      </div>
    </section>
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}
