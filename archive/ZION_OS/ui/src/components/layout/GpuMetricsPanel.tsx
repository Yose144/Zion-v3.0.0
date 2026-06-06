import { useEffect, useState } from "react";
import { getHardwareMetrics, type HardwareMetricsData } from "../../hooks/useTauri";
import { GpuGauge } from "../canvas/GpuGauge";
import { CpuHeatmap } from "../canvas/CpuHeatmap";
import { Sparkline } from "../canvas/Sparkline";

export function GpuMetricsPanel() {
  const [metrics, setMetrics] = useState<HardwareMetricsData | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getHardwareMetrics();
        if (data) {
          setMetrics(data);
          setHistory((prev) => [...prev.slice(-29), data.gpu_usage || 0]);
          setError(null);
        }
      } catch (e) {
        setError(String(e));
      }
    };

    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return <div className="text-zion-critical font-mono">Error: {error}</div>;
  }

  if (!metrics) {
    return (
      <div className="text-zion-dim font-mono animate-pulse">
        Loading hardware metrics...
      </div>
    );
  }

  const gpuVramPercent = metrics.gpu_vram_total > 0
    ? (metrics.gpu_vram_used / metrics.gpu_vram_total) * 100
    : 0;

  const memPercent = metrics.memory_total > 0
    ? (metrics.memory_used / metrics.memory_total) * 100
    : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-zion-warn font-mono">GPU / Hardware Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-panel p-4 flex flex-col items-center">
          <GpuGauge
            value={metrics.gpu_usage}
            label="GPU Util"
            sublabel={`${Math.round(metrics.gpu_usage)}%`}
            color="#00ccff"
          />
        </div>
        <div className="glass-panel p-4 flex flex-col items-center">
          <GpuGauge
            value={gpuVramPercent}
            label="GPU VRAM"
            sublabel={`${metrics.gpu_vram_used.toFixed(1)} / ${metrics.gpu_vram_total.toFixed(0)} GB`}
            color="#ffcc00"
          />
        </div>
        <div className="glass-panel p-4 flex flex-col items-center">
          <GpuGauge
            value={metrics.gpu_temp}
            label="GPU Temp"
            sublabel={`${Math.round(metrics.gpu_temp)}°C`}
            color="#ff3366"
          />
        </div>
        <div className="glass-panel p-4 flex flex-col items-center">
          <GpuGauge
            value={metrics.cpu_usage}
            label="CPU Util"
            sublabel={`${metrics.cpu_cores.length} cores`}
            color="#00ffaa"
          />
          <div className="mt-3">
            <CpuHeatmap cores={metrics.cpu_cores} size={100} />
          </div>
        </div>
        <div className="glass-panel p-4 flex flex-col items-center">
          <GpuGauge
            value={memPercent}
            label="Memory"
            sublabel={`${metrics.memory_used.toFixed(1)} / ${metrics.memory_total.toFixed(1)} GB`}
            color="#cc66ff"
          />
        </div>
        <div className="glass-panel p-4">
          <p className="text-xs text-zion-dim font-mono mb-2">GPU Util History</p>
          <Sparkline data={history.length > 1 ? history : [0, 0]} color="#00ffaa" />
          <p className="text-xs text-zion-ok font-mono mt-1">
            {history.length > 0 ? `${Math.round(history[history.length - 1])}%` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
