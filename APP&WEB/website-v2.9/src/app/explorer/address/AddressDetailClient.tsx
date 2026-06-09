"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
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
import { tr } from '@/lib/translations';

/* ── helpers ─────────────────────────────────────────────────── */

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="text-white/20 hover:text-white/60 transition-colors"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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
  if (s < 60) return cs ? `pred ${s} s` : `${s}s ago`;
  if (s < 3600) return cs ? `pred ${Math.floor(s / 60)} min` : `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return cs ? `pred ${Math.floor(s / 3600)} h` : `${Math.floor(s / 3600)}h ago`;
  return cs ? `pred ${Math.floor(s / 86400)} d` : `${Math.floor(s / 86400)}d ago`;
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
    sender: string;
    receiver: string;
    amount: number;
    fee: number;
    timestamp: number;
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
  MENTAL:      { bg: "bg-blue-500/10",  border: "border-blue-500/20",  text: "text-blue-400",   glow: "from-blue-500/20",   icon: Sparkles },
  COSMIC:      { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", glow: "from-purple-500/20", icon: Star },
  ON_THE_STAR: { bg: "bg-zion-gold/10", border: "border-zion-gold/20", text: "text-zion-gold",  glow: "from-zion-gold/20",  icon: Star },
};

/* ── component ───────────────────────────────────────────────── */

export default function AddressDetailClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'en_us', lang);
  const router = useRouter();
  const searchParams = useSearchParams();
  const addr = useMemo(() => String(searchParams.get("addr") || "").trim(), [searchParams]);

  const [data, setData] = useState<AddressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null); setLoading(true); setData(null);
        if (!addr) { setError(cs ? "Chybi adresa. Pouzijte ?addr=zion1... nebo ?addr=ZION..." : "Missing address. Use ?addr=zion1... or ?addr=ZION..."); return; }
        const result = await apiClient<AddressData>(`/blockchain/address?addr=${encodeURIComponent(addr)}`, { cache: "no-store" });
        setData(result);
      } catch (err) { setError(cs ? `Nepodarilo se nacist adresu: ${err}` : `Failed to load address: ${err}`); }
      finally { setLoading(false); }
    })();
  }, [addr, cs]);

  /* ── loading ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="zion-shell min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
      </div>
    );
  }

  /* ── error ───────────────────────────────────────────────── */
  if (error || !data) {
    return (
      <div className="zion-shell min-h-screen relative">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-transparent" />
        <div className="relative z-10 zion-container max-w-3xl py-12">
          <nav className="flex items-center gap-1.5 text-[11px] text-white/40 mb-6">
            <Link href="/explorer" className="hover:text-white/70 transition-colors">Explorer</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/70">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'address', lang)}</span>
          </nav>
          <div className="zion-panel rounded-[28px] bg-black/60 border border-red-500/20 p-10 text-center">
            <XCircle className="h-10 w-10 text-red-400/60 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'address_not_found', lang)}</h1>
            <p className="text-white/40 text-sm mb-6 font-mono break-all">{error || addr}</p>
            <button onClick={() => router.push("/explorer")} className="px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] transition-colors text-sm text-white/60 hover:text-white/90">
              {tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'back_to_explorer', lang)}
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
    <div className="zion-shell min-h-screen relative">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zion-purple/10 via-transparent to-transparent" />

      <div className="relative z-10 zion-container max-w-[1200px] py-8">

        {/* breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] text-white/40 mb-6">
          <Link href="/explorer" className="hover:text-white/70 transition-colors">Explorer</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white/70">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'address', lang)}</span>
        </nav>

        {/* title & address */}
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Wallet className="w-5 h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white tracking-tight">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'address', lang)}</h1>
              {data.known_label && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                  data.known_type === 'pool' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  data.known_type === 'fund' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  data.known_type === 'fee' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  'bg-gray-500/10 text-gray-400 border-gray-500/20'
                }`}>
                  {data.known_label}
                </span>
              )}
              {data.is_miner && !data.known_label && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ⛏ {tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'active_miner', lang)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-purple-300/70 font-mono text-sm break-all">{addr}</p>
              <CopyBtn text={addr} />
            </div>
          </div>
        </div>

        {/* ── balance summary ──────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: cs ? "On-chain zustatek" : "On-Chain Balance", value: `${data.balance.total.toFixed(4)} ZION`, color: "text-white" },
            { label: cs ? "UTXOs" : "UTXOs", value: String(data.balance.utxo_count), color: "text-zion-cyan" },
            { label: cs ? "Pool (ceka)" : "Pool (Pending)", value: `${data.balance.pool_pending.toFixed(4)} ZION`, color: "text-amber-400" },
            { label: cs ? "Pool (vyplaceno)" : "Pool (Paid)", value: `${data.balance.pool_paid.toFixed(2)} ZION`, color: "text-zion-gold" },
          ].map((s) => (
            <div key={s.label} className="zion-panel rounded-[20px] bg-black/60 p-5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1.5">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

          {/* ── Address Details card ─────────────────────────── */}
          <div className="zion-panel rounded-[28px] bg-black/60 p-6">
            <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-purple-400" />
              {tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'address_details', lang)}
            </h2>
            <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'address', lang)} value={addr} mono copy />
            <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'on_chain_balance', lang)} value={`${data.balance.total.toFixed(4)} ZION`} color="text-white" />
            <InfoRow label="UTXOs" value={String(data.balance.utxo_count)} />
            <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'pool_pending', lang)} value={`${data.balance.pool_pending.toFixed(4)} ZION`} color="text-amber-400" />
            <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'pool_paid', lang)} value={`${data.balance.pool_paid.toFixed(4)} ZION`} color="text-zion-gold" />
            <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'transactions', lang)} value={String(data.transaction_count)} />
            {data.first_seen > 0 && <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'first_seen', lang)} value={formatDate(data.first_seen, locale)} />}
            {data.last_seen > 0 && <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'last_active', lang)} value={formatDate(data.last_seen, locale)} />}
          </div>

          {/* ── Mining Stats card (or placeholder) ──────────── */}
          {data.is_miner && data.mining_stats ? (
            <div className="zion-panel rounded-[28px] bg-black/60 p-6">
              <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                <Pickaxe className="w-4 h-4 text-emerald-400" />
                {tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'mining_stats', lang)}
              </h2>
              <InfoRow label="Hashrate (1h)" value={data.mining_stats.hashrate_formatted} color="text-emerald-400" />
              <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'blocks_found', lang)} value={String(data.mining_stats.blocks_found)} color="text-zion-gold" />
              <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'accepted_shares', lang)} value={data.mining_stats.accepted_shares.toLocaleString(locale)} />
              <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'rejected_shares', lang)} value={data.mining_stats.rejected_shares.toLocaleString(locale)} color="text-red-400" />
              {data.mining_stats.worker_name && <InfoRow label={tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'worker', lang)} value={data.mining_stats.worker_name} mono />}

              {/* consciousness level */}
              <div className={`mt-4 rounded-2xl ${cStyle.bg} border ${cStyle.border} p-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <CIcon className={`w-6 h-6 ${cStyle.text}`} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/30">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'consciousness_level', lang)}</p>
                    <p className={`${cStyle.text} font-bold text-lg`}>{level.replace(/_/g, " ")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'multiplier', lang)}</p>
                  <p className={`${cStyle.text} font-bold text-2xl tabular-nums`}>{data.mining_stats.consciousness_multiplier}×</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="zion-panel rounded-[28px] bg-black/60 p-6 flex flex-col items-center justify-center text-center">
              <Pickaxe className="w-8 h-8 text-white/10 mb-3" />
              <p className="text-white/30 text-sm">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'not_an_active_miner', lang)}</p>
              <p className="text-white/15 text-xs mt-1">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'mining_stats_will_appear_once_this_address_starts_', lang)}</p>
            </div>
          )}
        </div>

        {/* ── Transaction history table ──────────────────────── */}
        <div className="zion-panel rounded-[28px] bg-black/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70">
              {tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'transactions', lang)} ({data.transactions.length})
            </h2>
            {data.transactions.length > 0 && (
              <Link
                href={`/explorer/transactions?address=${encodeURIComponent(addr)}`}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'view_all', lang)}
              </Link>
            )}
          </div>

          {/* table header */}
          <div className="grid grid-cols-[70px_1fr_100px_90px_120px] gap-3 px-5 py-2.5 border-b border-white/[0.04]">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'type', lang)}</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">TX Hash</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'age', lang)}</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">Fee</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'amount', lang)}</span>
          </div>

          {data.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-white/20 text-sm">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'no_transactions_found', lang)}</p>
            </div>
          ) : (
            data.transactions.map((t) => {
              const incoming = t.receiver === addr;
              return (
                <Link
                  key={t.tx_hash}
                  href={`/explorer/tx?hash=${encodeURIComponent(t.tx_hash)}`}
                  className="grid grid-cols-[70px_1fr_100px_90px_120px] gap-3 px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                >
                  {/* type */}
                  <div className="flex items-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      t.type === "payout" ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"
                    }`}>{t.type === 'payout' ? (tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'payout', lang)) : (cs ? 'prevod' : t.type)}</span>
                  </div>

                  {/* hash */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-mono text-cyan-300 group-hover:text-cyan-200 truncate transition-colors">
                      {t.tx_hash.slice(0, 16)}…{t.tx_hash.slice(-8)}
                    </span>
                    <CopyBtn text={t.tx_hash} />
                  </div>

                  {/* age */}
                  <div className="flex items-center text-[12px] text-white/40 tabular-nums">{timeAgo(t.timestamp, cs)}</div>

                  {/* fee */}
                  <div className="flex items-center justify-end text-[12px] text-white/30 tabular-nums font-mono">
                    {t.fee > 0 ? t.fee.toFixed(6) : "—"}
                  </div>

                  {/* amount */}
                  <div className={`flex items-center justify-end text-[13px] font-semibold tabular-nums ${incoming ? "text-emerald-400" : "text-red-400"}`}>
                    {incoming ? "+" : "-"}{t.amount.toFixed(4)} ₿Z
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* ── UTXO list (only for UTXO-model addresses) ────── */}
        {data.transaction_model === 'utxo' && (
          <div className="zion-panel rounded-[28px] bg-black/60 overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                <Layers className="w-4 h-4 text-zion-cyan" />
                {tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'utxo_list', lang)} ({data.utxos.length})
              </h2>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">
                {tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'total', lang)} {data.utxos.reduce((s, u) => s + u.amount, 0).toFixed(4)} ZION
              </span>
            </div>

            {/* table header */}
            <div className="grid grid-cols-[60px_1fr_80px_100px_100px] gap-3 px-5 py-2.5 border-b border-white/[0.04]">
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">#</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">TX Hash</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'index', lang)}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'height', lang)}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium text-right">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'amount', lang)}</span>
            </div>

            {data.utxos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-white/20 text-sm">{tr('APP_WEB_website_v2_9_src_app_explorer_ad', 'no_utxos_found', lang)}</p>
              </div>
            ) : (
              data.utxos.map((u, idx) => (
                <Link
                  key={`${u.tx_hash}_${u.output_index}`}
                  href={`/explorer/tx?hash=${encodeURIComponent(u.tx_hash)}`}
                  className="grid grid-cols-[60px_1fr_80px_100px_100px] gap-3 px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="flex items-center text-[12px] text-white/40 tabular-nums">{idx + 1}</div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-mono text-cyan-300 group-hover:text-cyan-200 truncate transition-colors">
                      {u.tx_hash.slice(0, 16)}…{u.tx_hash.slice(-8)}
                    </span>
                    <CopyBtn text={u.tx_hash} />
                  </div>
                  <div className="flex items-center justify-end text-[12px] text-white/40 tabular-nums font-mono">{u.output_index}</div>
                  <div className="flex items-center justify-end text-[12px] text-white/40 tabular-nums font-mono">{u.height > 0 ? u.height.toLocaleString(locale) : '—'}</div>
                  <div className="flex items-center justify-end text-[13px] font-semibold tabular-nums text-emerald-400">
                    {u.amount.toFixed(4)} ₿Z
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
