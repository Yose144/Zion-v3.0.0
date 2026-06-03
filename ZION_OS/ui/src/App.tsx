import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ServiceGrid } from "./components/ui/ServiceGrid";
import { Sidebar } from "./components/ui/Sidebar";
import { GpuGauge } from "./components/canvas/GpuGauge";
import { CpuHeatmap } from "./components/canvas/CpuHeatmap";
import { Sparkline } from "./components/canvas/Sparkline";
import { NetworkScene } from "./components/three/NetworkScene";
import { LogTail } from "./components/ui/LogTail";
import { useState } from "react";

type Tab = "overview" | "services" | "topology" | "gpu" | "logs" | "settings";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("services");

  return (
    <DashboardLayout>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "services" && <ServiceGrid />}
          {activeTab === "overview" && (
            <div className="text-center mt-20">
              <h1 className="text-4xl font-bold text-glow-green mb-4">
                Zion OS — RTX Spark
              </h1>
              <p className="text-zion-dim font-mono">
                GPU-accelerated Mainnet Operations System
              </p>
              <p className="text-zion-dim text-sm mt-2">
                Select "Services" from sidebar to manage the ecosystem
              </p>
            </div>
          )}
          {activeTab === "topology" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-zion-info font-mono">Network Topology</h2>
              <NetworkScene />
            </div>
          )}
          {activeTab === "gpu" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-zion-warn font-mono">GPU / Hardware Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="glass-panel p-4 flex flex-col items-center">
                  <GpuGauge value={87} label="GPU Util" sublabel="Apple M1 Metal" color="#00ccff" />
                </div>
                <div className="glass-panel p-4 flex flex-col items-center">
                  <GpuGauge value={45} label="GPU VRAM" sublabel="3.2 / 8 GB" color="#ffcc00" />
                </div>
                <div className="glass-panel p-4 flex flex-col items-center">
                  <GpuGauge value={62} label="GPU Temp" sublabel="72°C" color="#ff3366" />
                </div>
                <div className="glass-panel p-4 flex flex-col items-center">
                  <GpuGauge value={38} label="CPU Util" sublabel="8 cores" color="#00ffaa" />
                  <div className="mt-3">
                    <CpuHeatmap cores={[12, 34, 56, 78, 23, 45, 67, 89]} size={100} />
                  </div>
                </div>
                <div className="glass-panel p-4 flex flex-col items-center">
                  <GpuGauge value={58} label="Memory" sublabel="18.5 / 32 GB" color="#cc66ff" />
                </div>
                <div className="glass-panel p-4">
                  <p className="text-xs text-zion-dim font-mono mb-2">GPU Hashrate History</p>
                  <Sparkline data={[210, 230, 245, 280, 310, 295, 330, 350, 340, 360, 380, 390, 410, 395, 420]} color="#00ffaa" />
                  <p className="text-xs text-zion-ok font-mono mt-1">420 H/s</p>
                </div>
              </div>
            </div>
          )}
          {activeTab === "logs" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-zion-ok font-mono">System Logs</h2>
              <LogTail />
            </div>
          )}
          {activeTab === "settings" && (
            <div className="glass-panel p-6">
              <h2 className="text-xl font-bold text-zion-dim mb-4">Settings</h2>
              <p className="text-zion-dim">Configuration panel</p>
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}

export default App;
