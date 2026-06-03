// ─── ZION Dashboard v2 — Settings Store ─────────────────────────────────────
import { create } from 'zustand';

interface Settings {
  theme: 'dark' | 'light' | 'system';
  refreshIntervalMs: number;
  maxLogLines: number;
  sidebarCollapsed: boolean;
  autoScroll: boolean;
  showTimestamps: boolean;
  compactMode: boolean;
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const defaults: Settings = {
  theme: 'dark',
  refreshIntervalMs: 5_000,
  maxLogLines: 3_000,
  sidebarCollapsed: false,
  autoScroll: true,
  showTimestamps: true,
  compactMode: false,
};

// Load from localStorage
function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('zion-dashboard-settings');
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* ignore */ }
  return defaults;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...loadSettings(),

  update: (patch) => set((state) => {
    const next = { ...state, ...patch };
    try { localStorage.setItem('zion-dashboard-settings', JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  }),

  reset: () => set(() => {
    localStorage.removeItem('zion-dashboard-settings');
    return { ...defaults };
  }),
}));
