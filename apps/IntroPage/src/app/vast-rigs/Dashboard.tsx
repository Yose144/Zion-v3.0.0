"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";

type Hashrate = { rate: number; unit: string; a: number; r: number };
type Miner = {
  algo: string | null;
  pool: string | null;
  worker: string | null;
  cmd?: string;
  pid?: number;
  etime?: string;
  hashrate?: Hashrate;
  hist?: number[];
};
type Rig = {
  id: number;
  gpu_name: string;
  status: string;
  dph: number;
  geo: string;
  ssh: string;
  gpu: { util?: string; power?: string; temp?: string; mem?: string };
  miners: Miner[];
  error: string | null;
  net?: Record<string, boolean>;
  sessions?: string[];
};
type PoolStats = {
  sessions: number | null;
  total_connections: number | null;
  uptime_s: number | null;
  config: { fee_bps?: number; humanitarian_pct?: number; miner_pct?: number; issobella_pct?: number; port?: number };
  shares: { accepted?: number; rejected?: number; total?: number };
  pplns: {
    registered_miners?: number;
    miners_with_unpaid?: number;
    window_size?: number;
    window_used?: number;
    window_total_difficulty?: string;
    total_paid_flowers?: string;
    total_unpaid_flowers?: string;
    payout_rounds?: number;
  };
  external_payouts: Record<string, unknown>;
  routing: {
    total_submits?: number;
    total_accepted?: number;
    total_rejected?: number;
    total_stale?: number;
    total_accept_rate_pct?: number;
    groups: { group: string; submits: number; accepted: number; pct: number }[];
    sources: { source: string; submits: number; accepted: number; accept_rate_pct: number }[];
  };
  pearl: {
    upstream: {
      connected?: boolean;
      enabled?: boolean;
      submits?: number;
      accepted?: number;
      rejected?: number;
      stale_dropped?: number;
      unknown?: number;
      busy?: number;
      pending_submits?: number;
      job_id?: string;
      job_age_ms?: number;
    };
    native: { enabled?: boolean; job_age_ms?: number; job_id?: string; share_pct?: number };
    served_upstream?: number;
    served_native?: number;
  };
  coins: {
    ticker: string;
    algorithm: string;
    device: string;
    upstream: string;
    job_fresh: boolean;
    job_age_ms: number;
  }[];
};
type Snap = {
  ts: string | null;
  total_dph: number;
  rigs: Rig[];
  pool?: PoolMiner[] | null;
  poolstats?: PoolStats | null;
  smos?: SmosRig[] | null;
  ext?: ExtPools;
};
type ExtWorker = { name: string; hashrate: number; h1?: number; h6?: number; h24?: number; accepted?: number; last: number; agent?: string; rating?: number };
type ExtPool = {
  hashrate: number;
  avg: Record<string, number>;
  accepted?: number;
  rejected?: number;
  unlocked?: number;
  locked?: number;
  paid?: number;
  balance?: number;
  workers: ExtWorker[];
  url: string;
};
type ExtPools = { qtu: ExtPool | null; prl: ExtPool | null; nock: ExtPool | null; xmr: ExtPool | null };
type SmosRig = {
  id: number;
  name: string;
  online: boolean;
  paused: boolean;
  group: string;
  miner: string;
  gpus: number;
  gpus_max: number;
  hash: number;
  hash2: number;
  gpu_hash: string[];
  gpu_hash2: string[];
  gpu_temp: string[];
  gpu_fan: string[];
  gpu_pwr: string[];
  sys_pwr: string;
  acc: number;
  rej: number;
  uptime: string;
  proc_uptime: number;
  alerts: string[];
  last_update: number;
  ip: string;
  driver: string;
  kernel: string;
  os: string;
  pwr_limit: string;
};
type PoolStream = { v: number; i: number; t: number };
type PoolMiner = {
  worker: string;
  address: string;
  streams: Record<string, PoolStream>;
  hps: number;
  hps_1h: number;
  last_seen: number;
  first_seen: number;
  blocks: number;
  paid: number;
};
type AiGpu = {
  name: string;
  memory_total_mib: number;
  memory_used_mib: number;
  memory_free_mib: number;
  utilization_pct: number;
  temperature_c: number;
  power_w: number | null;
};
type CatEntry = {
  hf: string;
  params: string;
  vram_gb: number;
  tags: string[];
  desc: string;
  gated?: boolean;
  internal?: boolean;
  mockup?: boolean;
  latest_vllm?: boolean;
};
type HfResult = {
  hf: string;
  likes: number;
  downloads: number;
  gated: boolean;
  tags: string[];
};
type AiRig = {
  id: number;
  gpu_name: string;
  dph: number;
  gpus: AiGpu[];
  models: string[];
  inference_reachable: boolean;
  servers: string[];
  error: string | null;
};
type AiStatus = {
  ts: string;
  ai_api_port: number;
  rigs: AiRig[];
  totals: {
    gpu_count: number;
    memory_total_mib: number;
    memory_used_mib: number;
    memory_free_mib: number;
    gpu_utilization_pct: number | null;
    inference_rigs: number;
  };
  hiran?: { reachable: boolean; models: string[]; model: string | null };
  note: string;
};

const COIN: Record<string, { name: string; c: string }> = {
  quantus: { name: "QTU", c: "#fcd116" },
  pearlhash: { name: "PRL", c: "#34d399" },
  "rx/0": { name: "XMR", c: "#fb923c" },
};
const VLLM_IMAGE = "vllm/vllm-openai:v0.8.5";
const POOL_COIN: Record<string, string> = {
  zion: "#7dd3fc", qtu: "#fcd116", qtc: "#fcd116", prl: "#34d399",
  pearl: "#34d399", vrsc: "#a78bfa", zano: "#f472b6", evr: "#fb923c",
  krx: "#4ade80", xmr: "#fb923c",
};

function fmtHps(hps: number) {
  if (!hps) return "—";
  for (const [u, s] of [[1e12, "TH/s"], [1e9, "GH/s"], [1e6, "MH/s"], [1e3, "kH/s"]] as const)
    if (hps >= u) return `${(hps / u).toFixed(1)} ${s}`;
  return `${hps.toFixed(1)} H/s`;
}

function workerName(w: string) {
  const core = w.split("@")[0];
  const parts = core.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : core;
}

function workerKind(name: string): { label: string; cls: string } {
  const n = name.toLowerCase();
  if (n.includes("smos")) return { label: "SMOS", cls: "border-[#fcd116]/40 bg-[#fcd116]/10 text-[#fcd116]" };
  if (n.includes("vast")) return { label: "vast", cls: "border-[#7dd3fc]/40 bg-[#7dd3fc]/10 text-[#7dd3fc]" };
  if (n.includes("edge") || n.includes("dest-")) return { label: "infra", cls: "border-white/15 bg-white/[0.04] text-white/50" };
  return { label: "ext", cls: "border-[#a371f7]/40 bg-[#a371f7]/10 text-[#d2a8ff]" };
}

