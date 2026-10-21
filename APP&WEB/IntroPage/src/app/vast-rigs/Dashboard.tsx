"use client";

import { useEffect, useState } from "react";

type Hashrate = { rate: number; unit: string; a: number; r: number };
type Miner = {
  algo: string | null;
  pool: string | null;
  worker: string | null;
  hashrate?: Hashrate;
  hist?: number[];
};
type XmrigApi = {
  algo: string;
  hps_10s: number;
  hps_15m: number;
  shares_good: number;
  shares_total: number;
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
  xmrig_api: XmrigApi | null;
  error: string | null;
};
type Snap = { ts: string | null; total_dph: number; rigs: Rig[] };

function Spark({ data, w = 120, h = 28 }: { data?: number[]; w?: number; h?: number }) {
  if (!data || data.length < 2) return <span className="dim">—</span>;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="spark">
      <polyline points={pts} fill="none" stroke="#7ee787" strokeWidth="1.5" />
    </svg>
  );
}

function fmt(hr?: Hashrate) {
  return hr ? `${hr.rate.toFixed(2)} ${hr.unit} · A${hr.a} R${hr.r}` : "—";
}

export default function Dashboard() {
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

  return (
    <main className="vast">
      <style jsx global>{`
        body { background: #0b0e14; }
        .vast { color: #cfd8e3; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 20px; max-width: 1200px; margin: 0 auto; }
        .vast h1 { font-size: 18px; font-weight: 600; }
        .vast .tot { color: #8b98a9; margin: 8px 0 18px; font-size: 13px; }
        .vast .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 12px; }
        .vast .card { background: #121723; border: 1px solid #232c3d; border-radius: 10px; padding: 14px; }
        .vast .hd b { color: #7ee787; }
        .vast .sub, .vast .dim { color: #8b98a9; font-size: 12px; }
        .vast .err { color: #ff7b72; font-size: 12px; }
        .vast table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        .vast td { padding: 4px 6px; vertical-align: middle; }
        .vast .algo { color: #79c0ff; }
        .vast .spark { display: block; }
        .vast .tag { display: inline-block; background: #1f2d1f; color: #7ee787; border-radius: 4px; padding: 0 6px; font-size: 11px; margin-left: 6px; }
        .vast .tag.warn { background: #3d2d1f; color: #ffb86b; }
      `}</style>
      <h1>vast rigs · multi-mining</h1>
      <div className="tot">
        {snap
          ? `${rigs.length} rigs · $${snap.total_dph.toFixed(4)}/h = $${(snap.total_dph * 24).toFixed(2)}/day · updated ${snap.ts || "?"} · auto 30s`
          : err
            ? `status.json: ${err}`
            : "loading…"}
      </div>
      <div className="grid">
        {rigs.map((r) => (
          <div className="card" key={r.id}>
            <div className="hd">
              <b>#{r.id}</b> · {r.gpu_name} <span className="dim">· {r.geo} · ${r.dph.toFixed(4)}/h</span>
              {r.status !== "running" && <span className="tag warn">{r.status}</span>}
            </div>
            <div className="sub">
              gpu {r.gpu?.util ?? "?"} · {r.gpu?.power ?? "?"} · {r.gpu?.temp ?? "?"} · vram {r.gpu?.mem ?? "?"} · {r.ssh}
            </div>
            {r.error && <div className="err">{r.error}</div>}
            <table>
              <tbody>
                {r.miners.map((m, i) => (
                  <tr key={i}>
                    <td className="algo">{m.algo || "?"}</td>
                    <td className="dim">{m.pool || ""}</td>
                    <td>{fmt(m.hashrate)}</td>
                    <td><Spark data={m.hist} /></td>
                  </tr>
                ))}
                {r.xmrig_api && (
                  <tr>
                    <td className="algo">{r.xmrig_api.algo}</td>
                    <td className="dim">cpu · xmrig</td>
                    <td>{r.xmrig_api.hps_15m.toFixed(0)} H/s · S{r.xmrig_api.shares_good}/{r.xmrig_api.shares_total}</td>
                    <td><Spark data={r.xmrig_api.hist} /></td>
                  </tr>
                )}
                {!r.miners.length && !r.xmrig_api && (
                  <tr><td colSpan={4} className="dim">idle — no miners</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </main>
  );
}
