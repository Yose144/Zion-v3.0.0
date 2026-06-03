import { DashboardLayout } from "./components/layout/DashboardLayout";
import { GpuMetricsPanel } from "./components/layout/GpuMetricsPanel";
import { ServiceGrid } from "./components/ui/ServiceGrid";
import { Sidebar } from "./components/ui/Sidebar";
import { SettingsPanel } from "./components/ui/SettingsPanel";
import { NetworkScene } from "./components/three/NetworkScene";
import { LogTail } from "./components/ui/LogTail";
import { OasisPanel } from "./components/ui/OasisPanel";
import { useState } from "react";

type Tab = "overview" | "services" | "topology" | "gpu" | "oasis" | "logs" | "settings";

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
          {activeTab === "gpu" && <GpuMetricsPanel />}
          {activeTab === "oasis" && <OasisPanel />}
          {activeTab === "logs" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-zion-ok font-mono">System Logs</h2>
              <LogTail />
            </div>
          )}
          {activeTab === "settings" && <SettingsPanel />}
        </main>
      </div>
    </DashboardLayout>
  );
}

export default App;
