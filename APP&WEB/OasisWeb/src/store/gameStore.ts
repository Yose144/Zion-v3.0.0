'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getPlayer } from '../lib/api';
import { WORLDS } from '../domain/config/worlds';
import type { World } from '../domain/types/world';

export interface ShipLoadout {
  boost: number;
  cargo: number;
  scanner: number;
  color: string;
  model: ShipModelId;
}

export type ShipModelId = 'pilgrim' | 'awing' | 'bwing' | 'snowspeeder' | 'tiefighter' | 'tieinterceptor' | 'xwing' | 'ywing' | 'falcon' | 'stardestroyer' | 'slave1' | 'jedistarfighter';

export interface ShipModelDef {
  id: ShipModelId;
  label: string;
  description: string;
  stlPath: string | null;
  procedural: boolean; // true = built from Three.js primitives
  color: string;
  unlockLevel: number;
  unlockCost: number;
  class: string;
  stats: { boost: number; cargo: number; scanner: number; hp: number };
}

export const SHIP_MODELS: ShipModelDef[] = [
  { id: 'pilgrim', label: 'Pilgrim Scout', description: 'Default explorer vessel', stlPath: null, procedural: true, color: '#078930', unlockLevel: 1, unlockCost: 0, class: 'Scout', stats: { boost: 1, cargo: 1, scanner: 1, hp: 100 } },
  { id: 'awing', label: 'A-Wing', description: 'Fast interceptor — high boost', stlPath: '/models/awing.stl', procedural: false, color: '#e41e2b', unlockLevel: 2, unlockCost: 500, class: 'Interceptor', stats: { boost: 3, cargo: 1, scanner: 2, hp: 80 } },
  { id: 'snowspeeder', label: 'Snowspeeder', description: 'Atmospheric recon', stlPath: '/models/snowspeeder.stl', procedural: false, color: '#a3a3a3', unlockLevel: 3, unlockCost: 1000, class: 'Recon', stats: { boost: 2, cargo: 1, scanner: 3, hp: 90 } },
  { id: 'tiefighter', label: 'TIE Fighter', description: 'Imperial patrol — agile', stlPath: '/models/tiefighter.stl', procedural: false, color: '#1a1a1a', unlockLevel: 4, unlockCost: 2500, class: 'Patrol', stats: { boost: 2, cargo: 1, scanner: 2, hp: 70 } },
  { id: 'bwing', label: 'B-Wing', description: 'Heavy assault — balanced', stlPath: '/models/bwing.stl', procedural: false, color: '#fcd116', unlockLevel: 5, unlockCost: 5000, class: 'Assault', stats: { boost: 2, cargo: 2, scanner: 2, hp: 120 } },
  { id: 'tieinterceptor', label: 'TIE Interceptor', description: 'Elite strike — max speed', stlPath: '/models/tieinterceptor.stl', procedural: false, color: '#0d0d0d', unlockLevel: 7, unlockCost: 10000, class: 'Elite Strike', stats: { boost: 4, cargo: 1, scanner: 2, hp: 80 } },
  // New procedural starfighters
  { id: 'xwing', label: 'X-Wing', description: 'Rebel icon — balanced all-rounder', stlPath: null, procedural: true, color: '#e41e2b', unlockLevel: 6, unlockCost: 7500, class: 'Starfighter', stats: { boost: 3, cargo: 2, scanner: 2, hp: 110 } },
  { id: 'ywing', label: 'Y-Wing', description: 'Heavy bomber — high cargo, strong hull', stlPath: null, procedural: true, color: '#e41e2b', unlockLevel: 8, unlockCost: 15000, class: 'Bomber', stats: { boost: 2, cargo: 4, scanner: 2, hp: 150 } },
  { id: 'jedistarfighter', label: 'Jedi Starfighter', description: 'Elegant interceptor — precision crafted', stlPath: null, procedural: true, color: '#d4d4d4', unlockLevel: 9, unlockCost: 20000, class: 'Jedi', stats: { boost: 4, cargo: 2, scanner: 3, hp: 100 } },
  { id: 'slave1', label: 'Slave I', description: 'Bounty hunter\'s vessel — versatile', stlPath: null, procedural: true, color: '#078930', unlockLevel: 10, unlockCost: 30000, class: 'Bounty', stats: { boost: 3, cargo: 3, scanner: 4, hp: 130 } },
  { id: 'falcon', label: 'Millennium Falcon', description: 'Legendary freighter — max versatility', stlPath: null, procedural: true, color: '#a3a3a3', unlockLevel: 12, unlockCost: 50000, class: 'Freighter', stats: { boost: 4, cargo: 5, scanner: 3, hp: 200 } },
  { id: 'stardestroyer', label: 'Star Destroyer', description: 'Capital ship — dominates the battlefield', stlPath: null, procedural: true, color: '#4a4a4a', unlockLevel: 15, unlockCost: 100000, class: 'Capital', stats: { boost: 2, cargo: 5, scanner: 5, hp: 500 } },
];

