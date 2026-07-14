import {
  CheckCircle,
  XCircle,
  Globe,
  Settings,
  TrendingUp,
  Wallet as WalletIcon,
  Blocks,
  AlertTriangle,
  History,
} from 'lucide-react';
import { useState } from 'react';
import type {
  Checklist,
  EdgeOverview,
  RevenueDashboard,
  PoolMinersDashboard,
  WalletsResponse,
  Wallet as WalletType,
  BlockSummary,
  BlockEvent,
  AlertItem,
} from '../lib/api';

export function ChecklistSection({ checklist }: { checklist: Checklist | null }) {
  if (!checklist) return null;
  const pct = checklist.pct ?? 0;
  return (
    <section className="zion-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-lg">🚀</span>
          <h2 className="text-sm font-bold">Mainnet Readiness</h2>
        </div>
        <span className={`text-xs font-bold ${pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
          {checklist.passed}/{checklist.total} ({pct}%)
        </span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-6 overflow-hidden mb-3 relative">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
          {pct}%
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {checklist.checks.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs bg-white/5 rounded-lg px-2 py-1.5">
            {c.ok ? <CheckCircle size={12} className="text-emerald-400" /> : <XCircle size={12} className="text-red-400" />}
            <span className={c.ok ? 'text-gray-300' : 'text-gray-500'}>{c.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EdgeOverviewSection({ overview }: { overview: EdgeOverview | null }) {
  if (!overview) return null;
  const lb = overview.local_backup || {};
  return (
    <section className="zion-card">
      <div className="flex items-center gap-2 mb-3">
        <Globe size={18} className="text-cyan-400" />
        <h2 className="text-sm font-bold">Edge & Local Backup</h2>
        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded font-bold ${overview.reachable ? 'bg-emerald-700/40 text-emerald-300' : 'bg-red-700/40 text-red-300'}`}>
          {overview.reachable ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
        <Stat label="Topology" value={overview.topology} />
        <Stat label="Edge Height" value={fmt(overview.chain_height)} />
        <Stat label="Pool" value={overview.pool_running ? 'Running' : 'Down'} color={overview.pool_running ? 'text-emerald-400' : 'text-red-400'} />
        <Stat label="Miners" value={fmt(overview.active_miners)} />
        <Stat label="Hashrate" value={fmtH(overview.hashrate)} />
        <Stat label="Blocks Found" value={fmt(overview.blocks_found)} />
        <Stat label="Local Height" value={fmt(lb.chain_height)} />
        <Stat label="Local Tip" value={lb.tip_hash ? `${lb.tip_hash.slice(0, 16)}…` : '—'} />
        <Stat label="Local Peers" value={fmt(lb.known_peers)} />
        <Stat label="Mempool" value={fmt(lb.mempool_size)} />
        <Stat label="Network" value={lb.network || '—'} />
        <Stat label="Protocol" value={lb.protocol_version || '—'} />
      </div>
      {overview.services && Object.keys(overview.services).length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-[10px] text-gray-400 mb-2">Edge Services</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(overview.services).map(([name, state]) => (
              <span key={name} className={`text-[10px] px-2 py-1 rounded border ${state === 'up' || state === 'running' || state === 'ok' ? 'border-emerald-500/30 text-emerald-300 bg-emerald-700/20' : 'border-red-500/30 text-red-300 bg-red-700/20'}`}>
                {name}: {state}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function ServiceControlsSection({ actions, onAction }: { actions: string[]; onAction: (action: string) => Promise<void> }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);

  if (!actions.length) {
    return (
      <section className="zion-card">
        <div className="text-xs text-gray-400">Loading controls…</div>
      </section>
    );
  }

  const special = actions.filter((a) => !/^(start|stop|restart)-/.test(a));
  const grouped = new Map<string, string[]>();
  actions.filter((a) => /^(start|stop|restart)-/.test(a)).forEach((a) => {
    const m = a.match(/^(start|stop|restart)-(.+)$/);
    if (!m) return;
    const [, op, svc] = m;
    grouped.set(svc, [...(grouped.get(svc) || []), op]);
  });

  const run = async (action: string) => {
    setLoading(action);
    setLog(`Running ${action}…`);
    try {
      await onAction(action);
      setLog(`✓ ${action}`);
    } catch (e: any) {
      setLog(`✗ ${action}: ${e.message || 'failed'}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="zion-card">
      <div className="flex items-center gap-2 mb-3">
        <Settings size={18} className="text-amber-400" />
        <h2 className="text-sm font-bold">Service Controls</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 max-h-60 overflow-y-auto pr-1">
        {Array.from(grouped.entries()).map(([svc, ops]) => (
          <div key={svc} className="bg-white/5 rounded-lg p-2">
            <div className="text-[10px] text-gray-400 uppercase mb-1">{svc}</div>
            <div className="flex gap-1">
              {ops.includes('start') && (
                <button onClick={() => run(`start-${svc}`)} disabled={!!loading} className="flex-1 py-1 text-[10px] rounded bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-300 transition disabled:opacity-40">
                  ▶ Start
                </button>
              )}
              {ops.includes('stop') && (
                <button onClick={() => run(`stop-${svc}`)} disabled={!!loading} className="flex-1 py-1 text-[10px] rounded bg-red-700/40 hover:bg-red-700/60 text-red-300 transition disabled:opacity-40">
                  ⏹ Stop
                </button>
              )}
              {ops.includes('restart') && (
                <button onClick={() => run(`restart-${svc}`)} disabled={!!loading} className="flex-1 py-1 text-[10px] rounded bg-amber-700/40 hover:bg-amber-700/60 text-amber-300 transition disabled:opacity-40">
                  ⟳ Restart
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {special.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {special.map((a) => (
            <button
              key={a}
              onClick={() => run(a)}
              disabled={!!loading}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition disabled:opacity-40 ${a.includes('stop') ? 'bg-red-700/40 hover:bg-red-700/60 text-red-300' : 'bg-purple-700/40 hover:bg-purple-700/60 text-purple-300'}`}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {log && <div className="text-[10px] font-mono text-gray-400 truncate">{log}</div>}
    </section>
  );
}

export function RevenueSection({ revenue, poolDashboard }: { revenue: RevenueDashboard | null; poolDashboard: PoolMinersDashboard | null }) {
  if (!revenue && !poolDashboard) return null;
  const r = revenue?.revenue;
  const aux = revenue?.auxpow || poolDashboard?.auxpow;
  const pw = poolDashboard?.pool_wallet;
  const pplns = poolDashboard?.pplns;
  const fee = poolDashboard?.fee_split;
  const routing = poolDashboard?.routing;

  return (
    <section className="zion-card">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={18} className="text-zion-gold" />
        <h2 className="text-sm font-bold">Revenue & Pool Accounting</h2>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">
          {r?.status || (aux?.enabled ? 'Active' : 'Preview')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div className="zion-panel-soft p-3">
          <div className="text-[10px] text-gray-400 mb-1">AuxPoW</div>
          <div className="text-lg font-bold text-cyan-400">{r?.current_coin || aux?.current_coin || '—'}</div>
          <div className="text-xs text-gray-400">{r?.current_algorithm || aux?.current_algorithm || '—'} · {r?.current_pool || aux?.current_pool || '—'}</div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
            <div className="text-gray-400">Shares</div><div className="text-right font-mono text-white">{fmt(r?.shares_submitted || aux?.shares_submitted)}</div>
            <div className="text-gray-400">Accepted</div><div className="text-right font-mono text-emerald-400">{fmt(r?.shares_accepted || aux?.shares_accepted)}</div>
            <div className="text-gray-400">Rejected</div><div className="text-right font-mono text-red-400">{fmt(r?.shares_rejected || aux?.shares_rejected)}</div>
            <div className="text-gray-400">Switches</div><div className="text-right font-mono text-white">{fmt(r?.coin_switches || aux?.coin_switches)}</div>
          </div>
          <div className="text-[10px] text-gray-400 mt-2">Circuit: {r?.circuit_open || aux?.circuit_open ? 'OPEN' : 'closed'}</div>
        </div>

        <div className="zion-panel-soft p-3">
          <div className="text-[10px] text-gray-400 mb-1">Revenue</div>
          <div className="text-lg font-bold text-zion-gold">${r?.total_usd?.toFixed(4) ?? '—'}</div>
          <div className="text-xs text-gray-400">{r?.daily_estimate_usd ? `~$${r.daily_estimate_usd.toFixed(4)}/day` : '—'}</div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
            <div className="text-gray-400">Z Mined</div><div className="text-right font-mono text-white">{fmtZ(r?.zion_mined_total)}</div>
            <div className="text-gray-400">Z Paid</div><div className="text-right font-mono text-emerald-400">{fmtZ(r?.zion_paid_total)}</div>
            <div className="text-gray-400">Z Pending</div><div className="text-right font-mono text-amber-400">{fmtZ(r?.zion_pending)}</div>
            <div className="text-gray-400">Z / day</div><div className="text-right font-mono text-cyan-400">{fmtZ(r?.zion_per_day)}</div>
          </div>
        </div>

        <div className="zion-panel-soft p-3">
          <div className="text-[10px] text-gray-400 mb-1">Mining</div>
          <div className="text-lg font-bold text-emerald-400">{fmt(r?.blocks_found)}</div>
          <div className="text-xs text-gray-400">{r?.blocks_per_day ? `${r.blocks_per_day}/day` : '—'}</div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
            <div className="text-gray-400">Pool HR</div><div className="text-right font-mono text-white">{fmtH(r?.pool_hashrate)}</div>
            <div className="text-gray-400">PPLNS rounds</div><div className="text-right font-mono text-white">{fmt(pplns?.payout_rounds)}</div>
            <div className="text-gray-400">Registered</div><div className="text-right font-mono text-cyan-400">{fmt(pplns?.registered_miners)}</div>
            <div className="text-gray-400">Window</div><div className="text-right font-mono text-white">{fmt(pplns?.window_used)}/{fmt(pplns?.window_size)}</div>
          </div>
        </div>

        <div className="zion-panel-soft p-3">
          <div className="text-[10px] text-gray-400 mb-1">Pool Wallet</div>
          <div className="text-xs font-mono text-white truncate">{pw?.pool_wallet ? `${pw.pool_wallet.slice(0, 20)}…` : '—'}</div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
            <div className="text-gray-400">Balance</div><div className="text-right font-mono text-white">{fmtZ(pw?.balance_zion)}</div>
            <div className="text-gray-400">Blocks</div><div className="text-right font-mono text-emerald-400">{fmt(pw?.blocks_found)}</div>
            <div className="text-gray-400">Pending</div><div className="text-right font-mono text-amber-400">{fmt(pw?.pending_payouts)}</div>
            <div className="text-gray-400">Fee Split</div><div className="text-right font-mono text-cyan-400">{pw?.fee_split || '—'}</div>
            <div className="text-gray-400">Shares</div><div className="text-right font-mono text-white">{fmt(pw?.shares_accepted)}/{fmt(pw?.shares_rejected)}</div>
            <div className="text-gray-400">Payouts</div><div className="text-right font-mono text-white">{pw?.payout_enabled ? 'enabled' : 'disabled'}</div>
          </div>
        </div>

        <div className="zion-panel-soft p-3">
          <div className="text-[10px] text-gray-400 mb-1">Fee Split</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="text-gray-400">Miner</div><div className="text-right font-mono text-white">{fee?.miner_pct ?? r?.miner_share_pct ?? '—'}%</div>
            <div className="text-gray-400">Humanitarian</div><div className="text-right font-mono text-amber-400">{fee?.humanitarian_pct ?? r?.humanitarian_share_pct ?? '—'}%</div>
            <div className="text-gray-400">Issobella</div><div className="text-right font-mono text-purple-400">{fee?.issobella_pct ?? r?.dao_share_pct ?? '—'}%</div>
            <div className="text-gray-400">Pool Fee</div><div className="text-right font-mono text-cyan-400">{fee?.pool_fee_pct ?? r?.pool_fee_pct ?? '—'}%</div>
          </div>
          <div className="text-[10px] text-gray-400 mt-2">Accumulated H/I/P</div>
          <div className="text-xs font-mono text-white">
            {fmtZ(fee?.humanitarian_accumulated_zion ?? r?.humanitarian_accumulated_zion)} / {fmtZ(fee?.issobella_accumulated_zion ?? r?.issobella_accumulated_zion)} / {fmtZ(fee?.pool_fee_accumulated_zion ?? r?.pool_fee_accumulated_zion)}
          </div>
        </div>

        <div className="zion-panel-soft p-3">
          <div className="text-[10px] text-gray-400 mb-1">Routing</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="text-gray-400">Submits</div><div className="text-right font-mono text-white">{fmt(routing?.submits)}</div>
            <div className="text-gray-400">Accepted</div><div className="text-right font-mono text-emerald-400">{fmt(routing?.accepted)}</div>
            <div className="text-gray-400">Rejected</div><div className="text-right font-mono text-red-400">{fmt(routing?.rejected)}</div>
            <div className="text-gray-400">Rate</div><div className="text-right font-mono text-cyan-400">{fmt(routing?.accept_rate_pct)}%</div>
          </div>
          {routing?.groups && Object.keys(routing.groups).length > 0 && (
            <div className="mt-2 text-[10px] text-gray-400">Groups: {Object.keys(routing.groups).join(', ')}</div>
          )}
        </div>

        <div className="zion-panel-soft p-3 md:col-span-2 lg:col-span-2">
          <div className="text-[10px] text-gray-400 mb-1">Coin Revenue</div>
          <div className="max-h-40 overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-500 border-b border-white/5">
                  <th className="text-left py-1">Coin</th>
                  <th className="text-left">Algorithm</th>
                  <th className="text-right">Shares</th>
                  <th className="text-right">USD</th>
                  <th className="text-center">Active</th>
                </tr>
              </thead>
              <tbody>
                {(r?.coin_revenue || []).map((c) => (
                  <tr key={c.coin} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-1 font-mono text-white">{c.coin}</td>
                    <td className="text-gray-400">{c.algorithm}</td>
                    <td className="text-right font-mono text-white">{fmt(c.shares)}</td>
                    <td className="text-right font-mono text-zion-gold">{c.revenue_usd.toFixed(4)}</td>
                    <td className="text-center">{c.active ? <span className="text-emerald-400">●</span> : <span className="text-gray-600">○</span>}</td>
                  </tr>
                ))}
                {!(r?.coin_revenue?.length) && (
                  <tr><td className="py-2 text-gray-500" colSpan={5}>No coin revenue data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="zion-panel-soft p-3 md:col-span-2 lg:col-span-2">
          <div className="text-[10px] text-gray-400 mb-1">Distributions</div>
          <div className="max-h-40 overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-500 border-b border-white/5">
                  <th className="text-left py-1">Time</th>
                  <th className="text-left">Recipient</th>
                  <th className="text-right">ZION</th>
                  <th className="text-left">Type</th>
                </tr>
              </thead>
              <tbody>
                {(r?.distributions || []).map((d, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-1 text-gray-400">{d.ts ? new Date(d.ts).toLocaleString() : '—'}</td>
                    <td className="font-mono text-white truncate max-w-[120px]">{d.recipient}</td>
                    <td className="text-right font-mono text-emerald-400">{d.amount_zion.toFixed(4)}</td>
                    <td className="text-gray-400">{d.type}</td>
                  </tr>
                ))}
                {!(r?.distributions?.length) && (
                  <tr><td className="py-2 text-gray-500" colSpan={4}>No distributions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="zion-panel-soft p-3 md:col-span-2 lg:col-span-2 xl:col-span-4">
          <div className="text-[10px] text-gray-400 mb-1">Stream Profit Weights</div>
          <div className="flex flex-wrap gap-3">
            {(r?.stream_profit_weights || []).map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-white/5 rounded-lg px-2 py-1">
                <span className="text-white font-mono">{w.source}</span>
                <span className="text-cyan-400 font-mono">{w.weight_pct}%</span>
              </div>
            ))}
            {!(r?.stream_profit_weights?.length) && (
              <span className="text-xs text-gray-500">No stream weights configured</span>
            )}
          </div>
          {r?.stream_profit_description && <div className="text-[10px] text-gray-400 mt-2">{r.stream_profit_description}</div>}
        </div>
      </div>
    </section>
  );
}

export function WalletsSection({ wallets }: { wallets: WalletsResponse | null }) {
  if (!wallets) return null;
  const s = wallets.summary;
  return (
    <section className="zion-card">
      <div className="flex items-center gap-2 mb-3">
        <WalletIcon size={18} className="text-emerald-400" />
        <h2 className="text-sm font-bold">Wallets</h2>
        <span className="ml-auto text-[10px] text-gray-400">RPC {wallets.rpc.host}:{wallets.rpc.port} {wallets.rpc.reachable ? '✓' : '✗'}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-white">{fmt(s.total_wallets)}</div>
          <div className="text-[9px] text-gray-400">Total</div>
        </div>
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-cyan-400">{fmt(s.premine_wallets)}</div>
          <div className="text-[9px] text-gray-400">Premine</div>
        </div>
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-amber-400">{fmt(s.operational_wallets)}</div>
          <div className="text-[9px] text-gray-400">Operational</div>
        </div>
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-emerald-400">{fmt(s.with_live_balance)}</div>
          <div className="text-[9px] text-gray-400">Live Balance</div>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-gray-500 border-b border-white/5">
              <th className="text-left py-1">Label</th>
              <th className="text-left">Address</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Balance</th>
              <th className="text-center">RPC</th>
            </tr>
          </thead>
          <tbody>
            {wallets.wallets.map((w, i) => (
              <WalletRow key={i} wallet={w} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WalletRow({ wallet }: { wallet: WalletType }) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/5">
      <td className="py-1.5 text-gray-300 max-w-[120px] truncate" title={wallet.label}>{wallet.label}</td>
      <td className="font-mono text-gray-400 truncate max-w-[120px]" title={wallet.address}>{wallet.address.slice(0, 18)}…</td>
      <td className="text-right font-mono text-white">{wallet.amount_zion ? wallet.amount_zion.toFixed(4) : '—'}</td>
      <td className="text-right font-mono text-emerald-400">{wallet.balance_zion != null ? wallet.balance_zion.toFixed(4) : '—'}</td>
      <td className="text-center">{wallet.rpc_ok ? <CheckCircle size={10} className="inline text-emerald-400" /> : <XCircle size={10} className="inline text-red-400" />}</td>
    </tr>
  );
}

export function ExplorerSection({ blocks, overview }: { blocks: BlockSummary[] | null; overview: EdgeOverview | null }) {
  if (!blocks && !overview) return null;
  const lb = overview?.local_backup;
  return (
    <section className="zion-card">
      <div className="flex items-center gap-2 mb-3">
        <Blocks size={18} className="text-blue-400" />
        <h2 className="text-sm font-bold">Explorer</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-white">{fmt(overview?.chain_height)}</div>
          <div className="text-[9px] text-gray-400">Edge Height</div>
        </div>
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-cyan-400">{fmt(lb?.chain_height)}</div>
          <div className="text-[9px] text-gray-400">Local Height</div>
        </div>
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-amber-400">{fmt(lb?.mempool_size)}</div>
          <div className="text-[9px] text-gray-400">Mempool</div>
        </div>
        <div className="zion-panel-soft p-2 text-center">
          <div className="text-lg font-bold text-emerald-400">{fmt(lb?.known_peers)}</div>
          <div className="text-[9px] text-gray-400">Peers</div>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-gray-500 border-b border-white/5">
              <th className="text-left py-1">Height</th>
              <th className="text-left">Hash</th>
              <th className="text-right">Txns</th>
              <th className="text-right">Size</th>
              <th className="text-right">Difficulty</th>
              <th className="text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {blocks?.map((b) => (
              <tr key={b.height} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-1 font-mono text-white">{fmt(b.height)}</td>
                <td className="font-mono text-gray-400 truncate max-w-[120px]" title={b.hash}>{b.hash.slice(0, 18)}…</td>
                <td className="text-right font-mono text-white">{fmt(b.txns)}</td>
                <td className="text-right font-mono text-white">{fmt(b.size)}</td>
                <td className="text-right font-mono text-cyan-400">{b.difficulty.toFixed(2)}</td>
                <td className="text-right text-gray-400">{b.ts ? new Date(b.ts * 1000).toLocaleTimeString() : '—'}</td>
              </tr>
            ))}
            {!blocks?.length && (
              <tr><td className="py-2 text-gray-500" colSpan={6}>No blocks yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AlertsHistorySection({ history }: { history: { alerts: AlertItem[] } | null }) {
  if (!history?.alerts?.length) return null;
  return (
    <section className="zion-card">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={18} className="text-red-400" />
        <h2 className="text-sm font-bold">Alert History</h2>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-2">
        {history.alerts.map((a, i) => (
          <div key={i} className={`text-xs p-2 rounded-lg border ${severityClass(a.severity)}`}>
            <div className="font-semibold">{a.title}</div>
            <div className="text-gray-400">{a.detail}</div>
            {(a as any).ts && <div className="text-[9px] text-gray-500 mt-1">{(a as any).ts}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function EventsSection({ events, connectionHistory }: { events: { events: BlockEvent[] } | null; connectionHistory?: PoolMinersDashboard['connection_history'] }) {
  return (
    <section className="zion-card">
      <div className="flex items-center gap-2 mb-3">
        <History size={18} className="text-purple-400" />
        <h2 className="text-sm font-bold">Events</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] text-gray-400 mb-1">Block Events</div>
          <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
            {events?.events?.map((e, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded p-1.5">
                <span className="text-gray-300">{e.type} <span className="text-gray-500">#{e.height}</span></span>
                <span className="text-gray-500 text-[10px]">{e.ts ? new Date(e.ts * 1000).toLocaleTimeString() : '—'}</span>
              </div>
            ))}
            {!events?.events?.length && <div className="text-gray-500">No events yet</div>}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-gray-400 mb-1">Pool Connections</div>
          <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
            {connectionHistory?.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded p-1.5">
                <span className="text-gray-300">
                  {c.miner_id ? c.miner_id.slice(0, 12) : c.peer_addr || 'session'}
                  {c.worker_name ? ` / ${c.worker_name}` : ''}
                </span>
                <span className="text-gray-500 text-[10px]">{c.time ? new Date(c.time).toLocaleTimeString() : c.ts ? new Date(c.ts * 1000).toLocaleTimeString() : '—'}</span>
              </div>
            ))}
            {!connectionHistory?.length && <div className="text-gray-500">No connection history</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-2">
      <div className="text-[9px] text-gray-400">{label}</div>
      <div className={`font-mono font-bold ${color || 'text-white'}`}>{value ?? '—'}</div>
    </div>
  );
}

export function severityClass(severity: string) {
  switch (severity) {
    case 'critical': return 'bg-red-900/30 border-red-500/30 text-red-200';
    case 'warning': return 'bg-amber-900/30 border-amber-500/30 text-amber-200';
    case 'success': return 'bg-emerald-900/30 border-emerald-500/30 text-emerald-200';
    default: return 'bg-blue-900/30 border-blue-500/30 text-blue-200';
  }
}

export function fmt(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—';
  if (typeof n === 'number') return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—';
  return String(n);
}

export function fmtZ(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  return `${Number(n).toFixed(4)} Z`;
}

export function fmtH(hps: number | null | undefined): string {
  if (!hps || hps <= 0) return '—';
  if (hps >= 1e9) return `${(hps / 1e9).toFixed(2)} GH/s`;
  if (hps >= 1e6) return `${(hps / 1e6).toFixed(2)} MH/s`;
  if (hps >= 1e3) return `${(hps / 1e3).toFixed(2)} KH/s`;
  return `${hps.toFixed(0)} H/s`;
}
