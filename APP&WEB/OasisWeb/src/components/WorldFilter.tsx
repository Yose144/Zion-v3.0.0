'use client';

import { motion } from 'framer-motion';
import type { WorldCategory } from '../domain/types/world';

const CATEGORIES: { id: WorldCategory; label: string; color: string }[] = [
  { id: 'star-system', label: 'Stars', color: '#f59e0b' },
  { id: 'planet', label: 'Planets', color: '#22d3ee' },
  { id: 'sector', label: 'Sectors', color: '#a855f7' },
  { id: 'world', label: 'Worlds', color: '#10b981' },
  { id: 'dimension', label: 'Dimensions', color: '#ec4899' },
];

interface WorldFilterProps {
  active: WorldCategory[];
  onChange: (active: WorldCategory[]) => void;
}

export default function WorldFilter({ active, onChange }: WorldFilterProps) {
  const toggle = (id: WorldCategory) => {
    if (active.includes(id)) {
      onChange(active.filter((c) => c !== id));
    } else {
      onChange([...active, id]);
    }
  };

  const allActive = active.length === CATEGORIES.length;
  const toggleAll = () => {
    onChange(allActive ? [] : CATEGORIES.map((c) => c.id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 3.5 }}
      className="pointer-events-auto absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/80 p-2.5 shadow-2xl backdrop-blur-xl"
    >
      <button
        onClick={toggleAll}
        className={`rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
          allActive ? 'bg-white text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
        }`}
      >
        {allActive ? 'All' : 'None'}
      </button>

      <div className="mx-1 h-5 w-px bg-white/10" />

      {CATEGORIES.map((cat) => {
        const isActive = active.includes(cat.id);
        return (
          <button
            key={cat.id}
            onClick={() => toggle(cat.id)}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{
              backgroundColor: isActive ? `${cat.color}22` : 'rgba(255,255,255,0.05)',
              color: isActive ? cat.color : '#9ca3af',
              boxShadow: isActive ? `0 0 12px ${cat.color}22` : 'none',
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: cat.color, opacity: isActive ? 1 : 0.4 }}
            />
            {cat.label}
          </button>
        );
      })}
    </motion.div>
  );
}
