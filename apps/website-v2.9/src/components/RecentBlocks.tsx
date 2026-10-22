'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Blocks, Clock, Hash, User } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';

const RecentBlocksCopy = {
  justNow: { cs: `právě teď`, en: `just now` },
  enUs: { cs: `cs-CZ`, en: `en-US` },
  loadingRecentBlocks: { cs: `Načítám poslední bloky...`, en: `Loading recent blocks...` },
  recentBlocks: { cs: `Poslední bloky`, en: `Recent Blocks` },
  viewAll: { cs: `Zobrazit vše →`, en: `View all →` },
  height: { cs: `Výška`, en: `Height` },
  time: { cs: `Čas`, en: `Time` },
  transactions: { cs: `Transakce`, en: `Transactions` },
  consciousness: { cs: `Vědomí: `, en: `Consciousness: ` },
};

interface Block {
  height: number;
  hash: string;
  timestamp: number;
  miner: string;
  transactions: number;
  consciousness_level?: string;
}

export default function RecentBlocks() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocks = useCallback(async () => {
    try {
      const data = await apiClient<Block[]>('/blockchain/blocks?limit=5');
      setBlocks(data);
    } catch (error) {
      console.error('Failed to fetch blocks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchBlocks, 15_000);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return RecentBlocksCopy.justNow[cs ? 'cs' : 'en'];
    if (minutes < 60) return cs ? `před ${minutes} min` : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return cs ? `před ${hours} h` : `${hours}h ago`;
    return date.toLocaleDateString(RecentBlocksCopy.enUs[cs ? 'cs' : 'en']);
  };

  const truncateHash = (hash: string) => {
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
  };

  if (loading) {
    return (
      <section className="mt-12">
        <div className="animate-pulse text-gray-400">{RecentBlocksCopy.loadingRecentBlocks[cs ? 'cs' : 'en']}</div>
      </section>
    );
  }

  return (
    <section className="mt-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Blocks className="w-6 h-6 text-zion-gold" />
            <h2 className="text-3xl font-bold">{RecentBlocksCopy.recentBlocks[cs ? 'cs' : 'en']}</h2>
          </div>
          <Link 
            href="/explorer/blocks"
            className="text-sm text-zion-cyan hover:text-zion-gold transition-colors"
          >
            {RecentBlocksCopy.viewAll[cs ? 'cs' : 'en']}
          </Link>
        </div>

        <div className="space-y-4">
          {blocks.map((block, index) => (
            <motion.div
              key={block.hash}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-black/30 rounded-lg p-4 hover:bg-black/40 transition-colors"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Blocks className="w-4 h-4 text-zion-purple" />
                    <span className="text-sm text-gray-400">{RecentBlocksCopy.height[cs ? 'cs' : 'en']}</span>
                  </div>
                  <div className="text-lg font-semibold text-zion-purple">
                    #{block.height}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-4 h-4 text-zion-cyan" />
                    <span className="text-sm text-gray-400">Hash</span>
                  </div>
                  <div className="text-sm font-mono text-zion-cyan">
                    {truncateHash(block.hash)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-zion-gold" />
                    <span className="text-sm text-gray-400">{RecentBlocksCopy.time[cs ? 'cs' : 'en']}</span>
                  </div>
                  <div className="text-sm text-zion-gold">
                    {formatTimestamp(block.timestamp)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-zion-cyan" />
                    <span className="text-sm text-gray-400">{RecentBlocksCopy.transactions[cs ? 'cs' : 'en']}</span>
                  </div>
                  <div className="text-sm text-zion-cyan">
                    {block.transactions} tx
                  </div>
                </div>
              </div>

              {block.consciousness_level && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <span className="text-xs text-gray-500">{RecentBlocksCopy.consciousness[cs ? 'cs' : 'en']}</span>
                  <span className="text-xs text-zion-purple font-semibold">
                    {block.consciousness_level}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
