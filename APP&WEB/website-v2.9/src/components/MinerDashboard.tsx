"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Clock,
  Copy,
  Cpu,
  ExternalLink,
  Hash,
  Layers,
  Pickaxe,
  RefreshCw,
  Server,
  Shield,
  Signal,
  Sparkles,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';

/* ═══════════════════════════════════════════════════════════
   MINER DASHBOARD — Per-miner metrics & charts
   Explorer design language (bg-black/60, rounded-3xl, motion.section)
   ═══════════════════════════════════════════════════════════ */

/* ═══════ TYPES ═══════ */
interface MinerData {
  ok: boolean;
  address: string;
  active: boolean;
  stats: {
    hashrate_1h: number;
    hashrate_24h: number;
    total_shares: number;
    valid_shares: number;
    invalid_shares: number;
    efficiency: string;
    blocks_found: number;
    total_paid: number;
    pending_balance: number;
    last_share_time: number;
  };
  payouts: Array<{
    amount: number;
    tx_id?: string;
    timestamp: number;
    status?: string;
  }>;
  blocks: Array<{
    height: number;
    hash: string;
    reward: number;
    timestamp: number;
    server?: string;
  }>;
  servers: Array<{ id: string; connected: boolean }>;
}

interface PrometheusMinerData {
  ok: boolean;
  has_metrics: boolean;
  scrape_ts: number;
  source?: string;
  metrics: {
    hashrate: number;
    shares_valid: number;
    shares_invalid: number;
    blocks_found: number;
    pending_balance_atomic: number;
    paid_total_atomic: number;
    connections_active: number;
  };
  servers: Array<{
    server: string;
    connected: boolean;
    metrics_available: boolean;
    values: {
      hashrate: number;
      shares_valid: number;
      shares_invalid: number;
      blocks_found: number;
      pending_balance_atomic: number;
      paid_total_atomic: number;
      connections_active: number;
    } | null;
  }>;
}

/* ═══════ HELPERS ═══════ */
function fmtHash(h: number): string {
  if (!h || h <= 0) return "0 H/s";
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} kH/s`;
  return `${h.toFixed(0)} H/s`;
}

function fmtNum(n?: number): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US");
}

function fmtZion(atomic: number): string {
  return (atomic / 1e6).toFixed(4);
}

function timeAgo(ts: number, cs = false): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return cs ? `pred ${diff} s` : `${diff}s ago`;
  if (diff < 3600) return cs ? `pred ${Math.floor(diff / 60)} min` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return cs ? `pred ${Math.floor(diff / 3600)} h` : `${Math.floor(diff / 3600)}h ago`;
  return cs ? `pred ${Math.floor(diff / 86400)} d` : `${Math.floor(diff / 86400)}d ago`;
}

function shortHash(h: string): string {
  if (h.length <= 16) return h;
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

function shortAddr(addr: string): string {
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`;
}

