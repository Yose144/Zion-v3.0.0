import type { Metadata } from "next";
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL } from '@/lib/site';

const GRAFANA_BASE_URL = (process.env.NEXT_PUBLIC_GRAFANA_BASE_URL || "https://zionterranova.com/grafana").replace(/\/$/, "");
const IFRAME_SRC = `${GRAFANA_BASE_URL}/d/system-metrics/full-system-dashboard?orgId=1&theme=dark&kiosk=tv`;
const DASHBOARD_URL = `${GRAFANA_BASE_URL}/d/system-metrics/full-system-dashboard`;

export const metadata: Metadata = {
  title: `Full System Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: `End-to-end system metrics: CPU, RAM, RPC latency, API health, and uptime for the live ${SITE_RELEASE_LABEL} public line on the ${SITE_RUNTIME_LABEL} runtime.`,
};

export default function SystemMetricsPage() {
  return (
    <div className="zion-shell min-h-screen text-white pb-16">
      <div className="zion-container max-w-6xl pt-20">
        <div className="mb-6">
          <p className="zion-kicker">Monitoring</p>
          <h1 className="zion-section-title mt-3">Full System Dashboard</h1>
          <p className="zion-section-sub mt-2">CPU/RAM · RPC latency · API health · uptime</p>
        </div>

        <div className="zion-panel p-3 shadow-lg">
          <iframe
            src={IFRAME_SRC}
            title="Full System Dashboard"
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
