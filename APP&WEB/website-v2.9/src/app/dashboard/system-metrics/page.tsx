import React from "react";
import type { Metadata } from "next";
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL } from '@/lib/site';
import { Activity, ExternalLink } from "lucide-react";

const GRAFANA_BASE_URL = (process.env.NEXT_PUBLIC_GRAFANA_BASE_URL || "https://app.zionterranova.com/grafana").replace(/\/$/, "");
const IFRAME_SRC = `${GRAFANA_BASE_URL}/d/system-metrics/full-system-dashboard?orgId=1&theme=dark&kiosk=tv`;
const DASHBOARD_URL = `${GRAFANA_BASE_URL}/d/system-metrics/full-system-dashboard`;

export const metadata: Metadata = {
  title: `Full System Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: `End-to-end system metrics: CPU, RAM, RPC latency, API health, and uptime for the live ${SITE_RELEASE_LABEL} public line on the ${SITE_RUNTIME_LABEL} runtime.`,
};

export default function SystemMetricsPage() {
  return (
    <div className="zion-page text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-zion-cyan/15 flex items-center justify-center">
              <Activity className="h-4 w-4 text-zion-cyan" />
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Monitoring</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-gradient mt-2">Full System Dashboard</h1>
          <p className="mt-2 text-sm text-gray-300">CPU/RAM · RPC latency · API health · uptime</p>
        </div>

        <div className="zion-rainbow-card p-3" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
          <iframe
            src={IFRAME_SRC}
            title="Full System Dashboard"
            width="100%"
            height="900"
            frameBorder="0"
            className="w-full rounded-2xl"
          />
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm text-zion-cyan">
          <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Open in Grafana
          </a>
          <span className="text-gray-600">/</span>
          <a href={`${GRAFANA_BASE_URL}/`} target="_blank" rel="noreferrer" className="hover:underline text-gray-300">Grafana Home</a>
        </div>
      </div>
    </div>
  );
}
