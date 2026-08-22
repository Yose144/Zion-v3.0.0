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
  Code,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useLang } from '@/contexts/LanguageContext';
import { KNOWN_ADDRESS_MAP } from '@/lib/explorer/known-addresses';

const ExplorerTxTxDetailClientCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  missingTransactionHash: { cs: `Chybí hash transakce`, en: `Missing transaction hash` },
  transactionNotFound: { cs: `Transakce nenalezena`, en: `Transaction Not Found` },
  backToExplorer: { cs: `Zpět do exploreru`, en: `Back to Explorer` },
  transactions: { cs: `Transakce`, en: `Transactions` },
  transaction: { cs: `Transakce`, en: `Transaction` },
  pending: { cs: `Čeká`, en: `Pending` },
  confirmations: { cs: `potvrzení`, en: `Confirmations` },
  hideRawJson: { cs: `Skrýt Raw JSON`, en: `Hide Raw JSON` },
  rawJson: { cs: `Raw JSON`, en: `Raw JSON` },
  amount: { cs: `Částka`, en: `Amount` },
  model: { cs: `Model`, en: `Model` },
  previousOutput: { cs: `Předchozí výstup`, en: `Previous Output` },
  outputIndex: { cs: `Index výstupu`, en: `Output Index` },
  script: { cs: `Script`, en: `Script` },
  memo: { cs: `Memo`, en: `Memo` },
  inputs: { cs: `Vstupy`, en: `Inputs` },
  outputs: { cs: `Vystupy`, en: `Outputs` },
  transactionDetails: { cs: `Detaily transakce`, en: `Transaction Details` },
  status: { cs: `Stav`, en: `Status` },
  pendingMempool: { cs: `Čeká (mempool)`, en: `Pending (Mempool)` },
  confirmed: { cs: `Potvrzena`, en: `Confirmed` },
  block: { cs: `Blok`, en: `Block` },
  timestamp: { cs: `Cas`, en: `Timestamp` },
  publicKey: { cs: `Veřejný klíč`, en: `Public Key` },
  signature: { cs: `Podpis`, en: `Signature` },
  version: { cs: `Verze`, en: `Version` },
  unlockTime: { cs: `Čas odemčení`, en: `Unlock Time` },
  newCoinsGenerated: { cs: `Nově vytvořené mince`, en: `New coins generated` },
  input: { cs: `Vstup`, en: `Input` },
  keyImage: { cs: `Key image`, en: `Key Image` },
  totalIn: { cs: `Celkem na vstupu:`, en: `Total In:` },
  outputs_2: { cs: `Výstupy`, en: `Outputs` },
  output: { cs: `Vystup`, en: `Output` },
  key: { cs: `Klíč`, en: `Key` },
  totalOut: { cs: `Celkem na výstupu:`, en: `Total Out:` },
  bytes: { cs: `bajtů`, en: `bytes` },
  viewBlock: { cs: `Zobrazit blok`, en: `View Block` },
};

interface TxInput { type: string; amount: number; address?: string; key_image?: string; previous_output?: string; output_index?: number; script?: string; key_offsets?: number[]; }
interface TxOutput { amount: number; key: string; address?: string; index?: number; }
interface Transaction {
  tx_hash: string; block_height: number; block_timestamp: number; in_pool: boolean;
  fee: number; amount: number; version: number; unlock_time: number;
  inputs: TxInput[]; outputs: TxOutput[]; extra: number[];
  confirmations: number; status: string;
  from?: string; to?: string; amount_zion?: string; fee_zion?: number;
  nonce?: number; signature?: string; public_key?: string; tx_id?: string;
  transaction_model?: string;
  [key: string]: any;
}

