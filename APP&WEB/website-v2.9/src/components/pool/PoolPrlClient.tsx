"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Blocks,
  Clock,
  ExternalLink,
  Gauge,
  Gem,
  Pickaxe,
  RefreshCw,
  Server,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";

const C = {
  title: { cs: "Pearl Network (PRL)", en: "Pearl Network (PRL)" },
  sub: {
    cs: "Proof-of-Useful-Work řetězec · maticový PoW · nativní stratum na ZION poolu",
    en: "Proof-of-Useful-Work chain · matrix PoW · native stratum on the ZION pool",
  },
  live: { cs: "ŽIVĚ", en: "LIVE" },
  down: { cs: "NEDOSTUPNÉ", en: "DOWN" },
  syncing: { cs: "SYNC", en: "SYNC" },
  height: { cs: "Výška", en: "Height" },
  peers: { cs: "Peery", en: "Peers" },
  netHash: { cs: "Síťový výkon", en: "Network power" },
  nativeLeg: { cs: "Nativní leg", en: "Native leg" },
  shareSplit: { cs: "Nativní podíl", en: "Native share" },
  difficulty: { cs: "Obtížnost", en: "Difficulty" },
  nodeTitle: { cs: "Pearl node", en: "Pearl node" },
  version: { cs: "Verze", en: "Version" },
  chainLabel: { cs: "Řetězec", en: "Chain" },
  bestBlock: { cs: "Tip bloku", en: "Best block" },
  mempool: { cs: "Mempool tx", en: "Mempool tx" },
  blockTx: { cs: "Tx v šabloně", en: "Template tx" },
  mediantime: { cs: "Median čas", en: "Median time" },
  poolTitle: { cs: "Mining legy na poolu", en: "Pool mining legs" },
  poolSub: {
    cs: "Nativní leg = joby přímo z lokálního Pearl gateway (zk-verifikace proofů). Upstream leg = volitelný most na externí pool.",
    en: "Native leg = jobs straight from the local Pearl gateway (zk proof verification). Upstream leg = optional bridge to an external pool.",
  },
  enabled: { cs: "Povoleno", en: "Enabled" },
  connected: { cs: "Připojeno", en: "Connected" },
  currentJob: { cs: "Aktuální job", en: "Current job" },
  jobAge: { cs: "Stáří jobu", en: "Job age" },
  upstreamTitle: { cs: "Upstream leg", en: "Upstream leg" },
  pendingSubmits: { cs: "Čekající submity", en: "Pending submits" },
  pendingPayouts: { cs: "Čekající PRL výplaty", en: "Pending PRL payouts" },
  srbTitle: { cs: "Těžte PRL přes SRBMiner", en: "Mine PRL with SRBMiner" },
  srbSub: {
    cs: "Pool mluví nativním Pearl stratumech — SRBMiner-MULTI ≥ 3.7.6 se připojí přímo, bez bridge. GPU only.",
    en: "The pool speaks the native Pearl stratum — SRBMiner-MULTI ≥ 3.7.6 connects directly, no bridge. GPU only.",
  },
  srbCmd: { cs: "Příkaz pro připojení", en: "Connect command" },
  srbWalletNote: {
    cs: "Za wallet doplňte svou prl1… payout adresu, za tečku volitelné jméno workera. Heslo může být cokoliv (x).",
    en: "Replace the wallet with your prl1… payout address; the suffix after the dot is an optional worker name. Password can be anything (x).",
  },
  srbGpuNote: {
    cs: "Pearlhash v SRBMineru: AMD RDNA+ a NVIDIA Turing/Ampere/Ada (SM75+). Pascal (GTX 10xx) není podporován — tam těží vestavěný ZION miner kernel.",
    en: "SRBMiner pearlhash: AMD RDNA+ and NVIDIA Turing/Ampere/Ada (SM75+). Pascal (GTX 10xx) is unsupported — the built-in ZION miner kernel covers those cards.",
  },
  srbPplnsNote: {
    cs: "Shares se počítají podle vaší prl1 adresy a workera — výplaty řeší pool automaticky.",
    en: "Shares are credited to your prl1 address and worker — payouts are handled by the pool automatically.",
  },
  srbDownload: { cs: "Stáhnout SRBMiner", en: "Download SRBMiner" },
  netTitle: { cs: "Síť Pearl", en: "Pearl network" },
  netSub: {
    cs: "Živá data z lokálního Pearl nodu — obtížnost, odhad síťového výkonu a mempool.",
    en: "Live data from the local Pearl node — difficulty, estimated network power and mempool.",
  },
  refresh: { cs: "Obnovit", en: "Refresh" },
  yes: { cs: "ano", en: "yes" },
  no: { cs: "ne", en: "no" },
};