// ── Hiranyagarbha Keys ──
// 108 keys hidden across the OASIS multiverse. Collecting all unlocks
// the Golden Egg (Hiranyagarbha — "Zlaté Lůno") endgame.
// Key #1 is hidden in the B-Wing's quantum engine.
export interface HiranKeyDef {
  id: string;
  number: number;
  name: string;
  location: string;
  hint: string;
  reward: number; // XP reward for finding this key
}

export const HIRAN_KEYS: HiranKeyDef[] = [
  {
    id: 'bwing-quantum-core',
    number: 1,
    name: 'Klíč Prvotního Lůna',
    location: 'B-Wing · Kvantový motor',
    hint: 'Uvnitř těžkého bombardéru se skrývá jádro, které nesvítí pro pouhé oko — pouze pro pilota, který si vybral tuto loď jako svou. Hledej puls v motoru, když letíš.',
    reward: 500,
  },
  // Keys 2–108 will be added as more content is discovered
];

export const TOTAL_HIRAN_KEYS = 108;

export type Archetype = 'warrior' | 'trader' | 'explorer' | 'sage' | null;

export type BodyType = 'slim' | 'standard' | 'heavy';
export type Augmentation = 'reflexes' | 'neural' | 'tech' | 'bio' | 'stealth';

export interface AvatarConfig {
  callsign: string;
  bodyType: BodyType;
  neonColor: string;
  augmentation: Augmentation;
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
  territories: any[];
  collectedEggs: string[];
  /* Fruit of the Tree — collect N fruits → Tree Blessing bonus XP */
  collectedFruits: string[];
  fruitBlessings: number;
  fruitThreshold: number;
  collectedFruitIds: string[];
  /* Hiranyagarbha Keys — 108 keys hidden across the OASIS multiverse.
     Collecting all 108 unlocks the Golden Egg (Hiranyagarbha) endgame.
     Each key is tied to a specific location, ship, quest, or dimension. */
  collectedHiranKeys: string[];
  archetype: Archetype;
  avatarConfig: AvatarConfig;
  shipLoadout: ShipLoadout;
  unlockedShips: ShipModelId[];
  worlds: World[];
  setWorlds: (worlds: World[]) => void;
  setAddress: (address: string | null) => void;
  setAvatars: (avatars: any[]) => void;
  setTerritories: (territories: any[]) => void;
  setXp: (xp: number) => void;
  syncPlayer: () => Promise<void>;
  addXp: (amount: number) => void;
  addCredits: (amount: number) => void;
  completeQuest: (id: string, xp: number) => void;
  discoverWorld: (id: string) => void;
  scanWorld: (id: string) => void;
  setRealQuests: (quests: any[]) => void;
  claimGoldenEgg: (worldId: string) => boolean;
  collectFruit: (fruitId: string) => boolean;
  resetFruitBlessing: () => void;
  collectHiranKey: (keyId: string) => boolean;
  upgradeShip: (part: keyof ShipLoadout) => boolean;
  setShipColor: (color: string) => void;
  setShipModel: (model: ShipModelId) => void;
  unlockShip: (model: ShipModelId) => boolean;
  setArchetype: (archetype: Archetype) => void;
  applyArchetype: (archetype: NonNullable<Archetype>) => void;
  setAvatarConfig: (config: Partial<AvatarConfig>) => void;
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
      territories: [],
      collectedEggs: [],
      collectedFruits: [],
      fruitBlessings: 0,
      fruitThreshold: 7,
      collectedFruitIds: [],
      collectedHiranKeys: [],
      archetype: null,
      avatarConfig: { callsign: '', bodyType: 'standard', neonColor: '#078930', augmentation: 'neural' },
      shipLoadout: { boost: 1, cargo: 1, scanner: 1, color: '#078930', model: 'pilgrim' },
      unlockedShips: ['pilgrim'],
      worlds: WORLDS,

      setWorlds: (worlds) => set({ worlds }),

      setAddress: (address) => set({ address }),

      setXp: (xp) => set({ xp }),

      syncPlayer: async () => {
        const state = get();
        if (!state.address) return;
        const player = await getPlayer(state.address);
        if (player && typeof player.total_xp === 'number') {
          set({ xp: player.total_xp });
        }
      },

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
      setTerritories: (territories) => set({ territories }),

      claimGoldenEgg: (worldId) => {
        const state = get();
        if (state.collectedEggs.includes(worldId)) return false;
        if (state.credits < 100) return false;
        set((s) => ({
          credits: s.credits - 100,
          xp: s.xp + 500,
          collectedEggs: [...s.collectedEggs, worldId],
        }));
        return true;
      },

