import { useEffect } from "react";
import { useOrchestratorStore, type ServiceStatus } from "../../stores/orchestratorStore";
import { ServiceCard } from "./ServiceCard";

const DEMO_SERVICES: ServiceStatus[] = [
  { name: "zion-node", layer: "L1", state: "running", pid: 35840, autoRestart: true, ports: { p2p: 8333, rpc: 8443, ws: 8445, metrics: 9115 }, description: "Zion Core Node — P2P sync, consensus, mempool, RPC" },
  { name: "zion-pool", layer: "L1", state: "running", pid: 20695, autoRestart: true, ports: { stratum: 8444, metrics: 8455 }, description: "Zion Pool Server — stratum mining, share validation" },
  { name: "zion-miner", layer: "L1", state: "running", pid: 42576, autoRestart: true, ports: {}, description: "Zion Miner — CPU/GPU mining (Metal backend)" },
  { name: "zion-bridge", layer: "L2", state: "stopped", pid: null, autoRestart: true, ports: { metrics: 9102 }, description: "Cross-chain bridge daemon" },
  { name: "zion-dao", layer: "L2", state: "stopped", pid: null, autoRestart: true, ports: { api: 8450 }, description: "DAO daemon + Axum HTTP API" },
  { name: "zion-atomic-swap", layer: "L2", state: "stopped", pid: null, autoRestart: true, ports: { api: 8452 }, description: "HTLC swap daemon" },
  { name: "zion-warp", layer: "L3", state: "stopped", pid: null, autoRestart: true, ports: { api: 8453 }, description: "Cross-chain relay daemon" },
  { name: "zion-hiranyagarbha", layer: "L4", state: "stopped", pid: null, autoRestart: true, ports: { api: 8001 }, description: "Orchestrator, RAG, Consciousness, NCL" },
  { name: "zion-hiran-inference", layer: "L4", state: "stopped", pid: null, autoRestart: true, ports: { api: 8002 }, description: "LLM inference API" },
  { name: "zion-mining-agent", layer: "L5", state: "running", pid: 42576, autoRestart: true, ports: {}, description: "Multi-GPU mining agent" },
  { name: "zion-dashboard-web", layer: "L6", state: "running", pid: 43685, autoRestart: true, ports: { http: 8766 }, description: "Python Flask dashboard" },
  { name: "zion-prometheus", layer: "monitoring", state: "stopped", pid: null, autoRestart: true, ports: { http: 9090 }, description: "Metrics collection" },
  { name: "zion-grafana", layer: "monitoring", state: "stopped", pid: null, autoRestart: true, ports: { http: 3100 }, description: "Visualization dashboards" },
  { name: "zion-auto-update", layer: "auto-update", state: "stopped", pid: null, autoRestart: true, ports: {}, description: "Automatic updates" },
];

const LAYER_ORDER = ["L1", "L2", "L3", "L4", "L5", "L6", "monitoring", "auto-update", "SDK"];

export function ServiceGrid() {
  const { services, setServices } = useOrchestratorStore();

  useEffect(() => {
    if (services.length === 0) {
      setServices(DEMO_SERVICES);
    }
  }, [services.length, setServices]);

  const running = services.filter((s) => s.state === "running").length;
  const stopped = services.filter((s) => s.state === "stopped").length;
  const degraded = services.filter((s) => s.state === "degraded").length;

  const grouped = LAYER_ORDER.map((layer) => ({
    layer,
    services: services.filter((s) => s.layer === layer),
  })).filter((g) => g.services.length > 0);

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex gap-4">
        <div className="glass-panel px-4 py-3 flex items-center gap-3">
          <span className="text-zion-dim text-xs font-mono">Total</span>
          <span className="text-xl font-bold text-white font-mono">{services.length}</span>
        </div>
        <div className="glass-panel px-4 py-3 flex items-center gap-3 neon-border-green">
          <span className="text-zion-ok text-xs font-mono">Running</span>
          <span className="text-xl font-bold text-zion-ok font-mono">{running}</span>
        </div>
        <div className="glass-panel px-4 py-3 flex items-center gap-3 neon-border-red">
          <span className="text-zion-critical text-xs font-mono">Stopped</span>
          <span className="text-xl font-bold text-zion-critical font-mono">{stopped}</span>
        </div>
        {degraded > 0 && (
          <div className="glass-panel px-4 py-3 flex items-center gap-3 neon-border-yellow">
            <span className="text-zion-warn text-xs font-mono">Degraded</span>
            <span className="text-xl font-bold text-zion-warn font-mono">{degraded}</span>
          </div>
        )}
      </div>

      {/* Service grids by layer */}
      {grouped.map((group) => (
        <div key={group.layer}>
          <h2 className="text-sm font-bold text-zion-info font-mono mb-3 tracking-wider">
            {group.layer} — {group.services.length} services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {group.services.map((svc) => (
              <ServiceCard key={svc.name} service={svc} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
