"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Cpu,
  Loader2,
  Pickaxe,
  Sparkles,
  Star,
  Wallet,
  XCircle,
  Layers,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useLang } from '@/contexts/LanguageContext';
import { FLOWERS_PER_ZION } from '@/lib/constants';

const ExplorerAddressAddressDetailClientCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  missingAddressUseAddrZion1OrAd: { cs: `Chybí adresa. Použijte ?addr=zion1... nebo ?addr=ZION...`, en: `Missing address. Use ?addr=zion1... or ?addr=ZION...` },
  address: { cs: `Adresa`, en: `Address` },
  addressNotFound: { cs: `Adresa nenalezena`, en: `Address Not Found` },
  backToExplorer: { cs: `← Zpět do exploreru`, en: `← Back to Explorer` },
  watched: { cs: `Sledováno`, en: `Watched` },
  activeMiner: { cs: `Aktivní miner`, en: `Active Miner` },
  unwatch: { cs: `Přestat sledovat`, en: `Unwatch` },
  watch: { cs: `Sledovat`, en: `Watch` },
  optionalLabel: { cs: `Volitelný popisek...`, en: `Optional label...` },
  add: { cs: `Přidat`, en: `Add` },
  cancel: { cs: `Zrušit`, en: `Cancel` },
  onChainBalance: { cs: `On-chain zůstatek`, en: `On-Chain Balance` },
  utxos: { cs: `UTXOs`, en: `UTXOs` },
  poolPending: { cs: `Pool (čeká)`, en: `Pool (Pending)` },
  poolPaid: { cs: `Pool (vyplaceno)`, en: `Pool (Paid)` },
  transactionSummary: { cs: `Souhrn transakcí`, en: `Transaction Summary` },
  total: { cs: `Celkem`, en: `Total` },
  received: { cs: `Přijato`, en: `Received` },
  sent: { cs: `Odesláno`, en: `Sent` },
  fees: { cs: `Poplatky`, en: `Fees` },
  addressDetails: { cs: `Detaily adresy`, en: `Address Details` },
  poolPending_2: { cs: `Pool (čeká)`, en: `Pool Pending` },
  poolPaid_2: { cs: `Pool (vyplaceno)`, en: `Pool Paid` },
  transactions: { cs: `Transakce`, en: `Transactions` },
  firstSeen: { cs: `První výskyt`, en: `First Seen` },
  lastActive: { cs: `Naposledy aktivní`, en: `Last Active` },
  miningStats: { cs: `Statistiky těžby`, en: `Mining Stats` },
  blocksFound: { cs: `Nalezené bloky`, en: `Blocks Found` },
  acceptedShares: { cs: `Přijaté shares`, en: `Accepted Shares` },
  rejectedShares: { cs: `Odmítnuté shares`, en: `Rejected Shares` },
  worker: { cs: `Worker`, en: `Worker` },
  consciousnessLevel: { cs: `Úroveň vědomí`, en: `Consciousness Level` },
  multiplier: { cs: `Násobič`, en: `Multiplier` },
  notAnActiveMiner: { cs: `Není to aktivní miner`, en: `Not an active miner` },
  miningStatsWillAppearOnceThisA: { cs: `Statistiky těžby se objeví, jakmile tato adresa začne těžit.`, en: `Mining stats will appear once this address starts mining.` },
  viewAll: { cs: `Zobrazit vše →`, en: `View all →` },
  type: { cs: `Typ`, en: `Type` },
  age: { cs: `Stáří`, en: `Age` },
  amount: { cs: `Částka`, en: `Amount` },
  noTransactionsFound: { cs: `Nenalezeny žádné transakce`, en: `No transactions found` },
  payout: { cs: `výplata`, en: `payout` },
  loadMore: { cs: `Načíst další`, en: `Load More` },
  utxoList: { cs: `UTXO seznam`, en: `UTXO List` },
  index: { cs: `Index`, en: `Index` },
  height: { cs: `Výška`, en: `Height` },
  noUtxosFound: { cs: `Žádné UTXO nenalezeny`, en: `No UTXOs found` },
  watchlist: { cs: `Sledované adresy`, en: `Watchlist` },
  added: { cs: `Přidáno`, en: `Added` },
  current: { cs: `Aktuální`, en: `Current` },
  remove: { cs: `Odstranit`, en: `Remove` },
};

