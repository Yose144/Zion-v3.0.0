// ─── ZION Dashboard v2 — Alert Store ────────────────────────────────────────
import { create } from 'zustand';
import type { Alert } from '../types/api';
import api from '../api/client';

interface AlertState {
  alerts: Alert[];
  unreadCount: number;

  fetchAlerts: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  appendAlert: (a: Alert) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  unreadCount: 0,

  fetchAlerts: async () => {
    try {
      const alerts = await api.alerts();
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

  // convenience alias for WS use
  ...{} as Record<string, unknown>,
}));

export function useUnreadAlerts() {
  return useAlertStore((s) => s.unreadCount);
}
