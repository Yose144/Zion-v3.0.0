"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Atom,
  Blocks,
  Clock,
  Coins,
  ExternalLink,
  Gauge,
  Loader2,
  Pickaxe,
  RefreshCw,
  Search,
  Server,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";

const C = {
  title: { cs: "Quantus Network (QTC)", en: "Quantus Network (QTC)" },
  sub: {
    cs: "Post-quantum řetězec · nativní mining leg · wormhole odměny · veřejný indexer",
    en: "Post-quantum chain · native mining leg · wormhole rewards · public indexer",
  },
  live: { cs: "ŽIVĚ", en: "LIVE" },
  down: { cs: "NEDOSTUPNÉ", en: "DOWN" },
  syncing: { cs: "SYNC", en: "SYNC" },
  height: { cs: "Výška", en: "Height" },
  peers: { cs: "Peery", en: "Peers" },
  nativeLeg: { cs: "Nativní leg", en: "Native leg" },
  shareSplit: { cs: "Nativní podíl", en: "Native share" },
  blocksMined: { cs: "Vytěžené bloky", en: "Blocks mined" },
  nodeTitle: { cs: "Quantus node", en: "Quantus node" },
  version: { cs: "Verze", en: "Version" },
  runtime: { cs: "Runtime", en: "Runtime" },
  syncState: { cs: "Synchronizace", en: "Sync state" },
  synced: { cs: "synchronizováno", en: "synced" },
  publicRpc: { cs: "Veřejné RPC", en: "Public RPC" },
  chainLabel: { cs: "Řetězec", en: "Chain" },
  poolTitle: { cs: "Nativní mining leg", en: "Native mining leg" },
  poolSub: {
    cs: "Přímé spojení poolu s lokálním Quantus nodem — nativní joby jsou sdílené malým procentem minerů (lottery režim), zbytek jede přes externí upstream.",
    en: "Direct pool-to-node link — native jobs are shared with a small percentage of miners (lottery mode), the rest rides the external upstream.",
  },
  enabled: { cs: "Povoleno", en: "Enabled" },
  connected: { cs: "Připojeno", en: "Connected" },
  currentJob: { cs: "Nativní job", en: "Native job" },
  jobAge: { cs: "Stáří jobu", en: "Job age" },
  upstream: { cs: "Upstream pool", en: "Upstream pool" },
  upstreamJob: { cs: "Upstream job", en: "Upstream job" },
  pendingPayouts: { cs: "Čekající QTC výplaty", en: "Pending QTC payouts" },
  rewardsTitle: { cs: "Wormhole odměny", en: "Wormhole rewards" },
  rewardsSub: {
    cs: "Blokové odměny akumulují jako ZK-listy na wormhole adrese. Indexerová data jsou zpožděná (~20–90 min za tipem řetězce).",
    en: "Block rewards accrue as ZK leaves on the wormhole address. Indexer data lags ~20–90 min behind the chain tip.",
  },
  rewardAddress: { cs: "Rewards adresa", en: "Rewards address" },
  lastReward: { cs: "Poslední odměna", en: "Last reward" },
  noRewards: { cs: "Zatím žádné indexované odměny — těžba běží.", en: "No indexed rewards yet — mining is live." },
  heightCol: { cs: "Výška", en: "Height" },
  rewardCol: { cs: "Odměna", en: "Reward" },
  leafCol: { cs: "Leaf", en: "Leaf" },
  timeCol: { cs: "Čas", en: "Time" },
  lookupTitle: { cs: "QTC adresní lookup", en: "QTC address lookup" },
  lookupSub: {
    cs: "Zůstatek přímo z on-chain storage + historie transferů z indexeru.",
    en: "Balance straight from on-chain storage + transfer history from the indexer.",
  },
  lookupPlaceholder: { cs: "qz… adresa", en: "qz… address" },
  lookup: { cs: "Načíst", en: "Lookup" },
  invalidAddress: { cs: "Neplatná QTC adresa (očekává se ss58-189)", en: "Invalid QTC address (ss58-189 expected)" },
  balance: { cs: "Zůstatek", en: "Balance" },
  nonce: { cs: "Nonce", en: "Nonce" },
  transfers: { cs: "Transferů", en: "Transfers" },
  noTransfers: { cs: "Žádné transfery pro tuto adresu.", en: "No transfers for this address." },
  dirIn: { cs: "příchozí", en: "in" },
  dirOut: { cs: "odchozí", en: "out" },
  counterparty: { cs: "Protistrana", en: "Counterparty" },
  amount: { cs: "Částka", en: "Amount" },
  feedTitle: { cs: "Síťový feed", en: "Network feed" },
  feedSub: {
    cs: "Poslední transfery na Quantus mainnetu (indexer zaostává ~20–90 min za tipem).",
    en: "Latest transfers on Quantus mainnet (indexer lags ~20–90 min behind tip).",
  },
  from: { cs: "Odesílatel", en: "From" },
  to: { cs: "Příjemce", en: "To" },
  kind: { cs: "Typ", en: "Kind" },
  reward: { cs: "odměna", en: "reward" },
  transfer: { cs: "transfer", en: "transfer" },
  feedEmpty: { cs: "Indexer nedostupný.", en: "Indexer unreachable." },
  refresh: { cs: "Obnovit", en: "Refresh" },
  yes: { cs: "ano", en: "yes" },
  no: { cs: "ne", en: "no" },
};

