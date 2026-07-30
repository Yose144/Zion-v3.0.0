'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, User } from 'lucide-react';
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getLeaderboard().then((data) => {
      if (mounted) setEntries(data ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section>
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-purple"
      >
        Top 100 Pilgrims
      </motion.h1>

      {loading && (
        <div className="text-center text-gray-400">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-oasis-cyan border-t-transparent" />
          Loading leaderboard…
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
          No leaderboard data available.
        </p>
      )}

      {!loading && entries.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Pilgrim</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium text-right">XP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <motion.tr
                    key={entry.address}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-white/5 transition-colors hover:bg-white/5"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {entry.rank <= 3 ? (
                          <Medal
                            className={`h-4 w-4 ${
                              entry.rank === 1
                                ? 'text-oasis-gold'
                                : entry.rank === 2
                                ? 'text-gray-300'
                                : 'text-amber-600'
                            }`}
                          />
                        ) : (
                          <Trophy className="h-4 w-4 text-oasis-cyan" />
                        )}
                        <span className="font-mono font-bold">#{entry.rank}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-oasis-purple" />
                        <span className="font-medium">
                          {entry.display_name || shorten(entry.address)}
                        </span>
                        {entry.guild_name && (
                          <span className="rounded-full bg-oasis-cyan/10 px-2 py-0.5 text-xs text-oasis-cyan">
                            {entry.guild_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{entry.level}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-oasis-gold">
                      {(entry.total_xp ?? entry.value ?? 0).toLocaleString()}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function shorten(addr: string) {
  if (addr.length > 20) return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
  return addr;
}
