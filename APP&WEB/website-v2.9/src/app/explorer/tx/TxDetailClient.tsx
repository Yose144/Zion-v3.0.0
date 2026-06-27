"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Hash,
  Layers,
  Shield,
  Clock,
  ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useLang } from '@/contexts/LanguageContext';

interface TxInput { type: string; amount: number; key_image?: string; key_offsets?: number[]; }
interface TxOutput { amount: number; key: string; index?: number; }
interface Transaction {
  tx_hash: string; block_height: number; block_timestamp: number; in_pool: boolean;
  fee: number; amount: number; version: number; unlock_time: number;
  inputs: TxInput[]; outputs: TxOutput[]; extra: number[];
  confirmations: number; status: string;
  // V3 account-model fields
  from?: string; to?: string; amount_zion?: string; fee_zion?: number;
  nonce?: number; signature?: string; public_key?: string; tx_id?: string;
  transaction_model?: string;
}

const fmtDate = (ts: number, locale: string) => ts ? new Date(ts * 1000).toLocaleString(locale) : "—";
const fmtAge = (ts: number, cs: boolean) => {
  if (!ts) return "";
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return cs ? `pred ${s} s` : `${s}s ago`;
  if (s < 3600) return cs ? `pred ${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 60)}m ${s % 60}s ago`;
  if (s < 86400) return cs ? `pred ${Math.floor(s / 3600)} h` : `${Math.floor(s / 3600)}h ago`;
  return cs ? `pred ${Math.floor(s / 86400)} d` : `${Math.floor(s / 86400)}d ago`;
};
const truncHash = (h: string, n = 12) => h && h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-n)}` : h || "—";

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="text-gray-600 hover:text-white transition ml-2 flex-shrink-0">
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function InfoRow({ label, value, copyable, mono, color, link }: {
  label: string; value: string; copyable?: boolean; mono?: boolean; color?: string; link?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-white/[0.04] last:border-0 gap-1">
      <span className="text-[12px] uppercase tracking-[0.1em] text-gray-500 font-medium flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        {link ? (
          <Link href={link} className={`${mono ? "font-mono" : ""} ${color || "text-zion-cyan"} text-sm hover:text-white transition break-all truncate`}>{value}</Link>
        ) : (
          <span className={`${mono ? "font-mono" : ""} ${color || "text-white"} text-sm break-all`}>{value}</span>
        )}
        {copyable && <CopyBtn text={value} />}
      </div>
    </div>
  );
}

export default function TxDetailClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = cs ? 'cs-CZ' : 'en-US';
  const router = useRouter();
  const searchParams = useSearchParams();
  const hash = useMemo(() => String(searchParams.get("hash") || "").trim(), [searchParams]);

  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null); setLoading(true); setTx(null);
        if (!hash) { setError(cs ? "Chybi hash transakce" : "Missing transaction hash"); return; }
        const data = await apiClient<Transaction>(`/blockchain/transactions?hash=${encodeURIComponent(hash)}`);
        setTx(data);
      } catch (err) { setError(cs ? `Nepodarilo se nacist transakci: ${err}` : `Failed to load transaction: ${err}`); }
      finally { setLoading(false); }
    })();
  }, [hash, cs]);

  if (loading) {
    return (
      <div className="zion-shell min-h-screen">
        <div className="zion-container py-20 max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-white/5 rounded" />
            <div className="h-12 w-96 bg-white/5 rounded" />
            <div className="h-[300px] zion-section" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[250px] zion-section" />
              <div className="h-[250px] zion-section" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="zion-shell min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <ArrowRightLeft className="h-16 w-16 text-red-400/50 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{cs ? 'Transakce nenalezena' : 'Transaction Not Found'}</h1>
          <p className="text-gray-500 text-sm mb-6">{error || `Hash: ${hash}`}</p>
          <Link href="/explorer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" /> {cs ? 'Zpet do exploreru' : 'Back to Explorer'}
          </Link>
        </div>
      </div>
    );
  }

  const totalInput = tx.inputs.reduce((s, inp) => s + inp.amount, 0);
  const totalOutput = tx.outputs.reduce((s, out) => s + out.amount, 0);
  const isCoinbase = tx.inputs.some((inp) => inp.type === "coinbase");
  const isV3Account = !!(tx.from && tx.to);

  return (
    <div className="zion-shell min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-zion-cyan/15 via-transparent to-transparent" />

      <div className="relative z-10 zion-container py-10 max-w-6xl space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/explorer" className="text-gray-500 hover:text-white transition">Explorer</Link>
          <span className="text-gray-700">/</span>
          <Link href="/explorer/transactions" className="text-gray-500 hover:text-white transition">{cs ? 'Transakce' : 'Transactions'}</Link>
          <span className="text-gray-700">/</span>
          <span className="text-white font-mono text-xs">{truncHash(tx.tx_hash, 8)}</span>
        </nav>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-zion-cyan/10 flex-shrink-0">
            <ArrowRightLeft className="h-6 w-6 text-zion-cyan" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{cs ? 'Transakce' : 'Transaction'}</h1>
            <p className="text-xs text-gray-500 font-mono mt-0.5 break-all">{tx.tx_hash}</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              tx.in_pool
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              {tx.in_pool ? <Clock className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              {tx.in_pool ? (cs ? 'Ceka' : 'Pending') : `${tx.confirmations.toLocaleString(locale)} ${cs ? 'potvrzeni' : 'Confirmations'}`}
            </span>
            {isCoinbase && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-zion-gold/10 text-zion-gold border-zion-gold/20">
                ⛏ Coinbase
              </span>
            )}
          </div>
        </motion.div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(isV3Account ? [
            { label: cs ? "Castka" : "Amount", value: `${tx.amount.toFixed(4)} ZION`, color: "text-white" },
            { label: "Fee", value: `${tx.fee.toFixed(6)} ZION`, color: "text-amber-400" },
            { label: "Nonce", value: `${tx.nonce ?? 0}`, color: "text-zion-cyan" },
            { label: cs ? "Model" : "Model", value: (tx.transaction_model ?? 'hybrid').toUpperCase(), color: "text-emerald-400" },
          ] : [
            { label: cs ? "Castka" : "Amount", value: `${tx.amount.toFixed(4)} ZION`, color: "text-white" },
            { label: "Fee", value: `${tx.fee.toFixed(6)} ZION`, color: "text-amber-400" },
            { label: cs ? "Vstupy" : "Inputs", value: `${tx.inputs.length}`, color: "text-zion-cyan" },
            { label: cs ? "Vystupy" : "Outputs", value: `${tx.outputs.length}`, color: "text-emerald-400" },
          ]).map((item) => (
            <div key={item.label} className="zion-tile p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium mb-1">{item.label}</p>
              <p className={`text-lg font-bold tabular-nums ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* TX Details */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="zion-rainbow-card rounded-[28px] bg-black/60 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-8 w-8 rounded-xl bg-zion-cyan/10 flex items-center justify-center">
              <Layers className="h-4 w-4 text-zion-cyan" />
            </div>
            <h2 className="text-lg font-semibold text-white">{cs ? 'Detaily transakce' : 'Transaction Details'}</h2>
          </div>
          <InfoRow label="TX Hash" value={tx.tx_hash} mono copyable />
          <InfoRow label={cs ? 'Stav' : 'Status'} value={tx.in_pool ? (cs ? "Ceka (mempool)" : "Pending (Mempool)") : (cs ? 'Potvrzena' : 'Confirmed')}
            color={tx.in_pool ? "text-amber-400" : "text-emerald-400"} />
          {tx.block_height > 0 && (
            <InfoRow label={cs ? 'Blok' : 'Block'} value={`#${tx.block_height.toLocaleString(locale)}`}
              link={`/explorer/block?id=${tx.block_height}`} />
          )}
          <InfoRow label={cs ? 'Cas' : 'Timestamp'} value={`${fmtDate(tx.block_timestamp, locale)} (${fmtAge(tx.block_timestamp, cs)})`} />
          <InfoRow label={cs ? 'Castka' : 'Amount'} value={`${tx.amount.toFixed(6)} ZION`} color="text-zion-gold" />
          <InfoRow label="Fee" value={`${tx.fee.toFixed(6)} ZION`} color="text-amber-400" />
          {isV3Account ? (
            <>
              <InfoRow label="From" value={tx.from ?? '—'} mono copyable link={`/explorer/address?id=${tx.from}`} />
              <InfoRow label="To" value={tx.to ?? '—'} mono copyable link={`/explorer/address?id=${tx.to}`} />
              <InfoRow label="Nonce" value={`${tx.nonce ?? 0}`} />
              <InfoRow label={cs ? 'Model' : 'Model'} value={(tx.transaction_model ?? 'hybrid').toUpperCase()} color="text-emerald-400" />
              {tx.public_key && <InfoRow label={cs ? 'Verejny klic' : 'Public Key'} value={tx.public_key} mono copyable />}
              {tx.signature && <InfoRow label={cs ? 'Podpis' : 'Signature'} value={truncHash(tx.signature, 16)} mono copyable />}
            </>
          ) : (
            <>
              <InfoRow label={cs ? 'Verze' : 'Version'} value={tx.version.toString()} />
              {tx.unlock_time > 0 && <InfoRow label={cs ? 'Cas odemceni' : 'Unlock Time'} value={tx.unlock_time.toString()} />}
            </>
          )}
        </motion.div>

        {/* Inputs & Outputs — only for legacy UTXO-style txs */}
        {!isV3Account && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="zion-rainbow-sub rounded-[28px] bg-black/60 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-blue-400 rotate-180" />
              </div>
              <h3 className="text-lg font-semibold text-white">{cs ? 'Vstupy' : 'Inputs'} ({tx.inputs.length})</h3>
            </div>
            <div className="space-y-2">
              {tx.inputs.map((inp, i) => (
                <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                  {inp.type === "coinbase" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-zion-gold text-[10px] font-bold px-2 py-0.5 bg-zion-gold/10 rounded-md uppercase tracking-wider">
                        ⛏ Coinbase
                      </span>
                      <span className="text-gray-500 text-xs">{cs ? 'Nove vytvorene mince' : 'New coins generated'}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-blue-400 text-[10px] font-mono uppercase tracking-wider">{cs ? 'Vstup' : 'Input'} #{i}</span>
                        <span className="text-white text-sm font-semibold tabular-nums">{inp.amount.toFixed(4)} ZION</span>
                      </div>
                      {inp.key_image && (
                        <div className="flex items-center text-gray-600 font-mono text-[11px] truncate">
                          {cs ? 'Key image' : 'Key Image'}: {truncHash(inp.key_image, 10)}
                          <CopyBtn text={inp.key_image} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {!isCoinbase && tx.inputs.length > 0 && (
                <div className="text-right text-sm font-semibold text-white pt-2 border-t border-white/[0.06]">
                  {cs ? 'Celkem vstup:' : 'Total In:'} {totalInput.toFixed(4)} ZION
                </div>
              )}
            </div>
          </motion.div>

          {/* Outputs */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="zion-rainbow-sub p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">{cs ? 'Vystupy' : 'Outputs'} ({tx.outputs.length})</h3>
            </div>
            <div className="space-y-2">
              {tx.outputs.map((out, i) => (
                <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-emerald-400 text-[10px] font-mono uppercase tracking-wider">{cs ? 'Vystup' : 'Output'} #{i}</span>
                    <span className="text-zion-gold text-sm font-semibold tabular-nums">{out.amount.toFixed(4)} ZION</span>
                  </div>
                  {out.key && (
                    <div className="flex items-center text-gray-600 font-mono text-[11px] truncate">
                      {cs ? 'Klic' : 'Key'}: {truncHash(out.key, 10)}
                      <CopyBtn text={out.key} />
                    </div>
                  )}
                </div>
              ))}
              {tx.outputs.length > 0 && (
                <div className="text-right text-sm font-semibold text-zion-gold pt-2 border-t border-white/[0.06]">
                  {cs ? 'Celkem vystup:' : 'Total Out:'} {totalOutput.toFixed(4)} ZION
                </div>
              )}
            </div>
          </motion.div>
        </div>
        )}

        {/* TX Extra */}
        {tx.extra && tx.extra.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="zion-rainbow-sub p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-xl bg-gray-500/10 flex items-center justify-center">
                <Hash className="h-4 w-4 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">TX Extra ({tx.extra.length} {cs ? 'bajtu' : 'bytes'})</h3>
            </div>
            <div className="bg-black/40 rounded-xl p-4 font-mono text-[11px] text-gray-500 break-all overflow-x-auto max-h-24 leading-relaxed">
              {tx.extra.map((b) => b.toString(16).padStart(2, "0")).join(" ")}
            </div>
          </motion.div>
        )}

        {/* Navigate to block */}
        {tx.block_height > 0 && (
          <div className="flex items-center justify-center pt-2">
            <Link href={`/explorer/block?id=${tx.block_height}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition">
              {cs ? 'Zobrazit blok' : 'View Block'} #{tx.block_height.toLocaleString(locale)} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