function agoS(t: number) {
  if (!t) return "—";
  const d = Math.max(0, Math.floor(Date.now() / 1000) - t);
  if (d < 90) return `${d}s ago`;
  if (d < 5400) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

/** Age in seconds of an ISO-ish daemon timestamp ("2026-10-26T07:08:41+0100"). */
function snapAgeS(ts?: string | null): number | null {
  if (!ts) return null;
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

function fmtAge(s: number | null) {
  if (s === null) return "—";
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

/** Merge pool miner rows that share one payout wallet — the pool exposes a
 * row per session identity (bare wallet, wallet.worker, wallet.wallet.worker),
 * which duplicates the same miner. One row per wallet, streams/hps merged. */
type PoolWorkerGroup = {
  address: string;
  names: string[];
  kinds: { label: string; cls: string }[];
  streams: Record<string, PoolStream>;
  hps: number;
  hps_1h: number;
  last_seen: number;
  first_seen: number;
  blocks: number;
  paid: number;
  sessions: number;
};

function groupPoolWorkers(pool: PoolMiner[]): PoolWorkerGroup[] {
  const byAddr: Record<string, PoolMiner[]> = {};
  for (const m of pool) {
    const key = m.address || m.worker;
    (byAddr[key] ||= []).push(m);
  }
  const groups: PoolWorkerGroup[] = [];
  for (const address of Object.keys(byAddr)) {
    const rows = byAddr[address];
    const names = rows
      .map((r) => workerName(r.worker))
      .filter((n, i, a) => a.indexOf(n) === i)
      .sort((a, b) => a.length - b.length);
    const kinds = names
      .map(workerKind)
      .filter((k, i, a) => a.findIndex((x) => x.label === k.label) === i);
    const streams: Record<string, PoolStream> = {};
    for (const r of rows)
      for (const [c, s] of Object.entries(r.streams)) {
        const cur = streams[c];
        streams[c] = cur
          ? { v: cur.v + s.v, i: cur.i + s.i, t: Math.max(cur.t, s.t) }
          : { ...s };
      }
    groups.push({
      address,
      names,
      kinds,
      streams,
      hps: rows.reduce((s, r) => s + (r.hps || 0), 0),
      hps_1h: rows.reduce((s, r) => s + (r.hps_1h || 0), 0),
      last_seen: rows.reduce((mx, r) => Math.max(mx, r.last_seen || 0), 0),
      first_seen: rows.reduce(
        (min, r) => (r.first_seen && (!min || r.first_seen < min) ? r.first_seen : min),
        0,
      ),
      blocks: rows.reduce((s, r) => s + (r.blocks || 0), 0),
      paid: rows.reduce((s, r) => s + (r.paid || 0), 0),
      sessions: rows.length,
    });
  }
  groups.sort((a, b) => b.last_seen - a.last_seen);
  return groups;
}

function coinOf(m: Miner) {
  const a = (m.algo || "").toLowerCase();
  for (const [k, v] of Object.entries(COIN)) if (a.includes(k)) return v;
  return { name: (m.algo || "?").toUpperCase(), c: "#79c0ff" };
}

function Spark({ data, color, w = 110, h = 26 }: { data?: number[]; color: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return <span className="text-white/20">·</span>;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function fmt(hr?: Hashrate) {
  if (!hr) return <span className="text-white/25">—</span>;
  return (
    <>
      <span className="font-bold text-white">{hr.rate >= 100 ? hr.rate.toFixed(0) : hr.rate.toFixed(1)}</span>{" "}
      <span className="text-white/60">{hr.unit}</span>
      <span className="ml-2 text-[11px] text-white/40">
        A{hr.a}·R{hr.r}
      </span>
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{label}</div>
      <div className={`mt-1 text-lg font-bold leading-tight ${tone || "text-white"}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-white/35">{sub}</div> : null}
    </div>
  );
}

function Bar({ pct, tone }: { pct: number; tone: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function fmtDur(s?: number | null) {
  if (!s && s !== 0) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(s % 60)}s`;
}

function fmtNum(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

function PoolStatsPanel({ p, miners }: { p: PoolStats; miners?: PoolMiner[] | null }) {
  const up = p.pearl?.upstream || {};
  const rt = p.routing || { groups: [], sources: [] };
  const ppl = p.pplns || {};
  const upRate = up.submits ? ((up.accepted || 0) / up.submits) * 100 : null;
  const winPct = ppl.window_size ? ((ppl.window_used || 0) / ppl.window_size) * 100 : null;
  const topSources = (rt.sources || []).slice().sort((a, b) => (b.submits || 0) - (a.submits || 0)).slice(0, 10);
  const groups = (rt.groups || []).slice().sort((a, b) => (b.submits || 0) - (a.submits || 0));

  return (
    <div className="mb-5 space-y-4">
      {/* ── headline KPIs ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Sessions" value={fmtNum(p.sessions)} sub="live stratum" />
        <Kpi label="Uptime" value={fmtDur(p.uptime_s)} sub="pool process" />
        <Kpi label="Connections" value={fmtNum(p.total_connections)} sub="cumulative" />
        <Kpi
          label="Accept rate"
          value={rt.total_accept_rate_pct !== undefined ? `${rt.total_accept_rate_pct.toFixed(1)} %` : "—"}
          sub={`${fmtNum(rt.total_accepted)} acc / ${fmtNum(rt.total_submits)} sub`}
          tone={rt.total_accept_rate_pct !== undefined && rt.total_accept_rate_pct < 95 ? "text-amber-300" : "text-emerald-300"}
        />
        <Kpi
          label="PPLNS miners"
          value={fmtNum(ppl.registered_miners)}
          sub={`${fmtNum(ppl.miners_with_unpaid)} with unpaid balance`}
        />
        <Kpi
          label="Pool fee"
          value={p.config?.fee_bps !== undefined ? `${(p.config.fee_bps / 100).toFixed(2)} %` : "—"}
          sub={`miner ${p.config?.miner_pct ?? "?"} · charity ${p.config?.humanitarian_pct ?? "?"} %`}
        />
      </div>

      {/* ── Pearl upstream leg (Nockchain merge path) ── */}
      <div className="rounded-2xl border border-[#34d399]/15 bg-gradient-to-br from-[#34d399]/[0.05] to-white/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <h3 className="text-sm font-bold text-white">Pearl upstream leg → LuckyPool</h3>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                up.connected
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                  : "border-rose-400/40 bg-rose-400/10 text-rose-300"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${up.connected ? "bg-emerald-400" : "bg-rose-400"}`} />
              {up.connected ? "connected" : "disconnected"}
            </span>
            <span className="text-[10px] text-white/35">
              job {up.job_id ? up.job_id.slice(0, 18) : "—"} · age {up.job_age_ms ? `${Math.round(up.job_age_ms / 1000)}s` : "—"}
            </span>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Submits" value={fmtNum(up.submits)} sub="to upstream pool" />
          <Kpi label="Accepted" value={fmtNum(up.accepted)} tone="text-emerald-300" sub="accepted upstream" />
          <Kpi label="Rejected" value={fmtNum(up.rejected)} tone={up.rejected ? "text-rose-300" : undefined} sub="rejected upstream" />
          <Kpi label="Stale dropped" value={fmtNum(up.stale_dropped)} tone={up.stale_dropped ? "text-amber-300" : undefined} sub="job expired" />
        </div>
        <div className="px-4 pb-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-white/35">
            <span>Upstream accept rate</span>
            <span className={upRate !== null && upRate < 95 ? "text-amber-300" : "text-emerald-300"}>
              {upRate !== null ? `${upRate.toFixed(1)} %` : "—"}
            </span>
          </div>
          <Bar pct={upRate ?? 0} tone="bg-gradient-to-r from-[#34d399] to-emerald-400" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Kpi label="Served upstream jobs" value={fmtNum(p.pearl?.served_upstream)} sub="prlu: jobs sent to miners" />
            <Kpi label="Served native jobs" value={fmtNum(p.pearl?.served_native)} sub="local PRL leg" />
            <Kpi label="Pending submits" value={fmtNum(up.pending_submits)} sub="in flight" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── routing by group ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <h3 className="text-sm font-bold text-white">Share routing by group</h3>
          </div>
          {!groups.length ? (
            <div className="p-6 text-center text-xs text-white/40">No routing data.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    <th className="px-4 py-2">Group</th>
                    <th className="px-3 py-2 text-right">Submits</th>
                    <th className="px-3 py-2 text-right">Accepted</th>
                    <th className="px-3 py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.group} className="border-b border-white/[0.03] text-xs">
                      <td className="px-4 py-2 font-semibold" style={{ color: POOL_COIN[g.group] || "#c9d1d9" }}>
                        {g.group}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white/70">{fmtNum(g.submits)}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-300/90">{fmtNum(g.accepted)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono text-white/50">{g.pct?.toFixed(1) ?? "—"}%</span>
                          <div className="w-14">
                            <Bar pct={g.pct ?? 0} tone="bg-white/40" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── sources ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <h3 className="text-sm font-bold text-white">Top sources by submits</h3>
          </div>
          {!topSources.length ? (
            <div className="p-6 text-center text-xs text-white/40">No source data.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    <th className="px-4 py-2">Source</th>
                    <th className="px-3 py-2 text-right">Submits</th>
                    <th className="px-3 py-2 text-right">Accepted</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {topSources.map((s) => (
                    <tr key={s.source} className="border-b border-white/[0.03] text-xs">
                      <td className="max-w-[220px] truncate px-4 py-2 font-mono text-white/75" title={s.source}>
                        {s.source}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white/70">{fmtNum(s.submits)}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-300/90">{fmtNum(s.accepted)}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          s.accept_rate_pct < 95 ? "text-amber-300" : "text-white/60"
                        }`}
                      >
                        {s.accept_rate_pct?.toFixed(1) ?? "—"}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── auxpow legs ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <h3 className="text-sm font-bold text-white">AuxPoW legs</h3>
          <span className="text-[10px] text-white/35">{(p.coins || []).length} coins · job freshness</span>
        </div>
        {!p.coins?.length ? (
          <div className="p-6 text-center text-xs text-white/40">No auxpow legs reported.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {p.coins.map((c) => {
              const color = POOL_COIN[c.ticker?.toLowerCase() || ""] || "#79c0ff";
              return (
                <div key={c.ticker} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold" style={{ color }}>
                      {c.ticker}
                    </span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${c.job_fresh ? "bg-emerald-400" : "bg-amber-400"}`}
                      title={c.job_fresh ? "job fresh" : "job stale"}
                    />
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-white/40" title={c.algorithm}>
                    {c.algorithm || "—"}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-white/25" title={c.upstream}>
                    {c.upstream || "—"}
                  </div>
                  <div className="mt-1 text-[10px] text-white/30">
                    job age {c.job_age_ms ? `${Math.round(c.job_age_ms / 1000)}s` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── pplns window ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">PPLNS window</h3>
          <span className="text-[10px] text-white/35">
            {fmtNum(ppl.window_used)} / {fmtNum(ppl.window_size)} entries
            {ppl.window_total_difficulty ? ` · diff ${ppl.window_total_difficulty}` : ""}
          </span>
        </div>
        <Bar pct={winPct ?? 0} tone="bg-gradient-to-r from-[#7dd3fc] to-[#a371f7]" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Registered miners" value={fmtNum(ppl.registered_miners)} />
          <Kpi label="With unpaid balance" value={fmtNum(ppl.miners_with_unpaid)} />
          <Kpi label="Payout rounds" value={fmtNum(ppl.payout_rounds)} />
          <Kpi label="Shares accepted" value={fmtNum(p.shares?.accepted)} sub={`${fmtNum(p.shares?.rejected)} rejected`} />
        </div>
      </div>

      {/* ── top pool miners ── */}
      {miners && miners.length > 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
            <h3 className="text-sm font-bold text-white">Pool miners by hashrate</h3>
            <span className="text-[10px] text-white/35">
              {miners.length} workers · valid / invalid shares per stream
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  <th className="px-4 py-2">Worker</th>
                  <th className="px-3 py-2 text-right">Hashrate</th>
                  <th className="px-3 py-2 text-right">1 h</th>
                  <th className="px-3 py-2 text-right">Streams (valid/invalid)</th>
                  <th className="px-3 py-2 text-right">Blocks</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {miners
                  .slice()
                  .sort((a, b) => (b.hps || 0) - (a.hps || 0))
                  .slice(0, 12)
                  .map((m) => (
                    <tr key={m.worker} className="border-b border-white/[0.03] text-xs">
                      <td className="max-w-[260px] truncate px-4 py-2 font-mono text-white/75" title={m.worker}>
                        {m.worker || "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white/70">
                        {m.hps ? `${(m.hps / 1e12).toFixed(2)} TH/s` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white/45">
                        {m.hps_1h ? `${(m.hps_1h / 1e12).toFixed(2)} TH/s` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {Object.keys(m.streams || {}).length === 0 ? (
                          <span className="text-white/25">—</span>
                        ) : (
                          Object.entries(m.streams).map(([coin, s]) => (
                            <span key={coin} className="mr-2">
                              <span style={{ color: POOL_COIN[coin.toLowerCase()] || "#c9d1d9" }}>{coin}</span>
                              <span className="text-emerald-300/90"> {s.v}</span>
                              <span className="text-rose-300/70">/{s.i}</span>
                            </span>
                          ))
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white/60">{fmtNum(m.blocks)}</td>
                      <td className="px-4 py-2 text-right font-mono text-white/50">
                        {m.paid ? `${(m.paid / 1e6).toFixed(3)} ZION` : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const [lang, setLang] = useState<"cs" | "en">("en");
  const [snap, setSnap] = useState<Snap | null>(null);
  const [err, setErr] = useState("");
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [aiErr, setAiErr] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [inferenceModel, setInferenceModel] = useState("Qwen/Qwen2.5-Coder-3B-Instruct");
  const [inferenceMemory, setInferenceMemory] = useState("0.6");
  const [catalog, setCatalog] = useState<CatEntry[]>([]);
  const [hfQ, setHfQ] = useState("");
  const [hfRes, setHfRes] = useState<HfResult[] | null>(null);
  const hfSearch = async () => {
    const q = hfQ.trim();
    if (!q) return;
    setBusy("hf:search");
    setHfRes(null);
    try {
      const res = await fetch(`/vast-ops/api/inference/hf-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setHfRes(Array.isArray(data) ? data : []);
    } catch {
      setHfRes([]);
    } finally {
      setBusy("");
    }
  };

  const loadAiStatus = useCallback(async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/vast-ops/api/ai/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setAi(data as AiStatus);
      setAiErr("");
    } catch (e) {
      setAiErr(String(e));
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/vast-rigs/status.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j: Snap) => !stop && (setSnap(j), setErr("")))
        .catch((e) => !stop && setErr(String(e)));
    load();
    const t = setInterval(load, 10000);
    fetch("/vast-ops/api/inference/catalog")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCatalog(d))
      .catch(() => {});
    loadAiStatus();
    const aiTimer = setInterval(loadAiStatus, 10000);
    return () => ((stop = true), clearInterval(t), clearInterval(aiTimer));
  }, [loadAiStatus]);

  const rigs = snap?.rigs || [];
  const feedAge = snapAgeS(snap?.ts);
  const feedStale = feedAge !== null && feedAge > 120;

  // ── market ──
  type Offer = {
    id: number; gpu_name: string; dph_total: number; geolocation: string;
    inet_down: number; inet_up: number; reliability: number;
    cuda_max_good: number | string; cpu_ram: number; disk_space: number;
  };
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [offerError, setOfferError] = useState("");
  const [mGpu, setMGpu] = useState("RTX_3060");
  const [mDph, setMDph] = useState("");
  const loadOffers = async (gpuOverride?: string) => {
    setBusy("offers");
    setOfferError("");
    setOffers(null);
    const query = new URLSearchParams({ gpu: gpuOverride ?? mGpu });
    if (mDph.trim()) query.set("max_dph", mDph.trim());
    try {
      const response = await fetch(`/vast-ops/api/offers?${query.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setOffers(Array.isArray(data) ? data : []);
    } catch (e) {
      setOfferError(String(e));
    } finally {
      setBusy("");
    }
  };

  // ── ops calls → /vast-ops/api/* (same realm → browser sends basic auth) ──
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const show = (ok: boolean, text: string) => {
    setToast({ ok, text: text.trim().slice(0, 900) || "(no output)" });
    setTimeout(() => setToast(null), 9000);
  };
  const [logs, setLogs] = useState<Record<number, string>>({});
  const [logsOpen, setLogsOpen] = useState<Record<number, string>>({});
  const [smosLog, setSmosLog] = useState<Record<number, string>>({});
  const [smosLogOpen, setSmosLogOpen] = useState<Record<number, boolean>>({});
  const toggleSmosLog = (id: number) => {
    const opening = !smosLogOpen[id];
    setSmosLogOpen({ ...smosLogOpen, [id]: opening });
    if (!opening) return;
    setSmosLog({ ...smosLog, [id]: "loading console…" });
    fetch(`/vast-ops/api/smos/console?id=${id}`)
      .then((r) => r.text())
      .then((t) => setSmosLog((p) => ({ ...p, [id]: t })))
      .catch((e) => setSmosLog((p) => ({ ...p, [id]: String(e) })));
  };
  const [chatAns, setChatAns] = useState<Record<number, string>>({});
  const [routerAns, setRouterAns] = useState("");
  const [routerModel, setRouterModel] = useState("");
  const routerChat = async () => {
    const inp = document.getElementById("router-chat") as HTMLInputElement;
    const prompt = (inp?.value || "").trim();
    if (!prompt) return;
    setBusy("router:chat");
    setRouterAns("…");
    try {
      const q = new URLSearchParams({ prompt });
      if (routerModel) q.set("model", routerModel);
      const res = await fetch(`/vast-ops/api/inference/auto-chat?${q}`, { method: "POST" });
      const text = await res.text();
      setRouterAns(text || "(empty reply)");
    } catch (e) {
      setRouterAns(`error: ${e}`);
    } finally {
      setBusy("");
    }
  };
  const autoDeploy = async (modelArg?: string) => {
    const model = (modelArg || inferenceModel).trim();
    if (!model) return;
    if (!confirm(
      `Auto-deploy ${model}?\n\nThe backend picks the rig with the most free ` +
      `VRAM and starts vLLM there (up to ${Math.round(Number(inferenceMemory) * 100)}% ` +
      `of GPU memory). It can reduce mining performance.`,
    )) return;
    setBusy("router:autodeploy");
    try {
      const q = new URLSearchParams({
        confirm: "1", model, gpu_memory_utilization: inferenceMemory, image: VLLM_IMAGE,
      });
      const res = await fetch(`/vast-ops/api/inference/auto-deploy?${q}`, { method: "POST" });
      const text = await res.text();
      show(res.ok, text);
    } catch (e) {
      show(false, String(e));
    } finally {
      setBusy("");
    }
  };
  const [hiranAns, setHiranAns] = useState("");
  const hiranChat = async () => {
    const inp = document.getElementById("hiran-chat") as HTMLInputElement;
    const prompt = (inp?.value || "").trim();
    if (!prompt) return;
    setBusy("hiran:chat");
    setHiranAns("…");
    try {
      const res = await fetch(`/vast-ops/api/inference/hiran-chat?prompt=${encodeURIComponent(prompt)}`, { method: "POST" });
      const text = await res.text();
      setHiranAns(text || "(empty reply)");
    } catch (e) {
      setHiranAns(`error: ${e}`);
    } finally {
      setBusy("");
    }
  };
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [tab, setTab] = useState<"mining" | "ai" | "market" | "pool">("mining");
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h === "ai" || h === "market" || h === "mining" || h === "pool") setTab(h);
  }, []);
  const goTab = (t: "mining" | "ai" | "market" | "pool") => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };
  // auto-load offers on first market tab open
  useEffect(() => {
    if (tab === "market" && offers === null && !offerError && busy !== "offers")
      loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const autoSearch = () => {
    setMGpu("any");
    loadOffers("any");
  };
  const loadLogs = (id: number, src: string) => {
    setLogs({ ...logs, [id]: `loading ${src} logs…` });
    fetch(`/vast-ops/api/logs?id=${id}&src=${src}`)
      .then((r) => r.text())
      .then((t) => setLogs({ ...logs, [id]: t }))
      .catch((e) => setLogs({ ...logs, [id]: String(e) }));
  };
  const toggleLogs = (id: number, src = "all") => {
    const cur = logsOpen[id];
    if (cur === src) {
      setLogsOpen({ ...logsOpen, [id]: "" });
      return;
    }
    setLogsOpen({ ...logsOpen, [id]: src });
    loadLogs(id, src);
  };
  const ops = async (path: string, method = "GET") => {
    setBusy(path);
    try {
      const r = await fetch(`/vast-ops/api/${path}`, { method });
      show(r.ok, await r.text());
    } catch (e) {
      show(false, String(e));
    } finally {
      setBusy("");
    }
  };
  const inferenceAction = async (
    action: "deploy" | "status" | "stop" | "tunnel",
    rig: AiRig,
  ) => {
    if (action === "deploy" && !confirm(
      `Deploy ${inferenceModel} on Vast rig #${rig.id}?\n\n` +
      `This starts vLLM (${VLLM_IMAGE}) and uses up to ${Math.round(Number(inferenceMemory) * 100)}% ` +
      `of GPU memory. It can reduce mining performance. No new instance will be rented.`,
    )) return;
    if (action === "stop" && !confirm(
      `Stop the hiran-vllm container on rig #${rig.id}?`,
    )) return;

    const key = `inference:${rig.id}:${action}`;
    const query = new URLSearchParams({ id: String(rig.id) });
    if (action === "deploy") {
      query.set("confirm", "1");
      query.set("model", inferenceModel.trim());
      query.set("gpu_memory_utilization", inferenceMemory);
      query.set("image", VLLM_IMAGE);
    }
    if (action === "stop") query.set("confirm", "1");
    setBusy(key);
    try {
      const response = await fetch(`/vast-ops/api/inference/${action}?${query.toString()}`, {
        method: "POST",
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
      if (action === "tunnel") {
        const [command, baseUrl] = text.split("\n");
        try {
          await navigator.clipboard.writeText(command);
          show(true, `SSH tunnel command copied. Configure Hiran with ${baseUrl}`);
        } catch {
          show(true, text);
        }
      } else {
        show(true, text);
        if (action === "deploy" || action === "stop") await loadAiStatus();
      }
    } catch (e) {
      show(false, String(e));
    } finally {
      setBusy("");
    }
  };

  const totals: Record<string, { v: number; unit: string; a: number; c: string }> = {};
  for (const r of rigs)
    for (const m of r.miners) {
      if (!m.hashrate) continue;
      const coin = coinOf(m);
      const t = (totals[coin.name] ||= { v: 0, unit: m.hashrate.unit, a: 0, c: coin.c });
      t.v += m.hashrate.rate;
      t.a += m.hashrate.a;
    }

  return (
    <PageLayout lang={lang} setLang={setLang}>
      {/* Hero */}
      <section className="relative flex w-full flex-col items-center justify-center gap-4 px-4 pb-8 pt-24 text-center sm:pb-10">
        <span className="rounded-full border border-[#fcd116]/30 bg-black/40 px-4 py-1 text-xs font-semibold tracking-[0.14em] text-[#fcd116] backdrop-blur-sm sm:text-sm">
          ZION OPS · VAST.AI
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-6xl">
          Multi-Mining Rigs
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">
          Live fleet overview, AI inference capacity, and instance management.
        </p>
        <div className="flex w-full max-w-4xl flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/75 sm:px-4 sm:text-sm">
            <b className="text-white">{rigs.length}</b> active rigs
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/75 sm:px-4 sm:text-sm">
            {snap ? snap.total_dph.toFixed(4) : "—"}/h
            <span className="text-white/35">·</span>
            {snap ? (snap.total_dph * 24).toFixed(2) : "—"}/day
          </span>
          {Object.entries(totals).map(([name, t]) => (
            <span
              key={name}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold sm:px-4 sm:text-sm"
              style={{ borderColor: `${t.c}66`, background: `${t.c}14`, color: t.c }}
            >
              {name} {t.v >= 1000 ? t.v.toFixed(0) : t.v.toFixed(1)} {t.unit}
              <span className="text-white/40 font-normal">· A{t.a}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-white/40">
          Updated{" "}
          <span title={snap?.ts ?? undefined} className={feedStale ? "font-semibold text-amber-300" : undefined}>
            {snap ? fmtAge(feedAge) : "—"}
          </span>
          {feedStale && <span className="ml-1 text-amber-300">· feed stale</span>}
          {" · refreshes every 10 seconds"}
          {err && <span className="ml-2 text-[#ff7b72]">· {err}</span>}
        </p>
      </section>

      {/* ── section tabs ── */}
      <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-1.5 px-2 pb-5 sm:px-4" aria-label="Dashboard sections">
        {([
          ["mining", `Mining rigs · ${rigs.length}`],
          ["ai", `AI inference · ${ai ? `${ai.totals.inference_rigs}/${ai.rigs.length} online` : "…"}`],
          ["market", "GPU market"],
          ["pool", `SMOS / Pool${snap?.smos ? ` · ${snap.smos.filter((r) => r.online).length}/${snap.smos.length}` : ""}`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => goTab(id)}
            className={`min-h-10 rounded-full border px-4 text-xs font-semibold tracking-wide transition sm:px-5 sm:text-sm ${
              tab === id
                ? "border-[#fcd116]/60 bg-[#fcd116]/15 text-[#fcd116]"
                : "border-white/10 bg-black/30 text-white/55 hover:border-white/25 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="vast-dashboard-shell w-full min-w-0 px-2 pb-10 sm:px-4 lg:px-6">
        {tab === "ai" && (
        <section className="mx-auto w-full max-w-7xl pb-6">
          <div className="rounded-2xl border border-[#a371f7]/25 bg-gradient-to-br from-[#a371f7]/[0.08] to-white/[0.02] p-4 shadow-xl shadow-black/10 backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#a371f7]/30 bg-[#a371f7]/10 text-lg text-[#d2a8ff]" aria-hidden="true">
                    ✦
                  </span>
                  <h2 className="text-lg font-bold text-white sm:text-xl">AI inference workers</h2>
                  <span className="rounded-full border border-[#a371f7]/25 bg-[#a371f7]/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#d2a8ff]/70">
                    vLLM · SSH only
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/50 sm:text-sm">
                  Deploy Hiran-compatible inference on an existing running rig. No automatic rental.
                </p>
              </div>
              <button
                onClick={loadAiStatus}
                disabled={aiLoading}
                className="min-h-10 rounded-lg border border-[#a371f7]/40 bg-[#a371f7]/10 px-3 py-2 text-xs font-semibold text-[#d2a8ff] transition hover:bg-[#a371f7]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2a8ff] disabled:cursor-wait disabled:opacity-50"
              >
                {aiLoading ? "Checking…" : "Refresh status"}
              </button>
            </div>

            {aiErr ? (
              <div role="alert" className="mt-4 rounded-xl border border-[#ff7b72]/25 bg-[#ff7b72]/[0.06] p-4">
                <p className="text-sm font-semibold text-[#ff9b93]">AI status unavailable</p>
                <p className="mt-1 break-words text-xs text-white/55">{aiErr}</p>
              </div>
            ) : ai ? (
              <>
                {(() => {
                  const freeGiB = ai.rigs.filter((r) => !r.error).flatMap((r) =>
                    r.gpus.map((g) => g.memory_free_mib / 1024));
                  const bestFree = freeGiB.length ? Math.max(...freeGiB) : 0;
                  const internal = catalog.filter((m) => m.internal);
                  const pub = catalog.filter((m) => !m.internal);
                  const eps = [
                    ...ai.rigs.filter((r) => r.inference_reachable).flatMap((r) =>
                      r.models.map((m) => ({ model: m, where: `rig #${r.id}` }))),
                    ...(ai.hiran?.reachable ? (ai.hiran.models || []).map((m) => ({ model: m, where: "hiran" })) : []),
                  ];
                  const row = (m: CatEntry) => {
                    const fits = m.vram_gb <= bestFree;
                    const sel = inferenceModel === m.hf;
                    return (
                      <tr
                        key={m.hf}
                        onClick={() => setInferenceModel(m.hf)}
                        className={`cursor-pointer border-t border-white/[0.05] transition ${
                          sel
                            ? "bg-[#a371f7]/15"
                            : m.internal ? "bg-[#fcd116]/[0.03] hover:bg-[#fcd116]/[0.07]" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`truncate font-mono text-xs font-semibold ${m.internal ? "text-[#fcd116]" : "text-white"}`}>
                              {m.hf.split("/").pop()}
                            </span>
                            {m.internal && <span className="shrink-0 rounded-full border border-[#fcd116]/40 bg-[#fcd116]/10 px-1.5 py-px text-[8px] font-semibold text-[#fcd116]">ZION</span>}
                            {m.tags.includes("live") && <span className="shrink-0 rounded-full border border-[#34d399]/50 bg-[#34d399]/10 px-1.5 py-px text-[8px] font-semibold text-[#6ee7b7]">live</span>}
                            {m.mockup && <span className="shrink-0 text-[8px] italic text-white/35">planned</span>}
                          </div>
                          <div className="truncate text-[10px] text-white/35">{m.hf.split("/")[0]} · {m.desc}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-[10px] font-medium text-white/55">{m.params}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className={`rounded-full border px-1.5 py-px text-[9px] font-semibold ${
                            fits ? "border-[#34d399]/40 text-[#6ee7b7]" : "border-[#ff7b72]/40 text-[#ff9b93]"
                          }`}>
                            {m.vram_gb} GB {fits ? "fits" : "tight"}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-lg:hidden">
                          <div className="flex flex-wrap gap-1">
                            {m.tags.filter((t) => t !== "live").map((t) => (
                              <span key={t} className="rounded-full bg-white/[0.06] px-1.5 py-px text-[9px] text-white/45">{t}</span>
                            ))}
                            {m.gated && <span className="rounded-full border border-[#fcd116]/30 px-1.5 py-px text-[9px] text-[#fcd116]">gated</span>}
                            {m.latest_vllm && <span className="rounded-full border border-[#79c0ff]/30 px-1.5 py-px text-[9px] text-[#79c0ff]" title="auto-deploy uses vllm-openai:latest">new vLLM</span>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {m.internal ? (
                            <span className="text-[9px] italic text-white/30">llama.cpp</span>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); autoDeploy(m.hf); }}
                                disabled={!!busy}
                                className="min-h-7 rounded-md border border-[#34d399]/35 bg-[#34d399]/10 px-2.5 text-[10px] font-semibold text-[#6ee7b7] transition hover:bg-[#34d399]/20 disabled:opacity-40"
                              >
                                ▸ deploy
                              </button>
                              {" "}
                              <a
                                href={`https://huggingface.co/${m.hf}`}
                                target="_blank" rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-white/35 transition hover:text-white/70"
                              >HF↗</a>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  };
                  return (
                    <>
                      {/* ── Deploy panel ── */}
                      <div className="mt-5 overflow-hidden rounded-xl border border-[#a371f7]/20 bg-black/20">
                        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
                          <h3 className="text-sm font-semibold text-white">Model catalog</h3>
                          <span className="text-[10px] text-white/35">
                            {catalog.length} models · best rig {bestFree.toFixed(1)} GiB free
                          </span>
                          <div className="ml-auto flex items-center gap-1.5">
                            <label className="flex items-center gap-1 text-[10px] text-white/40">
                              VRAM
                              <select
                                value={inferenceMemory}
                                onChange={(e) => setInferenceMemory(e.target.value)}
                                className="min-h-7 rounded-md border border-white/15 bg-black/40 px-1.5 text-[10px] text-white focus:border-[#a371f7]/50 focus:outline-none"
                              >
                                <option value="0.4">40%</option>
                                <option value="0.6">60%</option>
                                <option value="0.75">75%</option>
                              </select>
                            </label>
                            <button
                              onClick={() => autoDeploy()}
                              disabled={!!busy || !inferenceModel.trim()}
                              title={inferenceModel}
                              className="min-h-8 rounded-lg border border-[#34d399]/40 bg-[#34d399]/10 px-3 text-xs font-semibold text-[#6ee7b7] transition hover:bg-[#34d399]/20 disabled:cursor-wait disabled:opacity-40"
                            >
                              {busy === "router:autodeploy" ? "Deploying…" : "⚡ Deploy selected"}
                            </button>
                          </div>
                        </div>
                        <div className="p-3 sm:p-4">
                          <div className="flex gap-1.5">
                            <input
                              value={inferenceModel}
                              onChange={(e) => setInferenceModel(e.target.value)}
                              maxLength={200}
                              spellCheck={false}
                              placeholder="HF model id — pick a card or type custom…"
                              className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 font-mono text-xs text-white placeholder-white/25 focus:border-[#a371f7]/50 focus:outline-none"
                            />
                            <input
                              value={hfQ}
                              onChange={(e) => setHfQ(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); hfSearch(); } }}
                              placeholder="Search HuggingFace…"
                              className="min-h-9 w-44 min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 text-xs text-white placeholder-white/25 focus:border-[#a371f7]/50 focus:outline-none max-sm:w-32"
                            />
                            <button
                              onClick={hfSearch}
                              disabled={!!busy || !hfQ.trim()}
                              className="min-h-9 shrink-0 rounded-lg border border-white/20 bg-white/[0.04] px-3 text-xs font-semibold text-white/70 transition hover:border-white/35 hover:text-white disabled:opacity-40"
                            >
                              {busy === "hf:search" ? "…" : "Search"}
                            </button>
                          </div>
                          {hfRes !== null && (
                            <div className="mt-2 max-h-52 overflow-auto rounded-lg border border-white/10 bg-black/30">
                              {hfRes.length === 0 && <div className="p-3 text-[11px] text-white/40">no results</div>}
                              {hfRes.map((m) => (
                                <button
                                  key={m.hf}
                                  onClick={() => { setInferenceModel(m.hf); setHfRes(null); }}
                                  className="flex w-full items-center gap-2 border-b border-white/[0.04] px-3 py-2 text-left text-xs transition last:border-0 hover:bg-white/[0.04]"
                                >
                                  <span className="min-w-0 flex-1 truncate font-mono text-white/80">{m.hf}</span>
                                  {m.gated && <span className="shrink-0 rounded-full border border-[#fcd116]/30 px-1.5 text-[9px] text-[#fcd116]">gated</span>}
                                  <span className="shrink-0 text-[9px] text-white/30">♥{m.likes} ↓{(m.downloads / 1000).toFixed(0)}k</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 -mx-1 overflow-x-auto">
                            <table className="w-full min-w-[680px] text-left">
                              <tbody>
                                <tr className="border-y border-[#fcd116]/15 bg-[#fcd116]/[0.04]">
                                  <td colSpan={5} className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#fcd116]/80">
                                    Hiran · own GGUF · llama.cpp
                                  </td>
                                </tr>
                                {internal.map(row)}
                                <tr className="border-y border-white/[0.08] bg-white/[0.02]">
                                  <td colSpan={5} className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/45">
                                    Public · vLLM · HF weights on deploy
                                  </td>
                                </tr>
                                {pub.map(row)}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* ── Chat panel ── */}
                      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
                          <h3 className="text-sm font-semibold text-white">Chat</h3>
                          <span className="text-[10px] text-white/35">{eps.length} endpoint{eps.length === 1 ? "" : "s"} online</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${
                            ai.hiran?.reachable
                              ? "border-[#34d399]/40 bg-[#34d399]/10 text-[#6ee7b7]"
                              : "border-white/15 bg-black/30 text-white/40"
                          }`}>
                            hiran {ai.hiran ? (ai.hiran.reachable ? "●" : "○ off") : "…"}
                          </span>
                          <span className="ml-auto text-[9px] text-white/30">routed via model · vLLM rig → SSH · hiran → :8003</span>
                        </div>
                        <div className="p-3 sm:p-4">
                          {eps.length > 0 ? (
                            <div className="mb-2.5 flex flex-wrap gap-1.5">
                              {eps.map((e, i) => (
                                <button
                                  key={`${e.model}-${i}`}
                                  onClick={() => setRouterModel(e.model)}
                                  title={`${e.model} @ ${e.where}`}
                                  className={`max-w-full truncate rounded-full border px-2.5 py-1 font-mono text-[10px] transition ${
                                    routerModel === e.model
                                      ? "border-[#a371f7]/60 bg-[#a371f7]/20 text-[#d8b4fe]"
                                      : "border-white/10 bg-black/30 text-white/55 hover:border-white/25 hover:text-white/85"
                                  }`}
                                >
                                  {e.model.split("/").pop()} <span className="opacity-50">@{e.where}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="mb-2.5 text-[11px] text-white/40">
                              Nothing loaded — deploy a model above, or bring the SMOS rig online for hiran.
                            </p>
                          )}
                          <div className="flex gap-1.5">
                            <select
                              value={routerModel}
                              onChange={(e) => setRouterModel(e.target.value)}
                              className="min-h-9 w-40 min-w-0 shrink-0 rounded-lg border border-white/15 bg-black/40 px-2 text-xs text-white focus:border-[#a371f7]/50 focus:outline-none max-sm:w-28"
                            >
                              <option value="">auto</option>
                              {Array.from(new Set(eps.map((e) => e.model))).map((m) => (
                                <option key={m} value={m}>{m.split("/").pop()}</option>
                              ))}
                            </select>
                            <input
                              id="router-chat"
                              placeholder={eps.length ? "Ask any loaded model…" : "Nothing online to ask"}
                              disabled={!eps.length}
                              className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 text-xs text-white placeholder-white/25 focus:border-[#a371f7]/50 focus:outline-none disabled:opacity-40"
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); routerChat(); } }}
                            />
                            <button
                              disabled={!!busy || !eps.length}
                              onClick={routerChat}
                              className="min-h-9 shrink-0 rounded-lg border border-[#a371f7]/40 bg-[#a371f7]/10 px-4 text-xs font-semibold text-[#d2a8ff] transition hover:bg-[#a371f7]/20 disabled:cursor-wait disabled:opacity-40"
                            >
                              {busy === "router:chat" ? "…" : "Ask"}
                            </button>
                          </div>
                          {routerAns !== "" && (
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#a371f7]/15 bg-black/40 p-3 text-[11px] leading-relaxed text-[#d2a8ff]">
                              {routerAns}
                            </pre>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
                  {[
                    ["GPUs", ai.totals.gpu_count],
                    ["VRAM total", `${(ai.totals.memory_total_mib / 1024).toFixed(1)} GiB`],
                    ["VRAM used (sum)", `${(ai.totals.memory_used_mib / 1024).toFixed(1)} GiB`],
                    ["VRAM free (sum)", `${(ai.totals.memory_free_mib / 1024).toFixed(1)} GiB`],
                    ["GPU load (avg)", ai.totals.gpu_utilization_pct === null ? "—" : `${ai.totals.gpu_utilization_pct}%`],
                    ["Inference APIs", `${ai.totals.inference_rigs}/${ai.rigs.length}`],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
                      <div className="min-h-8 text-[10px] leading-snug text-white/45 sm:text-xs">{label}</div>
                      <div className="mt-1 break-words text-base font-semibold text-white sm:text-lg">{value}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 rounded-xl border border-[#fcd116]/20 bg-[#fcd116]/[0.05] p-3 text-xs leading-relaxed text-white/65 sm:p-4">
                  <b className="mr-1 text-[#fcd116]">Capacity note</b>
                  {ai.note} Free VRAM does not mean free GPU compute; mining and inference still compete for GPU time.
                </p>
                <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
                  {ai.rigs.map((rig) => (
                      <div key={rig.id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <b className="truncate text-sm text-white">Rig #{rig.id} · {rig.gpu_name}</b>
                        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:text-xs ${
                          rig.inference_reachable
                            ? "border-[#34d399]/25 bg-[#34d399]/[0.07] text-[#6ee7b7]"
                            : "border-white/10 bg-white/[0.03] text-white/45"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${rig.inference_reachable ? "bg-[#34d399]" : "bg-white/30"}`} />
                          {rig.inference_reachable ? "API online" : `API offline · :${ai.ai_api_port}`}
                        </span>
                      </div>
                      {rig.gpus.map((gpu, index) => (
                        <div key={`${rig.id}-${index}`} className="mt-3 min-w-0">
                          <div className="truncate text-xs font-medium text-white/75">{gpu.name}</div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-white/45 sm:text-xs">
                            <span>VRAM free</span>
                            <span className="shrink-0 font-medium text-white/75">
                              {(gpu.memory_free_mib / 1024).toFixed(1)} / {(gpu.memory_total_mib / 1024).toFixed(1)} GiB
                            </span>
                          </div>
                          <div
                            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
                            role="progressbar"
                            aria-label={`${gpu.name} VRAM usage`}
                            aria-valuemin={0}
                            aria-valuemax={gpu.memory_total_mib}
                            aria-valuenow={gpu.memory_used_mib}
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#a371f7] to-[#d2a8ff]"
                              style={{ width: `${Math.min(100, Math.max(0, (gpu.memory_used_mib / Math.max(1, gpu.memory_total_mib)) * 100))}%` }}
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/45 sm:text-xs">
                            <span>{gpu.utilization_pct}% GPU</span>
                            <span>{gpu.temperature_c}°C</span>
                            <span>{gpu.power_w === null ? "—" : `${gpu.power_w.toFixed(0)} W`}</span>
                          </div>
                        </div>
                      ))}
                      {rig.inference_reachable && rig.models.length > 0 && (
                        <div className="mt-3 border-t border-white/[0.06] pt-2 text-xs">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Models</div>
                          <div className="mt-1 break-all leading-relaxed text-[#d2a8ff]">
                            {rig.models.join(", ")}
                          </div>
                        </div>
                      )}
                      {rig.error && <div className="mt-2 break-words text-xs text-[#ff7b72]">{rig.error}</div>}
                      <div className="mt-3 flex gap-1.5 border-t border-white/[0.06] pt-3">
                        <input
                          id={`aichat-${rig.id}`}
                          placeholder={rig.inference_reachable ? "Ask the model…" : "Deploy a worker first"}
                          disabled={!rig.inference_reachable}
                          className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 text-xs text-white placeholder-white/25 focus:border-[#a371f7]/50 focus:outline-none disabled:opacity-40"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (document.getElementById(`aichat-btn-${rig.id}`) as HTMLButtonElement)?.click(); } }}
                        />
                        <button
                          id={`aichat-btn-${rig.id}`}
                          disabled={!!busy || !rig.inference_reachable}
                          onClick={async () => {
                            const inp = document.getElementById(`aichat-${rig.id}`) as HTMLInputElement;
                            const prompt = (inp?.value || "").trim();
                            if (!prompt) return;
                            const key = `inference:${rig.id}:chat`;
                            setBusy(key);
                            setChatAns((p) => ({ ...p, [rig.id]: "…" }));
                            try {
                              const res = await fetch(`/vast-ops/api/inference/chat?id=${rig.id}&prompt=${encodeURIComponent(prompt)}`, { method: "POST" });
                              const text = await res.text();
                              setChatAns((p) => ({ ...p, [rig.id]: text || "(empty reply)" }));
                            } catch (e) {
                              setChatAns((p) => ({ ...p, [rig.id]: `error: ${e}` }));
                            } finally {
                              setBusy("");
                            }
                          }}
                          className="min-h-9 shrink-0 rounded-lg border border-[#a371f7]/35 bg-[#a371f7]/10 px-3 text-xs font-semibold text-[#d2a8ff] transition hover:bg-[#a371f7]/20 disabled:cursor-wait disabled:opacity-40"
                        >
                          {busy === `inference:${rig.id}:chat` ? "…" : "Ask"}
                        </button>
                      </div>
                      {chatAns[rig.id] !== undefined && (
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#a371f7]/15 bg-black/40 p-3 text-[11px] leading-relaxed text-[#d2a8ff]">
                          {chatAns[rig.id]}
                        </pre>
                      )}
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
                        <button
                          onClick={() => inferenceAction("deploy", rig)}
                          disabled={!!busy || !inferenceModel.trim()}
                          className="min-h-10 rounded-lg border border-[#a371f7]/35 bg-[#a371f7]/10 px-2 py-2 text-xs font-semibold text-[#d2a8ff] transition hover:bg-[#a371f7]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2a8ff] disabled:cursor-wait disabled:opacity-40"
                        >
                          {busy === `inference:${rig.id}:deploy` ? "Starting…" : "Deploy worker"}
                        </button>
                        <button
                          onClick={() => inferenceAction("status", rig)}
                          disabled={!!busy}
                          className="min-h-10 rounded-lg border border-white/15 bg-white/[0.03] px-2 py-2 text-xs font-semibold text-white/65 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-wait disabled:opacity-40"
                        >
                          {busy === `inference:${rig.id}:status` ? "Checking…" : "Check worker"}
                        </button>
                        <button
                          onClick={() => inferenceAction("tunnel", rig)}
                          disabled={!!busy}
                          className="min-h-10 rounded-lg border border-[#34d399]/20 bg-[#34d399]/[0.04] px-2 py-2 text-xs font-semibold text-[#6ee7b7] transition hover:bg-[#34d399]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6ee7b7] disabled:cursor-wait disabled:opacity-40"
                        >
                          {busy === `inference:${rig.id}:tunnel` ? "Preparing…" : "Copy SSH tunnel"}
                        </button>
                        <button
                          onClick={() => inferenceAction("stop", rig)}
                          disabled={!!busy}
                          className="min-h-10 rounded-lg border border-[#ff7b72]/20 bg-[#ff7b72]/[0.04] px-2 py-2 text-xs font-semibold text-[#ff9b93] transition hover:bg-[#ff7b72]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9b93] disabled:cursor-wait disabled:opacity-40"
                        >
                          {busy === `inference:${rig.id}:stop` ? "Stopping…" : "Stop worker"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {!ai.rigs.length && (
                  <p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-white/45">
                    No active Vast rigs are available to probe.
                  </p>
                )}
                <p className="mt-3 text-right text-[10px] text-white/30">Probed {ai.ts} · refreshes every 30 seconds</p>
              </>
            ) : (
              <div className="mt-5 animate-pulse rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/45" aria-live="polite">
                Connecting to GPU fleet…
              </div>
            )}
          </div>
        </section>
        )}

        {tab === "mining" && (
        <section className="mx-auto w-full max-w-7xl pb-8 lg:pb-12">
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
            <table className="w-full min-w-[840px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  <th className="px-3 py-2.5">Rig</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Cost</th>
                  <th className="px-3 py-2.5">Mining</th>
                  <th className="px-3 py-2.5">Shares</th>
                  <th className="px-3 py-2.5">GPU</th>
                  <th className="w-8 px-3 py-2.5" aria-label="expand" />
                </tr>
              </thead>
              <tbody>
          {rigs.map((r) => {
            const expanded = !!open[r.id];
            const act = r.miners.filter((m) => m.hashrate);
            const totA = act.reduce((s, m) => s + (m.hashrate?.a ?? 0), 0);
            return (
            <Fragment key={r.id}>
              <tr
                onClick={() => setOpen((p) => ({ ...p, [r.id]: !p[r.id] }))}
                className="cursor-pointer border-b border-white/[0.05] transition hover:bg-white/[0.04]"
              >
                <td className="px-3 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                        r.error ? "bg-[#ff7b72]" : "bg-[#34d399]"
                      } shadow-[0_0_8px_currentColor]`}
                    />
                    <b className="shrink-0 text-sm text-white">#{r.id}</b>
                    <span className="truncate text-xs text-white/60">{r.gpu_name}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-white/35">{r.geo} · {r.ssh}</div>
                </td>
                <td className="px-3 py-3">
                  <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${act.length ? "border-[#34d399]/30 text-[#34d399]" : "border-white/10 text-white/30"}`}>
                    {act.length ? `${act.length} live` : "idle"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-white/60">${r.dph.toFixed(4)}/h</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {act.map((m, i) => {
                      const c = coinOf(m);
                      return (
                        <span key={i} className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${c.c}15`, color: c.c }}>
                          {c.name} {fmt(m.hashrate)}
                        </span>
                      );
                    })}
                    {!act.length && <span className="text-white/25">—</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-white/50">A{totA}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-white/50">{r.gpu?.util ?? "?"} · {r.gpu?.temp ?? "?"}</td>
                <td className="px-3 py-3 text-white/40">{expanded ? "▴" : "▾"}</td>
              </tr>
              {expanded && (
              <tr className="border-b border-white/10">
                <td colSpan={7} className="bg-black/30 p-3 sm:p-4">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:p-4">
              {r.error && <div role="alert" className="mt-2 break-words rounded-lg bg-[#ff7b72]/[0.07] p-2 text-xs text-[#ff9b93]">{r.error}</div>}
              {r.net && Object.values(r.net).some((v) => !v) && (
                <div role="alert" className="mt-2 flex items-start gap-2 break-words rounded-lg border border-[#ff7b72]/30 bg-[#ff7b72]/[0.08] p-2 text-xs text-[#ff9b93]">
                  <span className="shrink-0">⚠</span>
                  <span>Pools unreachable from this rig — host egress firewall blocks stratum ports: {Object.entries(r.net).filter(([, ok]) => !ok).map(([hp]) => hp).join(", ")}</span>
                </div>
              )}

              {/* engine cards — unified status + controls */}
              {(() => {
                const zionM = r.miners.filter((m) => (m.cmd || "").includes("zion-miner"));
                const srbM = r.miners.filter((m) => (m.cmd || "").includes("SRBMiner"));
                const xmrM = r.miners.filter((m) => (m.cmd || "").toLowerCase().includes("xmrig"));
                const otherM = r.miners.filter((m) => !zionM.includes(m) && !srbM.includes(m) && !xmrM.includes(m));
                const isB = (k: string) => busy === k;
                const launch = (m: string, ask?: string) => () => {
                  if (!ask || confirm(ask)) ops(`launch?id=${r.id}&m=${m}`, "POST");
                };
                const stopFn = (m: string) => () => {
                  if (confirm(`stop ${m} on ${r.id}?`)) ops(`stop?id=${r.id}&m=${m}`, "POST");
                };
                const Pill = ({ k, onClick, tone = "", children }: { k: string; onClick: () => void; tone?: string; children: React.ReactNode }) => (
                  <button
                    disabled={!!busy}
                    onClick={onClick}
                    className={`inline-flex min-h-7 items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-wait disabled:opacity-40 ${
                      tone === "danger"
                        ? "border-[#ff7b72]/30 bg-[#ff7b72]/[0.06] text-[#ff9b93] hover:border-[#ff7b72]/55 hover:bg-[#ff7b72]/15"
                        : tone === "info"
                          ? "border-[#60a5fa]/25 bg-[#60a5fa]/[0.05] text-[#93c5fd] hover:border-[#60a5fa]/50 hover:bg-[#60a5fa]/15"
                          : tone === "ghost"
                            ? "border-white/10 bg-black/20 text-white/45 hover:border-white/30 hover:text-white/80"
                            : "border-[#34d399]/30 bg-[#34d399]/[0.07] text-[#6ee7b7] hover:border-[#34d399]/60 hover:bg-[#34d399]/15"
                    }`}
                  >
                    {isB(k) ? "…" : children}
                  </button>
                );
                const Engine = ({ title, accent, ms, children }: { title: string; accent: string; ms: Miner[]; children: React.ReactNode }) => {
                  const on = ms.length > 0;
                  return (
                    <div className={`min-w-0 rounded-xl border p-2.5 transition ${on ? "border-white/[0.12] bg-white/[0.04]" : "border-white/[0.06] bg-black/25"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: on ? accent : "rgba(255,255,255,0.2)", boxShadow: on ? `0 0 6px ${accent}` : "none" }}
                          />
                          <span className="truncate text-[11px] font-bold uppercase tracking-wider" style={{ color: on ? accent : "rgba(255,255,255,0.45)" }}>
                            {title}
                          </span>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${on ? "border-[#34d399]/30 text-[#34d399]" : "border-white/10 text-white/25"}`}>
                          {on ? "running" : "stopped"}
                        </span>
                      </div>
                      {!!ms.length && (
                        <div className="mt-1.5 space-y-1">
                          {ms.map((m, i) => {
                            const coin = coinOf(m);
                            return (
                              <div key={i} className="rounded-lg bg-black/30 px-2 py-1.5">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${coin.c}18`, color: coin.c }}>
                                    {coin.name}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{fmt(m.hashrate)}</span>
                                  {m.etime && <span className="shrink-0 text-[10px] text-white/35">up {m.etime}</span>}
                                  <Spark data={m.hist} color={coin.c} w={150} h={32} />
                                </div>
                                {(m.pool || m.worker) && (
                                  <div className="mt-1 truncate text-[10px] text-white/30" title={`${m.pool || ""} ${m.worker || ""}`}>
                                    {m.pool || "—"}{m.worker ? ` · ${m.worker}` : ""}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1">{children}</div>
                    </div>
                  );
                };
                const Lg = ({ src }: { src: string }) => (
                  <Pill k="" tone="info" onClick={() => toggleLogs(r.id, src)}>
                    {logsOpen[r.id] === src ? "▾ log" : "▤ log"}
                  </Pill>
                );
                return (
                  <div className="mt-3 border-t border-white/5 pt-2.5">
                    {/* meta bar: hw + tmux sessions */}
                    <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 text-[10px] text-white/45">
                      <span title="GPU util / power / temp / vram">
                        <b className="text-white/70">gpu</b> {r.gpu?.util ?? "?"} · {r.gpu?.power ?? "?"} · {r.gpu?.temp ?? "?"} · vram {r.gpu?.mem ?? "?"}
                      </span>
                      <span title="tmux sessions"><b className="text-white/70">tmux</b> {(r.sessions ?? []).join(", ") || "—"}</span>
                      <span className="ml-auto truncate font-mono text-white/30" title="ssh endpoint">{r.ssh}</span>
                    </div>
                    <button
                      disabled={!!busy}
                      onClick={() => confirm(`full deploy on ${r.id}?\n\n• SRBMiner → PRL+QTU dual → upstream pools (max hashrate)\n• xmrig → CPU rx/0\n• zion-miner → binary installed (standby)`) && ops(`launch?id=${r.id}&m=full`, "POST")}
                      className="w-full rounded-xl border border-[#fcd116]/40 bg-gradient-to-r from-[#fcd116]/[0.14] to-transparent px-4 py-2 text-left transition hover:border-[#fcd116]/70 hover:from-[#fcd116]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fcd116] disabled:cursor-wait disabled:opacity-40"
                    >
                      <div className="text-sm font-bold text-[#fcd116]">{isB(`launch?id=${r.id}&m=full`) ? "Deploying…" : "▸ Full deploy"}</div>
                      <div className="mt-0.5 text-[10px] text-white/40">SRBMiner PRL+QTU dual → upstream pools · XMRig CPU · zion standby</div>
                    </button>
                    <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
                      <Engine title="SRBMiner · PRL+QTU upstream" accent="#34d399" ms={srbM}>
                        <Pill k={`launch?id=${r.id}&m=srb`} onClick={launch("srb", `launch SRB dual on ${r.id}?`)}>▸ dual</Pill>
                        <Pill k={`launch?id=${r.id}&m=srb-prl`} onClick={launch("srb-prl", `launch SRB PRL on ${r.id}?`)}>▸ prl</Pill>
                        <Pill k={`launch?id=${r.id}&m=srb-qtu`} onClick={launch("srb-qtu", `launch SRB QTU on ${r.id}?`)}>▸ qtu</Pill>
                        <span className="flex-1" />
                        <Pill k={`stop?id=${r.id}&m=srb`} tone="danger" onClick={stopFn("srb")}>■ stop</Pill>
                        <Lg src="srb" />
                      </Engine>
                      <Engine title="XMRig · cpu rx/0" accent="#fb923c" ms={xmrM}>
                        <Pill k={`launch?id=${r.id}&m=xmr`} onClick={launch("xmr")}>▸ start</Pill>
                        <span className="flex-1" />
                        <Pill k={`stop?id=${r.id}&m=xmr`} tone="danger" onClick={stopFn("xmr")}>■ stop</Pill>
                        <Lg src="xmr" />
                      </Engine>
                      <Engine title="zion-miner · pool (dev)" accent="#fcd116" ms={zionM}>
                        <Pill k={`launch?id=${r.id}&m=zion`} onClick={launch("zion", `launch zion 50/50 on ${r.id}?\n\nNOTE: kills SRBMiner sessions for exclusive GPU`)}>▸ 50/50</Pill>
                        <Pill k={`launch?id=${r.id}&m=zionmax`} onClick={launch("zionmax", `launch zion 100/40 on ${r.id}?`)}>▸ 100/40</Pill>
                        <Pill k={`launch?id=${r.id}&m=prl`} onClick={launch("prl", `launch PRL-only on ${r.id}?`)}>▸ PRL</Pill>
                        <Pill k={`launch?id=${r.id}&m=qtu`} onClick={launch("qtu", `launch QTU-only on ${r.id}?`)}>▸ QTU</Pill>
                        <input
                          id={`dprl-${r.id}`}
                          inputMode="numeric"
                          placeholder="PRL%"
                          aria-label="PRL duty percent"
                          className="min-h-7 w-12 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-center text-[11px] text-white placeholder-white/25 focus:border-[#fcd116]/40 focus:outline-none"
                        />
                        <input
                          id={`dqtu-${r.id}`}
                          inputMode="numeric"
                          placeholder="QTU%"
                          aria-label="QTU duty percent"
                          className="min-h-7 w-12 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-center text-[11px] text-white placeholder-white/25 focus:border-[#fcd116]/40 focus:outline-none"
                        />
                        <Pill k="" tone="ghost" onClick={() => {
                          const p = (document.getElementById(`dprl-${r.id}`) as HTMLInputElement)?.value || "50";
                          const q = (document.getElementById(`dqtu-${r.id}`) as HTMLInputElement)?.value || "50";
                          if (confirm(`launch zion ${p}/${q} on ${r.id}?`)) ops(`launch?id=${r.id}&m=zion&prl=${encodeURIComponent(p)}&qtu=${encodeURIComponent(q)}`, "POST");
                        }}>▸ custom</Pill>
                        <span className="flex-1" />
                        <Pill k={`stop?id=${r.id}&m=zion`} tone="danger" onClick={stopFn("zion")}>■ stop</Pill>
                        <Lg src="zion" />
                      </Engine>
                      {otherM.length > 0 && (
                        <div className="truncate rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-[10px] text-white/35 lg:col-span-3">
                          other: {otherM.map((m) => m.algo || (m.cmd || "").split(" ")[0]).join(", ")}
                        </div>
                      )}
                    </div>
                    {logsOpen[r.id] && (
                      <pre className="mt-2.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/50 p-3 text-[10px] leading-relaxed text-white/60">
                        <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/35">logs · {logsOpen[r.id]}</span>
                        {logs[r.id] ?? "loading…"}
                      </pre>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <form
                        className="flex min-w-0 flex-1 gap-1.5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const inp = (e.target as HTMLFormElement).elements.namedItem("c") as HTMLInputElement;
                          if (inp.value.trim()) ops(`exec?id=${r.id}&cmd=${encodeURIComponent(inp.value)}`);
                          inp.value = "";
                        }}
                      >
                        <input
                          name="c"
                          aria-label={`SSH command for rig ${r.id}`}
                          placeholder="ssh cmd…"
                          className="min-h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-2.5 py-0.5 font-mono text-[11px] text-white placeholder-white/25 focus:border-white/30 focus:outline-none"
                        />
                        <button
                          disabled={!!busy}
                          className="min-h-7 shrink-0 rounded-md border border-[#60a5fa]/25 bg-[#60a5fa]/[0.05] px-3 py-0.5 text-[11px] font-semibold text-[#93c5fd] transition hover:border-[#60a5fa]/50 hover:bg-[#60a5fa]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-wait disabled:opacity-40"
                        >
                          {busy.startsWith("exec?") && busy.includes(`id=${r.id}&`) ? "…" : "run"}
                        </button>
                      </form>
                      <Pill k={`stop?id=${r.id}&m=all`} tone="danger" onClick={stopFn("all")}>■ stop all</Pill>
                      <Lg src="all" />
                    </div>
                  </div>
                );
              })()}
                  </div>
                </td>
              </tr>
              )}
            </Fragment>
            );
          })}
          {!rigs.length && (
            <tr>
              <td colSpan={7} className="p-8 text-center sm:p-12">
                <div className="text-sm font-semibold text-white/65">
                  {err && !snap
                    ? "Fleet feed unavailable"
                    : snap
                      ? "No vast.ai rigs running"
                      : "Loading fleet data…"}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/40">
                  {err && !snap
                    ? "The status feed could not be loaded. Check the connection and try again."
                    : snap
                      ? "All rented instances are stopped or destroyed — the fleet is idle. Spin one up from the GPU market tab."
                      : "Waiting for the Vast status daemon to publish its first snapshot…"}
                </p>
                {snap && !err && (
                  <button
                    onClick={() => goTab("market")}
                    className="mt-4 rounded-lg border border-[#fcd116]/40 bg-[#fcd116]/10 px-4 py-2 text-xs font-semibold text-[#fcd116] transition hover:border-[#fcd116]/70 hover:bg-[#fcd116]/20"
                  >
                    → Browse GPU market
                  </button>
                )}
              </td>
            </tr>
          )}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {/* ── pool workers (SMOS / external rigs on the project pool) ── */}
        {tab === "pool" && (
        <section className="mx-auto w-full max-w-7xl pb-12 sm:pb-20">
          {/* our own ZION pool — live routing / auxpow / PPLNS */}
          {snap?.poolstats ? (
            <PoolStatsPanel p={snap.poolstats} miners={snap.pool} />
          ) : (
            <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] px-4 py-5 text-center text-xs text-amber-200/80">
              Pool API unavailable — the status daemon could not reach the pool HTTP API on Edge (:8080).
            </div>
          )}

          {/* SMOS rigs card */}
          <div className="mb-5 rounded-2xl border border-[#fcd116]/15 bg-gradient-to-br from-[#fcd116]/[0.05] to-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
              <h3 className="text-sm font-bold text-white">SimpleMining rigs</h3>
              <span className="text-[10px] text-white/35">
                {snap?.smos ? `${snap.smos.filter((r) => r.online).length}/${snap.smos.length} online · api.simplemining.net` : "simplemining.net"}
              </span>
            </div>
            {snap?.smos === null || snap?.smos === undefined ? (
              <div className="p-6 text-center text-xs text-white/40">
                {snap?.smos === null
                  ? "SMOS API unavailable — check VASTCTL_SMOS_KEY in vastctl env."
                  : "SMOS data pending — waiting for the next daemon snapshot (≤60 s)."}
              </div>
            ) : snap.smos.length === 0 ? (
              <div className="p-6 text-center text-xs text-white/40">No SimpleMining rigs on this account.</div>
            ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  <th className="px-4 py-2">Rig</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Group / miner</th>
                  <th className="px-3 py-2">Hashrate</th>
                  <th className="px-3 py-2">GPU</th>
                  <th className="px-3 py-2">Uptime</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {snap.smos.map((r) => (
                  <Fragment key={r.id}>
                  <tr className="border-b border-white/[0.04] align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_currentColor] ${r.online ? "bg-[#34d399]" : "bg-[#ff7b72]"}`} />
                        <b className="text-sm text-white">{r.name}</b>
                        <span className="text-[10px] text-white/30">#{r.id}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-white/35" title={`${r.ip} · ${r.kernel}`}>
                        {r.os} · {r.driver} · {r.ip}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        r.paused ? "border-white/15 text-white/40" : r.online ? "border-[#34d399]/30 text-[#34d399]" : "border-[#ff7b72]/40 text-[#ff7b72]"
                      }`}>
                        {r.paused ? "paused" : r.online ? "online" : "offline"}
                      </span>
                      {r.alerts.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1" title={r.alerts.join(", ")}>
                          {r.alerts.filter((a) => a !== "has_alerts").map((a) => (
                            <span key={a} className="rounded border border-[#ff7b72]/40 bg-[#ff7b72]/10 px-1 py-0.5 text-[9px] font-semibold text-[#ff7b72]">⚠{a}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-white/60">
                      <div className="truncate font-medium text-white/80">{r.group || "—"}</div>
                      <div className="text-[10px] text-white/35">{r.miner || "—"}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-white/70">
                      {r.hash > 0 && <div className="font-semibold text-white">{fmtHps(r.hash)}</div>}
                      {r.hash2 > 0 && <div className="font-semibold text-[#34d399]">{fmtHps(r.hash2)} <span className="text-[9px] font-normal text-white/35">aux</span></div>}
                      {r.hash === 0 && r.hash2 === 0 && <span className="text-white/25">—</span>}
                      {(r.acc > 0 || r.rej > 0) && <div className="text-[10px] text-white/40">A{r.acc}·R{r.rej}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-white/60">
                      <div>{r.gpus}/{r.gpus_max} GPU{r.gpus !== 1 ? "s" : ""}</div>
                      {r.gpu_temp.length > 0 && (
                        <div className="mt-0.5 text-[10px] text-white/40">
                          {r.gpu_temp.map((t, i) => (
                            <span key={i} className="mr-1.5">{t}°{r.gpu_fan[i] ? `·${r.gpu_fan[i]}%` : ""}</span>
                          ))}
                        </div>
                      )}
                      {r.sys_pwr && <div className="text-[10px] text-white/40">{r.sys_pwr} W{r.pwr_limit ? ` / pl ${r.pwr_limit}` : ""}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-white/50">
                      {r.uptime ? <div>{r.uptime}</div> : "—"}
                      <div className="text-[10px] text-white/30">upd {agoS(Math.floor(Date.now() / 1000) - (r.last_update || 0))}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => toggleSmosLog(r.id)}
                          className="rounded-lg border border-[#7dd3fc]/40 bg-[#7dd3fc]/10 px-2 py-1 text-[10px] font-semibold text-[#7dd3fc] transition hover:bg-[#7dd3fc]/20"
                        >▤ console</button>
                        {r.paused ? (
                          <button
                            onClick={() => ops(`smos/action?id=${r.id}&act=resume`, "POST")}
                            className="rounded-lg border border-[#34d399]/40 bg-[#34d399]/10 px-2 py-1 text-[10px] font-semibold text-[#34d399] transition hover:bg-[#34d399]/20"
                          >▶ resume</button>
                        ) : (
                          <button
                            onClick={() => ops(`smos/action?id=${r.id}&act=pause`, "POST")}
                            className="rounded-lg border border-[#fcd116]/40 bg-[#fcd116]/10 px-2 py-1 text-[10px] font-semibold text-[#fcd116] transition hover:bg-[#fcd116]/20"
                          >⏸ pause</button>
                        )}
                        <button
                          onClick={() => confirm(`Reboot SMOS rig ${r.name} (#${r.id})?`) && ops(`smos/action?id=${r.id}&act=reboot`, "POST")}
                          className="rounded-lg border border-[#ff7b72]/40 bg-[#ff7b72]/10 px-2 py-1 text-[10px] font-semibold text-[#ff7b72] transition hover:bg-[#ff7b72]/20"
                        >↻ reboot</button>
                      </div>
                    </td>
                  </tr>
                  {smosLogOpen[r.id] && (
                    <tr className="border-b border-white/[0.06]">
                      <td colSpan={7} className="bg-black/40 px-4 py-2">
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-snug text-white/75">{smosLog[r.id] || "loading…"}</pre>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
            )}
          </div>

          {/* external pools: earnings + workers per coin */}
          {snap?.ext && (
          <div className="mb-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {([
              ["qtu", "QTC · Quantus", "#fcd116", "luckypool"],
              ["prl", "PRL · Pearl", "#34d399", "luckypool"],
              ["nock", "NOCK · Nockchain", "#a78bfa", "luckypool"],
              ["xmr", "XMR · Monero", "#fb923c", "nanopool"],
            ] as const).map(([k, label, color, poolName]) => {
              const p = snap.ext?.[k];
              return (
                <div key={k} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold" style={{ color }}>{label}</h4>
                    {p && (
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-[10px] text-white/35 underline decoration-dotted hover:text-white/70">
                        {poolName} ↗
                      </a>
                    )}
                  </div>
                  {!p ? (
                    <div className="mt-3 text-[11px] text-white/35">pool API unreachable</div>
                  ) : (
                    <>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div>
                          <div className="text-lg font-bold text-white">{fmtHps(p.hashrate)}</div>
                          <div className="text-[10px] text-white/40">
                            {p.avg["24h"] ? `24h ${fmtHps(p.avg["24h"])}` : ""}
                            {p.avg["1h"] ? ` · 1h ${fmtHps(p.avg["1h"])}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold" style={{ color }}>
                            {p.unlocked != null ? `${p.unlocked.toFixed(4)}` : p.balance != null ? `${p.balance.toFixed(4)}` : "—"}
                          </div>
                          <div className="text-[10px] text-white/40">
                            {p.unlocked != null ? "unlocked" : "balance"}
                            {p.locked != null && p.locked > 0 ? ` · ${p.locked.toFixed(4)} locked` : ""}
                            {p.paid != null && p.paid > 0 ? ` · paid ${p.paid.toFixed(4)}` : ""}
                          </div>
                        </div>
                      </div>
                      {p.accepted != null && (
                        <div className="mt-2 text-[10px] text-white/40">A{p.accepted}{p.rejected ? ` · R${p.rejected}` : ""} shares</div>
                      )}
                      <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
                        {p.workers.filter((w) => w.hashrate > 0 || w.last > 0).slice(0, 6).map((w) => (
                          <div key={w.name} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${w.hashrate > 0 ? "bg-[#34d399]" : "bg-white/20"}`} />
                              <span className="truncate text-white/70" title={w.agent}>{w.name}</span>
                            </span>
                            <span className="shrink-0 text-white/50">
                              {w.hashrate > 0 ? <b className="text-white/80">{fmtHps(w.hashrate)}</b> : w.last ? agoS(w.last) : "—"}
                            </span>
                          </div>
                        ))}
                        {p.workers.filter((w) => w.hashrate > 0 || w.last > 0).length === 0 && (
                          <div className="text-[10px] text-white/25">no active workers</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          )}

          {/* pool workers — grouped by payout wallet (the pool emits a row per
             session identity; one wallet can carry several session names) */}
          {(() => {
            const poolGroups = snap?.pool ? groupPoolWorkers(snap.pool) : null;
            const sessionCount = snap?.pool?.length ?? 0;
            return (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
              <h3 className="text-sm font-bold text-white">Pool workers</h3>
              <span className="text-[10px] text-white/35">
                {poolGroups
                  ? `${poolGroups.length} wallets · ${sessionCount} sessions · edge:8444`
                  : "edge pool"}
              </span>
            </div>
            {snap?.pool === null || snap?.pool === undefined ? (
              <div className="p-8 text-center text-sm text-white/45">
                {snap?.pool === null
                  ? "Pool API unreachable — daemon could not fetch /miners from the edge loopback."
                  : "Pool data pending — waiting for the next daemon snapshot (≤60 s)."}
              </div>
            ) : !poolGroups?.length ? (
              <div className="p-8 text-center text-sm text-white/45">No pool workers connected.</div>
            ) : (
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  <th className="px-3 py-2.5">Wallet / workers</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Streams</th>
                  <th className="px-3 py-2.5">Hashrate</th>
                  <th className="px-3 py-2.5">Blocks</th>
                  <th className="px-3 py-2.5">Seen</th>
                </tr>
              </thead>
              <tbody>
                {poolGroups.map((g) => {
                    const online = g.last_seen > 0 && Date.now() / 1000 - g.last_seen < 600;
                    const totV = Object.values(g.streams).reduce((s, x) => s + x.v, 0);
                    return (
                      <tr key={g.address} className="border-b border-white/[0.05] align-top transition hover:bg-white/[0.03]">
                        <td className="px-3 py-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${online ? "bg-[#34d399]" : "bg-white/20"} shadow-[0_0_8px_currentColor]`} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1">
                                {g.names.map((n) => (
                                  <b key={n} className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-semibold text-white" title={n}>
                                    {n.length > 18 ? `${n.slice(0, 8)}…${n.slice(-4)}` : n}
                                  </b>
                                ))}
                                {g.sessions > g.names.length && (
                                  <span className="text-[9px] text-white/30">×{g.sessions} sessions</span>
                                )}
                              </div>
                              <div className="mt-0.5 truncate text-[10px] text-white/35" title={g.address}>
                                {g.address.length > 14 ? `${g.address.slice(0, 8)}…${g.address.slice(-6)}` : g.address}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {g.kinds.map((k) => (
                              <span key={k.label} className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${k.cls}`}>{k.label}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(g.streams).map(([c, s]) => (
                              <span
                                key={c}
                                className="whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                                style={{
                                  color: POOL_COIN[c] ?? "#9ca3af",
                                  borderColor: `${POOL_COIN[c] ?? "#9ca3af"}44`,
                                  background: `${POOL_COIN[c] ?? "#9ca3af"}0f`,
                                }}
                                title={`${c}: ${s.v} valid / ${s.i} invalid · last share ${agoS(s.t)}`}
                              >
                                {c.toUpperCase()} {s.v}
                                {s.i > 0 && <span className="ml-1 text-[#ff7b72]">!{s.i}</span>}
                                <span className="ml-1 font-normal opacity-60">{agoS(s.t)}</span>
                              </span>
                            ))}
                            {totV === 0 && <span className="text-[10px] text-white/25">no shares yet</span>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-white/70">
                          {fmtHps(g.hps)}
                          {g.hps_1h > 0 && <span className="ml-1 text-[10px] text-white/35">1h {fmtHps(g.hps_1h)}</span>}
                        </td>
                        <td className="px-3 py-3 text-xs text-white/70">{g.blocks > 0 ? <span className="text-[#fcd116]">{g.blocks} ◆</span> : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-white/50">{agoS(g.last_seen)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            )}
          </div>
            );
          })()}
          <p className="mt-2 px-1 text-[10px] text-white/30">
            Workers connected to the project pool (edge:8444). SMOS = SimpleMining rigs, vast = this dashboard's fleet, infra = pool edge services.
          </p>
        </section>
        )}

        {/* ── market ── */}
        {tab === "market" && (
        <section className="mx-auto w-full max-w-7xl pb-12 sm:pb-20">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4 backdrop-blur sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white sm:text-xl">GPU market</h2>
                <p className="mt-1 text-xs text-white/45 sm:text-sm">Find and rent an instance. Rentals incur charges.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
                <label className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-white/45 sm:col-span-1">
                  GPU model
                  <select
                    value={mGpu}
                    onChange={(e) => setMGpu(e.target.value)}
                    className="mt-1 block min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white focus:border-[#fcd116]/50 focus:outline-none focus:ring-1 focus:ring-[#fcd116]/40 sm:min-w-40"
                  >
                <option value="any">any GPU</option>
                {([
                  ["GTX / 16xx", ["GTX_1050_Ti", "GTX_1060", "GTX_1070", "GTX_1070_Ti", "GTX_1080", "GTX_1080_Ti", "GTX_1650", "GTX_1660", "GTX_1660_S", "GTX_1660_Ti", "GTX_TITAN_X"]],
                  ["RTX 20xx", ["RTX_2060", "RTX_2060S", "RTX_2070", "RTX_2070S", "RTX_2080", "RTX_2080_Ti"]],
                  ["RTX 30xx", ["RTX_3050", "RTX_3060", "RTX_3060_Ti", "RTX_3070", "RTX_3070_Ti", "RTX_3080", "RTX_3080_Ti", "RTX_3090", "RTX_3090_Ti"]],
                  ["RTX 40xx", ["RTX_4060", "RTX_4060_Ti", "RTX_4070", "RTX_4070S", "RTX_4070_Ti", "RTX_4070S_Ti", "RTX_4080", "RTX_4080S", "RTX_4090"]],
                  ["RTX 50xx", ["RTX_5060", "RTX_5060_Ti", "RTX_5070", "RTX_5070_Ti", "RTX_5080", "RTX_5090"]],
                  ["Workstation", ["RTX_A2000", "RTX_A4000", "RTX_A5000", "RTX_A6000", "RTX_4000Ada", "RTX_4500Ada", "RTX_5000Ada", "RTX_5880Ada", "RTX_6000Ada", "Q_RTX_6000", "Q_RTX_8000"]],
                  ["Datacenter", ["A40", "A100_PCIE", "A100_SXM4", "A800_PCIE", "L4", "L40", "L40S", "H100_PCIE", "H100_SXM", "H100_NVL", "H200_NVL", "B300"]],
                  ["Legacy / Tesla", ["Tesla_P40", "Tesla_P100", "Tesla_T4", "Tesla_V100", "Titan_RTX", "Titan_V", "Titan_Xp", "CMP_170HX"]],
                ] as [string, string[]][]).map(([grp, gpus]) => (
                  <optgroup key={grp} label={grp}>
                    {gpus.map((g) => (
                      <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
                    ))}
                  </optgroup>
                ))}
                  </select>
                </label>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  Max price / hour
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={mDph}
                    onChange={(e) => setMDph(e.target.value)}
                    placeholder="No limit"
                    className="mt-1 block min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white placeholder-white/30 focus:border-[#fcd116]/50 focus:outline-none focus:ring-1 focus:ring-[#fcd116]/40 sm:w-32"
                  />
                </label>
                <button
                  onClick={() => loadOffers()}
                  disabled={!!busy}
                  className="col-span-1 min-h-11 rounded-lg border border-[#fcd116]/40 bg-[#fcd116]/10 px-4 py-2 text-sm font-semibold text-[#fcd116] transition hover:bg-[#fcd116]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fcd116] disabled:cursor-wait disabled:opacity-40"
                >
                  {busy === "offers" ? "Searching…" : "Search offers"}
                </button>
                <button
                  onClick={autoSearch}
                  disabled={!!busy}
                  title="Cheapest instances across every GPU type"
                  className="col-span-1 min-h-11 rounded-lg border border-[#34d399]/40 bg-[#34d399]/10 px-4 py-2 text-sm font-semibold text-[#6ee7b7] transition hover:bg-[#34d399]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34d399] disabled:cursor-wait disabled:opacity-40"
                >
                  {busy === "offers" ? "…" : "⚡ auto: cheapest"}
                </button>
              </div>
            </div>

            {offerError && (
              <p role="alert" className="mt-4 rounded-lg border border-[#ff7b72]/25 bg-[#ff7b72]/[0.06] p-3 text-xs text-[#ff9b93]">
                Could not search offers: {offerError}
              </p>
            )}

            {offers && (
              <div className="mt-5">
                <p className="mb-3 text-xs text-white/45" aria-live="polite">
                  {offers.length} {offers.length === 1 ? "offer" : "offers"} found · sorted by price
                </p>
                <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead>
                    <tr className="bg-white/[0.04] text-left text-[10px] uppercase tracking-wider text-white/45">
                      {["Offer", "GPU", "$ / hour", "$ / day", "Network ↓↑", "Reliability", "CUDA", "RAM", "Location", ""].map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o) => (
                      <tr key={o.id} className="border-t border-white/5 text-white/80 transition hover:bg-white/[0.04]">
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-white/50">{o.id}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-medium">{o.gpu_name}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#fcd116]">${o.dph_total.toFixed(4)}</td>
                        <td className="whitespace-nowrap px-3 py-3">${(o.dph_total * 24).toFixed(2)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-white/60">{Math.round(o.inet_down)} / {Math.round(o.inet_up)} Mbps</td>
                        <td className="whitespace-nowrap px-3 py-3 text-white/60">{(o.reliability * 100).toFixed(1)}%</td>
                        <td className="whitespace-nowrap px-3 py-3 text-white/60">{o.cuda_max_good}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-white/60">{Math.round(o.cpu_ram / 1024)} GB</td>
                        <td className="max-w-48 truncate px-3 py-3 text-white/60" title={o.geolocation}>{o.geolocation}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <button
                            disabled={!!busy}
                            onClick={() => confirm(`RENT offer ${o.id} — $${o.dph_total.toFixed(4)}/h?\nThis bills your vast.ai account!`) && ops(`rent?id=${o.id}`, "POST")}
                            className="min-h-9 rounded-lg border border-[#34d399]/40 bg-[#34d399]/10 px-3 py-1.5 text-xs font-semibold text-[#34d399] transition hover:bg-[#34d399]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34d399] disabled:cursor-wait disabled:opacity-40"
                          >
                            Rent
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!offers.length && (
                      <tr><td colSpan={10} className="px-3 py-8 text-center text-white/40">No offers match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
                <div className="grid gap-3 md:hidden">
                  {offers.map((o) => (
                    <div key={o.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white" title={o.gpu_name}>{o.gpu_name}</p>
                          <p className="mt-1 text-[10px] text-white/35">Offer #{o.id}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold text-[#fcd116]">${o.dph_total.toFixed(4)}<span className="font-normal text-white/45">/h</span></p>
                          <p className="text-[10px] text-white/40">${(o.dph_total * 24).toFixed(2)} / day</p>
                        </div>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/[0.06] pt-3 text-xs">
                        <div><dt className="text-[10px] text-white/35">Reliability</dt><dd className="mt-0.5 text-white/75">{(o.reliability * 100).toFixed(1)}%</dd></div>
                        <div><dt className="text-[10px] text-white/35">CUDA</dt><dd className="mt-0.5 text-white/75">{o.cuda_max_good}</dd></div>
                        <div><dt className="text-[10px] text-white/35">Network ↓↑</dt><dd className="mt-0.5 text-white/75">{Math.round(o.inet_down)} / {Math.round(o.inet_up)} Mbps</dd></div>
                        <div><dt className="text-[10px] text-white/35">RAM</dt><dd className="mt-0.5 text-white/75">{Math.round(o.cpu_ram / 1024)} GB</dd></div>
                        <div className="col-span-2 min-w-0"><dt className="text-[10px] text-white/35">Location</dt><dd className="mt-0.5 truncate text-white/75" title={o.geolocation}>{o.geolocation}</dd></div>
                      </dl>
                      <button
                        disabled={!!busy}
                        onClick={() => confirm(`RENT offer ${o.id} — $${o.dph_total.toFixed(4)}/h?\nThis bills your vast.ai account!`) && ops(`rent?id=${o.id}`, "POST")}
                        className="mt-4 min-h-11 w-full rounded-lg border border-[#34d399]/40 bg-[#34d399]/10 px-4 py-2 text-sm font-semibold text-[#34d399] transition hover:bg-[#34d399]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34d399] disabled:cursor-wait disabled:opacity-40"
                      >
                        Rent · ${o.dph_total.toFixed(4)} / hour
                      </button>
                    </div>
                  ))}
                  {!offers.length && (
                    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
                      No offers match these filters.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
        )}
      </div>

      {/* toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed inset-x-3 bottom-3 z-50 max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border p-4 text-xs backdrop-blur-md shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-full sm:max-w-md ${
            toast.ok
              ? "border-[#34d399]/40 bg-black/80 text-[#d1fae5]"
              : "border-[#ff7b72]/50 bg-black/85 text-[#fecaca]"
          }`}
        >
          {toast.text}
        </div>
      )}
    </PageLayout>
  );
}
