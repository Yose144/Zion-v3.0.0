// ─── ZION Dashboard v2 — Log Store ──────────────────────────────────────────
import { create } from 'zustand';
import type { ServiceName } from '../types/api';

export interface LogLine {
  id: number;
  ts: number;
  service: ServiceName;
  line: string;
}

const MAX_LINES = 3_000;  // per service
let lineCounter = 0;

interface LogState {
  // Lines keyed by service
  lines: Record<string, LogLine[]>;
  // Active service filter
  activeService: ServiceName | 'all';
  searchQuery: string;

  appendLine: (service: ServiceName, line: string, ts?: number) => void;
  clearService: (service: ServiceName) => void;
  clearAll: () => void;
  setActiveService: (s: ServiceName | 'all') => void;
  setSearchQuery: (q: string) => void;
  getFiltered: (service?: ServiceName | 'all', query?: string) => LogLine[];
}

export const useLogStore = create<LogState>((set, get) => ({
  lines: {},
  activeService: 'all',
  searchQuery: '',

  appendLine: (service, line, ts = Date.now()) => {
    set((state) => {
      const prev = state.lines[service] ?? [];
      const next = [...prev, { id: ++lineCounter, ts, service, line }];
      return {
        lines: {
          ...state.lines,
          [service]: next.length > MAX_LINES ? next.slice(-MAX_LINES) : next,
        },
      };
    });
  },

  clearService: (service) => {
    set((state) => ({ lines: { ...state.lines, [service]: [] } }));
  },

  clearAll: () => set({ lines: {} }),

  setActiveService: (s) => set({ activeService: s }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  getFiltered: (service, query) => {
    const { lines, activeService, searchQuery } = get();
    const svc = service ?? activeService;
    const q = (query ?? searchQuery).toLowerCase();

    let pool: LogLine[];
    if (svc === 'all') {
      pool = Object.values(lines).flat().sort((a, b) => a.ts - b.ts);
    } else {
      pool = lines[svc] ?? [];
    }

    if (!q) return pool;
    return pool.filter(l => l.line.toLowerCase().includes(q));
  },
}));