/* ── helpers ─────────────────────────────────────────────────── */

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="text-white/20 hover:text-white/60 transition-colors"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-zion-cyan" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function InfoRow({ label, value, mono, color, copy }: { label: string; value: string; mono?: boolean; color?: string; copy?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[11px] text-white/40 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-[13px] ${mono ? "font-mono" : ""} ${color || "text-white/80"} text-right break-all max-w-[300px]`}>{value}</span>
        {copy && <CopyBtn text={value} />}
      </div>
    </div>
  );
}

function formatDate(ts: number, locale: string) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(locale);
}

function timeAgo(ts: number, cs: boolean) {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return cs ? `před ${s} s` : `${s}s ago`;
  if (s < 3600) return cs ? `před ${Math.floor(s / 60)} min` : `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return cs ? `před ${Math.floor(s / 3600)} h` : `${Math.floor(s / 3600)}h ago`;
  return cs ? `před ${Math.floor(s / 86400)} d` : `${Math.floor(s / 86400)}d ago`;
}

/* ── watchlist (localStorage) ────────────────────────────────── */

interface WatchEntry { address: string; label: string; addedAt: number; }

const WATCHLIST_KEY = "zion-watchlist";

function loadWatchlist(): WatchEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveWatchlist(list: WatchEntry[]) {
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

/* ── donut chart ─────────────────────────────────────────────── */

function DonutChart({ received, sent }: { received: number; sent: number }) {
  const total = received + sent;
  const r = 26;
  const c = 2 * Math.PI * r;
  const recvPct = total > 0 ? received / total : 0;
  const sentPct = total > 0 ? sent / total : 0;
  const recvLen = c * recvPct;
  const sentLen = c * sentPct;
  return (
    <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      {total > 0 && (
        <>
          <circle cx="32" cy="32" r={r} fill="none" stroke="#34d399" strokeWidth="8"
            strokeDasharray={`${recvLen} ${c - recvLen}`} strokeDashoffset={0} />
          <circle cx="32" cy="32" r={r} fill="none" stroke="#f87171" strokeWidth="8"
            strokeDasharray={`${sentLen} ${c - sentLen}`} strokeDashoffset={-recvLen} />
        </>
      )}
    </svg>
  );
}

/* ── types ───────────────────────────────────────────────────── */

interface AddressData {
  address: string;
  known_label: string | null;
  known_type: string | null;
  balance: { total: number; total_atomic: number; utxo_count: number; pool_pending: number; pool_locked: number; pool_paid: number };
  total_received: number;
  total_sent: number;
  net_balance: number;
  transaction_count: number;
  first_seen: number;
  last_seen: number;
  is_miner: boolean;
  mining_stats: {
    blocks_found: number;
    accepted_shares: number;
    rejected_shares: number;
    worker_name: string;
    hashrate_1h: number;
    hashrate_formatted: string;
    consciousness_level: string;
    consciousness_multiplier: number;
  } | null;
  transactions: Array<{
    tx_hash: string;
    type: string;
    from: string;
    to: string;
    amount: number;
    fee: number;
    timestamp: number;
    block_height: number;
    status: string;
  }>;
  utxos: Array<{
    tx_hash: string;
    output_index: number;
    amount: number;
    address: string;
    height: number;
  }>;
  transaction_model: string;
}

const consciousnessMap: Record<string, { bg: string; border: string; text: string; glow: string; icon: typeof Star }> = {
  PHYSICAL:    { bg: "bg-slate-500/10", border: "border-slate-500/20", text: "text-slate-300",  glow: "from-slate-500/20",  icon: Cpu },
  MENTAL:      { bg: "bg-zion-purple/10",  border: "border-zion-purple/20",  text: "text-zion-purple",   glow: "from-zion-purple/20",   icon: Sparkles },
  COSMIC:      { bg: "bg-zion-purple/10", border: "border-zion-purple/20", text: "text-zion-purple", glow: "from-zion-purple/20", icon: Star },
  ON_THE_STAR: { bg: "bg-zion-gold/10", border: "border-zion-gold/20", text: "text-zion-gold",  glow: "from-zion-gold/20",  icon: Star },
};

/* ── component ───────────────────────────────────────────────── */

export default function AddressDetailClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = ExplorerAddressAddressDetailClientCopy.enUs[cs ? 'cs' : 'en'];
  const router = useRouter();
  const searchParams = useSearchParams();
  const addr = useMemo(() => String(searchParams.get("addr") || searchParams.get("address") || "").trim(), [searchParams]);

  const [data, setData] = useState<AddressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── watchlist state ── */
  const [watchlist, setWatchlist] = useState<WatchEntry[]>([]);
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [labelValue, setLabelValue] = useState("");
  const [mounted, setMounted] = useState(false);

  /* ── pagination state ── */
  const [visibleCount, setVisibleCount] = useState(10);
  const txListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setWatchlist(loadWatchlist());
  }, []);

  useEffect(() => { setVisibleCount(10); }, [addr]);

  const isWatched = mounted && watchlist.some((w) => w.address === addr);

  const toggleWatch = () => {
    if (isWatched) {
      const next = watchlist.filter((w) => w.address !== addr);
      setWatchlist(next); saveWatchlist(next);
      setShowLabelInput(false); setLabelValue("");
    } else {
      setShowLabelInput(true);
    }
  };

  const confirmWatch = () => {
    const entry: WatchEntry = { address: addr, label: labelValue.trim(), addedAt: Math.floor(Date.now() / 1000) };
    const next = [entry, ...watchlist.filter((w) => w.address !== addr)];
    setWatchlist(next); saveWatchlist(next);
    setShowLabelInput(false); setLabelValue("");
  };

  useEffect(() => {
    (async () => {
      try {
        setError(null); setLoading(true); setData(null);
        if (!addr) { setError(ExplorerAddressAddressDetailClientCopy.missingAddressUseAddrZion1OrAd[cs ? 'cs' : 'en']); return; }
        const result = await apiClient<AddressData>(`/blockchain/address?addr=${encodeURIComponent(addr)}`, { cache: "no-store" });
        setData(result);
      } catch (err) { setError(cs ? `Nepodařilo se načíst adresu: ${err}` : `Failed to load address: ${err}`); }
      finally { setLoading(false); }
    })();
  }, [addr, cs]);

  /* ── loading ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="relative min-h-screen pb-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
      </div>
    );
  }

  /* ── error ───────────────────────────────────────────────── */
  if (error || !data) {
    return (
      <div className="relative min-h-screen pb-24 overflow-x-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zion-purple/5 via-transparent to-transparent" />
        <div className="relative z-10 zion-container max-w-3xl py-12 pt-6">
          <nav className="flex items-center gap-1.5 text-[11px] text-white/40 mb-6">
            <Link href="/explorer" className="hover:text-white/70 transition-colors">Explorer</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/70">{ExplorerAddressAddressDetailClientCopy.address[cs ? 'cs' : 'en']}</span>
          </nav>
          <div className="zion-rainbow-card rounded-[28px] bg-black/60 border border-zion-purple/20 p-5 sm:p-8 md:p-10 text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <XCircle className="h-10 w-10 text-zion-purple/60 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">{ExplorerAddressAddressDetailClientCopy.addressNotFound[cs ? 'cs' : 'en']}</h1>
            <p className="text-white/40 text-sm mb-6 font-mono break-all">{error || addr}</p>
            <button onClick={() => router.push("/explorer")} className="px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] transition-colors text-sm text-white/60 hover:text-white/90">
              {ExplorerAddressAddressDetailClientCopy.backToExplorer[cs ? 'cs' : 'en']}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const level = data.mining_stats?.consciousness_level || "PHYSICAL";
  const cStyle = consciousnessMap[level] || consciousnessMap.PHYSICAL;
  const CIcon = cStyle.icon;

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zion-purple/10 via-transparent to-transparent" />

      <div className="relative z-10 zion-container max-w-[1200px] py-8 pt-6">

        {/* breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] text-white/40 mb-6">
          <Link href="/explorer" className="hover:text-white/70 transition-colors">Explorer</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white/70">{ExplorerAddressAddressDetailClientCopy.address[cs ? 'cs' : 'en']}</span>
        </nav>

        {/* title & address */}
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-zion-purple/10 border border-zion-purple/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Wallet className="w-5 h-5 text-zion-purple" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white tracking-tight">{ExplorerAddressAddressDetailClientCopy.address[cs ? 'cs' : 'en']}</h1>
              {isWatched && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-zion-gold/10 text-zion-gold border border-zion-gold/20" title={ExplorerAddressAddressDetailClientCopy.watched[cs ? 'cs' : 'en']}>
                  <Star className="w-3 h-3 fill-current" />
                  {ExplorerAddressAddressDetailClientCopy.watched[cs ? 'cs' : 'en']}
                </span>
              )}
              {data.known_label && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                  data.known_type === 'pool' ? 'bg-zion-cyan/10 text-zion-cyan border-zion-cyan/20' :
                  data.known_type === 'fund' ? 'bg-zion-purple/10 text-zion-purple border-zion-purple/20' :
                  data.known_type === 'fee' ? 'bg-zion-gold/10 text-zion-gold border-zion-gold/20' :
                  'bg-gray-500/10 text-gray-400 border-gray-500/20'
                }`}>
                  {data.known_label}
                </span>
              )}
              {data.is_miner && !data.known_label && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-zion-cyan/10 text-zion-cyan border border-zion-cyan/20">
                  ⛏ {ExplorerAddressAddressDetailClientCopy.activeMiner[cs ? 'cs' : 'en']}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-zion-purple/70 font-mono text-sm break-all">{addr}</p>
              <CopyBtn text={addr} />
              <button
                onClick={toggleWatch}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  isWatched
                    ? "bg-zion-gold/10 text-zion-gold border-zion-gold/30 hover:bg-zion-gold/20"
                    : "bg-white/[0.04] text-white/60 border-white/[0.08] hover:bg-white/[0.08] hover:text-white/90"
                }`}
                title={isWatched ? (ExplorerAddressAddressDetailClientCopy.unwatch[cs ? 'cs' : 'en']) : (ExplorerAddressAddressDetailClientCopy.watch[cs ? 'cs' : 'en'])}
              >
                <Star className={`w-3.5 h-3.5 ${isWatched ? "fill-current" : ""}`} />
                {isWatched ? (ExplorerAddressAddressDetailClientCopy.unwatch[cs ? 'cs' : 'en']) : (ExplorerAddressAddressDetailClientCopy.watch[cs ? 'cs' : 'en'])}
              </button>
            </div>
            {showLabelInput && !isWatched && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <input
                  type="text"
                  value={labelValue}
                  onChange={(e) => setLabelValue(e.target.value)}
                  placeholder={ExplorerAddressAddressDetailClientCopy.optionalLabel[cs ? 'cs' : 'en']}
                  className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-[12px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-zion-gold/40 w-56"
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmWatch(); if (e.key === 'Escape') { setShowLabelInput(false); setLabelValue(""); } }}
                  autoFocus
                />
                <button onClick={confirmWatch} className="px-3 py-1.5 rounded-lg bg-zion-gold/15 text-zion-gold border border-zion-gold/30 text-[11px] font-semibold hover:bg-zion-gold/25 transition-colors">
                  {ExplorerAddressAddressDetailClientCopy.add[cs ? 'cs' : 'en']}
                </button>
                <button onClick={() => { setShowLabelInput(false); setLabelValue(""); }} className="px-3 py-1.5 rounded-lg text-white/40 text-[11px] hover:text-white/70 transition-colors">
                  {ExplorerAddressAddressDetailClientCopy.cancel[cs ? 'cs' : 'en']}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── balance summary ──────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: ExplorerAddressAddressDetailClientCopy.onChainBalance[cs ? 'cs' : 'en'], value: `${data.balance.total.toFixed(4)} ZION`, color: "text-white" },
            { label: ExplorerAddressAddressDetailClientCopy.utxos[cs ? 'cs' : 'en'], value: String(data.balance.utxo_count), color: "text-zion-cyan" },
            { label: ExplorerAddressAddressDetailClientCopy.poolPending[cs ? 'cs' : 'en'], value: `${data.balance.pool_pending.toFixed(4)} ZION`, color: "text-zion-gold" },
            { label: ExplorerAddressAddressDetailClientCopy.poolPaid[cs ? 'cs' : 'en'], value: `${data.balance.pool_paid.toFixed(2)} ZION`, color: "text-zion-gold" },
          ].map((s) => (
            <div key={s.label} className="zion-rainbow-sub rounded-[20px] bg-black/60 p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1.5">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── transaction summary (received / sent / fees) ──── */}
        {(() => {
          const txs = data.transactions.filter((t) => t.tx_hash);
          const received = data.total_received || txs.filter((t) => (t.to || '') === addr).reduce((s, t) => s + t.amount, 0);
          const sent = data.total_sent || txs.filter((t) => (t.from || '') === addr).reduce((s, t) => s + t.amount, 0);
          const fees = txs.reduce((s, t) => s + (t.fee || 0), 0);
          const total = received + sent;
          return (
            <div className="zion-rainbow-sub rounded-[28px] bg-black/60 p-6 mb-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-zion-purple" />
                {ExplorerAddressAddressDetailClientCopy.transactionSummary[cs ? 'cs' : 'en']}
              </h2>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="relative flex-shrink-0">
                  <DonutChart received={received} sent={sent} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-[9px] uppercase tracking-wider text-white/30">{ExplorerAddressAddressDetailClientCopy.total[cs ? 'cs' : 'en']}</p>
                      <p className="text-[11px] font-bold text-white tabular-nums">{total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 flex-1 min-w-0 sm:min-w-[260px]">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-zion-cyan" />
                      <p className="text-[10px] uppercase tracking-wider text-white/30">{ExplorerAddressAddressDetailClientCopy.received[cs ? 'cs' : 'en']}</p>
                    </div>
                    <p className="text-lg font-bold text-zion-cyan tabular-nums">{received.toFixed(4)}</p>
                    <p className="text-[10px] text-white/30">ZION</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-zion-purple" />
                      <p className="text-[10px] uppercase tracking-wider text-white/30">{ExplorerAddressAddressDetailClientCopy.sent[cs ? 'cs' : 'en']}</p>
                    </div>
                    <p className="text-lg font-bold text-zion-purple tabular-nums">{sent.toFixed(4)}</p>
                    <p className="text-[10px] text-white/30">ZION</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-zion-gold" />
                      <p className="text-[10px] uppercase tracking-wider text-white/30">{ExplorerAddressAddressDetailClientCopy.fees[cs ? 'cs' : 'en']}</p>
                    </div>
                    <p className="text-lg font-bold text-zion-gold tabular-nums">{fees.toFixed(6)}</p>
                    <p className="text-[10px] text-white/30">ZION</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

          {/* ── Address Details card ─────────────────────────── */}
          <div className="zion-rainbow-sub rounded-[28px] bg-black/60 p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-zion-purple" />
              {ExplorerAddressAddressDetailClientCopy.addressDetails[cs ? 'cs' : 'en']}
            </h2>
            <InfoRow label={ExplorerAddressAddressDetailClientCopy.address[cs ? 'cs' : 'en']} value={addr} mono copy />
            <InfoRow label={ExplorerAddressAddressDetailClientCopy.onChainBalance[cs ? 'cs' : 'en']} value={`${data.balance.total.toFixed(4)} ZION`} color="text-white" />
            <InfoRow label="UTXOs" value={String(data.balance.utxo_count)} />
            <InfoRow label={ExplorerAddressAddressDetailClientCopy.poolPending_2[cs ? 'cs' : 'en']} value={`${data.balance.pool_pending.toFixed(4)} ZION`} color="text-zion-gold" />
            <InfoRow label={ExplorerAddressAddressDetailClientCopy.poolPaid_2[cs ? 'cs' : 'en']} value={`${data.balance.pool_paid.toFixed(4)} ZION`} color="text-zion-gold" />
            <InfoRow label={ExplorerAddressAddressDetailClientCopy.transactions[cs ? 'cs' : 'en']} value={String(data.transaction_count)} />
            {data.first_seen && data.first_seen > 0 && <InfoRow label={ExplorerAddressAddressDetailClientCopy.firstSeen[cs ? 'cs' : 'en']} value={formatDate(data.first_seen, locale)} />}
            {data.last_seen && data.last_seen > 0 && <InfoRow label={ExplorerAddressAddressDetailClientCopy.lastActive[cs ? 'cs' : 'en']} value={formatDate(data.last_seen, locale)} />}
          </div>

          {/* ── Mining Stats card (or placeholder) ──────────── */}
          {data.is_miner && data.mining_stats ? (
            <div className="zion-rainbow-sub rounded-[28px] bg-black/60 p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                <Pickaxe className="w-4 h-4 text-zion-cyan" />
                {ExplorerAddressAddressDetailClientCopy.miningStats[cs ? 'cs' : 'en']}
              </h2>
              <InfoRow label="Hashrate (1h)" value={data.mining_stats.hashrate_formatted} color="text-zion-cyan" />
              <InfoRow label={ExplorerAddressAddressDetailClientCopy.blocksFound[cs ? 'cs' : 'en']} value={String(data.mining_stats.blocks_found)} color="text-zion-gold" />
              <InfoRow label={ExplorerAddressAddressDetailClientCopy.acceptedShares[cs ? 'cs' : 'en']} value={data.mining_stats.accepted_shares.toLocaleString(locale)} />
              <InfoRow label={ExplorerAddressAddressDetailClientCopy.rejectedShares[cs ? 'cs' : 'en']} value={data.mining_stats.rejected_shares.toLocaleString(locale)} color="text-zion-purple" />
              {data.mining_stats.worker_name && <InfoRow label={ExplorerAddressAddressDetailClientCopy.worker[cs ? 'cs' : 'en']} value={data.mining_stats.worker_name} mono />}

              {/* consciousness level */}
              <div className={`mt-4 rounded-2xl ${cStyle.bg} border ${cStyle.border} p-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <CIcon className={`w-6 h-6 ${cStyle.text}`} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/30">{ExplorerAddressAddressDetailClientCopy.consciousnessLevel[cs ? 'cs' : 'en']}</p>
                    <p className={`${cStyle.text} font-bold text-lg`}>{level.replace(/_/g, " ")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">{ExplorerAddressAddressDetailClientCopy.multiplier[cs ? 'cs' : 'en']}</p>
                  <p className={`${cStyle.text} font-bold text-2xl tabular-nums`}>{data.mining_stats.consciousness_multiplier}×</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="zion-rainbow-sub rounded-[28px] bg-black/60 p-6 flex flex-col items-center justify-center text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <Pickaxe className="w-8 h-8 text-white/10 mb-3" />
              <p className="text-white/30 text-sm">{ExplorerAddressAddressDetailClientCopy.notAnActiveMiner[cs ? 'cs' : 'en']}</p>
              <p className="text-white/15 text-xs mt-1">{ExplorerAddressAddressDetailClientCopy.miningStatsWillAppearOnceThisA[cs ? 'cs' : 'en']}</p>
            </div>
          )}
        </div>

        {/* ── Transaction history table ──────────────────────── */}
        <div ref={txListRef} className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-x-auto overflow-y-hidden scroll-mt-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70">
              {ExplorerAddressAddressDetailClientCopy.transactions[cs ? 'cs' : 'en']} ({data.transactions?.length ?? 0})
            </h2>
            {(data.transactions?.length ?? 0) > 0 && (
              <Link
                href={`/explorer/transactions?address=${encodeURIComponent(addr)}`}
                className="text-[11px] text-zion-cyan hover:text-zion-cyan transition-colors"
              >
                {ExplorerAddressAddressDetailClientCopy.viewAll[cs ? 'cs' : 'en']}
              </Link>
            )}
          </div>

          {/* table header */}
          <div className="grid grid-cols-[70px_1fr_100px_90px_120px] min-w-[420px] gap-3 px-5 py-2.5 border-b border-white/[0.04]">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerAddressAddressDetailClientCopy.type[cs ? 'cs' : 'en']}</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">TX Hash</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{ExplorerAddressAddressDetailClientCopy.age[cs ? 'cs' : 'en']}</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">Fee</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{ExplorerAddressAddressDetailClientCopy.amount[cs ? 'cs' : 'en']}</span>
          </div>

          {(() => {
            const cleanTxs = data.transactions.filter((t) => t.tx_hash && (t.from || t.to || t.amount));
            if (cleanTxs.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <p className="text-white/20 text-sm">{ExplorerAddressAddressDetailClientCopy.noTransactionsFound[cs ? 'cs' : 'en']}</p>
                </div>
              );
            }
            const visibleTxs = cleanTxs.slice(0, visibleCount);
            return (
              <>
                {visibleTxs.map((t) => {
                  const incoming = (t.to || '') === addr;
                  return (
                    <Link
                      key={t.tx_hash}
                      href={`/explorer/tx?hash=${encodeURIComponent(t.tx_hash)}`}
                      className="grid grid-cols-[70px_1fr_100px_90px_120px] min-w-[420px] gap-3 px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* type */}
                      <div className="flex items-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          t.type === "payout" ? "bg-zion-cyan/15 text-zion-cyan" : "bg-zion-purple/15 text-zion-purple"
                        }`}>{t.type === 'payout' ? (ExplorerAddressAddressDetailClientCopy.payout[cs ? 'cs' : 'en']) : (cs ? 'převod' : t.type)}</span>
                      </div>

                      {/* hash */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-mono text-zion-cyan group-hover:text-cyan-200 truncate transition-colors">
                          {t.tx_hash.slice(0, 16)}…{t.tx_hash.slice(-8)}
                        </span>
                        <CopyBtn text={t.tx_hash} />
                      </div>

                      {/* age */}
                      <div className="flex items-center text-[12px] text-white/40 tabular-nums">
                        {t.timestamp ? timeAgo(t.timestamp, cs) : (t.block_height ? `#${t.block_height.toLocaleString(locale)}` : "—")}
                      </div>

                      {/* fee */}
                      <div className="flex items-center justify-end text-[12px] text-white/30 tabular-nums font-mono">
                        {t.fee > 0 ? t.fee.toFixed(6) : "—"}
                      </div>

                      {/* amount */}
                      <div className={`flex items-center justify-end text-[13px] font-semibold tabular-nums ${incoming ? "text-zion-cyan" : "text-zion-purple"}`}>
                        {incoming ? "+" : "-"}{t.amount.toFixed(4)} ₿Z
                      </div>
                    </Link>
                  );
                })}

                {/* pagination footer */}
                <div className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[11px] text-white/40 tabular-nums">
                    {cs ? `Zobrazuji ${Math.min(visibleCount, cleanTxs.length)} z ${cleanTxs.length}` : `Showing ${Math.min(visibleCount, cleanTxs.length)} of ${cleanTxs.length}`}
                  </span>
                  {visibleCount < cleanTxs.length && (
                    <button
                      onClick={() => {
                        setVisibleCount((c) => c + 10);
                        setTimeout(() => txListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-[12px] font-semibold text-white/70 hover:text-white transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                      {ExplorerAddressAddressDetailClientCopy.loadMore[cs ? 'cs' : 'en']}
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* ── UTXO list (only for UTXO-model addresses) ────── */}
        {data.transaction_model === 'utxo' && (
          <div className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-x-auto overflow-y-hidden mt-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                <Layers className="w-4 h-4 text-zion-cyan" />
                {ExplorerAddressAddressDetailClientCopy.utxoList[cs ? 'cs' : 'en']} ({data.utxos.length})
              </h2>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">
                {ExplorerAddressAddressDetailClientCopy.total[cs ? 'cs' : 'en']} {(data.utxos.reduce((s, u) => s + u.amount, 0) / FLOWERS_PER_ZION).toFixed(4)} ZION
              </span>
            </div>

            {/* table header */}
            <div className="grid grid-cols-[60px_1fr_80px_100px_100px] min-w-[340px] gap-3 px-5 py-2.5 border-b border-white/[0.04]">
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">#</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">TX Hash</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{ExplorerAddressAddressDetailClientCopy.index[cs ? 'cs' : 'en']}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{ExplorerAddressAddressDetailClientCopy.height[cs ? 'cs' : 'en']}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{ExplorerAddressAddressDetailClientCopy.amount[cs ? 'cs' : 'en']}</span>
            </div>

            {data.utxos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-white/20 text-sm">{ExplorerAddressAddressDetailClientCopy.noUtxosFound[cs ? 'cs' : 'en']}</p>
              </div>
            ) : (
              data.utxos.map((u, idx) => (
                <Link
                  key={`${u.tx_hash}_${u.output_index}`}
                  href={`/explorer/tx?hash=${encodeURIComponent(u.tx_hash)}`}
                  className="grid grid-cols-[60px_1fr_80px_100px_100px] min-w-[340px] gap-3 px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="flex items-center text-[12px] text-white/40 tabular-nums">{idx + 1}</div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-mono text-zion-cyan group-hover:text-cyan-200 truncate transition-colors">
                      {u.tx_hash.slice(0, 16)}…{u.tx_hash.slice(-8)}
                    </span>
                    <CopyBtn text={u.tx_hash} />
                  </div>
                  <div className="flex items-center justify-end text-[12px] text-white/40 tabular-nums font-mono">{u.output_index}</div>
                  <div className="flex items-center justify-end text-[12px] text-white/40 tabular-nums font-mono">{u.height > 0 ? u.height.toLocaleString(locale) : '—'}</div>
                  <div className="flex items-center justify-end text-[13px] font-semibold tabular-nums text-zion-cyan">
                    {(u.amount / FLOWERS_PER_ZION).toFixed(4)} ₿Z
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* ── Watchlist panel ─────────────────────────────────── */}
        {mounted && watchlist.length > 0 && (
          <div className="zion-rainbow-sub rounded-[28px] bg-black/60 p-6 mt-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-zion-gold fill-current" />
              {ExplorerAddressAddressDetailClientCopy.watchlist[cs ? 'cs' : 'en']} ({watchlist.length})
            </h2>
            <div className="space-y-2">
              {watchlist.map((w) => {
                const current = w.address === addr;
                return (
                  <div key={w.address} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${current ? "bg-zion-gold/5 border-zion-gold/20" : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]"}`}>
                    <Star className={`w-4 h-4 flex-shrink-0 ${current ? "text-zion-gold fill-current" : "text-zion-gold/60 fill-current"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/explorer/address?addr=${encodeURIComponent(w.address)}`} className="text-[13px] font-mono text-zion-cyan hover:text-cyan-200 truncate transition-colors">
                          {w.address.slice(0, 20)}…{w.address.slice(-8)}
                        </Link>
                        {w.label && <span className="text-[10px] text-white/40 truncate">— {w.label}</span>}
                      </div>
                      <p className="text-[10px] text-white/25 mt-0.5">{ExplorerAddressAddressDetailClientCopy.added[cs ? 'cs' : 'en']} {timeAgo(w.addedAt, cs)}</p>
                    </div>
                    {current && <span className="text-[10px] uppercase tracking-wider text-zion-gold font-semibold flex-shrink-0">{ExplorerAddressAddressDetailClientCopy.current[cs ? 'cs' : 'en']}</span>}
                    <button
                      onClick={() => { const next = watchlist.filter((x) => x.address !== w.address); setWatchlist(next); saveWatchlist(next); }}
                      className="text-white/20 hover:text-zion-purple transition-colors flex-shrink-0 text-[11px]"
                      title={ExplorerAddressAddressDetailClientCopy.remove[cs ? 'cs' : 'en']}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
