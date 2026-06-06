import type { Dispatch, SetStateAction } from "react";

type Tab = "overview" | "services" | "topology" | "gpu" | "oasis" | "logs" | "settings";

interface SidebarProps {
  activeTab: Tab;
  onTabChange: Dispatch<SetStateAction<Tab>>;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◈" },
  { id: "services", label: "Services", icon: "◉" },
  { id: "topology", label: "Topology", icon: "◊" },
  { id: "gpu", label: "GPU Metrics", icon: "◆" },
  { id: "oasis", label: "OASIS", icon: "🌸" },
  { id: "logs", label: "Logs", icon: "▤" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 glass-panel border-r border-zion-border m-4 flex flex-col">
      <div className="p-4 border-b border-zion-border">
        <h1 className="text-lg font-bold text-glow-green font-mono tracking-wider">
          ZION OS
        </h1>
        <p className="text-[10px] text-zion-dim font-mono mt-1">RTX Spark v3.0.0</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-mono transition-all duration-200 flex items-center gap-3 ${
              activeTab === tab.id
                ? "bg-zion-ok/10 text-zion-ok neon-border-green shadow-glow-green"
                : "text-zion-dim hover:text-white hover:bg-white/5"
            }`}
          >
            <span className={activeTab === tab.id ? "text-zion-ok" : "text-zion-dim"}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-zion-border">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-zion-ok animate-pulse" />
          <span className="text-zion-ok">Connected</span>
        </div>
        <p className="text-[10px] text-zion-dim mt-2 font-mono">
          100.76.16.108:8444
        </p>
      </div>
    </aside>
  );
}
