'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Trophy, Users, ScrollText, Search, Crown, Shield, Medal,
  CheckCircle2, Circle, Swords, ChevronRight, Plus, User as UserIcon,
} from 'lucide-react';
import {
  getGuilds, getLeaderboard, getQuests, getPlayerQuests,
  createGuild, joinGuild, completePlayerQuest,
  type Guild, type LeaderboardEntry, type QuestDef, type QuestProgress,
} from '../lib/api';
import { useGameStore } from '../store/gameStore';
import { useToastStore, type Toast } from '../store/toastStore';

type ToastFn = (message: string, type?: Toast['type'], duration?: number) => void;

type Tab = 'leaderboard' | 'guilds' | 'quests';

interface SocialPanelProps {
  onClose: () => void;
}

export default function SocialPanel({ onClose }: SocialPanelProps) {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const { address, syncPlayer, addXp } = useGameStore();
  const addToast = useToastStore((s) => s.add);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-oasis-black/95 shadow-2xl" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
            {([
              { id: 'leaderboard' as const, label: 'Leaderboard', icon: Trophy },
              { id: 'guilds' as const, label: 'Guilds', icon: Users },
              { id: 'quests' as const, label: 'Quests', icon: ScrollText },
            ]).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: 'thin' }}>
          {tab === 'leaderboard' && <LeaderboardTab />}
          {tab === 'guilds' && <GuildsTab address={address} addToast={addToast} onSync={syncPlayer} />}
          {tab === 'quests' && <QuestsTab address={address} addToast={addToast} addXp={addXp} onSync={syncPlayer} />}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Leaderboard Tab ── */
