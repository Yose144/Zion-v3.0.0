'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
  address: string | null;
  xp: number;
  credits: number;
  completedQuests: string[];
  discoveredWorlds: string[];
  scannedWorlds: string[];
  realQuests: any[];
  setAddress: (address: string | null) => void;
  addXp: (amount: number) => void;
  addCredits: (amount: number) => void;
  completeQuest: (id: string, xp: number) => void;
  discoverWorld: (id: string) => void;
  scanWorld: (id: string) => void;
  setRealQuests: (quests: any[]) => void;
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
          return {
            completedQuests: [...state.completedQuests, id],
            xp: state.xp + xp,
            credits: state.credits + Math.max(1, Math.floor(xp / 20)),
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

      reset: () =>
        set({
          address: null,
          xp: 0,
          credits: 0,
          completedQuests: [],
          discoveredWorlds: [],
          scannedWorlds: [],
          realQuests: [],
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