const fmtDate = (ts: number, locale: string) => ts ? new Date(ts * 1000).toLocaleString(locale) : "—";
const fmtAge = (ts: number, cs: boolean) => {
  if (!ts) return "";
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return cs ? `před ${s} s` : `${s}s ago`;
  if (s < 3600) return cs ? `před ${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 60)}m ${s % 60}s ago`;
  if (s < 86400) return cs ? `před ${Math.floor(s / 3600)} h` : `${Math.floor(s / 3600)}h ago`;
  return cs ? `před ${Math.floor(s / 86400)} d` : `${Math.floor(s / 86400)}d ago`;
};
const truncHash = (h: string, n = 12) => h && h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-n)}` : h || "—";
const bytesToHex = (bytes: number[]) =>
  bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
const decodeMemo = (bytes: number[]) => {
  if (!bytes?.length) return { text: "", hex: "", isText: false };
  const printable = bytes.filter((b) => b >= 32 && b < 127);
  const text = String.fromCharCode(...printable);
  const hex = bytesToHex(bytes);
  return { text, hex, isText: text.length > 0 && text.length === printable.length };
};

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="text-gray-600 hover:text-white transition ml-2 flex-shrink-0"
      aria-label={ok ? 'Copied' : 'Copy'}
      title={ok ? 'Copied' : 'Copy'}>
      {ok ? <Check className="h-3.5 w-3.5 text-zion-cyan" /> : <Copy className="h-3.5 w-3.5" />}
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

function AddressList({ addrs, max = 3 }: { addrs: string; max?: number }) {
  const list = addrs.split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) return <span className="text-gray-600">—</span>;
  const visible = list.slice(0, max);
  const hidden = list.length - max;
  return (
    <div className="flex flex-col items-end gap-1.5">
      {visible.map((a, i) => {
        const label = KNOWN_ADDRESS_MAP.get(a)?.label;
        const isAddr = a.startsWith('zion1');
        return (
          <div key={i} className="flex items-center gap-2 min-w-0">
            {label && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 border border-white/10">{label}</span>}
            {isAddr ? (
              <Link href={`/explorer/address?addr=${a}`} className="text-sm font-mono text-zion-cyan hover:text-white transition break-all truncate" title={a}>
                {truncHash(a, 18)}
              </Link>
            ) : (
              <span className="text-sm font-mono text-white break-all truncate" title={a}>{a}</span>
            )}
            <CopyBtn text={a} />
          </div>
        );
      })}
      {hidden > 0 && <span className="text-xs text-gray-500">+{hidden}</span>}
    </div>
  );
}

function AddressRow({ label, addrs }: { label: string; addrs: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between py-3 border-b border-white/[0.04] last:border-0 gap-2">
      <span className="text-[12px] uppercase tracking-[0.1em] text-gray-500 font-medium flex-shrink-0 pt-1">{label}</span>
      <AddressList addrs={addrs} />
    </div>
  );
}

function MiniInfo({ label, value, copyable, mono, link, color }: { label: string; value: string; copyable?: boolean; mono?: boolean; link?: string; color?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[10px] uppercase tracking-wider text-white/40 pt-1">{label}</span>
      <div className="flex items-center gap-2 min-w-0 justify-end">
        {link ? (
          <Link href={link} className={`text-[11px] ${mono ? "font-mono" : ""} ${color || "text-zion-cyan"} hover:text-white transition break-all truncate`} title={value}>{truncHash(value, 18)}</Link>
        ) : (
          <span className={`text-[11px] ${mono ? "font-mono" : ""} ${color || "text-white"} break-all truncate`} title={value}>{value}</span>
        )}
        {copyable && <CopyBtn text={value} />}
      </div>
    </div>
  );
}

export default function TxDetailClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = ExplorerTxTxDetailClientCopy.enUs[cs ? 'cs' : 'en'];
  const router = useRouter();
  const searchParams = useSearchParams();
  const hash = useMemo(() => String(searchParams.get("hash") || "").trim(), [searchParams]);

  const [tx, setTx] = useState<Transaction | null>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null); setLoading(true); setTx(null); setRawJson(null);
        if (!hash) { setError(ExplorerTxTxDetailClientCopy.missingTransactionHash[cs ? 'cs' : 'en']); return; }
        const data = await apiClient<Transaction>(`/blockchain/transactions?hash=${encodeURIComponent(hash)}`);
        setTx(data);
        try { setRawJson(JSON.stringify(data, null, 2)); } catch { setRawJson(null); }
      } catch (err) { setError(cs ? `Nepodařilo se načíst transakci: ${err}` : `Failed to load transaction: ${err}`); }
      finally { setLoading(false); }
    })();
  }, [hash, cs]);

  if (loading) {
    return (
      <div className="relative min-h-screen pb-24">
        <div className="zion-container py-20 pt-6 max-w-6xl">
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
      <div className="relative min-h-screen pb-24 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <ArrowRightLeft className="h-16 w-16 text-zion-purple/50 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{ExplorerTxTxDetailClientCopy.transactionNotFound[cs ? 'cs' : 'en']}</h1>
          <p className="text-gray-500 text-sm mb-6">{error || `Hash: ${hash}`}</p>
          <Link href="/explorer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" /> {ExplorerTxTxDetailClientCopy.backToExplorer[cs ? 'cs' : 'en']}
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
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-zion-cyan/15 via-transparent to-transparent" />

      <div className="relative z-10 zion-container py-10 pt-6 max-w-6xl space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/explorer" className="text-gray-500 hover:text-white transition">Explorer</Link>
          <span className="text-gray-700">/</span>
          <Link href="/explorer/transactions" className="text-gray-500 hover:text-white transition">{ExplorerTxTxDetailClientCopy.transactions[cs ? 'cs' : 'en']}</Link>
          <span className="text-gray-700">/</span>
          <span className="text-white font-mono text-xs">{truncHash(tx.tx_hash, 8)}</span>
        </nav>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-zion-cyan/10 flex-shrink-0">
            <ArrowRightLeft className="h-6 w-6 text-zion-cyan" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{ExplorerTxTxDetailClientCopy.transaction[cs ? 'cs' : 'en']}</h1>
            <p className="text-xs text-gray-500 font-mono mt-0.5 break-all">{tx.tx_hash}</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              tx.in_pool
                ? "bg-zion-gold/10 text-zion-gold border-zion-gold/20"
                : "bg-zion-cyan/10 text-zion-cyan border-zion-cyan/20"
            }`}>
              {tx.in_pool ? <Clock className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              {tx.in_pool ? (ExplorerTxTxDetailClientCopy.pending[cs ? 'cs' : 'en']) : `${tx.confirmations.toLocaleString(locale)} ${ExplorerTxTxDetailClientCopy.confirmations[cs ? 'cs' : 'en']}`}
            </span>
            {isCoinbase && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-zion-gold/10 text-zion-gold border-zion-gold/20">
                ⛏ Coinbase
              </span>
            )}
            <button
              onClick={() => setShowRaw((v) => !v)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition border ${
                showRaw
                  ? "bg-zion-purple/15 text-zion-purple border-zion-purple/30"
                  : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              {showRaw ? (ExplorerTxTxDetailClientCopy.hideRawJson[cs ? 'cs' : 'en']) : (ExplorerTxTxDetailClientCopy.rawJson[cs ? 'cs' : 'en'])}
            </button>
          </div>
        </motion.div>

        {/* Raw JSON View */}
        {showRaw && rawJson && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-hidden" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-zion-purple" />
                <span className="text-sm font-semibold text-white">Raw JSON</span>
              </div>
              <CopyBtn text={rawJson} />
            </div>
            <pre className="bg-black/60 border border-white/10 rounded-xl p-4 m-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-gray-300 max-h-[600px]">
              {rawJson}
            </pre>
          </motion.div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(isV3Account ? [
            { label: ExplorerTxTxDetailClientCopy.amount[cs ? 'cs' : 'en'], value: `${tx.amount.toFixed(4)} ZION`, color: "text-white" },
            { label: "Fee", value: `${tx.fee.toFixed(6)} ZION`, color: "text-zion-gold" },
            { label: "Nonce", value: `${tx.nonce ?? 0}`, color: "text-zion-cyan" },
            { label: ExplorerTxTxDetailClientCopy.model[cs ? 'cs' : 'en'], value: (tx.transaction_model ?? 'hybrid').toUpperCase(), color: "text-zion-cyan" },
          ] : [
            { label: ExplorerTxTxDetailClientCopy.amount[cs ? 'cs' : 'en'], value: `${tx.amount.toFixed(4)} ZION`, color: "text-white" },
            { label: "Fee", value: `${tx.fee.toFixed(6)} ZION`, color: "text-zion-gold" },
            { label: ExplorerTxTxDetailClientCopy.inputs[cs ? 'cs' : 'en'], value: `${tx.inputs.length}`, color: "text-zion-cyan" },
            { label: ExplorerTxTxDetailClientCopy.outputs[cs ? 'cs' : 'en'], value: `${tx.outputs.length}`, color: "text-zion-cyan" },
          ]).map((item) => (
            <div key={item.label} className="zion-tile p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium mb-1">{item.label}</p>
              <p className={`text-lg font-bold tabular-nums ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* TX Details */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="zion-rainbow-card rounded-[28px] bg-black/60 p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-8 w-8 rounded-xl bg-zion-cyan/10 flex items-center justify-center">
              <Layers className="h-4 w-4 text-zion-cyan" />
            </div>
            <h2 className="text-lg font-semibold text-white">{ExplorerTxTxDetailClientCopy.transactionDetails[cs ? 'cs' : 'en']}</h2>
          </div>
          <InfoRow label="TX Hash" value={tx.tx_hash} mono copyable />
          <InfoRow label={ExplorerTxTxDetailClientCopy.status[cs ? 'cs' : 'en']} value={tx.in_pool ? (ExplorerTxTxDetailClientCopy.pendingMempool[cs ? 'cs' : 'en']) : (ExplorerTxTxDetailClientCopy.confirmed[cs ? 'cs' : 'en'])}
            color={tx.in_pool ? "text-zion-gold" : "text-zion-cyan"} />
          {tx.block_height > 0 && (
            <InfoRow label={ExplorerTxTxDetailClientCopy.block[cs ? 'cs' : 'en']} value={`#${tx.block_height.toLocaleString(locale)}`}
              link={`/explorer/block?id=${tx.block_height}`} />
          )}
          <InfoRow label={ExplorerTxTxDetailClientCopy.timestamp[cs ? 'cs' : 'en']} value={`${fmtDate(tx.block_timestamp, locale)} (${fmtAge(tx.block_timestamp, cs)})`} />
          <InfoRow label={ExplorerTxTxDetailClientCopy.amount[cs ? 'cs' : 'en']} value={`${tx.amount.toFixed(6)} ZION`} color="text-zion-gold" />
          <InfoRow label="Fee" value={`${tx.fee.toFixed(6)} ZION`} color="text-zion-gold" />
          {isCoinbase ? (
            <InfoRow label="From" value="⛏ Coinbase" />
          ) : (
            <AddressRow label="From" addrs={tx.from || tx.inputs.map((i) => i.address).filter(Boolean).join(', ')} />
          )}
          <AddressRow label="To" addrs={tx.to || tx.outputs.map((o) => o.address || o.key).filter(Boolean).join(', ')} />
          <InfoRow label={ExplorerTxTxDetailClientCopy.model[cs ? 'cs' : 'en']} value={(tx.transaction_model ?? 'v31-native').toUpperCase()} color="text-zion-cyan" />
          {isV3Account && (
            <>
              <InfoRow label="Nonce" value={`${tx.nonce ?? 0}`} />
              {tx.public_key && <InfoRow label={ExplorerTxTxDetailClientCopy.publicKey[cs ? 'cs' : 'en']} value={tx.public_key} mono copyable />}
              {tx.signature && <InfoRow label={ExplorerTxTxDetailClientCopy.signature[cs ? 'cs' : 'en']} value={truncHash(tx.signature, 16)} mono copyable />}
            </>
          )}
          {!isV3Account && (
            <>
              <InfoRow label={ExplorerTxTxDetailClientCopy.version[cs ? 'cs' : 'en']} value={tx.version.toString()} />
              {tx.unlock_time > 0 && <InfoRow label={ExplorerTxTxDetailClientCopy.unlockTime[cs ? 'cs' : 'en']} value={tx.unlock_time.toString()} />}
            </>
          )}
          {tx.extra && tx.extra.length > 0 && (
            (() => {
              const memo = decodeMemo(tx.extra);
              return (
                <InfoRow
                  label={ExplorerTxTxDetailClientCopy.memo[cs ? 'cs' : 'en']}
                  value={memo.isText ? memo.text : `${memo.hex.slice(0, 64)}${memo.hex.length > 64 ? '…' : ''}`}
                  mono={!memo.isText}
                  copyable
                />
              );
            })()
          )}
        </motion.div>

        {/* Inputs & Outputs — only for legacy UTXO-style txs */}
        {!isV3Account && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="zion-rainbow-sub rounded-[28px] bg-black/60 p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-xl bg-zion-purple/10 flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-zion-purple rotate-180" />
              </div>
              <h3 className="text-lg font-semibold text-white">{ExplorerTxTxDetailClientCopy.inputs[cs ? 'cs' : 'en']} ({tx.inputs.length})</h3>
            </div>
            <div className="space-y-2">
              {tx.inputs.map((inp, i) => (
                <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                  {inp.type === "coinbase" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-zion-gold text-[10px] font-bold px-2 py-0.5 bg-zion-gold/10 rounded-md uppercase tracking-wider">
                        ⛏ Coinbase
                      </span>
                      <span className="text-gray-500 text-xs">{ExplorerTxTxDetailClientCopy.newCoinsGenerated[cs ? 'cs' : 'en']}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-zion-purple text-[10px] font-mono uppercase tracking-wider">{ExplorerTxTxDetailClientCopy.input[cs ? 'cs' : 'en']} #{i}</span>
                        <span className="text-white text-sm font-semibold tabular-nums">{inp.amount.toFixed(4)} ZION</span>
                      </div>
                      <div className="space-y-0.5">
                        {inp.previous_output && (
                          <MiniInfo
                            label={ExplorerTxTxDetailClientCopy.previousOutput[cs ? 'cs' : 'en']}
                            value={inp.previous_output}
                            copyable
                            mono
                            link={`/explorer/tx?hash=${inp.previous_output}`}
                          />
                        )}
                        {typeof inp.output_index === 'number' && (
                          <MiniInfo
                            label={ExplorerTxTxDetailClientCopy.outputIndex[cs ? 'cs' : 'en']}
                            value={String(inp.output_index)}
                            mono
                          />
                        )}
                        {inp.script && (
                          <MiniInfo
                            label={ExplorerTxTxDetailClientCopy.script[cs ? 'cs' : 'en']}
                            value={inp.script}
                            copyable
                            mono
                          />
                        )}
                        {inp.address?.startsWith('zion1') ? (
                          <MiniInfo
                            label="Address"
                            value={inp.address}
                            copyable
                            mono
                            link={`/explorer/address?addr=${inp.address}`}
                          />
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {!isCoinbase && tx.inputs.length > 0 && (
                <div className="text-right text-sm font-semibold text-white pt-2 border-t border-white/[0.06]">
                  {ExplorerTxTxDetailClientCopy.totalIn[cs ? 'cs' : 'en']} {totalInput.toFixed(4)} ZION
                </div>
              )}
            </div>
          </motion.div>

          {/* Outputs */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="zion-rainbow-sub p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-xl bg-zion-cyan/10 flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-zion-cyan" />
              </div>
              <h3 className="text-lg font-semibold text-white">{ExplorerTxTxDetailClientCopy.outputs_2[cs ? 'cs' : 'en']} ({tx.outputs.length})</h3>
            </div>
            <div className="space-y-2">
              {tx.outputs.map((out, i) => (
                <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-zion-cyan text-[10px] font-mono uppercase tracking-wider">{ExplorerTxTxDetailClientCopy.output[cs ? 'cs' : 'en']} #{i}</span>
                    <span className="text-zion-gold text-sm font-semibold tabular-nums">{out.amount.toFixed(4)} ZION</span>
                  </div>
                  <div className="space-y-0.5">
                    {typeof out.index === 'number' && (
                      <MiniInfo label="Index" value={String(out.index)} mono />
                    )}
                    {(out.address || out.key) && (
                      <MiniInfo
                        label="Address"
                        value={out.address || out.key}
                        copyable
                        mono
                        link={(out.address || out.key).startsWith('zion1') ? `/explorer/address?addr=${out.address || out.key}` : undefined}
                      />
                    )}
                  </div>
                </div>
              ))}
              {tx.outputs.length > 0 && (
                <div className="text-right text-sm font-semibold text-zion-gold pt-2 border-t border-white/[0.06]">
                  {ExplorerTxTxDetailClientCopy.totalOut[cs ? 'cs' : 'en']} {totalOutput.toFixed(4)} ZION
                </div>
              )}
            </div>
          </motion.div>
        </div>
        )}

        {/* Memo / TX Extra */}
        {tx.extra && tx.extra.length > 0 && (
          (() => {
            const memo = decodeMemo(tx.extra);
            return (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="zion-rainbow-sub p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-gray-500/10 flex items-center justify-center">
                    <Hash className="h-4 w-4 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{ExplorerTxTxDetailClientCopy.memo[cs ? 'cs' : 'en']} ({tx.extra.length} {ExplorerTxTxDetailClientCopy.bytes[cs ? 'cs' : 'en']})</h3>
                </div>
                {memo.isText ? (
                  <div className="bg-black/40 rounded-xl p-4 text-sm text-white break-all overflow-x-auto max-h-40 leading-relaxed">
                    {memo.text}
                  </div>
                ) : (
                  <div className="bg-black/40 rounded-xl p-4 font-mono text-[11px] text-gray-500 break-all overflow-x-auto max-h-40 leading-relaxed">
                    {memo.hex.match(/.{1,64}/g)?.join(' ')}
                  </div>
                )}
              </motion.div>
            );
          })()
        )}

        {/* Navigate to block */}
        {tx.block_height > 0 && (
          <div className="flex items-center justify-center pt-2">
            <Link href={`/explorer/block?id=${tx.block_height}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition">
              {ExplorerTxTxDetailClientCopy.viewBlock[cs ? 'cs' : 'en']} #{tx.block_height.toLocaleString(locale)} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