type QtcData = {
  ok: boolean;
  node: {
    ok: boolean;
    peers: number | null;
    syncing: boolean | null;
    height: number | null;
    version: string | null;
    chain: string | null;
    spec_version: number | null;
    tx_version: number | null;
  };
  pool: {
    available?: boolean;
    upstream?: string | null;
    upstream_job_id?: string | null;
    upstream_job_age_ms?: number | null;
    upstream_fresh?: boolean | null;
    pending_payouts?: number | null;
    native?: {
      enabled?: boolean;
      connected?: boolean;
      share_pct?: number;
      job_id?: string | null;
      job_age_ms?: number | null;
    } | null;
  };
  rewards: {
    address: string | null;
    mined_count: number | null;
    last_ts: string | null;
    recent: { amount_qtc: number; height: number; ts: string; leaf: string }[];
  };
  network_feed: {
    amount_qtc: number; from: string; to: string;
    height: number; ts: string; is_reward: boolean;
  }[];
  wallet?: {
    address: string;
    valid: boolean;
    balance?: { free_qtc: number; nonce: number } | null;
    history?: {
      direction: string; counterparty: string; amount_qtc: number;
      fee_qtc: number; height: number; ts: string;
      extrinsic: string | null; leaf: string | null;
    }[];
  } | null;
};

