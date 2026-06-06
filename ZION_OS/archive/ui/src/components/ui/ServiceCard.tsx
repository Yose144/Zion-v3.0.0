import { type ServiceStatus } from "../../hooks/useTauri";

interface Props {
  service: ServiceStatus;
  onControl: (name: string, action: "start" | "stop" | "restart") => void;
}

const LAYER_COLORS: Record<string, string> = {
  L1: "text-blue-400",
  L2: "text-purple-400",
  L3: "text-pink-400",
  L4: "text-orange-400",
  L5: "text-yellow-400",
  L6: "text-green-400",
  monitoring: "text-cyan-400",
  "auto-update": "text-gray-400",
  SDK: "text-gray-400",
};

function getStatusColor(state: string) {
  switch (state) {
    case "running":
      return "text-zion-ok";
    case "stopped":
      return "text-zion-critical";
    case "degraded":
      return "text-zion-warn";
    default:
      return "text-zion-dim";
  }
}

function getBorderClass(state: string) {
  switch (state) {
    case "running":
      return "neon-border-green";
    case "stopped":
      return "neon-border-red";
    case "degraded":
      return "neon-border-yellow";
    default:
      return "";
  }
}

export function ServiceCard({ service, onControl }: Props) {
  const ports = Object.entries(service.ports)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ") || "N/A";

  return (
    <div className={`glass-panel p-4 transition-all duration-300 hover:scale-[1.02] ${getBorderClass(service.state)}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono">{service.name}</h3>
          <span className={`text-[10px] ${LAYER_COLORS[service.layer] || "text-gray-400"}`}>
            {service.layer}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${getStatusColor(service.state)}`}>
            {service.state === "running" ? "●" : "○"} {service.state}
          </span>
          {service.auto_restart && <span className="text-[10px] text-zion-warn">♻</span>}
        </div>
      </div>

      <p className="text-[11px] text-zion-dim mb-3 line-clamp-2">{service.description}</p>

      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mb-3">
        <div>
          <span className="text-zion-dim">PID:</span>{" "}
          <span className="text-white">{service.pid ?? "—"}</span>
        </div>
        <div>
          <span className="text-zion-dim">Ports:</span>{" "}
          <span className="text-white">{ports}</span>
        </div>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={() => onControl(service.name, "start")}
          className="flex-1 text-[10px] bg-zion-ok/20 hover:bg-zion-ok/30 text-zion-ok border border-zion-ok/30 rounded px-2 py-1 transition-colors"
        >
          ▶
        </button>
        <button
          onClick={() => onControl(service.name, "stop")}
          className="flex-1 text-[10px] bg-zion-critical/20 hover:bg-zion-critical/30 text-zion-critical border border-zion-critical/30 rounded px-2 py-1 transition-colors"
        >
          ⏹
        </button>
        <button
          onClick={() => onControl(service.name, "restart")}
          className="flex-1 text-[10px] bg-zion-warn/20 hover:bg-zion-warn/30 text-zion-warn border border-zion-warn/30 rounded px-2 py-1 transition-colors"
        >
          ↻
        </button>
      </div>
    </div>
  );
}
