'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Wallet, Scale, Vote, Activity,
  ChevronRight, Lock, RefreshCw, AlertTriangle, CheckCircle2,
  Server, Pickaxe, Layers, Globe, Database, XCircle,
  Plus, Import, Send, Download, Copy, Eye, EyeOff, Trash2, Key,
} from 'lucide-react';
import { useZionWallet } from '@/contexts/ZionWalletContext';
import { usePolling } from '@/hooks/usePolling';

interface V3Metrics {
  chain?: {
    height?: number; peers?: number; mempool?: number; tps?: number;
    difficulty?: number; total_blocks?: number; total_transactions?: number; network_hashrate?: number;
  };
  pool?: {
    sessions?: number; hashrate_hps?: number; accept_rate_pct?: number; uptime_secs?: number; blocks_found?: number;
  };
  miner?: { hashrate_hps?: number; accepted?: number; rejected?: number; accept_rate_pct?: number };
  system?: { load1?: number; mem_used_gb?: number; mem_total_gb?: number; disk_used_pct?: number };
  source?: 'live' | 'fallback';
}

interface TreasuryItem { label: string; address: string; share: string; role: string; }
interface DaoProposal { id: string; title: string; status: 'active' | 'passed' | 'failed' | 'pending'; yes_votes: number; no_votes: number; deadline: string; }

const TREASURY: TreasuryItem[] = [
  { label: 'Miner',       address: 'zion1w523a76830x2t5m7f3j023w265e8g5c400a4790', share: '89%', role: 'Mining rewards' },
  { label: 'Humanitarian',address: 'zion1c245e7f5d8h427r4p4s2s607d7v4c255z7x96t3', share: '5%',  role: 'Charity tithe' },
  { label: 'Issobella',   address: 'zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702', share: '5%',  role: 'Issobella fund' },
  { label: 'Pool Fee',    address: 'zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342', share: '1%',  role: 'Pool operator' },
];

const TABS = [
  { id: 'wallet',     label: 'Wallet',     icon: Wallet },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'treasury',   label: 'Treasury',   icon: Scale },
  { id: 'dao',        label: 'DAO',        icon: Vote },
] as const;

function fmtHashrate(hps?: number) {
  if (hps == null) return '—';
  if (hps >= 1e12) return (hps / 1e12).toFixed(2) + ' TH/s';
  if (hps >= 1e9)  return (hps / 1e9).toFixed(2) + ' GH/s';
  if (hps >= 1e6)  return (hps / 1e6).toFixed(2) + ' MH/s';
  if (hps >= 1e3)  return (hps / 1e3).toFixed(2) + ' KH/s';
  return hps.toFixed(0) + ' H/s';
}

function fmtDuration(secs?: number) {
  if (secs == null) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

function copy(text: string) { navigator.clipboard.writeText(text); }

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={"zion-rainbow-sub rounded-3xl p-6 " + className} style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
      {children}
    </div>
  );
}

function Stat({ label, value, unit, icon: Icon, color }: {
  label: string; value: string | number; unit?: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
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

function MiniStat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; color: string }) {
  return (
    <div className="zion-rainbow-sub rounded-xl p-3" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={12} style={{ color }} />
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold font-mono text-white">{value}</p>
    </div>
  );
}

