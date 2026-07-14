import { useEffect, useState, useCallback } from 'react';
import { Globe, Wallet, Blocks, Users, Pickaxe } from 'lucide-react';
import type { V3Status, PoolMiner, PoolMinersDashboard } from '../lib/api';
import { fetchPoolMinersDashboard } from '../lib/api';

interface Props {
  pool: V3Status['pool'] | undefined;
  poolEdge: V3Status['pool_edge'] | undefined;
}

const REFRESH_MS = 5000;

export default function PoolPanel({ pool, poolEdge }: Props) {
  const p = pool || { running: false, active_sessions: undefined, blocks_found: undefined, fee_split: undefined, pool_wallet: undefined };
  const pe = poolEdge || { running: false, active_miners: undefined, blocks_found: undefined };
  const running = p.running || pe.running || false;

  const [dashboard, setDashboard] = useState<PoolMinersDashboard | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPoolMinersDashboard();
      if (data?.ok) {
        setDashboard(data);
        setLastError(null);
      } else {
        setLastError('Pool miners unavailable');
      }
    } catch (e) {
      setLastError('Pool miners unreachable');
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const miners = dashboard?.miners ?? [];
  const summary = dashboard?.summary;

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
          <div className="text-3xl font-bold text-cyan-400">{fmt(summary?.active_miners ?? pe.active_miners ?? p.active_sessions ?? 0)}</div>
          <div className="text-[10px] text-gray-400 mt-1">Active Miners</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <div className="text-3xl font-bold text-zion-gold">{fmt(summary?.total_paid_zion ?? pe.blocks_found ?? p.blocks_found ?? 0)}</div>
          <div className="text-[10px] text-gray-400 mt-1">{summary?.total_paid_zion ? 'Total Paid Z' : 'Blocks Found'}</div>
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

      {/* Pool-wide totals */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/5 rounded-xl p-2 text-center">
            <div className="text-xs font-bold text-amber-400">{fmtZ(summary.total_pending_zion ?? 0)}</div>
            <div className="text-[9px] text-gray-400">Pending Z</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2 text-center">
            <div className="text-xs font-bold text-cyan-400">{fmtZ(summary.total_paid_zion ?? 0)}</div>
            <div className="text-[9px] text-gray-400">Paid Z</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2 text-center">
            <div className="text-xs font-bold text-emerald-400">{fmtZ(summary.total_on_chain_zion ?? 0)}</div>
            <div className="text-[9px] text-gray-400">On-chain Z</div>
          </div>
        </div>
      )}

      {lastError && (
        <div className="text-[10px] text-red-400 mb-2">{lastError}</div>
      )}

      {/* Miner table */}
      {miners.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <div className="text-[10px] text-gray-400 font-semibold mb-1 flex items-center gap-1">
            <Pickaxe size={10} /> Miner Details
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-gray-500 border-b border-white/5">
                <th className="text-left py-1 px-1">Worker</th>
                <th className="text-right px-1">Hashrate</th>
                <th className="text-right px-1">Valid</th>
                <th className="text-right px-1">Blocks</th>
                <th className="text-right px-1">Pending</th>
                <th className="text-right px-1">Paid</th>
                <th className="text-right px-1">On-chain</th>
                <th className="text-right px-1">Last</th>
              </tr>
            </thead>
            <tbody>
              {miners.map((m, i) => (
                <tr key={m.miner_id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-1.5 px-1">
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${m.active ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                      <span className="text-white truncate max-w-[80px]" title={m.miner_id}>{m.worker_name || m.miner_id}</span>
                    </div>
                  </td>
                  <td className="text-right px-1 font-mono text-cyan-400">{fmtH(m.hashrate_hps)}</td>
                  <td className="text-right px-1 font-mono text-emerald-400">{fmt(m.valid_shares)}</td>
                  <td className="text-right px-1 font-mono text-zion-gold">{fmt(m.blocks_found)}</td>
                  <td className="text-right px-1 font-mono text-amber-400">{fmtZ(m.pending_balance_zion)}</td>
                  <td className="text-right px-1 font-mono text-cyan-400">{fmtZ(m.paid_total)}</td>
                  <td className="text-right px-1 font-mono text-emerald-400">{fmtZ(m.on_chain_balance_zion)}</td>
                  <td className="text-right px-1 text-gray-400">{ago(m.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2 mt-3">
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

function fmtZ(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  return n.toFixed(4) + ' Z';
}

function fmtH(hps: number | null | undefined): string {
  if (!hps || hps <= 0) return '—';
  if (hps >= 1_000_000) return (hps / 1_000_000).toFixed(2) + ' MH/s';
  if (hps >= 1_000) return (hps / 1_000).toFixed(2) + ' KH/s';
  return hps.toFixed(2) + ' H/s';
}

function ago(ts: number | null | undefined): string {
  if (!ts) return '—';
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 0) return 'now';
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  return Math.floor(s / 3600) + 'h';
}