function fmtAge(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)} min`;
}

function fmtTs(s: string | null | undefined): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return String(s); }
}

function short(a: string | null | undefined, n = 14): string {
  return a ? a.slice(0, n) + "…" : "—";
}

export default function PoolQtcClient({ embedded = false }: { embedded?: boolean }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [data, setData] = useState<QtcData | null>(null);
  const [addr, setAddr] = useState("");
  const [lookupAddr, setLookupAddr] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const url = lookupAddr ? `/api/qtc?addr=${encodeURIComponent(lookupAddr)}` : "/api/qtc";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch { /* keep last good frame */ }
    finally { setLoading(false); }
  }, [lookupAddr]);

  usePolling(fetchData, 15_000, { runWhenHidden: true });

  const n = data?.node;
  const p = data?.pool;
  const nv = p?.native;
  const rw = data?.rewards;
  const w = data?.wallet;

  const kpi = (
    ok: boolean | null | undefined,
    label: string,
    okText: string,
    badText: string,
  ) => (
    <div className="bg-black/25 rounded-xl p-3 text-center border border-white/5">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold ${ok == null ? 'text-gray-400' : ok ? 'text-emerald-400' : 'text-red-400'}`}>
        {ok == null ? '—' : ok ? okText : badText}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 }}
        className="zion-rainbow-card p-6 md:p-8"
        style={{ '--rc': '168, 85, 247' } as React.CSSProperties}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3">
              <Atom className="h-7 w-7 text-purple-400" />
              {C.title[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400 mt-1">{C.sub[cs ? 'cs' : 'en']}</p>
          </div>
          <button
            onClick={() => void fetchData()}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm border border-white/10 bg-white/5 text-gray-300 hover:border-white/25 hover:text-white transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {C.refresh[cs ? 'cs' : 'en']}
          </button>
        </div>
      </motion.section>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpi(n?.ok === true && n?.syncing === false ? true : n?.ok === true ? null : false,
          C.title[cs ? 'cs' : 'en'].split(' ')[0],
          C.live[cs ? 'cs' : 'en'],
          n?.ok ? C.syncing[cs ? 'cs' : 'en'] : C.down[cs ? 'cs' : 'en'])}
        <div className="bg-black/25 rounded-xl p-3 text-center border border-white/5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.height[cs ? 'cs' : 'en']}</div>
          <div className="text-lg font-bold text-cyan-400">{n?.height != null ? n.height.toLocaleString() : '—'}</div>
        </div>
        <div className="bg-black/25 rounded-xl p-3 text-center border border-white/5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.peers[cs ? 'cs' : 'en']}</div>
          <div className="text-lg font-bold">{n?.peers != null ? n.peers : '—'}</div>
        </div>
        {kpi(nv?.connected, C.nativeLeg[cs ? 'cs' : 'en'], 'LINKED', 'DOWN')}
        <div className="bg-black/25 rounded-xl p-3 text-center border border-white/5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.shareSplit[cs ? 'cs' : 'en']}</div>
          <div className="text-lg font-bold text-amber-400">{nv?.share_pct != null ? `${nv.share_pct} %` : '—'}</div>
        </div>
        <div className="bg-black/25 rounded-xl p-3 text-center border border-white/5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.blocksMined[cs ? 'cs' : 'en']}</div>
          <div className="text-lg font-bold text-emerald-400">{rw?.mined_count ?? '0'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Node card */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="zion-rainbow-card p-6"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Server className="h-5 w-5 text-cyan-400" />
            {C.nodeTitle[cs ? 'cs' : 'en']}
            <span className="text-xs text-gray-500 font-normal">mainnet · validator</span>
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <div className="text-gray-500">{C.chainLabel[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{n?.chain || '—'}</div>
            <div className="text-gray-500">{C.version[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200 truncate" title={n?.version || ''}>{n?.version || '—'}</div>
            <div className="text-gray-500">{C.runtime[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">
              {n?.spec_version != null ? `spec ${n.spec_version}` : '—'}{n?.tx_version != null ? ` · tx ${n.tx_version}` : ''}
            </div>
            <div className="text-gray-500">{C.syncState[cs ? 'cs' : 'en']}</div>
            <div className={`font-mono ${n?.syncing === false ? 'text-emerald-400' : 'text-amber-400'}`}>
              {n?.syncing == null ? '—' : n.syncing ? 'syncing…' : C.synced[cs ? 'cs' : 'en']}
            </div>
            <div className="text-gray-500">{C.publicRpc[cs ? 'cs' : 'en']}</div>
            <div className="font-mono">
              <a href="https://rpc.zionterranova.com/qtc" target="_blank" rel="noreferrer"
                 className="text-cyan-400 hover:text-white transition inline-flex items-center gap-1">
                rpc.zionterranova.com/qtc <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </motion.section>

        {/* Native pool leg card */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="zion-rainbow-card p-6"
          style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
            <Pickaxe className="h-5 w-5 text-amber-400" />
            {C.poolTitle[cs ? 'cs' : 'en']}
          </h3>
          <p className="text-xs text-gray-500 mb-4">{C.poolSub[cs ? 'cs' : 'en']}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <div className="text-gray-500">{C.enabled[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{nv?.enabled == null ? '—' : nv.enabled ? C.yes[cs ? 'cs' : 'en'] : C.no[cs ? 'cs' : 'en']}</div>
            <div className="text-gray-500">{C.connected[cs ? 'cs' : 'en']}</div>
            <div className={`font-mono ${nv?.connected ? 'text-emerald-400' : 'text-red-400'}`}>
              {nv?.connected == null ? '—' : nv.connected ? '● connected' : '● disconnected'}
            </div>
            <div className="text-gray-500">{C.currentJob[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{nv?.job_id || '—'}</div>
            <div className="text-gray-500">{C.jobAge[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{fmtAge(nv?.job_age_ms)}</div>
            <div className="text-gray-500">{C.upstream[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200 truncate" title={p?.upstream || ''}>{p?.upstream || '—'}</div>
            <div className="text-gray-500">{C.upstreamJob[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">
              {p?.upstream_job_id || '—'}
              <span className={p?.upstream_fresh ? 'text-emerald-400' : 'text-red-400'}> · {fmtAge(p?.upstream_job_age_ms)}</span>
            </div>
            <div className="text-gray-500">{C.pendingPayouts[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{p?.pending_payouts != null ? p.pending_payouts : '—'}</div>
          </div>
        </motion.section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Wormhole rewards */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.10 }}
          className="zion-rainbow-card p-6"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            {C.rewardsTitle[cs ? 'cs' : 'en']}
          </h3>
          <p className="text-xs text-gray-500 mb-3">{C.rewardsSub[cs ? 'cs' : 'en']}</p>
          {rw?.address && (
            <div className="text-[11px] font-mono text-emerald-300/80 break-all mb-3 bg-black/20 rounded-lg px-3 py-2 border border-emerald-500/10">
              {rw.address}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
            <div className="text-gray-500">{C.blocksMined[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-emerald-400 font-semibold">{rw?.mined_count ?? '0'}</div>
            <div className="text-gray-500">{C.lastReward[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{fmtTs(rw?.last_ts)}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-500 border-b border-white/10">
                  <th className="py-1.5 px-2">{C.heightCol[cs ? 'cs' : 'en']}</th>
                  <th className="py-1.5 px-2 text-right">{C.rewardCol[cs ? 'cs' : 'en']}</th>
                  <th className="py-1.5 px-2">{C.leafCol[cs ? 'cs' : 'en']}</th>
                  <th className="py-1.5 px-2">{C.timeCol[cs ? 'cs' : 'en']}</th>
                </tr>
              </thead>
              <tbody>
                {(rw?.recent?.length ?? 0) > 0 ? rw!.recent.map((r, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-1.5 px-2 font-mono">{r.height}</td>
                    <td className="py-1.5 px-2 text-right text-emerald-400">+{r.amount_qtc}</td>
                    <td className="py-1.5 px-2 font-mono text-gray-500">#{r.leaf}</td>
                    <td className="py-1.5 px-2 text-gray-400">{fmtTs(r.ts)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-4 text-gray-500 italic text-center">{C.noRewards[cs ? 'cs' : 'en']}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Address lookup */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="zion-rainbow-card p-6"
          style={{ '--rc': '59, 130, 246' } as React.CSSProperties}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
            <Wallet className="h-5 w-5 text-blue-400" />
            {C.lookupTitle[cs ? 'cs' : 'en']}
          </h3>
          <p className="text-xs text-gray-500 mb-3">{C.lookupSub[cs ? 'cs' : 'en']}</p>
          <div className="flex gap-2 mb-4">
            <input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setLookupAddr(addr.trim()); }}
              placeholder={C.lookupPlaceholder[cs ? 'cs' : 'en']}
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500/40 text-gray-200"
              spellCheck={false}
            />
            <button
              onClick={() => setLookupAddr(addr.trim())}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium zion-rainbow-sub text-white"
              style={{ '--rc': '59, 130, 246' } as React.CSSProperties}
            >
              <Search className="h-3.5 w-3.5" /> {C.lookup[cs ? 'cs' : 'en']}
            </button>
          </div>
          {w && (
            <>
              {w.valid === false ? (
                <div className="text-xs text-red-400 mb-3">{C.invalidAddress[cs ? 'cs' : 'en']}</div>
              ) : (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-black/25 rounded-lg p-2.5 text-center border border-white/5">
                    <div className="text-[9px] text-gray-500 uppercase mb-0.5">{C.balance[cs ? 'cs' : 'en']}</div>
                    <div className="text-sm font-bold text-emerald-400">
                      {w.balance ? w.balance.free_qtc.toFixed(6) : '0.000000'}
                    </div>
                  </div>
                  <div className="bg-black/25 rounded-lg p-2.5 text-center border border-white/5">
                    <div className="text-[9px] text-gray-500 uppercase mb-0.5">{C.nonce[cs ? 'cs' : 'en']}</div>
                    <div className="text-sm font-bold">{w.balance ? w.balance.nonce : '0'}</div>
                  </div>
                  <div className="bg-black/25 rounded-lg p-2.5 text-center border border-white/5">
                    <div className="text-[9px] text-gray-500 uppercase mb-0.5">{C.transfers[cs ? 'cs' : 'en']}</div>
                    <div className="text-sm font-bold">{w.history?.length ?? 0}</div>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/10">
                      <th className="py-1.5 px-2"></th>
                      <th className="py-1.5 px-2">{C.counterparty[cs ? 'cs' : 'en']}</th>
                      <th className="py-1.5 px-2 text-right">{C.amount[cs ? 'cs' : 'en']}</th>
                      <th className="py-1.5 px-2">{C.heightCol[cs ? 'cs' : 'en']}</th>
                      <th className="py-1.5 px-2">{C.timeCol[cs ? 'cs' : 'en']}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(w.history?.length ?? 0) > 0 ? w!.history!.map((r, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-1.5 px-2">
                          {r.direction === 'in'
                            ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                            : <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-gray-400" title={r.counterparty}>{short(r.counterparty, 12)}</td>
                        <td className="py-1.5 px-2 text-right">{r.amount_qtc}</td>
                        <td className="py-1.5 px-2 text-gray-400">{r.height}</td>
                        <td className="py-1.5 px-2 text-gray-400">{fmtTs(r.ts)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="py-4 text-gray-500 italic text-center">{C.noTransfers[cs ? 'cs' : 'en']}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.section>
      </div>

      {/* Network feed */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="zion-rainbow-card p-6"
        style={{ '--rc': '34, 211, 238' } as React.CSSProperties}
      >
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
          <Activity className="h-5 w-5 text-cyan-400" />
          {C.feedTitle[cs ? 'cs' : 'en']}
          <span className="text-xs text-gray-500 font-normal">{C.feedSub[cs ? 'cs' : 'en']}</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-gray-500 border-b border-white/10">
                <th className="py-2 px-2">{C.heightCol[cs ? 'cs' : 'en']}</th>
                <th className="py-2 px-2">{C.from[cs ? 'cs' : 'en']}</th>
                <th className="py-2 px-2">{C.to[cs ? 'cs' : 'en']}</th>
                <th className="py-2 px-2 text-right">{C.amount[cs ? 'cs' : 'en']}</th>
                <th className="py-2 px-2">{C.kind[cs ? 'cs' : 'en']}</th>
                <th className="py-2 px-2">{C.timeCol[cs ? 'cs' : 'en']}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.network_feed?.length ?? 0) > 0 ? data!.network_feed.map((r, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-2 px-2 font-mono">{r.height}</td>
                  <td className="py-2 px-2 font-mono text-gray-400" title={r.from}>{short(r.from)}</td>
                  <td className="py-2 px-2 font-mono text-gray-400" title={r.to}>{short(r.to)}</td>
                  <td className="py-2 px-2 text-right">{r.amount_qtc}</td>
                  <td className="py-2 px-2">
                    {r.is_reward
                      ? <span className="text-emerald-400">{C.reward[cs ? 'cs' : 'en']}</span>
                      : <span className="text-cyan-400">{C.transfer[cs ? 'cs' : 'en']}</span>}
                  </td>
                  <td className="py-2 px-2 text-gray-400">{fmtTs(r.ts)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="py-4 text-gray-500 italic text-center">{C.feedEmpty[cs ? 'cs' : 'en']}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </div>
  );
}