function LeaderboardTab() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'top10' | 'top50'>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLeaderboard()
      .then((data) => { if (!cancelled) { setEntries(data ?? []); setError(null); } })
      .catch(() => { if (!cancelled) setError('Failed to load leaderboard'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    if (filter === 'top10') return entries.slice(0, 10);
    if (filter === 'top50') return entries.slice(0, 50);
    return entries;
  }, [entries, filter]);

  if (loading) return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>;
  if (error) return <p className="py-8 text-center text-sm text-red-400">{error}</p>;
  if (visible.length === 0) return <p className="py-8 text-center text-sm text-gray-400">No leaderboard data available.</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Top 100 Pilgrims</h2>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
          {(['all', 'top10', 'top50'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition ${
                filter === f ? 'bg-oasis-cyan/20 text-oasis-cyan' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'top10' ? 'Top 10' : 'Top 50'}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 bg-white/5 text-gray-400">
            <tr>
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">Pilgrim</th>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 text-right font-medium">XP</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry, i) => (
              <motion.tr
                key={entry.address}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.015 }}
                className="border-b border-white/5 transition hover:bg-white/5"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {entry.rank <= 3 ? (
                      <Medal className={`h-3.5 w-3.5 ${entry.rank === 1 ? 'text-oasis-gold' : entry.rank === 2 ? 'text-gray-300' : 'text-amber-600'}`} />
                    ) : (
                      <Trophy className="h-3.5 w-3.5 text-oasis-cyan/50" />
                    )}
                    <span className="font-mono font-bold">#{entry.rank}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-white">{entry.display_name || shorten(entry.address)}</span>
                    {entry.guild_name && (
                      <span className="rounded-full bg-oasis-cyan/10 px-1.5 py-0.5 text-[9px] text-oasis-cyan">{entry.guild_name}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-300">{entry.level}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-oasis-gold">
                  {(entry.total_xp ?? entry.value ?? 0).toLocaleString()}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Guilds Tab ── */
function GuildsTab({ address, addToast, onSync }: { address: string | null; addToast: ToastFn; onSync: () => void }) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    getGuilds().then((data) => { setGuilds(data ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return guilds.filter((g) => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
  }, [guilds, search]);

  const handleCreate = async () => {
    if (!form.name || !address) { addToast('Need name and address', 'warning', 2500); return; }
    const res = await createGuild(form.name, address, form.description);
    if (res) {
      addToast(`Guild "${res.name}" created!`, 'success', 3000);
      setForm({ name: '', description: '' });
      setShowCreate(false);
      reload();
      onSync();
    } else {
      addToast('Failed to create guild', 'error', 3000);
    }
  };

  const handleJoin = async (guildId: string) => {
    if (!address) { addToast('Set your address first', 'warning', 2500); return; }
    const res = await joinGuild(guildId, address);
    if (res) {
      addToast(`Joined ${res.name}!`, 'success', 3000);
      setSelectedGuild(null);
      onSync();
    } else {
      addToast('Failed to join guild', 'error', 3000);
    }
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Guild Hall <span className="text-sm font-normal text-gray-400">({guilds.length})</span></h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 rounded-lg bg-oasis-cyan/20 px-3 py-1.5 text-xs font-semibold text-oasis-cyan transition hover:bg-oasis-cyan/30"
        >
          <Plus className="h-3.5 w-3.5" />
          Create
        </button>
      </div>

      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3"
        >
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Guild name"
            className="w-full rounded-lg bg-oasis-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full rounded-lg bg-oasis-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
          />
          <button
            onClick={handleCreate}
            disabled={!form.name || !address}
            className="w-full rounded-lg bg-oasis-gold/20 py-2 text-sm font-semibold text-oasis-gold transition hover:bg-oasis-gold/30 disabled:opacity-40"
          >
            Create Guild
          </button>
          {!address && <p className="text-[10px] text-gray-500">Set your pilgrim address in Identity tab first.</p>}
        </motion.div>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
        <Search className="ml-1 h-3.5 w-3.5 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guilds..."
          className="flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-gray-500"
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {filtered.map((g) => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-oasis-cyan/30"
            onClick={() => setSelectedGuild(g)}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-bold text-oasis-cyan">{g.name}</h3>
              <Crown className="h-3.5 w-3.5 text-oasis-gold" />
            </div>
            <p className="mb-2 line-clamp-1 text-[11px] text-gray-400">{g.description || 'No description'}</p>
            <div className="flex items-center gap-3 text-[10px] text-gray-300">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {g.members.length}</span>
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> L{g.guild_level}</span>
              <span>{g.territories.length} territories</span>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No guilds found.</p>}

      {/* Guild detail modal */}
      <AnimatePresence>
        {selectedGuild && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            onClick={() => setSelectedGuild(null)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl border border-white/10 bg-oasis-black p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-oasis-gold" />
                  <h3 className="text-xl font-bold text-white">{selectedGuild.name}</h3>
                </div>
                <button onClick={() => setSelectedGuild(null)} className="text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <p className="mb-4 text-sm text-gray-300">{selectedGuild.description || 'No description'}</p>
              <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-lg font-bold text-oasis-cyan">{selectedGuild.members.length}</p>
                  <p className="text-[9px] uppercase text-gray-400">Members</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-lg font-bold text-oasis-gold">{selectedGuild.guild_level}</p>
                  <p className="text-[9px] uppercase text-gray-400">Level</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-lg font-bold text-oasis-purple">{selectedGuild.quests_completed}</p>
                  <p className="text-[9px] uppercase text-gray-400">Quests</p>
                </div>
              </div>
              <div className="mb-4">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-400">Founder</p>
                <p className="font-mono text-xs text-white">{shorten(selectedGuild.founder)}</p>
              </div>
              {selectedGuild.members.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-400">Members ({selectedGuild.members.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGuild.members.slice(0, 10).map((m, i) => (
                      <span key={i} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-mono text-gray-300">{shorten(m)}</span>
                    ))}
                    {selectedGuild.members.length > 10 && <span className="text-[10px] text-gray-500">+{selectedGuild.members.length - 10} more</span>}
                  </div>
                </div>
              )}
              <button
                onClick={() => handleJoin(selectedGuild.id)}
                disabled={!address}
                className="w-full rounded-xl bg-oasis-cyan/20 py-2.5 text-sm font-bold text-oasis-cyan transition hover:bg-oasis-cyan/30 disabled:opacity-40"
              >
                {address ? `Join ${selectedGuild.name}` : 'Set address to join'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Quests Tab ── */
function QuestsTab({ address, addToast, addXp, onSync }: { address: string | null; addToast: ToastFn; addXp: (n: number) => void; onSync: () => void }) {
  const [quests, setQuests] = useState<QuestDef[]>([]);
  const [progress, setProgress] = useState<QuestProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [subtab, setSubtab] = useState<'active' | 'completed' | 'available'>('available');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getQuests(),
      address ? getPlayerQuests(address) : Promise.resolve(null),
    ]).then(([q, p]) => {
      if (cancelled) return;
      setQuests(q ?? []);
      setProgress(p ?? []);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address]);

  const merged = useMemo(() => {
    const byId = new Map(progress.map((p) => [p.quest_id, p]));
    return quests.map((q) => {
      const p = byId.get(q.quest_id);
      const status = p?.completed ? 'completed' : p ? 'active' : 'available';
      return { ...q, status };
    });
  }, [quests, progress]);

  const visible = useMemo(() => merged.filter((q) => q.status === subtab), [merged, subtab]);

  const handleComplete = async (questId: string, xpReward: number) => {
    if (!address) { addToast('Set your address first', 'warning', 2500); return; }
    const res = await completePlayerQuest(address, questId);
    if (res) {
      addXp(xpReward);
      addToast(`Quest completed: +${xpReward} XP`, 'success', 3000);
      // Refresh progress
      const p = await getPlayerQuests(address);
      setProgress(p ?? []);
      onSync();
    } else {
      addToast('Failed to complete quest', 'error', 3000);
    }
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>;

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-white">Quest Log</h2>

      <div className="mb-4 flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
        {(['available', 'active', 'completed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubtab(t)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition ${
              subtab === t ? 'bg-oasis-cyan/20 text-oasis-cyan' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t} ({merged.filter((q) => q.status === t).length})
          </button>
        ))}
      </div>

      {!address && (
        <p className="mb-3 rounded-lg border border-oasis-gold/20 bg-oasis-gold/5 p-2 text-[11px] text-oasis-gold">
          Set your pilgrim address in Identity tab to track quest progress.
        </p>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {visible.map((q) => (
          <motion.div
            key={q.quest_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border p-3 transition ${
              q.status === 'completed'
                ? 'border-oasis-emerald/20 bg-oasis-emerald/5'
                : q.status === 'active'
                ? 'border-oasis-gold/20 bg-oasis-gold/5'
                : 'border-white/10 bg-white/5 hover:border-oasis-cyan/30'
            }`}
          >
            <div className="mb-2 flex items-start justify-between">
              <h3 className="text-sm font-bold text-oasis-cyan">{q.title}</h3>
              {q.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-oasis-emerald" />
              ) : q.status === 'active' ? (
                <Circle className="h-4 w-4 shrink-0 text-oasis-gold" />
              ) : (
                <Swords className="h-4 w-4 shrink-0 text-oasis-purple" />
              )}
            </div>
            <p className="mb-2 text-[11px] leading-snug text-gray-400">{q.description}</p>
            <div className="flex flex-wrap items-center gap-1.5 text-[9px]">
              <span className="rounded-full bg-oasis-purple/10 px-2 py-0.5 text-oasis-purple">{q.avatar_name}</span>
              <span className="rounded-full bg-oasis-gold/10 px-2 py-0.5 text-oasis-gold">{q.xp_reward} XP</span>
              <span className="rounded-full bg-oasis-emerald/10 px-2 py-0.5 text-oasis-emerald">CL {q.min_consciousness_level}</span>
            </div>
            {q.status === 'active' && address && (
              <button
                onClick={() => handleComplete(q.quest_id, q.xp_reward)}
                className="mt-2 w-full rounded-lg bg-oasis-cyan/20 py-1.5 text-[10px] font-bold text-oasis-cyan transition hover:bg-oasis-cyan/30"
              >
                Complete Quest
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {visible.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No {subtab} quests.</p>}
    </div>
  );
}

/* ── Helpers ── */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-3/4 animate-pulse rounded bg-white/10" />
        <div className="h-2 w-1/2 animate-pulse rounded bg-white/5" />
      </div>
    </div>
  );
}

function shorten(addr: string) {
  if (addr.length > 20) return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
  return addr;
}
