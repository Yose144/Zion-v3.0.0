import { useState } from "react";

interface SettingSection {
  title: string;
  items: { label: string; type: "toggle" | "input" | "select"; value: string | boolean; options?: string[] }[];
}

const SETTINGS: SettingSection[] = [
  {
    title: "Appearance",
    items: [
      { label: "Cyberpunk Theme", type: "toggle", value: true },
      { label: "Glassmorphism Panels", type: "toggle", value: true },
      { label: "Neon Glow Effects", type: "toggle", value: true },
      { label: "Grid Background", type: "toggle", value: true },
    ],
  },
  {
    title: "Hardware Monitoring",
    items: [
      { label: "Auto-refresh interval", type: "select", value: "2s", options: ["1s", "2s", "5s", "10s"] },
      { label: "GPU backend", type: "select", value: "Metal", options: ["Metal", "CUDA", "OpenCL", "CPU"] },
      { label: "Show GPU gauges", type: "toggle", value: true },
      { label: "Show CPU heatmap", type: "toggle", value: true },
    ],
  },
  {
    title: "Network",
    items: [
      { label: "Edge Pool Host", type: "input", value: "77.42.71.94:8444" },
      { label: "Edge RPC Host", type: "input", value: "http://77.42.71.94:8443" },
      { label: "Tailscale Enabled", type: "toggle", value: true },
      { label: "Auto-reconnect", type: "toggle", value: true },
    ],
  },
  {
    title: "Notifications",
    items: [
      { label: "Service state changes", type: "toggle", value: true },
      { label: "GPU temperature alerts", type: "toggle", value: true },
      { label: "Low memory warning", type: "toggle", value: true },
      { label: "Block found notification", type: "toggle", value: true },
    ],
  },
];

export function SettingsPanel() {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {};
    SETTINGS.forEach((section) => {
      section.items.forEach((item) => {
        initial[`${section.title}-${item.label}`] = item.value;
      });
    });
    return initial;
  });

  const updateValue = (key: string, val: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-zion-dim font-mono">Settings</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SETTINGS.map((section) => (
          <div key={section.title} className="glass-panel p-4">
            <h3 className="text-sm font-bold text-zion-info font-mono mb-3 tracking-wider">
              {section.title}
            </h3>
            <div className="space-y-3">
              {section.items.map((item) => {
                const key = `${section.title}-${item.label}`;
                return (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-white font-mono">{item.label}</span>
                    {item.type === "toggle" && (
                      <button
                        onClick={() => updateValue(key, !values[key])}
                        className={`w-10 h-5 rounded-full transition-colors relative ${
                          values[key] ? "bg-zion-ok" : "bg-zion-dim/30"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            values[key] ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    )}
                    {item.type === "input" && (
                      <input
                        type="text"
                        value={values[key] as string}
                        onChange={(e) => updateValue(key, e.target.value)}
                        className="bg-black/30 border border-zion-border rounded px-2 py-1 text-xs text-white font-mono w-48 focus:outline-none focus:border-zion-ok"
                      />
                    )}
                    {item.type === "select" && (
                      <select
                        value={values[key] as string}
                        onChange={(e) => updateValue(key, e.target.value)}
                        className="bg-black/30 border border-zion-border rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-zion-ok"
                      >
                        {item.options?.map((opt) => (
                          <option key={opt} value={opt} className="bg-zion-bg">
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
