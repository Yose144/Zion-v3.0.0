'use client';

import { motion } from 'framer-motion';
import { WORLDS } from '../domain/config/worlds';
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
  const counts = CATEGORIES.map((cat) => WORLDS.filter((w) => w.category === cat.id).length);

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
      transition={{ duration: 0.6, delay: 3.2 }}
      className="pointer-events-auto absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2"
    >
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#05060f]/85 p-2 shadow-2xl shadow-black/50 backdrop-blur-2xl">
        <button
          onClick={toggleAll}
          className={`rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
            allActive ? 'bg-white text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          {allActive ? 'All' : 'None'}
        </button>

        <div className="mx-1 h-5 w-px bg-white/10" />

        {CATEGORIES.map((cat, i) => {
          const isActive = active.includes(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => toggle(cat.id)}
              className="relative flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                backgroundColor: isActive ? `${cat.color}1a` : 'rgba(255,255,255,0.04)',
                color: isActive ? cat.color : '#9ca3af',
                boxShadow: isActive ? `0 0 16px ${cat.color}22` : 'none',
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: cat.color, opacity: isActive ? 1 : 0.35 }}
              />
              {cat.label}
              <span
                className="ml-0.5 rounded px-1 py-0 text-[9px]"
                style={{
                  backgroundColor: isActive ? `${cat.color}25` : 'rgba(255,255,255,0.08)',
                  color: isActive ? cat.color : '#6b7280',
                }}
              >
                {counts[i]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-white/5 bg-black/40 px-2.5 py-1 text-[10px] text-gray-500 backdrop-blur-sm">
        {WORLDS.filter((w) => active.includes(w.category as WorldCategory)).length} / {WORLDS.length} worlds visible
      </div>
    </motion.div>
  );
}