/* ═══════ COPY BUTTON ═══════ */
function CopyBtn({ text, titleLabel = "Copy" }: { text: string; titleLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="ml-2 text-gray-500 hover:text-white transition-colors"
      title={titleLabel}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

/* ═══════ STAT CARD ═══════ */
function StatCard({ icon, label, value, sub, accent = "text-zion-cyan" }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="zion-rainbow-sub p-4 space-y-2" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
      <div className={`h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4 ${accent}`}>
        {icon}
      </div>
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

/* ═══════ SVG SPARKLINE ═══════ */
function HashrateSpark({ data, width = 600, height = 120, emptyLabel = "Not enough data for chart" }: { data: number[]; width?: number; height?: number; emptyLabel?: string }) {
  if (data.length < 2) return <p className="text-sm text-gray-500">{emptyLabel}</p>;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - 10 - ((v - min) / range) * (height - 20);
    return `${x},${y}`;
  }).join(" ");

  const areaPath = `M0,${height} L${data.map((v, i) => {
    const x = i * step;
    const y = height - 10 - ((v - min) / range) * (height - 20);
    return `${x},${y}`;
  }).join(" L")} L${width},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(147,51,234,0.4)" />
          <stop offset="100%" stopColor="rgba(147,51,234,0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGrad)" />
      <polyline fill="none" stroke="rgba(147,51,234,0.8)" strokeWidth="2" points={points} />
      {/* current value dot */}
      {data.length > 0 && (() => {
        const lastX = (data.length - 1) * step;
        const lastY = height - 10 - ((data[data.length - 1] - min) / range) * (height - 20);
        return <circle cx={lastX} cy={lastY} r="4" fill="#9333ea" stroke="white" strokeWidth="1.5" />;
      })()}
    </svg>
  );
}

/* ═══════ MAIN COMPONENT ═══════ */
export default function MinerDashboard({ address }: { address: string }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [data, setData] = useState<MinerData | null>(null);
  const [promMetrics, setPromMetrics] = useState<PrometheusMinerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hashHistory, setHashHistory] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [minerRes, promRes] = await Promise.all([
        fetch(`/api/pool/miner/${address}`, { cache: "no-store" }),
        fetch(`/api/pool/miner/${address}/metrics`, { cache: "no-store" }),
      ]);

      const json = await minerRes.json();
      if (json.ok) {
        setData(json);
        setError("");
        // Build hashrate history from accumulating samples
        setHashHistory((prev) => {
          const newArr = [...prev, json.stats.hashrate_1h];
          return newArr.slice(-60); // keep last 60 samples (15min at 15s refresh)
        });

        if (promRes.ok) {
          const promJson = await promRes.json();
          if (promJson?.ok) {
            setPromMetrics(promJson);
          }
        }
      } else {
        setError(json.error || (cs ? 'Miner nebyl nalezen' : 'Miner not found'));
      }
    } catch {
      setError(cs ? 'Nepodarilo se nacist data minera' : 'Failed to fetch miner data');
    } finally {
      setLoading(false);
    }
  }, [address, cs]);

  usePolling(fetchData, 15_000);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>{cs ? 'Nacitam data minera...' : 'Loading miner data...'}</span>
        </div>
      </div>
    );
  }

  /* ── Error / Not Found ── */
  if (error || !data) {
    return (
      <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24">
        <div className="zion-container max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="zion-rainbow-card p-8 md:p-12 text-center space-y-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
          >
            <div className="mx-auto h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-semibold text-white">{cs ? 'Miner nebyl nalezen' : 'Miner Not Found'}</h1>
            <p className="text-gray-400 max-w-md mx-auto">
              {error || (cs ? `Pro adresu ${shortAddr(address)} nebyla nalezena zadna tezebni data.` : `No mining data found for address ${shortAddr(address)}.`)}
              <br />{cs ? 'Zkontrolujte, ze je adresa spravna a ze odeslala shares do poolu.' : 'Make sure the address is correct and has submitted shares to the pool.'}
            </p>
            <code className="block text-sm text-gray-500 font-mono break-all">{address}</code>
            <Link href="/pool" className="inline-flex items-center gap-2 text-zion-cyan hover:text-white transition-colors text-sm">
              <ArrowLeft className="h-4 w-4" /> {cs ? 'Zpet do poolu' : 'Back to Pool'}
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  const s = data.stats;

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">

      <div className="relative z-10 zion-container max-w-7xl space-y-14">

        {/* ═══════ BREADCRUMB + HEADER ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/pool" className="hover:text-white transition-colors inline-flex items-center gap-1">
              <Pickaxe className="h-3.5 w-3.5" /> {cs ? 'Pool' : 'Pool'}
            </Link>
            <ArrowRight className="h-3 w-3" />
            <span className="text-gray-400">{cs ? 'Miner' : 'Miner'}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${data.active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-red-400'}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${data.active ? 'text-emerald-400' : 'text-red-400'}`}>
                  {data.active ? (cs ? 'Aktivni' : 'Active') : (cs ? 'Neaktivni' : 'Inactive')}
                </span>
                {s.last_share_time > 0 && (
                  <span className="text-xs text-gray-500">· {cs ? 'posledni share' : 'last share'} {timeAgo(s.last_share_time, cs)}</span>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-mono text-white break-all leading-relaxed flex items-center gap-2">
                {shortAddr(address)}
                <CopyBtn text={address} titleLabel={cs ? 'Kopirovat adresu' : 'Copy address'} />
              </h1>
              <div className="flex flex-wrap gap-2">
                {data.servers.filter((sv) => sv.connected).map((sv) => (
                  <span key={sv.id} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                    <Server className="h-3 w-3 text-zion-cyan" /> {sv.id}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex gap-6">
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Hashrate</p>
                <p className="text-2xl font-semibold text-zion-cyan">{fmtHash(s.hashrate_1h)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{cs ? 'Bloky' : 'Blocks'}</p>
                <p className="text-2xl font-semibold text-zion-gold">{fmtNum(s.blocks_found)}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ STATS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Telemetrie' : 'Telemetry'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {cs ? 'Statistiky minera' : 'Miner Statistics'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Metriky tohoto minera v realnem case napric vsemi pool servery.' : 'Real-time metrics for this miner across all pool servers.'}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <StatCard icon={<Zap />} label={cs ? 'Hashrate 1h' : 'Hashrate 1h'} value={fmtHash(s.hashrate_1h)} accent="text-zion-cyan" />
            <StatCard icon={<TrendingUp />} label={cs ? 'Hashrate 24h' : 'Hashrate 24h'} value={fmtHash(s.hashrate_24h)} accent="text-zion-purple" />
            <StatCard icon={<Layers />} label={cs ? 'Validni shares' : 'Valid Shares'} value={fmtNum(s.valid_shares)} accent="text-emerald-400" />
            <StatCard icon={<XCircle />} label={cs ? 'Neplatne shares' : 'Invalid Shares'} value={fmtNum(s.invalid_shares)} accent="text-red-400" />
            <StatCard icon={<Shield />} label={cs ? 'Efektivita' : 'Efficiency'} value={`${s.efficiency}%`} accent="text-zion-gold" />
            <StatCard icon={<Box />} label={cs ? 'Nalezene bloky' : 'Blocks Found'} value={fmtNum(s.blocks_found)} accent="text-amber-400" />
            <StatCard icon={<Wallet />} label={cs ? 'Ceka na payout' : 'Pending'} value={`${fmtZion(s.pending_balance)} ZION`} accent="text-zion-cyan" />
            <StatCard icon={<Sparkles />} label={cs ? 'Celkem vyplaceno' : 'Total Paid'} value={`${fmtZion(s.total_paid)} ZION`} accent="text-emerald-400" />
            <StatCard icon={<Hash />} label={cs ? 'Shares celkem' : 'Total Shares'} value={fmtNum(s.total_shares)} accent="text-gray-300" />
            <StatCard icon={<Clock />} label={cs ? 'Posledni share' : 'Last Share'} value={s.last_share_time > 0 ? timeAgo(s.last_share_time, cs) : '—'} accent="text-gray-300" />
            <StatCard icon={<Server />} label={cs ? 'Servery' : 'Servers'} value={`${data.servers.filter(sv => sv.connected).length} / ${data.servers.length}`} accent="text-zion-purple" />
            <StatCard icon={<Cpu />} label={cs ? 'Algoritmus' : 'Algorithm'} value="Cosmic Harmony" sub="v3 Multi-Algo" accent="text-zion-gold" />
          </div>
        </motion.section>

        {/* ═══════ HASHRATE CHART ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.10 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Vykon' : 'Performance'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-zion-purple" />
              {cs ? 'Vyvoj hashratu' : 'Hashrate Timeline'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Zive vzorky hashratu sbirane kazdych 15 sekund.' : 'Live hashrate samples collected every 15 seconds.'}</p>
          </div>
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">{cs ? 'Aktualne:' : 'Current:'}</span>
                <span className="text-lg font-semibold text-zion-cyan">{fmtHash(s.hashrate_1h)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">{cs ? '24h prumer:' : '24h avg:'}</span>
                <span className="text-lg font-semibold text-zion-purple">{fmtHash(s.hashrate_24h)}</span>
              </div>
            </div>
            <HashrateSpark data={hashHistory} emptyLabel={cs ? 'Pro graf zatim neni dost dat' : 'Not enough data for chart'} />
          </div>
        </motion.section>

        {/* ═══════ BLOCKS FOUND ═══════ */}
        {data.blocks.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Tezba' : 'Mining'}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Box className="h-7 w-7 text-amber-400" />
                {cs ? 'Nalezene bloky' : 'Blocks Found'}
              </h2>
              <p className="text-sm text-gray-400">{cs ? 'Bloky nalezene timto minerem v poolu.' : 'Blocks found by this miner on the pool.'}</p>
            </div>
            <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="px-4 md:px-6 py-4">{cs ? 'Vyska' : 'Height'}</th>
                      <th className="px-4 md:px-6 py-4">Hash</th>
                      <th className="px-4 md:px-6 py-4">{cs ? 'Odmena' : 'Reward'}</th>
                      <th className="px-4 md:px-6 py-4">{cs ? 'Cas' : 'Time'}</th>
                      <th className="px-4 md:px-6 py-4">{cs ? 'Server' : 'Server'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.blocks.map((b, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 md:px-6 py-3">
                          <Link href={`/explorer/block?height=${b.height}`} className="text-zion-cyan hover:text-white transition-colors font-mono">
                            #{fmtNum(b.height)}
                          </Link>
                        </td>
                        <td className="px-4 md:px-6 py-3 font-mono text-gray-400">{shortHash(b.hash)}</td>
                        <td className="px-4 md:px-6 py-3 text-zion-gold">{(b.reward / 1e6).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ZION</td>
                        <td className="px-4 md:px-6 py-3 text-gray-400">{timeAgo(b.timestamp, cs)}</td>
                        <td className="px-4 md:px-6 py-3 text-gray-500">{b.server ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.section>
        )}

        {/* ═══════ PAYOUTS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Vydelky' : 'Earnings'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Wallet className="h-7 w-7 text-emerald-400" />
              {cs ? 'Payouty' : 'Payouts'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Historie pool payoutu tomuto minerovi.' : 'History of pool payouts to this miner.'}</p>
          </div>
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            {data.payouts.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{cs ? 'Zatim zadne payouty. Minimalni payout: 0.1 ZION' : 'No payouts yet. Minimum payout: 0.1 ZION'}</p>
                <p className="text-xs mt-1">{cs ? 'Cekajici zustatek' : 'Pending balance'}: {fmtZion(s.pending_balance)} ZION</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">{cs ? 'Castka' : 'Amount'}</th>
                      <th className="px-4 py-3">TX ID</th>
                      <th className="px-4 py-3">{cs ? 'Cas' : 'Time'}</th>
                      <th className="px-4 py-3">{cs ? 'Stav' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payouts.map((p, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-emerald-400 font-semibold">{fmtZion(p.amount)} ZION</td>
                        <td className="px-4 py-3 font-mono text-gray-400">
                          {p.tx_id ? (
                            <Link href={`/explorer/tx?hash=${encodeURIComponent(p.tx_id)}`} className="text-zion-cyan hover:text-white transition-colors">
                              {shortHash(p.tx_id)}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{timeAgo(p.timestamp, cs)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                            p.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {p.status ? (p.status === 'confirmed' ? (cs ? 'potvrzeno' : 'confirmed') : p.status) : (cs ? 'ceka' : 'pending')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.section>

        {/* ═══════ ADVANCED METRICS INFO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Rozsirene' : 'Advanced'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Signal className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Rozsirene metriky' : 'Advanced Metrics'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Nejlepsi dostupna telemetrie minera z pool accounting a zivych runtime dat.' : 'Best available miner telemetry from pool accounting and live runtime data.'}</p>
          </div>
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            {!promMetrics ? (
              <p className="text-sm text-gray-400">{cs ? 'Nacitam rozsirene metriky minera...' : 'Loading advanced miner metrics...'}</p>
            ) : (
              <>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_hashrate{`{address="..."}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtHash(promMetrics.metrics.hashrate)}</p>
                    <p className="text-xs text-gray-400">{cs ? 'Aktualni hashrate (Gauge)' : 'Current hashrate (Gauge)'}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_shares_total{`{status="valid|invalid"}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtNum(promMetrics.metrics.shares_valid)} / {fmtNum(promMetrics.metrics.shares_invalid)}</p>
                    <p className="text-xs text-gray-400">{cs ? 'Validni / neplatne shares (Counter)' : 'Valid / invalid shares (Counter)'}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_blocks_found_total{`{address="..."}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtNum(promMetrics.metrics.blocks_found)}</p>
                    <p className="text-xs text-gray-400">{cs ? 'Nalezene bloky (Counter)' : 'Blocks found (Counter)'}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_pending_balance_atomic{`{address="..."}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtZion(promMetrics.metrics.pending_balance_atomic)} ZION</p>
                    <p className="text-xs text-gray-400">{cs ? 'Cekajici zustatek (Gauge)' : 'Pending balance (Gauge)'}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_paid_total_atomic{`{address="..."}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtZion(promMetrics.metrics.paid_total_atomic)} ZION</p>
                    <p className="text-xs text-gray-400">{cs ? 'Celkem vyplaceno (Gauge)' : 'Total paid (Gauge)'}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <p className="text-xs text-zion-cyan font-mono break-all">miner_connections_active{`{address="..."}`}</p>
                    <p className="text-lg font-semibold text-white">{fmtNum(promMetrics.metrics.connections_active)}</p>
                    <p className="text-xs text-gray-400">{cs ? 'Aktivni spojeni (Gauge)' : 'Active connections (Gauge)'}</p>
                  </div>
                </div>

                <div className="mt-4 text-xs text-gray-500 space-y-1">
                  <p>
                    {cs ? 'Posledni scrape' : 'Last scrape'}: {promMetrics.scrape_ts > 0 ? timeAgo(promMetrics.scrape_ts, cs) : '—'} · {cs ? 'aktualizace kazdych 15 s' : 'Updated every 15s'}
                  </p>
                  <p>
                    {cs ? 'Zdroj' : 'Source'}: {promMetrics.source ?? (cs ? 'runtime fallback' : 'runtime fallback')}
                  </p>
                  <p>
                    {cs ? 'Endpointy' : 'Endpoints'}: {promMetrics.servers.map((sv) => `${sv.server}:${sv.connected ? (cs ? 'ok' : 'ok') : (cs ? 'down' : 'down')}`).join(' · ')}
                  </p>
                </div>
              </>
            )}
          </div>
        </motion.section>

        {/* ═══════ CTA FOOTER ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
        >
          <div className="relative rounded-3xl md:rounded-4xl p-px bg-linear-to-r from-zion-purple/60 via-white/10 to-zion-cyan/60">
            <div className="rounded-3xl md:rounded-4xl bg-black/90 backdrop-blur-xl p-8 md:p-12 text-center space-y-6">
              <h3 className="text-2xl md:text-3xl font-semibold text-gradient">{cs ? 'Zpet na prehled poolu' : 'Back to Pool Overview'}</h3>
              <p className="text-gray-300 max-w-lg mx-auto">
                {cs ? 'Zobrazte vsechny statistiky poolu, stav serveru a pripojte se k tezebni komunite.' : 'View all pool statistics, server status, and join the mining community.'}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/pool"
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-purple to-zion-cyan px-8 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  <Pickaxe className="h-4 w-4" /> {cs ? 'Prehled poolu' : 'Pool Dashboard'}
                </Link>
                <Link
                  href="/explorer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 py-3 text-sm font-semibold text-gray-200 hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" /> {cs ? 'Explorer' : 'Explorer'}
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