      /* Fruit of the Tree — each fruit gives +50 XP. When the player
         reaches the threshold (default 7), a Tree Blessing fires:
         +500 bonus XP, the counter resets, and fruitBlessings increments.
         Returns true if the collection succeeded (fruit was new). */
      collectFruit: (fruitId) => {
        const state = get();
        if (state.collectedFruitIds.includes(fruitId)) return false;
        const newCount = state.collectedFruits.length + 1;
        const threshold = state.fruitThreshold;
        if (newCount >= threshold) {
          // Blessing triggered
          set((s) => ({
            xp: s.xp + 50 + 500,
            collectedFruits: [],
            collectedFruitIds: [...s.collectedFruitIds, fruitId],
            fruitBlessings: s.fruitBlessings + 1,
          }));
        } else {
          set((s) => ({
            xp: s.xp + 50,
            collectedFruits: [...s.collectedFruits, fruitId],
            collectedFruitIds: [...s.collectedFruitIds, fruitId],
          }));
        }
        return true;
      },

      /* Clear the per-session collected IDs so fruits can respawn for the
         next blessing cycle. Called by TreeOfLife when all fruits have
         respawned. */
      resetFruitBlessing: () =>
        set({ collectedFruitIds: [] }),

      /* Hiranyagarbha Key — collect a hidden key. Returns true if the key
         was new (not already collected). Awards XP from the key definition.
         When all 108 keys are collected, the Golden Egg endgame unlocks. */
      collectHiranKey: (keyId) => {
        const state = get();
        if (state.collectedHiranKeys.includes(keyId)) return false;
        const keyDef = HIRAN_KEYS.find((k) => k.id === keyId);
        const reward = keyDef?.reward ?? 100;
        set((s) => ({
          collectedHiranKeys: [...s.collectedHiranKeys, keyId],
          xp: s.xp + reward,
        }));
        return true;
      },

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

      setShipModel: (model) =>
        set((s) => {
          if (!s.unlockedShips.includes(model)) return s;
          return { shipLoadout: { ...s.shipLoadout, model } };
        }),

      unlockShip: (model) => {
        const state = get();
        if (state.unlockedShips.includes(model)) return false;
        const def = SHIP_MODELS.find((m) => m.id === model);
        if (!def) return false;
        const level = getLevel(state.xp);
        if (level < def.unlockLevel) return false;
        if (state.credits < def.unlockCost) return false;
        set({
          unlockedShips: [...state.unlockedShips, model],
          credits: state.credits - def.unlockCost,
          shipLoadout: { ...state.shipLoadout, model },
        });
        return true;
      },

      setArchetype: (archetype) => set({ archetype }),

      setAvatarConfig: (config) =>
        set((s) => ({
          avatarConfig: { ...s.avatarConfig, ...config },
        })),

      applyArchetype: (archetype) =>
        set((s) => {
          const isFirst = s.archetype === null;
          if (!isFirst) return { archetype };

          const loadout = { ...s.shipLoadout };
          if (archetype === 'warrior') {
            loadout.boost = Math.min(5, loadout.boost + 1);
          } else if (archetype === 'trader') {
            loadout.cargo = Math.min(5, loadout.cargo + 1);
          } else if (archetype === 'explorer') {
            loadout.scanner = Math.min(5, loadout.scanner + 1);
          } else if (archetype === 'sage') {
            return { archetype, credits: s.credits + 50, xp: s.xp + 100 };
          }
          return { archetype, shipLoadout: loadout };
        }),

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
          territories: [],
          collectedEggs: [],
          collectedFruits: [],
          fruitBlessings: 0,
          collectedFruitIds: [],
          collectedHiranKeys: [],
          archetype: null,
          avatarConfig: { callsign: '', bodyType: 'standard', neonColor: '#078930', augmentation: 'neural' },
          shipLoadout: { boost: 1, cargo: 1, scanner: 1, color: '#078930', model: 'pilgrim' },
          unlockedShips: ['pilgrim'],
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
        territories: state.territories,
        collectedEggs: state.collectedEggs,
        collectedFruits: state.collectedFruits,
        fruitBlessings: state.fruitBlessings,
        collectedHiranKeys: state.collectedHiranKeys,
        archetype: state.archetype,
        avatarConfig: state.avatarConfig,
        shipLoadout: state.shipLoadout,
        unlockedShips: state.unlockedShips,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        // Ensure unlockedShips is always a valid array (fix for zustand v5 hydration edge case)
        unlockedShips: Array.isArray((persisted as any)?.unlockedShips)
          ? (persisted as any).unlockedShips
          : current.unlockedShips ?? ['pilgrim'],
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
