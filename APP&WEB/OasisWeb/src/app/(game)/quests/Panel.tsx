'use client';

import { useEffect, useMemo, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Search, CheckCircle2, Circle, Swords } from 'lucide-react';
import { getQuests, getPlayerQuests, type QuestDef, type QuestProgress } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';

type QuestWithStatus = QuestDef & {
  status: 'completed' | 'active' | 'available';
};

export default function QuestsPanel() {
  const [input, setInput] = useState('pilgrim-0001');
  const [address, setAddress] = useState('pilgrim-0001');
  const { data: questsData, loading: loadingQuests } = useApi(getQuests, []);
  const { data: progressData, loading: loadingProgress } = useApi(
    () => getPlayerQuests(address),
    [address],
    { treatNullAsError: false }
  );
  const quests = questsData ?? [];
  const progress = progressData ?? [];
  const [tab, setTab] = useState<'active' | 'completed' | 'available'>('active');
  const loading = loadingQuests || loadingProgress;

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('oasis-address') : null;
    if (saved) {
      setInput(saved);
      setAddress(saved);
    }
  }, []);

  const saveAddress = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('oasis-address', input);
    }
    setAddress(input);
  };

  const merged: QuestWithStatus[] = useMemo(() => {
    const byId = new Map<string, QuestProgress>(progress.map((p) => [p.quest_id, p]));
    return quests.map((q) => {
      const p = byId.get(q.quest_id);
      if (p?.completed) return { ...q, status: 'completed' };
      if (p) return { ...q, status: 'active' };
      return { ...q, status: 'available' };
    });
  }, [quests, progress]);

  const visible = useMemo(() => merged.filter((q) => q.status === tab), [merged, tab]);

  return (
    <GlassPanel className="max-h-[80vh] overflow-y-auto">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-gold"
      >
        Quest Log
      </motion.h1>

      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
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

      <div className="mb-6 flex gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
        {(['active', 'completed', 'available'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-oasis-cyan/20 text-oasis-cyan' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}{' '}
            <span className="ml-1 text-xs opacity-70">
              ({merged.filter((q) => q.status === t).length})
            </span>
          </button>
        ))}
      </div>

      {loading && <Skeleton lines={6} className="mb-4" />}

      {!loading && visible.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
          No {tab} quests found.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((q) => (
          <QuestCard key={q.quest_id} quest={q} />
        ))}
      </div>
    </GlassPanel>
  );
}

const QuestCard = memo(function QuestCard({ quest: q }: { quest: QuestWithStatus }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-oasis-cyan/30"
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
        <span className="rounded-full bg-oasis-purple/10 px-2 py-1 text-oasis-purple">{q.avatar_name}</span>
        <span className="rounded-full bg-oasis-gold/10 px-2 py-1 text-oasis-gold">{q.xp_reward} XP</span>
        <span className="rounded-full bg-oasis-emerald/10 px-2 py-1 text-oasis-emerald">CL {q.min_consciousness_level}</span>
      </div>
    </motion.div>
  );
});