function WalletGate({ onEnter }: { onEnter: () => void }) {
  const { wallets, activeWallet, setActiveWallet, importFromMnemonic, initialized, loading } = useZionWallet();
  const [mode, setMode] = useState<'select' | 'import'>('select');
  const [mnemonic, setMnemonic] = useState('');
  const [name, setName] = useState('Operator');
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
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">Loading wallet SDK...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="zion-rainbow-card rounded-2xl p-8" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-zion-gold/15 flex items-center justify-center">
              <LayoutDashboard size={18} className="text-zion-gold" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">ZION Dashboard</h2>
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
                          <p className="text-xs text-gray-500 font-mono">{w.address.slice(0, 18)}...{w.address.slice(-6)}</p>
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
                  className="w-full py-2.5 rounded-2xl border border-zion-gold/30 text-zion-gold text-sm hover:bg-zion-gold/10 transition-colors shadow-lg shadow-zion-gold/10"
                >
                  Connect Wallet
                </button>
              </>
            )}

            {mode === 'import' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">Import your ZION wallet from mnemonic phrase</p>
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
                    className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-zion-gold to-amber-500 text-black text-sm font-semibold shadow-lg shadow-zion-gold/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {loading ? 'Importing...' : 'Import & Continue'}
                  </button>
                  <button
                    onClick={() => setMode('select')}
                    className="px-4 py-2.5 rounded-2xl border border-white/10 text-gray-300 text-sm hover:border-white/20 hover:bg-white/5 transition-colors"
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

function MissionControlLite({ metrics }: { metrics: V3Metrics | null }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-zion-gold/5 rounded-full blur-3xl pointer-events-none" />
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-zion-gold/15 flex items-center justify-center">
          <LayoutDashboard size={18} className="text-zion-gold" />
        </div>
        <h3 className="text-sm font-semibold text-white">Mission Control</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Block Height" value={metrics?.chain?.height?.toLocaleString() ?? '—'} icon={Server} color="#FFD700" />
        <MiniStat label="Difficulty"   value={metrics?.chain?.difficulty ? metrics.chain.difficulty.toLocaleString() : '—'} icon={Database} color="#F59E0B" />
        <MiniStat label="Pool HR"      value={fmtHashrate(metrics?.pool?.hashrate_hps)} icon={Pickaxe} color="#22C55E" />
        <MiniStat label="Blocks Found" value={metrics?.pool?.blocks_found?.toLocaleString() ?? '—'} icon={CheckCircle2} color="#10B981" />
      </div>
    </Card>
  );
}
function MonitoringTab({ metrics }: { metrics: V3Metrics | null }) {
  const m = metrics;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Block Height" value={m?.chain?.height?.toLocaleString() ?? '—'} icon={Server} color="#FFD700" />
        <Stat label="Difficulty"   value={m?.chain?.difficulty ? m.chain.difficulty.toLocaleString() : '—'} icon={Database} color="#F59E0B" />
        <Stat label="Pool Sessions"value={m?.pool?.sessions ?? '—'}                    icon={Layers} color="#9333EA" />
        <Stat label="Pool Hashrate"value={fmtHashrate(m?.pool?.hashrate_hps)}         icon={Pickaxe} color="#22C55E" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Accept Rate"   value={m?.pool?.accept_rate_pct?.toFixed(1) ?? '—'} unit="%" icon={CheckCircle2} color="#22C55E" />
        <Stat label="Network HR"    value={fmtHashrate(m?.chain?.network_hashrate)}       icon={Globe}          color="#06B6D4" />
        <Stat label="Mempool"       value={m?.chain?.mempool ?? '—'}                       unit="txs" icon={Database} color="#F59E0B" />
        <Stat label="Blocks Found"  value={m?.pool?.blocks_found?.toLocaleString() ?? '—'} icon={Server}         color="#FFD700" />
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={14} className="text-zion-cyan" /> System Health
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Load Average</p>
            <p className="text-lg font-mono text-white">{m?.system?.load1 ? m.system.load1.toFixed(2) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Memory</p>
            <p className="text-lg font-mono text-white">
              {m?.system?.mem_used_gb ? m.system.mem_used_gb.toFixed(1) + ' / ' + (m.system.mem_total_gb ?? 0).toFixed(1) + ' GB' : '—'}
            </p>
            <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              {m?.system?.mem_used_gb && m?.system?.mem_total_gb ? (
                <div className="h-full bg-zion-cyan rounded-full transition-all" style={{ width: Math.min((m.system.mem_used_gb / m.system.mem_total_gb * 100), 100) + '%' }} />
              ) : null}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Disk Used</p>
            <p className="text-lg font-mono text-white">{m?.system?.disk_used_pct ? m.system.disk_used_pct.toFixed(1) + '%' : '—'}</p>
            <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              {m?.system?.disk_used_pct ? (
                <div className="h-full bg-zion-gold rounded-full transition-all" style={{ width: Math.min(m.system.disk_used_pct, 100) + '%' }} />
              ) : null}
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
        const r = await fetch('/api/blockchain/address?address=' + encodeURIComponent(item.address), { signal: AbortSignal.timeout(5000) });
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
          <p className="text-3xl font-bold font-mono text-zion-gold mt-1">
            {total.toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-base text-gray-400">ZION</span>
          </p>
        </div>
        <button onClick={fetchBalances} disabled={loading} className="p-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
          <RefreshCw size={16} className={'text-gray-400 ' + (loading ? 'animate-spin' : '')} />
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
                    <div className="h-full bg-zion-gold rounded-full" style={{ width: pct + '%' }} />
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
    setLoading(true); setErr('');
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
        <button onClick={fetchProposals} disabled={loading} className="p-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
          <RefreshCw size={14} className={'text-gray-400 ' + (loading ? 'animate-spin' : '')} />
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle size={16} /> {err}
        </div>
      )}

      {proposals.length === 0 && !err && !loading ? (
        <Card><p className="text-sm text-gray-400 text-center py-8">No active proposals found.</p></Card>
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
                      <span className={'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ' +
                        (p.status === 'active'  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                         p.status === 'passed'  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                         p.status === 'failed'  ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                         'bg-gray-500/10 text-gray-400 border-gray-500/30')}>
                        {p.status}
                      </span>
                      <span className="text-xs text-gray-500">Deadline: {new Date(p.deadline).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-6 text-xs">
                  <div><span className="text-gray-500">Yes: </span><span className="font-mono text-emerald-400">{p.yes_votes.toLocaleString()}</span></div>
                  <div><span className="text-gray-500">No: </span><span className="font-mono text-red-400">{p.no_votes.toLocaleString()}</span></div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: yesPct + '%' }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function WalletTab() {
  const {
    wallets, activeWallet, balance, loading, error,
    createWallet, importFromMnemonic, importFromPrivateKey,
    setActiveWallet, deleteWallet, refreshBalance, send,
    exportMnemonic, exportPrivateKey,
  } = useZionWallet();

  const [subTab, setSubTab] = useState<'overview' | 'create' | 'import' | 'send' | 'export'>('overview');
  const [password, setPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [walletName, setWalletName] = useState('My Wallet');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [exportedSecret, setExportedSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [txResult, setTxResult] = useState('');
  const [copyOk, setCopyOk] = useState(false);

  const handleCopy = (text: string) => {
    copy(text);
    setCopyOk(true);
    setTimeout(() => setCopyOk(false), 1200);
  };

  const handleCreate = async () => {
    if (!password || password.length < 8) { alert('Password must be at least 8 characters'); return; }
    try {
      await createWallet(walletName, password);
      setPassword('');
      setSubTab('overview');
    } catch (e: any) { alert(e.message); }
  };

  const handleImportMnemonic = async () => {
    if (!mnemonic || !password) { alert('Mnemonic and password required'); return; }
    try {
      await importFromMnemonic(mnemonic, walletName, password);
      setMnemonic(''); setPassword('');
      setSubTab('overview');
    } catch (e: any) { alert(e.message); }
  };

  const handleImportPrivateKey = async () => {
    if (!privateKey || !password) { alert('Private key and password required'); return; }
    try {
      await importFromPrivateKey(privateKey, walletName, password);
      setPrivateKey(''); setPassword('');
      setSubTab('overview');
    } catch (e: any) { alert(e.message); }
  };

  const handleSend = async () => {
    if (!activeWallet || !sendTo || !sendAmount || !password) {
      alert('Fill all required fields'); return;
    }
    try {
      const txid = await send(sendTo, parseFloat(sendAmount), password, sendMemo || undefined);
      setTxResult('Transaction submitted! TXID: ' + txid);
      setSendTo(''); setSendAmount(''); setSendMemo(''); setPassword('');
    } catch (e: any) { alert(e.message); }
  };

  const handleExportMnemonic = async () => {
    if (!activeWallet || !password) return;
    try {
      const m = await exportMnemonic(activeWallet.id, password);
      setExportedSecret(m);
      setShowSecret(false);
    } catch (e: any) { alert(e.message); }
  };

  const handleExportPrivateKey = async () => {
    if (!activeWallet || !password) return;
    try {
      const pk = await exportPrivateKey(activeWallet.id, password);
      setExportedSecret(pk);
      setShowSecret(false);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}

      {activeWallet && (
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-zion-gold/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Active Wallet</p>
              <p className="text-lg font-semibold text-white">{activeWallet.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm font-mono text-zion-gold">{activeWallet.address.slice(0, 22)}...{activeWallet.address.slice(-8)}</code>
                <button onClick={() => handleCopy(activeWallet.address)} className="p-1.5 rounded-lg hover:bg-white/10 transition" title="Copy">
                  <Copy size={14} className="text-gray-400" />
                </button>
                {copyOk && <span className="text-[10px] text-emerald-400">Copied</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-400">Balance</p>
                <p className="text-2xl font-bold font-mono text-zion-cyan">{balance !== null ? balance.toFixed(6) : '---'} <span className="text-sm text-gray-400">ZION</span></p>
              </div>
              <button onClick={refreshBalance} disabled={loading} className="p-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors" title="Refresh">
                <RefreshCw size={16} className={'text-gray-400 ' + (loading ? 'animate-spin' : '')} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {wallets.length > 0 && (
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Your Wallets ({wallets.length})</p>
          <div className="space-y-2">
            {wallets.map((w) => (
              <div key={w.id}
                className={'flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ' +
                  (activeWallet?.id === w.id ? 'bg-zion-gold/10 border-zion-gold/30' : 'bg-black/40 border-white/5 hover:border-white/15')}
                onClick={() => setActiveWallet(w.id)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{w.name}</p>
                  <p className="text-xs text-gray-500 font-mono truncate max-w-[280px] sm:max-w-[400px]">{w.address}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm('Delete wallet "' + w.name + '"?')) deleteWallet(w.id); }}
                  className="p-2 hover:bg-red-500/10 rounded-xl text-red-400 transition shrink-0"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1">
        {(['overview','create','import','send','export'] as const).map((t) => (
          <button key={t} onClick={() => { setSubTab(t); setExportedSecret(''); setTxResult(''); }}
            className={'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ' +
              (subTab === t ? 'bg-white/10 text-white border border-white/15' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent')}>
            {t === 'overview' && <Wallet size={13} />}
            {t === 'create' && <Plus size={13} />}
            {t === 'import' && <Import size={13} />}
            {t === 'send' && <Send size={13} />}
            {t === 'export' && <Download size={13} />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <Card>
          {activeWallet ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Receive</h3>
              <p className="text-xs text-gray-400">Share your address to receive ZION tokens.</p>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-black/40 border border-white/10">
                <code className="text-sm font-mono text-zion-gold flex-1 break-all">{activeWallet.address}</code>
                <button onClick={() => handleCopy(activeWallet.address)} className="p-2 rounded-lg hover:bg-white/10 transition">
                  <Copy size={14} className="text-gray-400" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No active wallet. Create or import one.</p>
          )}
        </Card>
      )}

      {subTab === 'create' && (
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Plus size={14} className="text-zion-gold" /> Create New Wallet</h3>
          <div className="space-y-3 max-w-md">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Wallet Name</label>
              <input type="text" value={walletName} onChange={(e) => setWalletName(e.target.value)} className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-zion-gold/40" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password (min 8 chars)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-zion-gold/40" />
            </div>
            <button onClick={handleCreate} disabled={loading} className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-zion-gold to-amber-500 text-black text-sm font-semibold shadow-lg shadow-zion-gold/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Wallet'}
            </button>
          </div>
        </Card>
      )}

      {subTab === 'import' && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Import size={14} className="text-zion-cyan" /> From Mnemonic</h3>
            <div className="space-y-3 max-w-lg">
              <textarea value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} placeholder="Enter 12 or 24 word mnemonic..." rows={3}
                className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-cyan/40 resize-none font-mono" />
              <input type="text" value={walletName} onChange={(e) => setWalletName(e.target.value)} placeholder="Wallet name"
                className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-zion-cyan/40" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Encryption password"
                className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-zion-cyan/40" />
              <button onClick={handleImportMnemonic} disabled={loading}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50">
                {loading ? 'Importing...' : 'Import from Mnemonic'}
              </button>
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Key size={14} className="text-zion-purple" /> From Private Key</h3>
            <div className="space-y-3 max-w-lg">
              <input type="text" value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder="64-char hex private key"
                className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-purple/40 font-mono" />
              <input type="text" value={walletName} onChange={(e) => setWalletName(e.target.value)} placeholder="Wallet name"
                className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-zion-purple/40" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Encryption password"
                className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-zion-purple/40" />
              <button onClick={handleImportPrivateKey} disabled={loading}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-zion-purple to-violet-500 text-white text-sm font-semibold shadow-lg shadow-zion-purple/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50">
                {loading ? 'Importing...' : 'Import from Private Key'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {subTab === 'send' && (
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Send size={14} className="text-emerald-400" /> Send ZION</h3>
          {!activeWallet ? (
            <p className="text-sm text-gray-400">Select or create a wallet first.</p>
          ) : (
            <div className="space-y-3 max-w-lg">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Recipient Address</label>
                <input type="text" value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="zion1..."
                  className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-emerald-400/40 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Amount (ZION)</label>
                  <input type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.0"
                    className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-emerald-400/40" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Memo (optional)</label>
                  <input type="text" value={sendMemo} onChange={(e) => setSendMemo(e.target.value)} placeholder="Memo..."
                    className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-emerald-400/40" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Wallet Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                  className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-emerald-400/40" />
              </div>
              <button onClick={handleSend} disabled={loading}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Transaction'}
              </button>
              {txResult && <p className="text-xs text-emerald-400 font-mono break-all">{txResult}</p>}
            </div>
          )}
        </Card>
      )}

      {subTab === 'export' && (
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Download size={14} className="text-zion-gold" /> Export Keys</h3>
          {!activeWallet ? (
            <p className="text-sm text-gray-400">Select a wallet first.</p>
          ) : (
            <div className="space-y-3 max-w-lg">
              <p className="text-xs text-gray-400">Never share your private keys or mnemonic with anyone.</p>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Wallet Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                  className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white outline-none focus:border-zion-gold/40" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleExportMnemonic} className="px-4 py-2.5 rounded-2xl border border-zion-gold/30 text-zion-gold text-sm hover:bg-zion-gold/10 transition-colors shadow-lg shadow-zion-gold/10">Export Mnemonic</button>
                <button onClick={handleExportPrivateKey} className="px-4 py-2.5 rounded-2xl border border-white/10 text-gray-300 text-sm hover:border-white/20 hover:bg-white/5 transition-colors">Export Private Key</button>
              </div>
              {exportedSecret && (
                <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Secret</span>
                    <div className="flex gap-2">
                      <button onClick={() => setShowSecret(!showSecret)} className="text-xs text-gray-400 hover:text-white transition">{showSecret ? 'Hide' : 'Reveal'}</button>
                      <button onClick={() => handleCopy(exportedSecret)} className="text-xs text-gray-400 hover:text-white transition">Copy</button>
                    </div>
                  </div>
                  <code className="text-sm font-mono text-zion-gold break-all">{showSecret ? exportedSecret : '•'.repeat(Math.min(exportedSecret.length, 64))}</code>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </motion.div>
  );
}
export default function DashboardMain() {
  const { activeWallet, disconnect } = useZionWallet();
  const [activeTab, setActiveTab] = useState<'monitoring' | 'wallet' | 'treasury' | 'dao'>('wallet');
  const [metrics, setMetrics] = useState<V3Metrics | null>(null);
  const [metricsSource, setMetricsSource] = useState<'live' | 'fallback' | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const r = await fetch('/api/dashboard-metrics', { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return;
      const d = await r.json();
      setMetrics(d);
      setMetricsSource(d.source === 'fallback' ? 'fallback' : 'live');
    } catch { /* ignore */ }
  }, []);

  usePolling(fetchMetrics, 30);

  useEffect(() => {
    if (activeWallet) { setAuthenticated(true); fetchMetrics(); }
    else { setAuthenticated(false); }
  }, [activeWallet, fetchMetrics]);

  return (
    <div className="relative z-10 zion-container max-w-7xl space-y-14 py-10">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="zion-rainbow-card rounded-3xl md:rounded-4xl p-6 md:p-10"
        style={{ '--rc': '99, 102, 241' } as React.CSSProperties}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase">
              <LayoutDashboard className="h-4 w-4" /> Live Monitor
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">ZION Mainnet</p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">Dashboard</h1>
            </div>
            <p className="text-lg text-gray-300 max-w-2xl">
              Chain telemetry, wallet operations, treasury overview, and DAO proposals. Read-only monitoring for Guardians and operators.
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Activity className="h-3 w-3 text-emerald-400" /> Auto-refresh 30s
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Globe className="h-3 w-3 text-zion-cyan" /> Core + Edge
              </span>
              {metricsSource === 'fallback' && (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-400">
                  <AlertTriangle className="h-3 w-3" /> Core offline — showing cached/empty metrics
                </span>
              )}
            </div>
          </div>

          {activeWallet && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5">
                <Wallet size={12} className="text-zion-gold" />
                <span className="text-xs font-mono text-gray-300">{activeWallet.address.slice(0, 10)}...{activeWallet.address.slice(-4)}</span>
              </div>
              <button onClick={disconnect} className="p-2 rounded-xl border border-white/10 hover:border-red-500/40 hover:bg-red-500/10 transition-colors" title="Disconnect">
                <Lock size={14} className="text-gray-400" />
              </button>
            </div>
          )}
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <MissionControlLite metrics={metrics} />
        </motion.div>

        <div className="flex gap-1 mt-8 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const isActive = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ' +
                  (isActive ? 'bg-white/10 text-white border border-white/15' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent')}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          {activeTab === 'wallet' && <WalletTab />}
          {activeTab !== 'wallet' && !authenticated && (
            <WalletGate onEnter={() => setAuthenticated(true)} />
          )}
          {activeTab !== 'wallet' && authenticated && (
            <>
              {activeTab === 'monitoring' && <MonitoringTab metrics={metrics} />}
              {activeTab === 'treasury'   && <TreasuryTab />}
              {activeTab === 'dao'        && <DaoTab />}
            </>
          )}
        </div>
      </motion.section>
    </div>
  );
}
