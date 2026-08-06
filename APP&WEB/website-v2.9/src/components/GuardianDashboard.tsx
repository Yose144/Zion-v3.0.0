'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Wallet, TrendingUp, Scale, Vote, Activity,
  ChevronRight, Lock, Unlock, RefreshCw, AlertTriangle, CheckCircle2,
  Server, Pickaxe, Layers, Globe, Database, XCircle, Flame, Trophy, Users,
} from 'lucide-react';
import { useZionWallet } from '@/contexts/ZionWalletContext';
import { usePolling } from '@/hooks/usePolling';

/* ═══════════════════════ TYPES ═══════════════════════ */

interface V3Metrics {
  chain?: { height?: number; peers?: number; mempool?: number; tps?: number };
  pool?: { sessions?: number; hashrate_hps?: number; accept_rate_pct?: number; uptime_secs?: number };
  miner?: { hashrate_hps?: number; accepted?: number; rejected?: number; accept_rate_pct?: number };
  system?: { load1?: number; mem_used_gb?: number; mem_total_gb?: number; disk_used_pct?: number };
}

interface TreasuryItem {
  label: string;
  address: string;
  share: string;
  role: string;
}

interface DaoProposal {
  id: string;
  title: string;
  status: 'active' | 'passed' | 'failed' | 'pending';
  yes_votes: number;
  no_votes: number;
  deadline: string;
}

interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  ts: number;
  dismissed: boolean;
}

interface NclWorker {
  id: string;
  name: string;
  status: string;
  tasks_completed: number;
  uptime_hours: number;
}

interface NclEntry {
  rank: number;
  worker_id: string;
  name: string;
  score: number;
  tasks: number;
}

/* ═════════════════ CONSTANTS ════════════════════════ */

const TREASURY: TreasuryItem[] = [
  { label: 'Miner',      address: 'zion1u4a82230m0a267r785m822u5a3g7n753d7eu5n0', share: '89%', role: 'Mining rewards' },
  { label: 'Humanitarian', address: 'zion136m4u7f8s5w3l0e00342s7a4r282275442vm2w3', share: '5%', role: 'Charity tithe' },
  { label: 'Issobella',  address: 'zion173g835z228z6u303z59603y236r5e854l36g604', share: '5%', role: 'Issobella fund' },
  { label: 'Pool Fee',   address: 'zion1e6r72872w0y5w6c3h4e6z847g8z4z7l0n4rj607', share: '1%', role: 'Pool operator' },
];

const TABS = [
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'treasury',   label: 'Treasury',   icon: Shield },
  { id: 'dao',        label: 'DAO',        icon: Vote },
  { id: 'alerts',     label: 'Alerts',     icon: AlertTriangle },
  { id: 'ncl',        label: 'NCL',        icon: Trophy },
] as const;

/* ═════════════════ HELPERS ══════════════════════════ */

function fmtHashrate(hps?: number) {
  if (hps == null) return '—';
  if (hps >= 1e12) return `${(hps / 1e12).toFixed(2)} TH/s`;
  if (hps >= 1e9)  return `${(hps / 1e9).toFixed(2)} GH/s`;
  if (hps >= 1e6)  return `${(hps / 1e6).toFixed(2)} MH/s`;
  if (hps >= 1e3)  return `${(hps / 1e3).toFixed(2)} KH/s`;
  return `${hps.toFixed(0)} H/s`;
}

function fmtDuration(secs?: number) {
  if (secs == null) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ═════════════════ COMPONENTS ═════════════════════════ */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`zion-rainbow-sub backdrop-blur-sm p-5 ${className}`} style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
      {children}
    </div>
  );
}

function Stat({ label, value, unit, icon: Icon, color }: {
  label: string; value: string | number; unit?: string; icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; color: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono text-white">{value}</span>
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
      </div>
    </Card>
  );
}

/* ═════════════════ AUTH GATE ════════════════════════ */

