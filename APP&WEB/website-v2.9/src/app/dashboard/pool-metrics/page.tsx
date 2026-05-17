import type { Metadata } from "next";

const GRAFANA_BASE_URL = (process.env.NEXT_PUBLIC_GRAFANA_BASE_URL || "https://zionterranova.com/grafana").replace(/\/$/, "");
const IFRAME_SRC = `${GRAFANA_BASE_URL}/d/pool-metrics/pool-metrics-dashboard?orgId=1&theme=dark&kiosk=tv`;
const DASHBOARD_URL = `${GRAFANA_BASE_URL}/d/pool-metrics/pool-metrics-dashboard`;

export const metadata: Metadata = {
  title: "Pool Metrics Dashboard · ZION v2.9",
  description: "Live mining pool metrics: hashrate, workers, shares, and block discovery for ZION v2.9.",
};

export default function PoolMetricsPage() {
  return (
    <div className="text-white pb-16">
      <div className="zion-container max-w-6xl pt-28">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Monitoring</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-gradient">Pool Metrics Dashboard</h1>
          <p className="mt-2 text-sm text-gray-300">Hashrate · workers · shares · block discovery rate</p>
        </div>

        <div className="zion-panel p-3">
          <iframe
            src={IFRAME_SRC}
            title="Pool Metrics Dashboard"
            width="100%"
            height="900"
            frameBorder="0"
            className="w-full rounded-xl"
          />
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm text-zion-cyan">
          <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" className="hover:underline">Open in Grafana</a>
          <span className="text-gray-600">/</span>
          <a href={`${GRAFANA_BASE_URL}/`} target="_blank" rel="noreferrer" className="hover:underline text-gray-300">Grafana Home</a>
        </div>
      </div>
    </div>
  );
}
