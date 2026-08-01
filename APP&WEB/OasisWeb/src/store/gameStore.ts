'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ShipLoadout {
  boost: number;
  cargo: number;
  scanner: number;
  color: string;
}

interface GameState {
  address: string | null;
  xp: number;
  credits: number;
  completedQuests: string[];
  discoveredWorlds: string[];
  scannedWorlds: string[];
  realQuests: any[];
  avatars: any[];
  shipLoadout: ShipLoadout;
  setAddress: (address: string | null) => void;
  setAvatars: (avatars: any[]) => void;
  addXp: (amount: number) => void;
  addCredits: (amount: number) => void;
  completeQuest: (id: string, xp: number) => void;
  discoverWorld: (id: string) => void;
  scanWorld: (id: string) => void;
  setRealQuests: (quests: any[]) => void;
  upgradeShip: (part: keyof ShipLoadout) => boolean;
  setShipColor: (color: string) => void;
  reset: () => void;
}

const XP_PER_LEVEL = 1000;

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      address: null,
      xp: 0,
      credits: 0,
      completedQuests: [],
      discoveredWorlds: [],
      scannedWorlds: [],
      realQuests: [],
      avatars: [],
      shipLoadout: { boost: 1, cargo: 1, scanner: 1, color: '#22d3ee' },

      setAddress: (address) => set({ address }),

      addXp: (amount) =>
        set((state) => ({
          xp: state.xp + amount,
        })),

      addCredits: (amount) =>
        set((state) => ({
          credits: state.credits + amount,
        })),

      completeQuest: (id, xp) =>
        set((state) => {
          if (state.completedQuests.includes(id)) return state;
          const bonus = state.shipLoadout.cargo * 5;
          return {
            completedQuests: [...state.completedQuests, id],
            xp: state.xp + xp,
            credits: state.credits + Math.max(1, Math.floor(xp / 20)) + bonus,
          };
        }),

      discoverWorld: (id) =>
        set((state) => {
          if (state.discoveredWorlds.includes(id)) return state;
          return { discoveredWorlds: [...state.discoveredWorlds, id] };
        }),

      scanWorld: (id) =>
        set((state) => {
          if (state.scannedWorlds.includes(id)) return state;
          return { scannedWorlds: [...state.scannedWorlds, id] };
        }),

      setRealQuests: (realQuests) => set({ realQuests }),
      setAvatars: (avatars) => set({ avatars }),

      upgradeShip: (part) => {
        const state = get();
        const current = state.shipLoadout[part];
        if (typeof current !== 'number' || current >= 5) return false;
        const cost = current * 500;
        if (state.credits < cost) return false;
        set((s) => ({
          credits: s.credits - cost,
          shipLoadout: { ...s.shipLoadout, [part]: current + 1 },
        }));
        return true;
      },

      setShipColor: (color) =>
        set((s) => ({
          shipLoadout: { ...s.shipLoadout, color },
        })),

      reset: () =>
        set({
          address: null,
          xp: 0,
          credits: 0,
          completedQuests: [],
          discoveredWorlds: [],
          scannedWorlds: [],
          realQuests: [],
          avatars: [],
          shipLoadout: { boost: 1, cargo: 1, scanner: 1, color: '#22d3ee' },
        }),
    }),
    {
      name: 'oasis-game-store',
      partialize: (state) => ({
        address: state.address,
        xp: state.xp,
        credits: state.credits,
        completedQuests: state.completedQuests,
        discoveredWorlds: state.discoveredWorlds,
        scannedWorlds: state.scannedWorlds,
        avatars: state.avatars,
        shipLoadout: state.shipLoadout,
      }),
    }
  )
);

export function getLevel(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function getLevelProgress(xp: number): number {
  return (xp % XP_PER_LEVEL) / XP_PER_LEVEL;
}
