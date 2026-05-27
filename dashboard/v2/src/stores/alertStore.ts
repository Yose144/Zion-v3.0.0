// ─── ZION Dashboard v2 — Alert Store ────────────────────────────────────────
import { create } from 'zustand';
import type { Alert } from '../types/api';
import api, { apiFetch } from '../api/client';

interface AlertState {
  alerts: Alert[];
  unreadCount: number;

  fetchAlerts: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  appendAlert: (a: Alert) => void;
  applyWsAlerts: (alerts: Alert[]) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  unreadCount: 0,

  fetchAlerts: async () => {
    try {
      // Server returns { alerts: Alert[] } — unwrap here
      const raw = await apiFetch<{ alerts?: Alert[] } | Alert[]>('/api/alerts');
      const alerts = Array.isArray(raw) ? raw : (raw as { alerts?: Alert[] }).alerts ?? [];
      set({ alerts, unreadCount: alerts.filter(a => !a.dismissed).length });
    } catch { /* non-critical */ }
  },

  dismiss: async (id) => {
    try {
      await api.alertDismiss(id);
      set((state) => ({
        alerts: state.alerts.map(a => a.id === id ? { ...a, dismissed: true } : a),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch { /* ignore */ }
  },

  appendAlert: (a) => {
    set((state) => ({
      alerts: [a, ...state.alerts].slice(0, 200),
      unreadCount: state.unreadCount + (a.dismissed ? 0 : 1),
    }));
    // Also show as toast — emitted via CustomEvent so layout can pick it up
    window.dispatchEvent(new CustomEvent('zion:alert', { detail: a }));
  },

  applyWsAlerts: (incoming) => {
    set((state) => {
      const map = new Map(state.alerts.map(a => [a.id, a]));
      for (const a of incoming) {
        if (!map.has(a.id)) map.set(a.id, a);
      }
      const alerts = Array.from(map.values()).sort((a, b) => b.ts - a.ts).slice(0, 200);
      return { alerts, unreadCount: alerts.filter(a => !a.dismissed).length };
    });
  },
}));

export function useUnreadAlerts() {
  return useAlertStore((s) => s.unreadCount);
}
