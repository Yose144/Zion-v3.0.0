"use client";

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";

interface ZionStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  accent?: "gold" | "cyan" | "purple" | "green" | "blue";
  delay?: number;
  className?: string;
}

const accentMap = {
  gold: { text: "text-zion-gold", glow: "251, 191, 36" },
  cyan: { text: "text-zion-cyan", glow: "34, 211, 238" },
  purple: { text: "text-zion-purple", glow: "168, 85, 247" },
  green: { text: "text-green-400", glow: "74, 222, 128" },
  blue: { text: "text-zion-blue", glow: "59, 130, 246" },
};

/**
 * Stat card with icon, label, value, and optional sub-value.
 * Uses the zion-rainbow-card pattern with accent glow.
 */
export default function ZionStatCard({
  icon: Icon,
  label,
  value,
  subValue,
  accent = "gold",
  delay = 0,
  className = "",
}: ZionStatCardProps) {
  const { text, glow } = accentMap[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`zion-rainbow-card rounded-2xl bg-black/60 p-4 ${className}`}
      style={{ "--rc": glow } as React.CSSProperties}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${text}`} />
      </div>
      <div className={`text-lg font-bold ${text} tabular-nums`}>{value}</div>
      {subValue && <div className="text-xs text-gray-500 mt-1">{subValue}</div>}
    </motion.div>
  );
}
