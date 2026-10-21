"use client";

import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";

type Hashrate = { rate: number; unit: string; a: number; r: number };
type Miner = {
  algo: string | null;
  pool: string | null;
  worker: string | null;
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
};
type Snap = { ts: string | null; total_dph: number; rigs: Rig[] };

const COIN: Record<string, { name: string; c: string }> = {
  quantus: { name: "QTU", c: "#fcd116" },
  pearlhash: { name: "PRL", c: "#34d399" },
  "rx/0": { name: "XMR", c: "#fb923c" },
};
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

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/vast-rigs/status.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j: Snap) => !stop && (setSnap(j), setErr("")))
        .catch((e) => !stop && setErr(String(e)));
    load();
    const t = setInterval(load, 30000);
    return () => ((stop = true), clearInterval(t));
  }, []);

  const rigs = snap?.rigs || [];

  // ── market ──
  type Offer = {
    id: number; gpu_name: string; dph_total: number; geolocation: string;
    inet_down: number; inet_up: number; reliability: number;
    cuda_max_good: number | string; cpu_ram: number; disk_space: number;
  };
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [mGpu, setMGpu] = useState("RTX_3060");
  const [mDph, setMDph] = useState("");
  const loadOffers = () => {
    setBusy("offers");
    fetch(`/vast-ops/api/offers?gpu=${mGpu}&max_dph=${mDph}`)
      .then((r) => r.json())
      .then((d) => setOffers(Array.isArray(d) ? d : []))
      .catch((e) => alert(String(e)))
      .finally(() => setBusy(""));
  };

  // ── ops calls → /vast-ops/api/* (same realm → browser sends basic auth) ──
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const show = (ok: boolean, text: string) => {
    setToast({ ok, text: text.trim().slice(0, 900) || "(no output)" });
    setTimeout(() => setToast(null), 9000);
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
      <section className="relative flex w-full flex-col items-center justify-center gap-4 px-4 pb-10 pt-24 text-center">
        <span className="rounded-full border border-[#fcd116]/30 bg-black/40 px-4 py-1 text-sm font-semibold text-[#fcd116] backdrop-blur-sm">
          ZION OPS · vast.ai
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl">
          Multi-Mining Rigs
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/80">
            <b className="text-white">{rigs.length}</b> rigs
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/80">
            ${snap ? snap.total_dph.toFixed(4) : "—"}/h · ${snap ? (snap.total_dph * 24).toFixed(2) : "—"}/day
          </span>
          {Object.entries(totals).map(([name, t]) => (
            <span
              key={name}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold"
              style={{ borderColor: `${t.c}66`, background: `${t.c}14`, color: t.c }}
            >
              {name} {t.v >= 1000 ? t.v.toFixed(0) : t.v.toFixed(1)} {t.unit}
            </span>
          ))}
        </div>
        <p className="text-xs text-white/40">
          updated {snap?.ts || "—"} · auto-refresh 30 s
          {err && <span className="ml-2 text-[#ff7b72]">· {err}</span>}
        </p>
      </section>

      <article className="active">
        <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-16 sm:grid-cols-2">
          {rigs.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 backdrop-blur transition hover:border-[#fcd116]/30"
            >
              {/* rig header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      r.error ? "bg-[#ff7b72]" : "bg-[#34d399]"
                    } shadow-[0_0_8px_currentColor]`}
                  />
                  <b className="text-lg text-white">#{r.id}</b>
                  <span className="text-sm text-white/70">{r.gpu_name}</span>
                </div>
                <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-white/60">
                  ${r.dph.toFixed(4)}/h
                </span>
              </div>
              <div className="mt-1 text-xs text-white/40">
                {r.geo} · gpu {r.gpu?.util ?? "?"} · {r.gpu?.power ?? "?"} ·{" "}
                {r.gpu?.temp ?? "?"} · vram {r.gpu?.mem ?? "?"}
              </div>
              {r.error && <div className="mt-2 text-xs text-[#ff7b72]">{r.error}</div>}

              {/* miners */}
              <div className="mt-4 space-y-3">
                {r.miners.map((m, i) => {
                  const coin = coinOf(m);
                  return (
                    <div
                      key={i}
                      className="rounded-lg border p-3"
                      style={{ borderColor: `${coin.c}30`, background: `${coin.c}08` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="rounded-full border px-2.5 py-0.5 text-xs font-bold"
                          style={{ borderColor: `${coin.c}55`, color: coin.c }}
                        >
                          {coin.name}
                        </span>
                        <Spark data={m.hist} color={coin.c} />
                      </div>
                      <div className="mt-1.5 text-base">{fmt(m.hashrate)}</div>
                      <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[11px] text-white/35">
                        <span className="truncate">{m.pool || "—"}</span>
                        {m.etime && <span className="shrink-0">up {m.etime}</span>}
                      </div>
                    </div>
                  );
                })}
                {!r.miners.length && (
                  <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-white/30">
                    idle — no miners
                  </div>
                )}
              </div>

              {/* ops controls */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-3">
                {(["srb", "zion", "xmr", "all"] as const).map((m) => (
                  <button
                    key={m}
                    disabled={!!busy}
                    onClick={() => confirm(`launch ${m} on ${r.id}?`) && ops(`launch?id=${r.id}&m=${m}`, "POST")}
                    className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 transition hover:border-[#fcd116]/50 hover:text-[#fcd116] disabled:opacity-40"
                  >
                    ▸ {m}
                  </button>
                ))}
                <form
                  className="flex min-w-0 basis-full gap-1 sm:basis-auto sm:flex-1 sm:justify-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const inp = (e.target as HTMLFormElement).elements.namedItem("c") as HTMLInputElement;
                    if (inp.value.trim()) ops(`exec?id=${r.id}&cmd=${encodeURIComponent(inp.value)}`);
                    inp.value = "";
                  }}
                >
                  <input
                    name="c"
                    placeholder="ssh cmd…"
                    className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:border-[#fcd116]/50 focus:outline-none sm:w-36 sm:flex-none"
                  />
                  <button className="shrink-0 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 hover:border-[#34d399]/50 hover:text-[#34d399]">
                    run
                  </button>
                </form>
              </div>
            </div>
          ))}
          {!rigs.length && !err && (
            <div className="col-span-full rounded-xl border border-dashed border-white/10 p-10 text-center text-white/40">
              waiting for vastctl daemon…
            </div>
          )}
        </section>

        {/* ── market ── */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold text-white">
                market <span className="text-sm font-normal text-white/40">— offers, cheapest first</span>
              </h2>
              <select
                value={mGpu}
                onChange={(e) => setMGpu(e.target.value)}
                className="rounded-md border border-white/15 bg-black/40 px-2.5 py-1.5 text-sm text-white focus:border-[#fcd116]/50 focus:outline-none"
              >
                {["RTX_3060", "RTX_3070", "RTX_3060_Ti", "RTX_4060", "RTX_3080", "any"].map((g) => (
                  <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
                ))}
              </select>
              <input
                value={mDph}
                onChange={(e) => setMDph(e.target.value)}
                placeholder="max $/h"
                className="w-24 rounded-md border border-white/15 bg-black/40 px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:border-[#fcd116]/50 focus:outline-none"
              />
              <button
                onClick={loadOffers}
                disabled={!!busy}
                className="rounded-md border border-[#fcd116]/40 bg-[#fcd116]/10 px-4 py-1.5 text-sm font-semibold text-[#fcd116] transition hover:bg-[#fcd116]/20 disabled:opacity-40"
              >
                {busy === "offers" ? "searching…" : "search"}
              </button>
            </div>

            {offers && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/40">
                      {["offer", "gpu", "$/h", "$/day", "inet↓↑", "reliab", "cuda", "ram", "location", ""].map((h) => (
                        <th key={h} className="px-2 py-1.5 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o) => (
                      <tr key={o.id} className="border-t border-white/5 text-white/80 transition hover:bg-white/[0.04]">
                        <td className="px-2 py-1.5 font-mono text-xs">{o.id}</td>
                        <td className="px-2 py-1.5">{o.gpu_name}</td>
                        <td className="px-2 py-1.5 font-semibold text-[#fcd116]">${o.dph_total.toFixed(4)}</td>
                        <td className="px-2 py-1.5">${(o.dph_total * 24).toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-white/60">{Math.round(o.inet_down)}/{Math.round(o.inet_up)}</td>
                        <td className="px-2 py-1.5 text-white/60">{(o.reliability * 100).toFixed(1)}%</td>
                        <td className="px-2 py-1.5 text-white/60">{o.cuda_max_good}</td>
                        <td className="px-2 py-1.5 text-white/60">{Math.round(o.cpu_ram / 1024)}G</td>
                        <td className="px-2 py-1.5 text-white/60">{o.geolocation}</td>
                        <td className="px-2 py-1.5">
                          <button
                            disabled={!!busy}
                            onClick={() => confirm(`RENT offer ${o.id} — $${o.dph_total.toFixed(4)}/h?\nThis bills your vast.ai account!`) && ops(`rent?id=${o.id}`, "POST")}
                            className="rounded-md border border-[#34d399]/40 bg-[#34d399]/10 px-3 py-1 text-xs font-semibold text-[#34d399] transition hover:bg-[#34d399]/20 disabled:opacity-40"
                          >
                            rent
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!offers.length && (
                      <tr><td colSpan={10} className="px-2 py-6 text-center text-white/30">no offers match</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </article>

      {/* toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 max-w-md whitespace-pre-wrap rounded-xl border p-4 text-xs backdrop-blur-md shadow-2xl ${
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
