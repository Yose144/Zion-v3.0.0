'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Globe, Shield } from 'lucide-react';
import { getTerritories, type Territory } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';

export default function TerritoriesPanel() {
  const { data, loading, error, retry } = useApi(getTerritories, []);
  const [search, setSearch] = useState('');

  const territories = useMemo(() => {
    if (!data) return [];
    return Object.values(data.territories);
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return territories.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.region.toLowerCase().includes(q) ||
        (t.controller ?? '').toLowerCase().includes(q)
    );
  }, [territories, search]);

  const claimed = territories.filter((t) => t.controller).length;

  return (
    <GlassPanel className="max-h-[80vh] overflow-y-auto">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-emerald"
      >
        Territory Map
      </motion.h1>
      <p className="mb-6 text-sm text-white/70">
        {territories.length} regions · {claimed} claimed
      </p>

      {loading && <Skeleton lines={5} className="mb-4" />}

      {error && !loading && (
        <div className="mb-4 rounded-2xl border border-rasta-red/30 bg-rasta-red/10 p-4 text-sm text-rasta-red/80">
          {error}
          <button onClick={retry} className="ml-2 underline">Retry</button>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
        <Search className="ml-2 h-4 w-4 text-white/60" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search territories"
          className="flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/60"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="mb-1 flex items-center gap-2">
              <Globe className="h-4 w-4 text-oasis-emerald" />
              <h3 className="font-bold text-oasis-cyan">{t.name}</h3>
            </div>
            <p className="mb-2 text-xs text-white/70">{t.region}</p>
            <div className="flex items-center gap-2 text-xs text-white/80">
              <Shield className="h-3 w-3" />
              {t.controller ?? 'Unclaimed'}
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <span className="rounded bg-oasis-gold/10 px-2 py-0.5 text-oasis-gold">+{t.mining_bonus.toFixed(2)} mining</span>
              <span className="rounded bg-oasis-purple/10 px-2 py-0.5 text-oasis-purple">+{t.xp_bonus.toFixed(2)} XP</span>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassPanel>
  );
}
