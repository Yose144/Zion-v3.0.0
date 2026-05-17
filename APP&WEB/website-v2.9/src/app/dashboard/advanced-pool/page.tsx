import type { Metadata } from "next";

const PROM_BASE_URL = (process.env.NEXT_PUBLIC_PROMETHEUS_BASE_URL || "https://zionterranova.com/prometheus").replace(/\/$/, "");
const IFRAME_SRC = `${PROM_BASE_URL}/graph?g0.expr=&g0.range_input=1h&g0.stacked=0&g0.tab=0`;

export const metadata: Metadata = {
  title: "Advanced Pool Dashboard (Prometheus) · ZION v2.9",
  description: "PromQL explorer for advanced pool metrics and ad-hoc queries on ZION v2.9.",
};

export default function AdvancedPoolPage() {
  return (
    <div className="text-white pb-16">
      <div className="zion-container max-w-6xl pt-28">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Monitoring</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-gradient">Advanced Pool Dashboard</h1>
          <p className="mt-2 text-sm text-gray-300">PromQL explorer · custom queries · live metrics</p>
        </div>

        <div className="zion-panel p-3">
          <iframe
            src={IFRAME_SRC}
            title="Prometheus Graph"
            width="100%"
            height="900"
            frameBorder="0"
            className="w-full rounded-xl bg-white"
          />
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm text-zion-cyan">
          <a href={`${PROM_BASE_URL}/graph`} target="_blank" rel="noreferrer" className="hover:underline">Open in Prometheus</a>
        </div>
      </div>
    </div>
  );
}
