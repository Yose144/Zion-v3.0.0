"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type ObservatoryMode =
  | "maintenance"
  | "planet-orbit"
  | "warp-speed"
  | "galaxy-core"
  | "desktop-agent";

type ObservatoryContextType = {
  mode: ObservatoryMode;
  setMode: (mode: ObservatoryMode) => void;
  availableModes: { id: ObservatoryMode; label: string; description: string }[];
};

const ObservatoryContext = createContext<ObservatoryContextType | null>(null);

const MODES: ObservatoryContextType["availableModes"] = [
  { id: "maintenance", label: "Maintenance Starfield", description: "Gold starfield — clean and fast" },
  { id: "planet-orbit", label: "Turquoise Core", description: "Default turquoise atmosphere" },
  { id: "galaxy-core", label: "Galaxy Core", description: "Contact approach — inward starflow" },
  { id: "desktop-agent", label: "Desktop Agent", description: "Purple starfield — desktop agent match" },
  { id: "warp-speed", label: "Warp", description: "Warp tunnel effect" },
];

export function ObservatoryProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ObservatoryMode>('maintenance');

  const value = useMemo(
    () => ({ mode, setMode, availableModes: MODES }),
    [mode]
  );

  return <ObservatoryContext.Provider value={value}>{children}</ObservatoryContext.Provider>;
}

export function useObservatory() {
  const ctx = useContext(ObservatoryContext);
  if (!ctx) {
    throw new Error("useObservatory must be used within ObservatoryProvider");
  }
  return ctx;
}
