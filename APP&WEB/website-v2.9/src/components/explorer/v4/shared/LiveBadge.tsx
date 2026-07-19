"use client";

import { motion } from "framer-motion";

interface LiveBadgeProps {
  label?: string;
  className?: string;
}

/**
 * Pulsing "LIVE" badge for real-time sections.
 */
export default function LiveBadge({ label = "LIVE", className = "" }: LiveBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <motion.span
        className="relative flex h-2 w-2"
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </motion.span>
      <span className="text-xs font-bold text-green-400 tracking-wider">{label}</span>
    </span>
  );
}
