import { create } from 'zustand';

interface OasisState {
  selectedWorld: string | null;
  hoveredWorld: string | null;
  setSelectedWorld: (id: string | null) => void;
  setHoveredWorld: (id: string | null) => void;
}

export const useOasisStore = create<OasisState>((set) => ({
  selectedWorld: null,
  hoveredWorld: null,
  setSelectedWorld: (id) => set({ selectedWorld: id }),
  setHoveredWorld: (id) => set({ hoveredWorld: id }),
}));
