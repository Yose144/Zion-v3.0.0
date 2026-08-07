"use client";

import { memo, useMemo } from "react";
import clsx from "clsx";
import { ObservatoryMode } from "@/contexts/ObservatoryContext";

type Bubble = {
  id: string;
  size: number;
  x: number; // 0-100 viewport percent
  y: number;
  color: string;
  blur?: number;
  opacity?: number;
  delay?: number;
};

const BUBBLE_PRESETS: Record<ObservatoryMode, Bubble[]> = {
  "planet-orbit": [
    { id: "po-1", size: 280, x: 20, y: 30, color: "rgba(249,217,118,0.18)", blur: 70 },
    { id: "po-2", size: 200, x: 70, y: 40, color: "rgba(50,230,255,0.16)", blur: 60 },
    { id: "po-3", size: 240, x: 60, y: 75, color: "rgba(155,92,255,0.15)", blur: 65 },
  ],
  "desktop-agent": [
    { id: "da-1", size: 360, x: 20, y: 30, color: "rgba(228,30,43,0.16)", blur: 95, opacity: 0.52 },
    { id: "da-2", size: 300, x: 78, y: 68, color: "rgba(6,105,40,0.14)", blur: 88, opacity: 0.48 },
    { id: "da-3", size: 220, x: 52, y: 24, color: "rgba(252,209,22,0.1)", blur: 76, opacity: 0.42 },
  ],
  "warp-speed": [
    { id: "ws-1", size: 320, x: 45, y: 45, color: "rgba(252, 209, 22,0.2)", blur: 80 },
    { id: "ws-2", size: 240, x: 50, y: 50, color: "rgba(120,180,255,0.15)", blur: 70 },
  ],
  "galaxy-core": [
    { id: "gx-1", size: 600, x: 48, y: 48, color: "rgba(200,220,255,0.16)", blur: 140, opacity: 0.5 },
    { id: "gx-2", size: 400, x: 55, y: 52, color: "rgba(140,170,230,0.12)", blur: 120, opacity: 0.4 },
    { id: "gx-3", size: 300, x: 35, y: 40, color: "rgba(100,140,200,0.08)", blur: 100, opacity: 0.3 },
    { id: "gx-4", size: 250, x: 65, y: 35, color: "rgba(160,190,240,0.06)", blur: 90, opacity: 0.25 },
  ],
};

interface QuantumBubblesProps {
  mode?: ObservatoryMode;
  density?: "low" | "medium" | "high";
}

function createInstances(mode: ObservatoryMode, density: QuantumBubblesProps["density"]) {
  const preset = BUBBLE_PRESETS[mode];
  const normalize = (bubble: Bubble, idx: number): Bubble => ({
    ...bubble,
    delay: bubble.delay ?? ((Math.sin(idx * 1.73) + 1) * 4),
  });

  const normalized = preset.map((bubble, idx) => normalize(bubble, idx));

  if (density === "high") {
    const clones = normalized.map((bubble, idx) =>
      normalize(
        {
          ...bubble,
          id: `${bubble.id}-clone-${idx}`,
          size: bubble.size * 0.65,
          x: (bubble.x + 12 + idx * 7) % 100,
          y: (bubble.y + 18 + idx * 11) % 100,
          opacity: 0.08,
        },
        idx + normalized.length
      )
    );
    return [...normalized, ...clones];
  }

  if (density === "low") {
    return normalized.slice(0, Math.max(2, Math.floor(normalized.length / 2)));
  }

  return normalized;
}

function QuantumBubblesComponent({ mode = "planet-orbit", density = "medium" }: QuantumBubblesProps) {
  const bubbles = useMemo(() => createInstances(mode, density), [mode, density]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[2] overflow-hidden">
      {bubbles.map((bubble: Bubble) => (
        <span
          key={bubble.id}
          className={clsx(
            "absolute rounded-full bg-gradient-radial from-white/30 to-transparent",
            "animate-bubble-drift"
          )}
          style={{
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            left: `${bubble.x}%`,
            top: `${bubble.y}%`,
            background: `radial-gradient(circle at 30% 30%, ${bubble.color}, transparent 70%)`,
            filter: `blur(${bubble.blur ?? 45}px)`,
            opacity: bubble.opacity ?? 0.6,
            animationDelay: `${bubble.delay ?? 0}s`,
          }}
        />
      ))}
    </div>
  );
}

const QuantumBubbles = memo(QuantumBubblesComponent);
export default QuantumBubbles;
