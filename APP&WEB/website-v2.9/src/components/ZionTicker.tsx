'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, Globe, Zap, Sparkles, Shield, Satellite,
  Pickaxe, Orbit, BrainCircuit, Landmark, Leaf, Crown
} from 'lucide-react';

const TICKER_ITEMS = [
  { label: 'ZION L1', icon: Cpu, color: 'text-zion-cyan-300' },
  { label: 'TerraNova', icon: Globe, color: 'text-zion-cyan-300' },
  { label: 'Consciousness Mining', icon: Zap, color: 'text-zion-gold-300' },
  { label: 'Hiran v2.2', icon: Sparkles, color: 'text-zion-purple-300' },
  { label: 'Guardian Edge', icon: Shield, color: 'text-zion-cyan-300' },
  { label: '144k Nodes', icon: Satellite, color: 'text-zion-cyan-300' },
  { label: 'PoW + Deeksha', icon: Pickaxe, color: 'text-zion-gold-300' },
  { label: 'WARP Bridge', icon: Orbit, color: 'text-zion-purple-300' },
  { label: 'AI Native', icon: BrainCircuit, color: 'text-zion-cyan-300' },
  { label: 'Dharma Temple', icon: Landmark, color: 'text-zion-cyan-300' },
  { label: 'ZION Oasis', icon: Leaf, color: 'text-zion-cyan-300' },
  { label: 'Te Piko Ora', icon: Crown, color: 'text-zion-gold-300' },
];

export default function ZionTicker() {
  const [paused, setPaused] = useState(false);

  const renderItems = () => (
    <>
      {TICKER_ITEMS.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-xs font-medium text-gray-300 whitespace-nowrap transition-colors hover:bg-white/[0.06] hover:text-white cursor-default"
        >
          <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
          {item.label}
        </span>
      ))}
    </>
  );

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-r from-black/60 via-black/40 to-black/60 backdrop-blur-sm py-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/80 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/80 to-transparent z-10" />

      <motion.div
        className="flex gap-3 overflow-hidden"
        animate={{ x: paused ? undefined : [0, -50 * TICKER_ITEMS.length] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: 30,
            ease: 'linear',
          },
        }}
      >
        {renderItems()}
        {renderItems()}
        {renderItems()}
      </motion.div>
    </div>
  );
}
