'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Egg, BookOpen, User, Globe, Code2, Users, Crown } from 'lucide-react';
import { getPrizeTiers } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';
import { CLUES, CATEGORIES, type ClueCategory } from './clues';

const CAT_ICONS: Record<ClueCategory, typeof BookOpen> = {
  library: BookOpen,
  avatar: User,
  world: Globe,
  source: Code2,
  community: Users,
};

const CAT_COLORS: Record<ClueCategory, string> = {
  library: 'text-oasis-cyan',
  avatar: 'text-oasis-purple',
  world: 'text-oasis-emerald',
  source: 'text-oasis-gold',
  community: 'text-pink-400',
};

const MASTER_KEYS = [
  { name: 'Ramayana', found: 0, total: 36 },
  { name: 'Mahabharata', found: 0, total: 36 },
  { name: 'Unity', found: 0, total: 36 },
];

export default function GoldenEggPanel() {
  const { data: prizes, loading, error, retry } = useApi(getPrizeTiers, []);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ClueCategory | ''>('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return CLUES.filter(
      (c) =>
        (!category || c.category === category) &&
        (c.id.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q))
    );
  }, [search, category]);

  return (
    <GlassPanel className="max-h-[80vh] overflow-y-auto">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-gold to-oasis-cyan"
      >
        The Golden Egg
      </motion.h1>
      <p className="mb-4 text-sm text-gray-400">108 sacred clues · 3 Master Keys · 1 Billion ZION</p>

      {loading && <Skeleton lines={4} className="mb-4" />}

      {error && !loading && (
        <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          {error} <button onClick={retry} className="ml-2 underline">Retry</button>
        </div>
      )}

      {prizes && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-oasis-gold/10 p-4">
          <div className="flex items-center gap-2 text-oasis-gold">
            <Egg className="h-5 w-5" />
            <span className="font-bold">Prize pool:</span>
            <span>{prizes.total_pool_zion.toLocaleString()} ZION</span>
          </div>
        </div>
      )}

      <div className="mb-4 grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:grid-cols-3">
        {MASTER_KEYS.map((k) => (
          <div key={k.name} className="rounded-xl bg-white/5 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-oasis-gold">
              <Crown className="h-4 w-4" />
              {k.name}
            </div>
            <div className="h-1.5 w-full rounded bg-white/10">
              <div className="h-1.5 rounded bg-oasis-gold" style={{ width: `${(k.found / k.total) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-gray-400">{k.found}/{k.total} clues</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
          <Search className="ml-2 h-4 w-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clues"
            className="flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-gray-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ClueCategory | '')}
          className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none"
        >
          <option value="">All categories</option>
          {(Object.keys(CATEGORIES) as ClueCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORIES[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {filtered.slice(0, 24).map((c) => {
          const Icon = CAT_ICONS[c.category];
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <div className="mb-1 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${CAT_COLORS[c.category]}`} />
                <span className="font-mono text-xs text-oasis-gold">{c.id}</span>
                <span className={`ml-auto text-[10px] uppercase ${CAT_COLORS[c.category]}`}>{CATEGORIES[c.category]}</span>
              </div>
              <p className="line-clamp-2 text-xs text-gray-300">{c.hint}</p>
            </motion.div>
          );
        })}
      </div>
      {filtered.length > 24 && (
        <p className="mt-3 text-center text-xs text-gray-500">{filtered.length - 24} more clues in this view</p>
      )}
    </GlassPanel>
  );
}
