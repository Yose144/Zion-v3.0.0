'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, CheckCircle2, Circle, Swords } from 'lucide-react';
import { getQuests, getPlayerQuests, type QuestDef, type QuestProgress } from '@/lib/api';

type QuestWithStatus = QuestDef & {
  status: 'completed' | 'active' | 'available';
};

export default function QuestsPage() {
  const [input, setInput] = useState('pilgrim-0001');
  const [address, setAddress] = useState('pilgrim-0001');
  const [quests, setQuests] = useState<QuestDef[]>([]);
  const [progress, setProgress] = useState<QuestProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed' | 'available'>('active');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('oasis-address') : null;
    if (saved) {
      setInput(saved);
      setAddress(saved);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [all, playerQuests] = await Promise.all([
        getQuests(),
        getPlayerQuests(address),
      ]);
      if (mounted) {
        setQuests(all ?? []);
        setProgress(playerQuests ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [address]);

  const saveAddress = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('oasis-address', input);
    }
    setAddress(input);
  };

  const merged: QuestWithStatus[] = useMemo(() => {
    const byId = new Map(progress.map((p) => [p.quest_id, p]));
    return quests.map((q) => {
      const p = byId.get(q.quest_id);
      if (p?.completed) return { ...q, status: 'completed' };
      if (p) return { ...q, status: 'active' };
      return { ...q, status: 'available' };
    });
  }, [quests, progress]);

  const visible = merged.filter((q) => q.status === tab);

  return (
    <section>
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-purple"
      >
        Quest Log
      </motion.h1>

      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveAddress()}
          placeholder="Pilgrim address"
          className="flex-1 rounded-xl bg-transparent px-4 py-3 text-sm text-white placeholder-gray-500 outline-none"
        />
        <button
          onClick={saveAddress}
          className="flex items-center gap-2 rounded-xl bg-oasis-cyan/20 px-4 py-3 text-sm font-semibold text-oasis-cyan transition-colors hover:bg-oasis-cyan/30"
        >
          <Search className="h-4 w-4" />
          Load
        </button>
      </div>

      <div className="mb-6 flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm">
        {(['active', 'completed', 'available'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? 'bg-oasis-cyan/20 text-oasis-cyan'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}{' '}
            <span className="ml-1 text-xs opacity-70">
              ({merged.filter((q) => q.status === t).length})
            </span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center text-gray-400">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-oasis-cyan border-t-transparent" />
          Loading quests…
        </div>
      )}

      {!loading && visible.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
          No {tab} quests found.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((q) => (
          <motion.div
            key={q.quest_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-colors hover:border-oasis-cyan/30"
          >
            <div className="mb-3 flex items-start justify-between">
              <h3 className="font-bold text-oasis-cyan">{q.title}</h3>
              {q.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-oasis-emerald" />
              ) : q.status === 'active' ? (
                <Circle className="h-5 w-5 text-oasis-gold" />
              ) : (
                <Swords className="h-5 w-5 text-oasis-purple" />
              )}
            </div>
            <p className="mb-4 text-sm text-gray-400">{q.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
              <span className="rounded-full bg-oasis-purple/10 px-2 py-1 text-oasis-purple">
                {q.avatar_name}
              </span>
              <span className="rounded-full bg-oasis-gold/10 px-2 py-1 text-oasis-gold">
                {q.xp_reward} XP
              </span>
              <span className="rounded-full bg-oasis-emerald/10 px-2 py-1 text-oasis-emerald">
                CL {q.min_consciousness_level}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
