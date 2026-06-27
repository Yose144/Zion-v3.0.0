"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Coins,
  Copy,
  Hash,
  Layers,
  Shield,
  Cpu,
  Box,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useLang } from '@/contexts/LanguageContext';

interface BlockTx {
  tx_hash: string;
  type: string;
  fee: number;
  amount: number;
  timestamp?: number;
  inputs?: Array<{ type: string; amount: number; key_image?: string }>;
  outputs?: Array<{ amount: number; key: string }>;
}

interface BlockDetail {
  height: number;
  hash: string;
  prev_hash: string;
  timestamp: number;
  difficulty: number;
  nonce: number;
  reward: number;
  block_size: number;
  num_txes: number;
  confirmations: number;
  orphan_status: boolean;
  status: string;
  miner: string;
  miner_label: string | null;
  is_pool_block: boolean;
  miner_tx_hash: string;
  major_version: number;
  minor_version: number;
  tx_count: number;
  txs: BlockTx[];
  tx_hashes: string[];
  total_fees: number;
  total_output: number;
}

const fmtDate = (ts: number, locale: string) => ts ? new Date(ts * 1000).toLocaleString(locale) : "—";
const fmtAge = (ts: number, cs: boolean) => {
  if (!ts) return "—";
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return cs ? `pred ${s} s` : `${s}s ago`;
  if (s < 3600) return cs ? `pred ${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 60)}m ${s % 60}s ago`;
  if (s < 86400) return cs ? `pred ${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return cs ? `pred ${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h` : `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ago`;
};
const fmtSize = (b: number) => {
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(2)} KB`;
  return `${b} B`;
};
const truncHash = (h: string, n = 12) =>
  h && h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-n)}` : h || "—";

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="text-gray-600 hover:text-white transition ml-2 flex-shrink-0" title={`Copy ${label || ""}`}
    >
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function InfoRow({ label, value, copyable, mono, color, link, badge }: {
  label: string; value: string; copyable?: boolean; mono?: boolean; color?: string; link?: string; badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-white/[0.04] last:border-0 gap-1">
      <span className="text-[12px] uppercase tracking-[0.1em] text-gray-500 font-medium flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        {badge}
        {link ? (
          <Link href={link} className={`${mono ? "font-mono" : ""} ${color || "text-zion-cyan"} text-sm hover:text-white transition break-all truncate`}>
            {value}
          </Link>
        ) : (
          <span className={`${mono ? "font-mono" : ""} ${color || "text-white"} text-sm break-all`}>{value}</span>
        )}
        {copyable && <CopyBtn text={value} label={label} />}
      </div>
    </div>
  );
}

export default function BlockDetailClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = cs ? 'cs-CZ' : 'en-US';
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = useMemo(() => {
    const blockId = String(searchParams.get("id") || "").trim();
    if (blockId) return blockId;
    return String(searchParams.get("height") || "").trim();
  }, [searchParams]);

  const [block, setBlock] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null); setLoading(true); setBlock(null);
        if (!id) { setError(cs ? "Chybi id nebo vyska bloku" : "Missing block id/height"); return; }
        const isHash = /^[a-f0-9]{64}$/i.test(id);
        const query = isHash ? `/blockchain/block?hash=${id}` : `/blockchain/block?height=${id}`;
        const data = await apiClient<BlockDetail>(query);
        setBlock(data);
      } catch (err) {
        setError(cs ? `Nepodarilo se nacist blok: ${err}` : `Failed to load block: ${err}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, cs]);

  if (loading) {
    return (
      <div className="zion-shell min-h-screen">
        <div className="zion-container py-20 max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-white/5 rounded" />
            <div className="h-12 w-80 bg-white/5 rounded" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[400px] zion-section" />
              <div className="h-[400px] zion-section" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !block) {
    return (
      <div className="zion-shell min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <Box className="h-16 w-16 text-red-400/50 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{cs ? 'Blok nenalezen' : 'Block Not Found'}</h1>
          <p className="text-gray-500 text-sm mb-6">{error || (cs ? 'Tento blok v siti ZION neexistuje.' : 'This block does not exist on the ZION network.')}</p>
          <Link href="/explorer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 
            text-sm text-white hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" /> {cs ? 'Zpet do exploreru' : 'Back to Explorer'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="zion-shell min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-zion-purple/20 via-transparent to-transparent" />

      <div className="relative z-10 zion-container py-10 max-w-6xl space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/explorer" className="text-gray-500 hover:text-white transition">Explorer</Link>
          <span className="text-gray-700">/</span>
          <Link href="/explorer/blocks" className="text-gray-500 hover:text-white transition">{cs ? 'Bloky' : 'Blocks'}</Link>
          <span className="text-gray-700">/</span>
          <span className="text-white font-medium">#{block.height.toLocaleString(locale)}</span>
        </nav>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-zion-gold/10 flex-shrink-0">
            <Box className="h-6 w-6 text-zion-gold" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {cs ? 'Blok' : 'Block'} <span className="text-zion-gold">#{block.height.toLocaleString(locale)}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{fmtDate(block.timestamp, locale)} · {fmtAge(block.timestamp, cs)}</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              block.orphan_status
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              <Shield className="h-3 w-3" />
              {block.orphan_status ? (cs ? 'Osiroteny' : 'Orphaned') : `${block.confirmations.toLocaleString(locale)} ${cs ? 'potvrzeni' : 'Confirmations'}`}
            </span>
          </div>
        </motion.div>

        {/* Block Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Block Details */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="zion-rainbow-sub rounded-[28px] bg-black/60 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-xl bg-zion-cyan/10 flex items-center justify-center">
                <Layers className="h-4 w-4 text-zion-cyan" />
              </div>
              <h2 className="text-lg font-semibold text-white">{cs ? 'Detaily bloku' : 'Block Details'}</h2>
            </div>
            <InfoRow label={cs ? 'Vyska' : 'Height'} value={block.height.toLocaleString(locale)} />
            <InfoRow label={cs ? 'Cas' : 'Timestamp'} value={`${fmtDate(block.timestamp, locale)} (${fmtAge(block.timestamp, cs)})`} />
            <InfoRow label="Hash" value={block.hash} mono copyable />
            <InfoRow label={cs ? 'Predchozi hash' : 'Previous Hash'} value={truncHash(block.prev_hash, 16)} mono copyable
              link={block.prev_hash ? `/explorer/block?id=${block.height - 1}` : undefined} />
            <InfoRow label={cs ? 'Velikost bloku' : 'Block Size'} value={`${fmtSize(block.block_size)} (${block.block_size.toLocaleString(locale)} ${cs ? 'bajtu' : 'bytes'})`} />
            <InfoRow label={cs ? 'Verze' : 'Version'} value={`${block.major_version}.${block.minor_version}`} />
          </motion.div>

          {/* Mining Details */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="zion-rainbow-sub rounded-[28px] bg-black/60 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-xl bg-zion-gold/10 flex items-center justify-center">
                <Cpu className="h-4 w-4 text-zion-gold" />
              </div>
              <h2 className="text-lg font-semibold text-white">{cs ? 'Detaily tezby' : 'Mining Details'}</h2>
            </div>
            <InfoRow label={cs ? 'Obtiznost' : 'Difficulty'} value={block.difficulty.toLocaleString(locale)} />
            <InfoRow label="Nonce" value={block.nonce.toLocaleString()} />
            <InfoRow label={cs ? 'Odmena za blok' : 'Block Reward'} value={`${block.reward.toFixed(6)} ZION`} color="text-zion-gold" />
            <InfoRow label={cs ? 'Celkove fee' : 'Total Fees'} value={`${block.total_fees.toFixed(6)} ZION`} color="text-amber-400" />
            <InfoRow label={cs ? 'Transakce' : 'Transactions'} value={`${block.tx_count} (${block.num_txes} ${cs ? 'uzivatel' : 'user'} + 1 coinbase)`} />
            {block.miner && (
              <InfoRow
                label={cs ? 'Coinbase příjemce' : 'Coinbase Recipient'}
                value={block.miner_label || truncHash(block.miner)}
                mono={!block.miner_label}
                copyable
                color={block.is_pool_block ? 'text-emerald-400' : undefined}
                link={`/explorer/address?addr=${block.miner}`}
                badge={block.is_pool_block ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Pool
                  </span>
                ) : undefined}
              />
            )}
            <InfoRow label="Coinbase TX" value={truncHash(block.miner_tx_hash)} mono copyable />
          </motion.div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: cs ? "Celkovy vystup" : "Total Output", value: `${block.total_output.toFixed(4)} ZION`, color: "text-white" },
            { label: cs ? "Vybrane fee" : "Fees Collected", value: `${block.total_fees.toFixed(6)} ZION`, color: "text-amber-400" },
            { label: cs ? "Odmena bloku" : "Block Reward", value: `${block.reward.toFixed(4)} ZION`, color: "text-zion-gold" },
            { label: cs ? "Pocet tx" : "Tx Count", value: `${block.tx_count}`, color: "text-zion-cyan" },
          ].map((item) => (
            <div key={item.label} className="zion-tile p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium mb-1">{item.label}</p>
              <p className={`text-lg font-bold tabular-nums ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Transactions */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-hidden" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
          <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Hash className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{cs ? 'Transakce' : 'Transactions'} ({block.txs?.length || 0})</h2>
          </div>

          {/* TX Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left text-[10px] uppercase tracking-[0.12em] text-gray-500 font-medium px-6 py-3">{cs ? 'Typ' : 'Type'}</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.12em] text-gray-500 font-medium px-3 py-3">Hash</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.12em] text-gray-500 font-medium px-3 py-3 hidden sm:table-cell">{cs ? 'Vstupy' : 'Inputs'}</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.12em] text-gray-500 font-medium px-3 py-3 hidden sm:table-cell">{cs ? 'Vystupy' : 'Outputs'}</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.12em] text-gray-500 font-medium px-3 py-3 hidden md:table-cell">Fee</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.12em] text-gray-500 font-medium px-6 py-3">{cs ? 'Castka' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody>
                {(block.txs || []).map((tx, i) => (
                  <tr key={tx.tx_hash || i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
                        tx.type === "coinbase"
                          ? "bg-zion-gold/10 text-zion-gold border-zion-gold/20"
                          : "bg-zion-cyan/10 text-zion-cyan border-zion-cyan/20"
                      }`}>
                        {tx.type === "coinbase" ? `⛏ ${cs ? 'Coinbase' : 'Coinbase'}` : `↔ ${cs ? 'Prevod' : 'Transfer'}`}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center">
                        <Link href={`/explorer/tx?hash=${tx.tx_hash}`}
                          className="text-zion-cyan hover:text-white transition font-mono text-xs">
                          {truncHash(tx.tx_hash, 10)}
                        </Link>
                        {tx.tx_hash && !tx.tx_hash.startsWith("coinbase_") && <CopyBtn text={tx.tx_hash} />}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right hidden sm:table-cell">
                      <span className="text-gray-500 text-xs">{tx.inputs?.length || 1}</span>
                    </td>
                    <td className="px-3 py-3 text-right hidden sm:table-cell">
                      <span className="text-gray-500 text-xs">{tx.outputs?.length || 0}</span>
                    </td>
                    <td className="px-3 py-3 text-right hidden md:table-cell">
                      <span className="text-gray-500 text-xs tabular-nums">{tx.fee > 0 ? tx.fee.toFixed(6) : "—"}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-white font-semibold text-xs tabular-nums">{tx.amount.toFixed(4)}</span>
                      <span className="text-gray-600 text-[10px] ml-1">ZION</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Block Navigation */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => router.push(`/explorer/block?id=${block.height - 1}`)}
            disabled={block.height === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white 
              hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{cs ? 'Blok' : 'Block'}</span> #{(block.height - 1).toLocaleString(locale)}
          </button>
          <Link href="/explorer/blocks"
            className="text-xs text-gray-500 hover:text-white transition font-medium">
            {cs ? 'Vsechny bloky' : 'All Blocks'}
          </Link>
          <button
            onClick={() => router.push(`/explorer/block?id=${block.height + 1}`)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white 
              hover:bg-white/10 transition"
          >
            <span className="hidden sm:inline">{cs ? 'Blok' : 'Block'}</span> #{(block.height + 1).toLocaleString(locale)}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
