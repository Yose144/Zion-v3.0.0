import { invoke } from "@tauri-apps/api/core";

const API_BASE = "http://127.0.0.1:8766";
const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

export interface ServiceStatus {
  name: string;
  layer: string;
  state: string;
  pid: number | null;
  auto_restart: boolean;
  ports: Record<string, number>;
  description: string;
}

// Helper to transform HTTP API response to ServiceStatus[]
function transformHttpServices(data: any): ServiceStatus[] {
  if (!data || !data.services) return [];
  return Object.entries(data.services).map(([name, cfg]: [string, any]) => ({
    name,
    layer: cfg.layer || "unknown",
    state: cfg.state || "unknown",
    pid: cfg.pid || null,
    auto_restart: cfg.auto_restart || false,
    ports: cfg.ports || {},
    description: cfg.description || "",
  }));
}

export async function getServices(): Promise<ServiceStatus[]> {
  if (isTauri) {
    return invoke("get_services");
  }
  // HTTP fallback for browser dev
  try {
    const resp = await fetch(`${API_BASE}/api/orchestrator/status`);
    const data = await resp.json();
    return transformHttpServices(data);
  } catch (e) {
    console.warn("HTTP fallback failed, using demo data:", e);
    // Return demo data as last resort
    return getDemoServices();
  }
}

export async function getOrchestratorStatus(): Promise<{
  timestamp: string;
  services: ServiceStatus[];
}> {
  if (isTauri) {
    return invoke("get_orchestrator_status");
  }
  try {
    const resp = await fetch(`${API_BASE}/api/orchestrator/status`);
    const data = await resp.json();
    return {
      timestamp: data.timestamp || new Date().toISOString(),
      services: transformHttpServices(data),
    };
  } catch (e) {
    return {
      timestamp: new Date().toISOString(),
      services: getDemoServices(),
    };
  }
}

export async function startService(service: string): Promise<string> {
  if (isTauri) {
    return invoke("start_service", { service });
  }
  try {
    const resp = await fetch(`${API_BASE}/api/orchestrator/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service }),
    });
    const data = await resp.json();
    return data.message || data.error || "Done";
  } catch (e) {
    return `Would start ${service} (browser mode)`;
  }
}

export async function stopService(service: string): Promise<string> {
  if (isTauri) {
    return invoke("stop_service", { service });
  }
  try {
    const resp = await fetch(`${API_BASE}/api/orchestrator/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service }),
    });
    const data = await resp.json();
    return data.message || data.error || "Done";
  } catch (e) {
    return `Would stop ${service} (browser mode)`;
  }
}

export async function restartService(service: string): Promise<string> {
  if (isTauri) {
    return invoke("restart_service", { service });
  }
  try {
    const resp = await fetch(`${API_BASE}/api/orchestrator/restart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service }),
    });
    const data = await resp.json();
    return data.message || data.error || "Done";
  } catch (e) {
    return `Would restart ${service} (browser mode)`;
  }
}

function getDemoServices(): ServiceStatus[] {
  return [
    { name: "zion-node", layer: "L1", state: "running", pid: 35840, auto_restart: true, ports: { p2p: 8333, rpc: 8443, ws: 8445, metrics: 9115 }, description: "Zion Core Node — P2P sync, consensus, mempool, RPC" },
    { name: "zion-pool", layer: "L1", state: "running", pid: 20695, auto_restart: true, ports: { stratum: 8444, metrics: 8455 }, description: "Zion Pool Server — stratum mining, share validation" },
    { name: "zion-miner", layer: "L1", state: "running", pid: 42576, auto_restart: true, ports: {}, description: "Zion Miner — CPU/GPU mining (Metal backend)" },
    { name: "zion-bridge", layer: "L2", state: "stopped", pid: null, auto_restart: true, ports: { metrics: 9102 }, description: "Cross-chain bridge daemon" },
    { name: "zion-dao", layer: "L2", state: "stopped", pid: null, auto_restart: true, ports: { api: 8450 }, description: "DAO daemon + Axum HTTP API" },
    { name: "zion-atomic-swap", layer: "L2", state: "stopped", pid: null, auto_restart: true, ports: { api: 8452 }, description: "HTLC swap daemon" },
    { name: "zion-warp", layer: "L3", state: "stopped", pid: null, auto_restart: true, ports: { api: 8453 }, description: "Cross-chain relay daemon" },
    { name: "zion-hiranyagarbha", layer: "L4", state: "stopped", pid: null, auto_restart: true, ports: { api: 8001 }, description: "Orchestrator, RAG, Consciousness, NCL" },
    { name: "zion-hiran-inference", layer: "L4", state: "stopped", pid: null, auto_restart: true, ports: { api: 8002 }, description: "LLM inference API" },
    { name: "zion-mining-agent", layer: "L5", state: "running", pid: 42576, auto_restart: true, ports: {}, description: "Multi-GPU mining agent" },
    { name: "zion-dashboard-web", layer: "L6", state: "running", pid: 43685, auto_restart: true, ports: { http: 8766 }, description: "Python Flask dashboard" },
    { name: "zion-prometheus", layer: "monitoring", state: "stopped", pid: null, auto_restart: true, ports: { http: 9090 }, description: "Metrics collection" },
    { name: "zion-grafana", layer: "monitoring", state: "stopped", pid: null, auto_restart: true, ports: { http: 3100 }, description: "Visualization dashboards" },
    { name: "zion-auto-update", layer: "auto-update", state: "stopped", pid: null, auto_restart: true, ports: {}, description: "Automatic updates" },
  ];
}

export interface HardwareMetricsData {
  cpu_usage: number;
  cpu_cores: number[];
  cpu_temp: number;
  gpu_usage: number;
  gpu_vram_used: number;
  gpu_vram_total: number;
  gpu_temp: number;
  memory_total: number;
  memory_used: number;
  network_rx: number;
  network_tx: number;
}

export async function getHardwareMetrics(): Promise<HardwareMetricsData | null> {
  if (isTauri) {
    return invoke("get_hardware_metrics_cmd");
  }
  // Browser fallback - no real hardware access
  return {
    cpu_usage: 25 + Math.random() * 30,
    cpu_cores: Array.from({ length: 8 }, () => Math.random() * 80),
    cpu_temp: 45 + Math.random() * 20,
    gpu_usage: 60 + Math.random() * 25,
    gpu_vram_used: 3.2,
    gpu_vram_total: 8,
    gpu_temp: 65 + Math.random() * 10,
    memory_total: 32,
    memory_used: 16 + Math.random() * 8,
    network_rx: 10 + Math.random() * 5,
    network_tx: 7 + Math.random() * 3,
  };
}

export async function getSystemInfo(): Promise<{
  os: string;
  arch: string;
  version: string;
}> {
  if (isTauri) {
    return invoke("get_system_info");
  }
  return {
    os: navigator.platform,
    arch: "unknown",
    version: "3.0.0 (browser)",
  };
}
