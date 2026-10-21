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
                      <div className="mt-1 flex items-center justify-between text-[11px] text-white/35">
                        <span className="truncate">{m.pool || "—"}</span>
                        {m.etime && <span>up {m.etime}</span>}
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
            </div>
          ))}
          {!rigs.length && !err && (
            <div className="col-span-full rounded-xl border border-dashed border-white/10 p-10 text-center text-white/40">
              waiting for vastctl daemon…
            </div>
          )}
        </section>
      </article>
    </PageLayout>
  );
}