type PrlData = {
  ok: boolean;
  node: {
    ok: boolean;
    height: number | null;
    headers: number | null;
    chain: string | null;
    difficulty: number | null;
    best_block: string | null;
    mediantime: number | null;
    network_hashps: number | null;
    mempool_tx: number | null;
    block_tx: number | null;
    connections: number | null;
    version: string | null;
  };
  pool: {
    available?: boolean;
    pending_payouts?: number | null;
    native?: {
      enabled?: boolean;
      job_id?: string | null;
      job_age_ms?: number | null;
      share_pct?: number | null;
    } | null;
    upstream?: {
      enabled?: boolean;
      connected?: boolean;
      job_id?: string | null;
      job_age_ms?: number | null;
      pending_submits?: number | null;
    } | null;
  };
};

function fmtAge(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)} min`;
}

function short(a: string | null | undefined, n = 14): string {
  return a ? a.slice(0, n) + "…" : "—";
}

function fmtHashps(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s", "ZH/s"];
  let x = v, i = 0;
  while (x >= 1000 && i < units.length - 1) { x /= 1000; i++; }
  return `${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)} ${units[i]}`;
}

function fmtDiff(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} G`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)} k`;
  return v.toFixed(2);
}

export default function PoolPrlClient({ embedded = false }: { embedded?: boolean }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [data, setData] = useState<PrlData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/prl", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch { /* keep last good frame */ }
    finally { setLoading(false); }
  }, []);

  usePolling(fetchData, 15_000, { runWhenHidden: true });

  const n = data?.node;
  const p = data?.pool;
  const nv = p?.native;
  const up = p?.upstream;

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
        style={{ '--rc': '244, 114, 182' } as React.CSSProperties}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3">
              <Gem className="h-7 w-7 text-pink-400" />
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
        {kpi(n?.ok === true ? true : n == null ? null : false,
          C.title[cs ? 'cs' : 'en'].split(' ')[0],
          C.live[cs ? 'cs' : 'en'],
          C.down[cs ? 'cs' : 'en'])}
        <div className="bg-black/25 rounded-xl p-3 text-center border border-white/5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.height[cs ? 'cs' : 'en']}</div>
          <div className="text-lg font-bold text-cyan-400">{n?.height != null ? n.height.toLocaleString() : '—'}</div>
        </div>
        <div className="bg-black/25 rounded-xl p-3 text-center border border-white/5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.peers[cs ? 'cs' : 'en']}</div>
          <div className="text-lg font-bold">{n?.connections != null ? n.connections : '—'}</div>
        </div>
        <div className="bg-black/25 rounded-xl p-3 text-center border border-white/5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.netHash[cs ? 'cs' : 'en']}</div>
          <div className="text-lg font-bold text-pink-400">{fmtHashps(n?.network_hashps)}</div>
        </div>
        {kpi(nv?.enabled, C.nativeLeg[cs ? 'cs' : 'en'], 'ON', 'OFF')}
        <div className="bg-black/25 rounded-xl p-3 text-center border border-white/5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.shareSplit[cs ? 'cs' : 'en']}</div>
          <div className="text-lg font-bold text-amber-400">{nv?.share_pct != null ? `${nv.share_pct} %` : '—'}</div>
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
            <span className="text-xs text-gray-500 font-normal">mainnet</span>
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <div className="text-gray-500">{C.chainLabel[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{n?.chain || '—'}</div>
            <div className="text-gray-500">{C.version[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200 truncate">{n?.version || '—'}</div>
            <div className="text-gray-500">{C.difficulty[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{fmtDiff(n?.difficulty)}</div>
            <div className="text-gray-500">{C.bestBlock[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200 truncate" title={n?.best_block || ''}>{short(n?.best_block)}</div>
            <div className="text-gray-500">{C.mediantime[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">
              {n?.mediantime ? new Date(n.mediantime * 1000).toLocaleString() : '—'}
            </div>
            <div className="text-gray-500">{C.mempool[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{n?.mempool_tx ?? '—'}</div>
          </div>
        </motion.section>

        {/* Pool legs card */}
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
            <div className="text-gray-500">{C.nativeLeg[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{nv?.enabled == null ? '—' : nv.enabled ? C.yes[cs ? 'cs' : 'en'] : C.no[cs ? 'cs' : 'en']}</div>
            <div className="text-gray-500">{C.currentJob[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">
              {nv?.job_id || '—'}
              <span className={nv?.job_age_ms != null && nv.job_age_ms < 120_000 ? 'text-emerald-400' : 'text-red-400'}> · {fmtAge(nv?.job_age_ms)}</span>
            </div>
            <div className="text-gray-500">{C.upstreamTitle[cs ? 'cs' : 'en']}</div>
            <div className={`font-mono ${up?.connected ? 'text-emerald-400' : 'text-gray-400'}`}>
              {up?.enabled == null ? '—' : !up.enabled ? C.no[cs ? 'cs' : 'en'] : up.connected ? '● connected' : '● disconnected'}
            </div>
            <div className="text-gray-500">{C.pendingSubmits[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{up?.pending_submits ?? '—'}</div>
            <div className="text-gray-500">{C.pendingPayouts[cs ? 'cs' : 'en']}</div>
            <div className="font-mono text-gray-200">{p?.pending_payouts != null ? p.pending_payouts : '—'}</div>
          </div>
        </motion.section>
      </div>

      {/* SRBMiner connect */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09 }}
        className="zion-rainbow-card p-6"
        style={{ '--rc': '244, 114, 182' } as React.CSSProperties}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Gauge className="h-5 w-5 text-pink-400" />
            {C.srbTitle[cs ? 'cs' : 'en']}
          </h3>
          <a href="https://github.com/doktor83/SRBMiner-Multi/releases" target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs border border-pink-500/30 bg-pink-500/10 text-pink-300 hover:border-pink-400/60 transition">
            {C.srbDownload[cs ? 'cs' : 'en']} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="text-xs text-gray-500 mb-4">{C.srbSub[cs ? 'cs' : 'en']}</p>
        <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{C.srbCmd[cs ? 'cs' : 'en']}</div>
        <pre className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-pink-200/90 overflow-x-auto mb-4">{`SRBMiner-MULTI --algorithm pearlhash \\
  --pool stratum+tcp://62.171.141.136:8444 \\
  --wallet prl1YourAddress.yourWorker \\
  --password x --disable-cpu`}</pre>
        <ul className="space-y-1.5 text-xs text-gray-400 list-disc list-inside">
          <li>{C.srbWalletNote[cs ? 'cs' : 'en']}</li>
          <li>{C.srbGpuNote[cs ? 'cs' : 'en']}</li>
          <li>{C.srbPplnsNote[cs ? 'cs' : 'en']}</li>
        </ul>
      </motion.section>

      {/* Network card */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="zion-rainbow-card p-6"
        style={{ '--rc': '34, 211, 238' } as React.CSSProperties}
      >
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
          <Activity className="h-5 w-5 text-cyan-400" />
          {C.netTitle[cs ? 'cs' : 'en']}
          <span className="text-xs text-gray-500 font-normal">{C.netSub[cs ? 'cs' : 'en']}</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-black/25 rounded-xl p-4 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.netHash[cs ? 'cs' : 'en']}</div>
            <div className="text-xl font-bold text-pink-400 flex items-center gap-2">
              <Blocks className="h-4 w-4" /> {fmtHashps(n?.network_hashps)}
            </div>
          </div>
          <div className="bg-black/25 rounded-xl p-4 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.difficulty[cs ? 'cs' : 'en']}</div>
            <div className="text-xl font-bold text-cyan-300 flex items-center gap-2">
              <Gauge className="h-4 w-4" /> {fmtDiff(n?.difficulty)}
            </div>
          </div>
          <div className="bg-black/25 rounded-xl p-4 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.mempool[cs ? 'cs' : 'en']}</div>
            <div className="text-xl font-bold text-gray-200">{n?.mempool_tx ?? '—'}</div>
          </div>
          <div className="bg-black/25 rounded-xl p-4 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{C.blockTx[cs ? 'cs' : 'en']}</div>
            <div className="text-xl font-bold text-gray-200">{n?.block_tx ?? '—'}</div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
