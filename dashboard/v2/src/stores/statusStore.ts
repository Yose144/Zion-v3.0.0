// ─── ZION Dashboard v2 — Status Store ───────────────────────────────────────
import { create } from 'zustand';
import type { StatusResponse, HealthMap, MetricPoint } from '../types/api';
import api, { apiFetch } from '../api/client';

interface StatusState {
  status: StatusResponse | null;
  health: HealthMap | null;
  history: MetricPoint[];
  connected: boolean;
  lastUpdated: number | null;
  error: string | null;

  setConnected: (v: boolean) => void;
  fetchStatus: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  applyWsStatus: (data: StatusResponse) => void;
  applyWsHealth: (data: HealthMap) => void;
}

export const useStatusStore = create<StatusState>((set) => ({
  status: null,
  health: null,
  history: [],
  connected: false,
  lastUpdated: null,
  error: null,

  setConnected: (v) => set({ connected: v }),

  fetchStatus: async () => {
    try {
      const status = await api.status();
      set({ status, lastUpdated: Date.now(), error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  fetchHealth: async () => {
    try {
      const health = await api.health();
      set({ health });
    } catch {
      // health is non-critical
    }
  },

  fetchHistory: async () => {
    try {
      // Server returns { samples: MetricPoint[] } — unwrap here
      const raw = await apiFetch<{ samples?: MetricPoint[] } | MetricPoint[]>('/api/history');
      const history = Array.isArray(raw) ? raw : (raw as { samples?: MetricPoint[] }).samples ?? [];
      set({ history });
    } catch {
      // non-critical
    }
  },

  applyWsStatus: (data) => set({ status: data, lastUpdated: Date.now() }),
  applyWsHealth: (data) => set({ health: data }),
}));
