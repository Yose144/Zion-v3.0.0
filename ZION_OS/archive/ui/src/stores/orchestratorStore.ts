import { create } from "zustand";

export interface ServiceStatus {
  name: string;
  layer: string;
  state: "running" | "stopped" | "degraded" | "failed";
  pid: number | null;
  autoRestart: boolean;
  ports: Record<string, number>;
  description: string;
}

export interface HardwareMetrics {
  cpu: { usage: number; cores: number[]; temp: number };
  gpu: { usage: number; vram: number; temp: number; power: number; backend: string };
  memory: { total: number; used: number; free: number };
  network: { rx: number; tx: number };
}

interface OrchestratorState {
  services: ServiceStatus[];
  metrics: HardwareMetrics | null;
  activeProfile: string;
  connected: boolean;
  lastUpdate: string | null;
  setServices: (services: ServiceStatus[]) => void;
  setMetrics: (metrics: HardwareMetrics) => void;
  setProfile: (profile: string) => void;
  setConnected: (connected: boolean) => void;
  updateService: (name: string, updates: Partial<ServiceStatus>) => void;
}

export const useOrchestratorStore = create<OrchestratorState>((set) => ({
  services: [],
  metrics: null,
  activeProfile: "mainnet",
  connected: false,
  lastUpdate: null,
  setServices: (services) => set({ services, lastUpdate: new Date().toISOString() }),
  setMetrics: (metrics) => set({ metrics, lastUpdate: new Date().toISOString() }),
  setProfile: (profile) => set({ activeProfile: profile }),
  setConnected: (connected) => set({ connected }),
  updateService: (name, updates) =>
    set((state) => ({
      services: state.services.map((s) => (s.name === name ? { ...s, ...updates } : s)),
    })),
}));
