'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Star, Sparkles, type LucideIcon } from 'lucide-react';
import { getAvatars, type AvatarDef } from '@/lib/api';
import GlassPanel from '@/components/GlassPanel';

export default function AvatarsPanel() {
  const [avatars, setAvatars] = useState<AvatarDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ray, setRay] = useState('');
  const [rarity, setRarity] = useState('');
  const [cl, setCl] = useState('');
  const [selected, setSelected] = useState<AvatarDef | null>(null);

  useEffect(() => {
    let mounted = true;
    getAvatars().then((data) => {
      if (mounted) setAvatars(data ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const rays = useMemo(
    () => Array.from(new Set(avatars.map((a) => a.ray))).sort(),
    [avatars]
  );
  const rarities = useMemo(
    () => Array.from(new Set(avatars.map((a) => a.rarity))).sort(),
    [avatars]
  );

  const filtered = useMemo(() => {
    return avatars.filter((a) => {
      const matchesSearch =
        !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.subtitle.toLowerCase().includes(search.toLowerCase());
      const matchesRay = !ray || a.ray === ray;
      const matchesRarity = !rarity || a.rarity === rarity;
      const matchesCl = !cl || a.consciousness_level_required >= Number(cl);
      return matchesSearch && matchesRay && matchesRarity && matchesCl;
    });
  }, [avatars, search, ray, rarity, cl]);

  return (
    <GlassPanel className="max-h-[80vh] overflow-y-auto">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-purple"
      >
        Avatar Codex
      </motion.h1>

      <div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="w-full rounded-xl bg-oasis-black/40 py-2.5 pl-9 pr-3 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-oasis-cyan/50"
          />
        </div>
        <select
          value={ray}
          onChange={(e) => setRay(e.target.value)}
          className="rounded-xl bg-oasis-black/40 py-2.5 px-3 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-oasis-cyan/50"
        >
          <option value="">All rays</option>
          {rays.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
          className="rounded-xl bg-oasis-black/40 py-2.5 px-3 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-oasis-cyan/50"
        >
          <option value="">All rarities</option>
          {rarities.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={cl}
          onChange={(e) => setCl(e.target.value)}
          className="rounded-xl bg-oasis-black/40 py-2.5 px-3 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-oasis-cyan/50"
        >
          <option value="">Any consciousness</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              Level {n}+
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center text-gray-400">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-oasis-cyan border-t-transparent" />
          Summoning avatars…
        </div>
      )}

      {!loading && (
        <p className="mb-4 text-sm text-gray-400">
          Showing {filtered.length} of {avatars.length} avatars
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((avatar) => (
          <motion.button
            key={avatar.id}
            onClick={() => setSelected(avatar)}
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-colors hover:border-oasis-cyan/40"
          >
            <div className="mb-2 flex items-start justify-between">
              <h3 className="text-lg font-bold text-oasis-cyan">{avatar.name}</h3>
              <span className="rounded-full bg-oasis-gold/10 px-2 py-0.5 text-xs font-medium text-oasis-gold">
                {avatar.rarity}
              </span>
            </div>
            <p className="mb-4 text-sm text-gray-400">{avatar.subtitle}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge icon={Sparkles} text={avatar.ray} color="text-oasis-purple" />
              <Badge icon={Star} text={`CL ${avatar.consciousness_level_required}`} color="text-oasis-emerald" />
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-oasis-cyan/30 bg-oasis-black/90 p-6 shadow-2xl"
            >
              <button
                onClick={() => setSelected(null)}
                className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="mb-1 text-2xl font-bold text-oasis-cyan">{selected.name}</h2>
              <p className="mb-4 text-oasis-gold">{selected.subtitle}</p>

              <div className="mb-6 flex flex-wrap gap-2">
                <Badge icon={Sparkles} text={selected.ray} color="text-oasis-purple" />
                <Badge icon={Star} text={selected.rarity} color="text-oasis-gold" />
                <Badge icon={Star} text={`CL ${selected.consciousness_level_required}`} color="text-oasis-emerald" />
                <Badge text={selected.role} color="text-oasis-cyan" />
                <Badge text={selected.location} color="text-gray-300" />
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-gray-300">
                <p>
                  <span className="font-semibold text-white">Quest line:</span>{' '}
                  {selected.quest_line}
                </p>
                <p>
                  <span className="font-semibold text-white">Teaching:</span>{' '}
                  {selected.teaching}
                </p>
                <p>
                  <span className="font-semibold text-white">Ability:</span>{' '}
                  {selected.ability}
                </p>
                <p>
                  <span className="font-semibold text-white">Consciousness:</span>{' '}
                  {selected.consciousness_level_name} ({selected.consciousness_level_required})
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}

function Badge({
  icon: Icon,
  text,
  color,
}: {
  icon?: LucideIcon;
  text: string;
  color: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium ${color}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {text}
    </span>
  );
}
