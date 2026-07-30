'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Shield, Users, Crown } from 'lucide-react';
import { getGuilds, createGuild, type Guild } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';

export default function GuildsPanel() {
  const { data, loading, error, retry, refetch } = useApi(getGuilds, []);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', founder: '', description: '' });
  const [status, setStatus] = useState<string | null>(null);

  const guilds = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return guilds.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.founder.toLowerCase().includes(q)
    );
  }, [guilds, search]);

  const onCreate = async () => {
    if (!form.name || !form.founder) return;
    const res = await createGuild(form.name, form.founder, form.description);
    setStatus(res ? `Created ${res.name}` : 'Create failed');
    setForm({ name: '', founder: '', description: '' });
    refetch();
  };

  return (
    <GlassPanel className="max-h-[80vh] overflow-y-auto">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-purple"
      >
        Guild Hall
      </motion.h1>
      <p className="mb-6 text-sm text-gray-400">{guilds.length} guilds · forge your alliance</p>

      {loading && <Skeleton lines={5} className="mb-4" />}

      {error && !loading && (
        <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          {error} <button onClick={retry} className="ml-2 underline">Retry</button>
        </div>
      )}

      <div className="mb-4 grid gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 sm:grid-cols-4">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Guild name"
          className="rounded-xl bg-oasis-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
        />
        <input
          value={form.founder}
          onChange={(e) => setForm({ ...form, founder: e.target.value })}
          placeholder="Founder address"
          className="rounded-xl bg-oasis-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
        />
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description"
          className="rounded-xl bg-oasis-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500"
        />
        <button
          onClick={onCreate}
          className="rounded-xl bg-oasis-cyan/20 py-2 text-sm font-semibold text-oasis-cyan transition hover:bg-oasis-cyan/30"
        >
          Create Guild
        </button>
      </div>

      {status && <p className="mb-3 text-xs text-oasis-gold">{status}</p>}

      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
        <Search className="ml-2 h-4 w-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guilds"
          className="flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-gray-500"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((g) => (
          <GuildCard key={g.id} guild={g} />
        ))}
      </div>
    </GlassPanel>
  );
}

function GuildCard({ guild }: { guild: Guild }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-bold text-oasis-cyan">{guild.name}</h3>
        <Crown className="h-4 w-4 text-oasis-gold" />
      </div>
      <p className="mb-2 line-clamp-2 text-xs text-gray-400">{guild.description}</p>
      <div className="flex items-center gap-3 text-xs text-gray-300">
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {guild.members.length}</span>
        <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> L{guild.guild_level}</span>
        <span>{guild.territories.length} territories</span>
      </div>
    </motion.div>
  );
}
