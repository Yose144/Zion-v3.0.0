"use client";

import { useCallback, useEffect, useState } from "react";
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
};
type Snap = { ts: string | null; total_dph: number; rigs: Rig[] };
type AiGpu = {
  name: string;
  memory_total_mib: number;
  memory_used_mib: number;
  memory_free_mib: number;
  utilization_pct: number;
  temperature_c: number;
  power_w: number | null;
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
  note: string;
};

const COIN: Record<string, { name: string; c: string }> = {
  quantus: { name: "QTU", c: "#fcd116" },
  pearlhash: { name: "PRL", c: "#34d399" },
  "rx/0": { name: "XMR", c: "#fb923c" },
};
const VLLM_IMAGE = "vllm/vllm-openai:v0.8.5";

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

export default function Dashboard() {
  const [lang, setLang] = useState<"cs" | "en">("en");
  const [snap, setSnap] = useState<Snap | null>(null);
  const [err, setErr] = useState("");
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [aiErr, setAiErr] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [inferenceModel, setInferenceModel] = useState("Qwen/Qwen2.5-Coder-3B-Instruct");
  const [inferenceMemory, setInferenceMemory] = useState("0.6");

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
    const t = setInterval(load, 30000);
    loadAiStatus();
    const aiTimer = setInterval(loadAiStatus, 30000);
    return () => ((stop = true), clearInterval(t), clearInterval(aiTimer));
  }, [loadAiStatus]);

  const rigs = snap?.rigs || [];

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
  const loadOffers = async () => {
    setBusy("offers");
    setOfferError("");
    setOffers(null);
    const query = new URLSearchParams({ gpu: mGpu });
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
  const [chatAns, setChatAns] = useState<Record<number, string>>({});
  const [tab, setTab] = useState<"mining" | "ai" | "market">("mining");
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h === "ai" || h === "market" || h === "mining") setTab(h);
  }, []);
  const goTab = (t: "mining" | "ai" | "market") => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };
  // auto-load offers on first market tab open
  useEffect(() => {
    if (tab === "market" && offers === null && !offerError && busy !== "offers")
      loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
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
            ${snap ? snap.total_dph.toFixed(4) : "—"}/h
            <span className="text-white/35">·</span>
            ${snap ? (snap.total_dph * 24).toFixed(2) : "—"}/day
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
          Updated {snap?.ts || "—"} · refreshes every 30 seconds
          {err && <span className="ml-2 text-[#ff7b72]">· {err}</span>}
        </p>
      </section>

      {/* ── section tabs ── */}
      <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-1.5 px-2 pb-5 sm:px-4" aria-label="Dashboard sections">
        {([
          ["mining", `Mining rigs · ${rigs.length}`],
          ["ai", `AI inference · ${ai ? `${ai.totals.inference_rigs}/${ai.rigs.length} online` : "…"}`],
          ["market", "GPU market"],
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
                <div className="mt-5 rounded-xl border border-[#a371f7]/20 bg-black/20 p-3 sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Worker setup</h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                        Model API binds to rig loopback only · {VLLM_IMAGE}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#34d399]/20 bg-[#34d399]/[0.05] px-2.5 py-1 text-[10px] text-[#6ee7b7]">
                      Existing rigs only
                    </span>
                  </div>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                      Hugging Face model
                      <input
                        value={inferenceModel}
                        onChange={(event) => setInferenceModel(event.target.value)}
                        maxLength={200}
                        spellCheck={false}
                        list="ai-model-presets"
                        className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 text-xs normal-case text-white placeholder-white/25 focus:border-[#a371f7]/50 focus:outline-none focus:ring-1 focus:ring-[#a371f7]/40 sm:text-sm"
                      />
                      <datalist id="ai-model-presets">
                        <option value="Qwen/Qwen2.5-1.5B-Instruct">1.5B · tiny</option>
                        <option value="Qwen/Qwen2.5-Coder-3B-Instruct">3B · code</option>
                        <option value="Qwen/Qwen2.5-3B-Instruct">3B · general</option>
                        <option value="meta-llama/Llama-3.2-3B-Instruct">3B · llama (gated)</option>
                        <option value="Qwen/Qwen2.5-7B-Instruct">7B · general</option>
                        <option value="Qwen/Qwen2.5-Coder-7B-Instruct">7B · code</option>
                        <option value="mistralai/Mistral-7B-Instruct-v0.3">7B · mistral</option>
                      </datalist>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {[
                          ["Qwen/Qwen2.5-1.5B-Instruct", "1.5B"],
                          ["Qwen/Qwen2.5-Coder-3B-Instruct", "3B code"],
                          ["Qwen/Qwen2.5-3B-Instruct", "3B"],
                          ["Qwen/Qwen2.5-7B-Instruct", "7B"],
                          ["Qwen/Qwen2.5-Coder-7B-Instruct", "7B code"],
                        ].map(([id, tag]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setInferenceModel(id)}
                            title={id}
                            className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                              inferenceModel === id
                                ? "border-[#a371f7]/60 bg-[#a371f7]/20 text-[#d8b4fe]"
                                : "border-white/10 bg-black/30 text-white/50 hover:border-white/25 hover:text-white/80"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </label>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                      vLLM VRAM target
                      <select
                        value={inferenceMemory}
                        onChange={(event) => setInferenceMemory(event.target.value)}
                        className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-xs text-white focus:border-[#a371f7]/50 focus:outline-none focus:ring-1 focus:ring-[#a371f7]/40"
                      >
                        <option value="0.4">40%</option>
                        <option value="0.6">60% · default</option>
                        <option value="0.75">75% · high contention</option>
                      </select>
                    </label>
                    <div className="flex items-end">
                      <span className="min-h-11 content-center text-[10px] text-white/35">
                        Check GPU memory first
                      </span>
                    </div>
                  </div>
                </div>
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
        <section className="mx-auto grid w-full max-w-7xl min-w-0 grid-cols-1 gap-4 pb-8 sm:grid-cols-2 sm:gap-5 lg:pb-12">
          {rigs.map((r) => (
            <div
              key={r.id}
              className="w-full min-w-0 max-w-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4 backdrop-blur transition hover:border-[#fcd116]/30 sm:p-5"
            >
              {/* rig header */}
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      r.error ? "bg-[#ff7b72]" : "bg-[#34d399]"
                    } shadow-[0_0_8px_currentColor]`}
                  />
                  <b className="shrink-0 text-base text-white sm:text-lg">#{r.id}</b>
                  <span className="truncate text-sm text-white/70">{r.gpu_name}</span>
                </div>
                <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[10px] text-white/60 sm:text-xs">
                  ${r.dph.toFixed(4)}/h
                </span>
              </div>
              <div className="mt-2 break-words text-[11px] leading-relaxed text-white/40 sm:text-xs">
                {r.geo} · gpu {r.gpu?.util ?? "?"} · {r.gpu?.power ?? "?"} ·{" "}
                {r.gpu?.temp ?? "?"} · vram {r.gpu?.mem ?? "?"}
              </div>
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
                    className={`min-h-8 rounded-md border px-2.5 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-wait disabled:opacity-40 ${
                      tone === "danger"
                        ? "border-[#ff7b72]/25 text-[#ff9b93] hover:bg-[#ff7b72]/10"
                        : tone === "ghost"
                          ? "border-white/10 text-white/40 hover:border-white/30 hover:text-white/75"
                          : "border-white/15 bg-white/[0.05] text-white/75 hover:border-white/35 hover:text-white"
                    }`}
                  >
                    {isB(k) ? "…" : children}
                  </button>
                );
                const Engine = ({ title, accent, ms, children }: { title: string; accent: string; ms: Miner[]; children: React.ReactNode }) => {
                  const on = ms.length > 0;
                  return (
                    <div className={`rounded-xl border p-3 transition ${on ? "border-white/[0.12] bg-white/[0.04]" : "border-white/[0.06] bg-black/25"}`}>
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
                        <div className="mt-2 space-y-1.5">
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
                                  <Spark data={m.hist} color={coin.c} />
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
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{children}</div>
                    </div>
                  );
                };
                const Lg = ({ src }: { src: string }) => (
                  <Pill k="" tone={logsOpen[r.id] === src ? "" : "ghost"} onClick={() => toggleLogs(r.id, src)}>
                    {logsOpen[r.id] === src ? "▾ log" : "▤ log"}
                  </Pill>
                );
                return (
                  <div className="mt-4 border-t border-white/5 pt-3">
                    <button
                      disabled={!!busy}
                      onClick={() => confirm(`full deploy on ${r.id}?\n\n• SRBMiner → PRL+QTU dual → upstream pools (max hashrate)\n• xmrig → CPU rx/0\n• zion-miner → binary installed (standby)`) && ops(`launch?id=${r.id}&m=full`, "POST")}
                      className="w-full rounded-xl border border-[#fcd116]/40 bg-gradient-to-r from-[#fcd116]/[0.14] to-transparent px-4 py-2.5 text-left transition hover:border-[#fcd116]/70 hover:from-[#fcd116]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fcd116] disabled:cursor-wait disabled:opacity-40"
                    >
                      <div className="text-sm font-bold text-[#fcd116]">{isB(`launch?id=${r.id}&m=full`) ? "Deploying…" : "▸ Full deploy"}</div>
                      <div className="mt-0.5 text-[10px] text-white/40">SRBMiner PRL+QTU dual → upstream pools · XMRig CPU · zion standby</div>
                    </button>
                    <div className="mt-2.5 space-y-2">
                      <Engine title="SRBMiner · PRL+QTU upstream" accent="#34d399" ms={srbM}>
                        <Pill k={`launch?id=${r.id}&m=srb`} onClick={launch("srb", `launch SRB dual on ${r.id}?`)}>dual</Pill>
                        <Pill k={`launch?id=${r.id}&m=srb-prl`} onClick={launch("srb-prl", `launch SRB PRL on ${r.id}?`)}>prl</Pill>
                        <Pill k={`launch?id=${r.id}&m=srb-qtu`} onClick={launch("srb-qtu", `launch SRB QTU on ${r.id}?`)}>qtu</Pill>
                        <span className="flex-1" />
                        <Pill k={`stop?id=${r.id}&m=srb`} tone="danger" onClick={stopFn("srb")}>■</Pill>
                        <Lg src="srb" />
                      </Engine>
                      <Engine title="XMRig · cpu rx/0" accent="#fb923c" ms={xmrM}>
                        <Pill k={`launch?id=${r.id}&m=xmr`} onClick={launch("xmr")}>▸ start</Pill>
                        <span className="flex-1" />
                        <Pill k={`stop?id=${r.id}&m=xmr`} tone="danger" onClick={stopFn("xmr")}>■</Pill>
                        <Lg src="xmr" />
                      </Engine>
                      <Engine title="zion-miner · pool (dev)" accent="#fcd116" ms={zionM}>
                        <Pill k={`launch?id=${r.id}&m=zion`} onClick={launch("zion", `launch zion 50/50 on ${r.id}?\n\nNOTE: kills SRBMiner sessions for exclusive GPU`)}>50/50</Pill>
                        <Pill k={`launch?id=${r.id}&m=zionmax`} onClick={launch("zionmax", `launch zion 100/40 on ${r.id}?`)}>100/40</Pill>
                        <Pill k={`launch?id=${r.id}&m=prl`} onClick={launch("prl", `launch PRL-only on ${r.id}?`)}>PRL</Pill>
                        <Pill k={`launch?id=${r.id}&m=qtu`} onClick={launch("qtu", `launch QTU-only on ${r.id}?`)}>QTU</Pill>
                        <input
                          id={`dprl-${r.id}`}
                          inputMode="numeric"
                          placeholder="PRL%"
                          aria-label="PRL duty percent"
                          className="min-h-8 w-14 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-center text-[11px] text-white placeholder-white/25 focus:border-white/30 focus:outline-none"
                        />
                        <input
                          id={`dqtu-${r.id}`}
                          inputMode="numeric"
                          placeholder="QTU%"
                          aria-label="QTU duty percent"
                          className="min-h-8 w-14 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-center text-[11px] text-white placeholder-white/25 focus:border-white/30 focus:outline-none"
                        />
                        <Pill k="" tone="ghost" onClick={() => {
                          const p = (document.getElementById(`dprl-${r.id}`) as HTMLInputElement)?.value || "50";
                          const q = (document.getElementById(`dqtu-${r.id}`) as HTMLInputElement)?.value || "50";
                          if (confirm(`launch zion ${p}/${q} on ${r.id}?`)) ops(`launch?id=${r.id}&m=zion&prl=${encodeURIComponent(p)}&qtu=${encodeURIComponent(q)}`, "POST");
                        }}>custom</Pill>
                        <span className="flex-1" />
                        <Pill k={`stop?id=${r.id}&m=zion`} tone="danger" onClick={stopFn("zion")}>■</Pill>
                        <Lg src="zion" />
                      </Engine>
                      {otherM.length > 0 && (
                        <div className="truncate rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-[10px] text-white/35">
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
                          className="min-h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white placeholder-white/25 focus:border-white/30 focus:outline-none"
                        />
                        <button
                          disabled={!!busy}
                          className="min-h-8 shrink-0 rounded-md border border-white/10 px-3 py-1 text-[11px] font-medium text-white/50 transition hover:border-white/30 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-wait disabled:opacity-40"
                        >
                          {busy.startsWith("exec?") && busy.includes(`id=${r.id}&`) ? "…" : "run"}
                        </button>
                      </form>
                      <Pill k={`stop?id=${r.id}&m=all`} tone="danger" onClick={stopFn("all")}>■ all</Pill>
                      <Lg src="all" />
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
          {!rigs.length && !err && (
            <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center sm:p-12">
              <div className="text-sm font-semibold text-white/65">Fleet data is not available yet</div>
              <p className="mt-2 text-xs leading-relaxed text-white/40">
                {err ? "The status feed could not be loaded. Check the connection and try again." : "Waiting for the Vast status daemon to publish its first snapshot…"}
              </p>
            </div>
          )}
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
                  onClick={loadOffers}
                  disabled={!!busy}
                  className="col-span-2 min-h-11 rounded-lg border border-[#fcd116]/40 bg-[#fcd116]/10 px-4 py-2 text-sm font-semibold text-[#fcd116] transition hover:bg-[#fcd116]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fcd116] disabled:cursor-wait disabled:opacity-40 sm:col-span-1"
                >
                  {busy === "offers" ? "Searching…" : "Search offers"}
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
