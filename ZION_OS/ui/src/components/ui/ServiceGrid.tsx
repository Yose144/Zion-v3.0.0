import { useEffect, useState, useCallback } from "react";
import {
  getServices,
  startService,
  stopService,
  restartService,
  type ServiceStatus,
} from "../../hooks/useTauri";
import { ServiceCard } from "./ServiceCard";

const LAYER_ORDER = [
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "monitoring",
  "auto-update",
  "SDK",
];

export function ServiceGrid() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getServices();
      setServices(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleControl = useCallback(
    async (name: string, action: "start" | "stop" | "restart") => {
      try {
        if (action === "start") await startService(name);
        else if (action === "stop") await stopService(name);
        else if (action === "restart") await restartService(name);
        setTimeout(load, 1000);
      } catch (e) {
        alert(String(e));
      }
    },
    [load]
  );

  const running = services.filter((s) => s.state === "running").length;
  const stopped = services.filter((s) => s.state === "stopped").length;
  const degraded = services.filter((s) => s.state === "degraded").length;

  const grouped = LAYER_ORDER.map((layer) => ({
    layer,
    services: services.filter((s) => s.layer === layer),
  })).filter((g) => g.services.length > 0);

  if (loading && services.length === 0) {
    return (
      <div className="text-zion-dim font-mono animate-pulse">
        Loading services from manifest...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-zion-critical font-mono">
        Error: {error}
        <button
          onClick={load}
          className="ml-4 text-xs bg-zion-critical/20 text-zion-critical px-2 py-1 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex gap-4">
        <div className="glass-panel px-4 py-3 flex items-center gap-3">
          <span className="text-zion-dim text-xs font-mono">Total</span>
          <span className="text-xl font-bold text-white font-mono">
            {services.length}
          </span>
        </div>
        <div className="glass-panel px-4 py-3 flex items-center gap-3 neon-border-green">
          <span className="text-zion-ok text-xs font-mono">Running</span>
          <span className="text-xl font-bold text-zion-ok font-mono">
            {running}
          </span>
        </div>
        <div className="glass-panel px-4 py-3 flex items-center gap-3 neon-border-red">
          <span className="text-zion-critical text-xs font-mono">Stopped</span>
          <span className="text-xl font-bold text-zion-critical font-mono">
            {stopped}
          </span>
        </div>
        {degraded > 0 && (
          <div className="glass-panel px-4 py-3 flex items-center gap-3 neon-border-yellow">
            <span className="text-zion-warn text-xs font-mono">Degraded</span>
            <span className="text-xl font-bold text-zion-warn font-mono">
              {degraded}
            </span>
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
              <ServiceCard
                key={svc.name}
                service={svc}
                onControl={handleControl}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