function WalletGate({ onEnter }: { onEnter: () => void }) {
  const { wallets, activeWallet, setActiveWallet, importFromMnemonic, initialized, loading } = useZionWallet();
  const [mode, setMode] = useState<'select' | 'import'>('select');
  const [mnemonic, setMnemonic] = useState('');
  const [name, setName] = useState('Guardian');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const handleImport = async () => {
    setErr('');
    try {
      await importFromMnemonic(mnemonic.trim(), name, password);
      setMode('select');
    } catch (e: any) {
      setErr(e.message || 'Import failed');
    }
  };

  if (!initialized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">Loading wallet SDK…</div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="zion-rainbow-card backdrop-blur-md p-8" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-zion-gold/15 flex items-center justify-center">
              <Shield size={18} className="text-zion-gold" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Guardian Portal</h2>
              <p className="text-xs text-gray-400">ZION L1 wallet authentication</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {mode === 'select' && (
              <>
                {wallets.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 mb-2">Select wallet to continue</p>
                    {wallets.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => { setActiveWallet(w.id); onEnter(); }}
                        disabled={loading}
                        className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:border-zion-gold/40 hover:bg-white/8 transition-all"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{w.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{w.address.slice(0, 18)}…{w.address.slice(-6)}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-500" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-400">No saved wallets found.</p>
                  </div>
                )}
                <button
                  onClick={() => { setMode('import'); setErr(''); }}
                  className="w-full py-2.5 rounded-xl border border-zion-gold/30 text-zion-gold text-sm hover:bg-zion-gold/10 transition-colors"
                >
                  Import Guardian Wallet
                </button>
              </>
            )}

            {mode === 'import' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">Import your Guardian wallet from mnemonic phrase</p>
                <textarea
                  value={mnemonic}
                  onChange={(e) => setMnemonic(e.target.value)}
                  placeholder="Enter 12 or 24 word mnemonic..."
                  rows={3}
                  className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-gold/40 resize-none font-mono"
                />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Wallet name"
                  className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-gold/40"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Encryption password"
                  className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-gold/40"
                />
                {err && <p className="text-xs text-red-400">{err}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    disabled={loading || !mnemonic.trim() || !password}
                    className="flex-1 py-2.5 rounded-xl bg-zion-gold text-black text-sm font-semibold hover:bg-yellow-300 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Importing…' : 'Import & Continue'}
                  </button>
                  <button
                    onClick={() => setMode('select')}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:border-white/20 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ═════════════════ TABS ═════════════════════════════ */

function MonitoringTab({ metrics }: { metrics: V3Metrics | null }) {
  const m = metrics;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Block Height" value={m?.chain?.height?.toLocaleString() ?? '—'} icon={Server} color="#fcd116" />
        <Stat label="Peers" value={m?.chain?.peers ?? '—'} icon={Globe} color="#078930" />
        <Stat label="Pool Sessions" value={m?.pool?.sessions ?? '—'} icon={Layers} color="#e41e2b" />
        <Stat label="Pool Hashrate" value={fmtHashrate(m?.pool?.hashrate_hps)} icon={Pickaxe} color="#22C55E" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Accept Rate" value={m?.pool?.accept_rate_pct?.toFixed(1) ?? '—'} unit="%" icon={CheckCircle2} color="#22C55E" />
        <Stat label="Miner Hashrate" value={fmtHashrate(m?.miner?.hashrate_hps)} icon={Pickaxe} color="#3B82F6" />
        <Stat label="Mempool" value={m?.chain?.mempool ?? '—'} unit="txs" icon={Database} color="#F59E0B" />
        <Stat label="Uptime" value={fmtDuration(m?.pool?.uptime_secs)} icon={Activity} color="#10B981" />
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={14} className="text-zion-cyan" /> System Health
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Load Average</p>
            <p className="text-lg font-mono text-white">{m?.system?.load1?.toFixed(2) ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Memory</p>
            <p className="text-lg font-mono text-white">
              {m?.system?.mem_used_gb != null ? `${m.system.mem_used_gb.toFixed(1)} / ${m.system.mem_total_gb?.toFixed(1)} GB` : '—'}
            </p>
            <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              {m?.system?.mem_used_gb != null && m?.system?.mem_total_gb != null && (
                <div className="h-full bg-zion-cyan rounded-full transition-all" style={{ width: `${(m.system.mem_used_gb / m.system.mem_total_gb) * 100}%` }} />
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Disk Used</p>
            <p className="text-lg font-mono text-white">{m?.system?.disk_used_pct != null ? `${m.system.disk_used_pct.toFixed(1)}%` : '—'}</p>
            <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              {m?.system?.disk_used_pct != null && (
                <div className="h-full bg-zion-gold rounded-full transition-all" style={{ width: `${m.system.disk_used_pct}%` }} />
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function TreasuryTab() {
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    const res: Record<string, number> = {};
    for (const item of TREASURY) {
      try {
        const r = await fetch(`/api/blockchain/address?address=${encodeURIComponent(item.address)}`, { signal: AbortSignal.timeout(5000) });
        const d = await r.json();
        res[item.address] = d.balance ?? 0;
      } catch {
        res[item.address] = 0;
      }
    }
    setBalances(res);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const total = Object.values(balances).reduce((a, b) => a + b, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Treasury</p>
          <p className="text-3xl font-bold font-mono text-zion-gold mt-1">{total.toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-base text-gray-400">ZION</span></p>
        </div>
        <button
          onClick={fetchBalances}
          disabled={loading}
          className="p-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
        >
          <RefreshCw size={16} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </Card>

      <div className="space-y-3">
        {TREASURY.map((item) => {
          const bal = balances[item.address] ?? 0;
          const pct = total > 0 ? (bal / total) * 100 : 0;
          return (
            <Card key={item.address} className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/10">{item.share}</span>
                </div>
                <p className="text-xs text-gray-500 font-mono">{item.address}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.role}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-mono font-bold text-white">{bal.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-zion-gold rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-500">{pct.toFixed(1)}%</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}

function DaoTab() {
  const [proposals, setProposals] = useState<DaoProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/dao/proposals', { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      const list = Array.isArray(d) ? d : d.data?.proposals ?? d.proposals ?? [];
      setProposals(list);
    } catch (e: any) {
      setErr('DAO backend unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">DAO Proposals</h3>
        <button
          onClick={fetchProposals}
          disabled={loading}
          className="p-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
        >
          <RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle size={16} /> {err}
        </div>
      )}

      {proposals.length === 0 && !err && !loading ? (
        <Card>
          <p className="text-sm text-gray-400 text-center py-8">No active proposals found.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => {
            const total = p.yes_votes + p.no_votes;
            const yesPct = total > 0 ? (p.yes_votes / total) * 100 : 0;
            return (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        p.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        p.status === 'passed' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                        p.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                        'bg-gray-500/10 text-gray-400 border-gray-500/30'
                      }`}>
                        {p.status}
                      </span>
                      <span className="text-xs text-gray-500">Deadline: {new Date(p.deadline).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-gray-500">Yes: </span>
                    <span className="font-mono text-emerald-400">{p.yes_votes.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">No: </span>
                    <span className="font-mono text-red-400">{p.no_votes.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${yesPct}%` }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function AlertsTab() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/alerts', { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      const list = d.alerts ?? [];
      setAlerts(list.map((a: any, i: number) => ({
        id: a.id ?? `${i}`,
        severity: a.severity ?? 'info',
        title: a.title ?? a.message ?? 'Alert',
        detail: a.detail ?? a.recommendation ?? '',
        ts: a.ts ?? Date.now(),
        dismissed: a.dismissed ?? false,
      })));
    } catch (e: any) {
      setErr('Dashboard alerts unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const dismiss = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  const severityIcon = (s: string) => {
    if (s === 'critical') return <XCircle size={16} className="text-red-400 shrink-0" />;
    if (s === 'warning') return <AlertTriangle size={16} className="text-amber-400 shrink-0" />;
    return <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />;
  };

  const severityBorder = (s: string) => {
    if (s === 'critical') return 'border-red-500/20 bg-red-500/5';
    if (s === 'warning') return 'border-amber-500/20 bg-amber-500/5';
    return 'border-emerald-500/20 bg-emerald-500/5';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Live Alerts</h3>
        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="p-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
        >
          <RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle size={16} /> {err}
        </div>
      )}

      {alerts.length === 0 && !err && !loading ? (
        <Card>
          <p className="text-sm text-gray-400 text-center py-8 flex items-center justify-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" /> No active alerts.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <Card key={a.id} className={`flex items-start gap-3 ${severityBorder(a.severity)}`}>
              {severityIcon(a.severity)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{a.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{a.detail}</p>
                <p className="text-[10px] text-gray-500 mt-1">{new Date(a.ts).toLocaleString()}</p>
              </div>
              <button
                onClick={() => dismiss(a.id)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                title="Dismiss"
              >
                <XCircle size={14} className="text-gray-500" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function NclTab() {
  const [leaderboard, setLeaderboard] = useState<NclEntry[]>([]);
  const [workers, setWorkers] = useState<NclWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const fetchNcl = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [lbRes, wRes] = await Promise.all([
        fetch('/api/ncl/leaderboard', { signal: AbortSignal.timeout(8000) }),
        fetch('/api/ncl/workers', { signal: AbortSignal.timeout(8000) }),
      ]);
      const lb = await lbRes.json().catch(() => ({}));
      const w = await wRes.json().catch(() => ({}));
      setLeaderboard(Array.isArray(lb.leaderboard) ? lb.leaderboard : Array.isArray(lb) ? lb : []);
      setWorkers(Array.isArray(w.workers) ? w.workers : Array.isArray(w) ? w : []);
    } catch (e: any) {
      setErr('NCL backend unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNcl(); }, [fetchNcl]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">NCL Leaderboard</h3>
        <button
          onClick={fetchNcl}
          disabled={loading}
          className="p-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
        >
          <RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle size={16} /> {err}
        </div>
      )}

      {/* Leaderboard */}
      <div className="space-y-3">
        {leaderboard.length === 0 && !err && !loading ? (
          <Card>
            <p className="text-sm text-gray-400 text-center py-8">No leaderboard data yet.</p>
          </Card>
        ) : (
          leaderboard.map((entry) => (
            <Card key={entry.worker_id ?? entry.rank} className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                entry.rank === 1 ? 'bg-amber-500/15 text-amber-400' :
                entry.rank === 2 ? 'bg-gray-300/15 text-gray-300' :
                entry.rank === 3 ? 'bg-orange-700/15 text-orange-400' :
                'bg-white/5 text-gray-400'
              }`}>
                {entry.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{entry.name ?? entry.worker_id}</p>
                <p className="text-xs text-gray-500 font-mono">{entry.tasks?.toLocaleString()} tasks</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-mono font-bold text-white">{entry.score?.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500">score</p>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Workers */}
      <h3 className="text-sm font-semibold text-white pt-2">Active Workers</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {workers.length === 0 && !err && !loading ? (
          <Card className="col-span-full">
            <p className="text-sm text-gray-400 text-center py-8">No workers online.</p>
          </Card>
        ) : (
          workers.map((w) => (
            <Card key={w.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-zion-gold" />
                <span className="text-sm font-semibold text-white truncate">{w.name ?? w.id}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${w.status === 'online' ? 'bg-emerald-400' : w.status === 'busy' ? 'bg-amber-400' : 'bg-gray-500'}`} />
                <span className="text-gray-400 capitalize">{w.status}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Tasks: <span className="text-gray-300 font-mono">{w.tasks_completed?.toLocaleString()}</span></span>
                <span>Uptime: <span className="text-gray-300 font-mono">{w.uptime_hours}h</span></span>
              </div>
            </Card>
          ))
        )}
      </div>
    </motion.div>
  );
}

/* ═════════════════ MAIN ═══════════════════════════════ */

export default function GuardianDashboard() {
  const { activeWallet, disconnect, initialized } = useZionWallet();
  const [activeTab, setActiveTab] = useState<'monitoring' | 'treasury' | 'dao' | 'alerts' | 'ncl'>('monitoring');
  const [metrics, setMetrics] = useState<V3Metrics | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const r = await fetch('/api/dashboard-metrics', { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return;
      const d = await r.json();
      setMetrics(d);
    } catch { /* ignore */ }
  }, []);

  usePolling(fetchMetrics, 30);

  useEffect(() => {
    if (activeWallet) {
      setAuthenticated(true);
      fetchMetrics();
    } else {
      setAuthenticated(false);
    }
  }, [activeWallet, fetchMetrics]);

  if (!authenticated || !activeWallet) {
    return <WalletGate onEnter={() => setAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zion-gold/15 flex items-center justify-center">
                <Shield size={16} className="text-zion-gold" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">Guardian Portal</h1>
                <p className="text-[10px] text-gray-400">ZION Mainnet Monitor</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Wallet pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5">
                <Wallet size={12} className="text-zion-gold" />
                <span className="text-xs font-mono text-gray-300">{activeWallet.address.slice(0, 10)}…{activeWallet.address.slice(-4)}</span>
              </div>
              <button
                onClick={disconnect}
                className="p-2 rounded-xl border border-white/10 hover:border-red-500/40 hover:bg-red-500/10 transition-colors"
                title="Disconnect"
              >
                <Lock size={14} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 pb-2 overflow-x-auto">
            {TABS.map((t) => {
              const isActive = activeTab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white/10 text-white border border-white/15'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'monitoring' && <MonitoringTab metrics={metrics} />}
        {activeTab === 'treasury' && <TreasuryTab />}
        {activeTab === 'dao' && <DaoTab />}
        {activeTab === 'alerts' && <AlertsTab />}
        {activeTab === 'ncl' && <NclTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/40 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-[11px] text-gray-500">
          <span>Guardian access · {activeWallet.address.slice(0, 12)}…</span>
          <span>Auto-refresh: 30s</span>
        </div>
      </footer>
    </div>
  );
}
