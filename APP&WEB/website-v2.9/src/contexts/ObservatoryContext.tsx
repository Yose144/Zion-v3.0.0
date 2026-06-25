"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type ObservatoryMode = "deep-space" | "planet-orbit" | "galactic-core" | "nebula-drift";

type ObservatoryContextType = {
  mode: ObservatoryMode;
  setMode: (mode: ObservatoryMode) => void;
  availableModes: { id: ObservatoryMode; label: string; description: string }[];
};

const ObservatoryContext = createContext<ObservatoryContextType | null>(null);

const MODES: ObservatoryContextType["availableModes"] = [
  { id: "deep-space", label: "Deep Space", description: "Flight through the cosmos" },
  { id: "planet-orbit", label: "Planet Orbit", description: "AI / Mining deck" },
  { id: "galactic-core", label: "Command Nexus", description: "WARP & DAO view" },
  { id: "nebula-drift", label: "Nebula Drift", description: "Desktop agent vibe" },
];

export function ObservatoryProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ObservatoryMode>('deep-space');

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
