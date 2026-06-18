import type { Metadata } from "next";
import { Activity, ExternalLink } from "lucide-react";

const PROM_BASE_URL = (process.env.NEXT_PUBLIC_PROMETHEUS_BASE_URL || "https://zionterranova.com/prometheus").replace(/\/$/, "");
const IFRAME_SRC = `${PROM_BASE_URL}/graph?g0.expr=&g0.range_input=1h&g0.stacked=0&g0.tab=0`;

export const metadata: Metadata = {
  title: "Advanced Pool Dashboard (Prometheus) · ZION v2.9",
  description: "PromQL explorer for advanced pool metrics and ad-hoc queries on ZION v2.9.",
};

export default function AdvancedPoolPage() {
  return (
    <div className="text-white pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-zion-cyan/15 flex items-center justify-center">
              <Activity className="h-4 w-4 text-zion-cyan" />
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Monitoring</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-gradient mt-2">Advanced Pool Dashboard</h1>
          <p className="mt-2 text-sm text-gray-300">PromQL explorer · custom queries · live metrics</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl p-3 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <iframe
            src={IFRAME_SRC}
            title="Prometheus Graph"
            width="100%"
            height="900"
            frameBorder="0"
            className="w-full rounded-2xl"
          />
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm text-zion-cyan">
          <a href={`${PROM_BASE_URL}/graph`} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Open in Prometheus
          </a>
        </div>
      </div>
    </div>
  );
}
