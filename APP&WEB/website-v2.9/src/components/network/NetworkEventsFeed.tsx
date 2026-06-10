'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, ArrowRightLeft, Users, Clock, Radio, RefreshCw } from 'lucide-react';

interface NetworkEvent {
  id: string;
  type: 'block' | 'tx' | 'peer' | 'miner';
  time: number;
  title: string;
  titleCs: string;
  detail?: string;
  detailCs?: string;
  link?: string;
}

async function fetchRecentBlocks(): Promise<{ height: number; hash: string; timestamp: number }[]> {
  try {
    const res = await fetch('/api/blockchain/stats', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const height = data.block_height ?? 0;
    if (!height) return [];
    const blocks = [];
    for (let i = 0; i < 5; i++) {
      const h = height - i;
      if (h <= 0) break;
      blocks.push({
        height: h,
        hash: `...${String(h).slice(-4)}`,
        timestamp: Date.now() - i * 60000,
      });
    }
    return blocks;
  } catch {
    return [];
  }
}

async function fetchPoolStats(): Promise<{
  miners: number | null;
  hashrate: number | null;
}> {
  try {
    const res = await fetch('/api/pool/stats', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { miners: null, hashrate: null };
    const data = await res.json();
    const agg = data.aggregate ?? {};
    return { miners: agg.active_miners ?? null, hashrate: agg.hashrate ?? null };
  } catch {
    return { miners: null, hashrate: null };
  }
}

function useNetworkEvents(cs: boolean) {
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [lastMinerCount, setLastMinerCount] = useState<number | null>(null);
  const [lastHeight, setLastHeight] = useState<number>(0);

  const refresh = useCallback(async () => {
    const [blocks, pool] = await Promise.all([fetchRecentBlocks(), fetchPoolStats()]);
    const now = Date.now();
    const newEvents: NetworkEvent[] = [];

    blocks.forEach((b, i) => {
      const isNew = b.height > lastHeight;
      newEvents.push({
        id: `block-${b.height}`,
        type: 'block',
        time: now - i * 60000,
        title: `Block #${b.height.toLocaleString()} mined`,
        titleCs: `Blok #${b.height.toLocaleString()} vytěžen`,
        detail: `Hash ${b.hash}`,
        detailCs: `Hash ${b.hash}`,
        link: `/explorer/block?id=${b.height}`,
      });
      if (isNew && i === 0) {
        setLastHeight(b.height);
      }
    });

    if (pool.miners != null) {
      if (lastMinerCount != null && pool.miners > lastMinerCount) {
        newEvents.push({
          id: `miner-${now}`,
          type: 'miner',
          time: now,
          title: `${pool.miners} active miners`,
          titleCs: `${pool.miners} aktivních minerů`,
          detail: pool.hashrate ? `Network hashrate ${(pool.hashrate / 1e6).toFixed(2)} MH/s` : undefined,
          detailCs: pool.hashrate ? `Síťový hashrate ${(pool.hashrate / 1e6).toFixed(2)} MH/s` : undefined,
        });
      }
      setLastMinerCount(pool.miners);
    }

    setEvents((prev) => {
      const merged = [...newEvents, ...prev];
      const seen = new Set<string>();
      const unique = merged.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      return unique.slice(0, 12);
    });
  }, [cs, lastHeight, lastMinerCount]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { events, refresh };
}

const typeIcons: Record<string, React.ReactNode> = {
  block: <Box className="h-4 w-4 text-zion-gold" />,
  tx: <ArrowRightLeft className="h-4 w-4 text-zion-cyan" />,
  peer: <Radio className="h-4 w-4 text-emerald-400" />,
  miner: <Users className="h-4 w-4 text-purple-400" />,
};

function timeAgo(ts: number, cs: boolean): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return cs ? 'právě teď' : 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${cs ? 'zpět' : 'ago'}`;
  const h = Math.floor(m / 60);
  return `${h}h ${cs ? 'zpět' : 'ago'}`;
}

export default function NetworkEventsFeed({ cs }: { cs: boolean }) {
  const { events, refresh } = useNetworkEvents(cs);

  return (
    <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Události' : 'Events'}</p>
          <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
            <Clock className="h-7 w-7 text-zion-cyan" />
            {cs ? 'Živý síťový feed' : 'Live Network Feed'}
          </h2>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400 hover:text-white transition"
        >
          <RefreshCw className="h-3.5 w-3.5" /> {cs ? 'Aktualizovat' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/[0.07] transition-colors"
            >
              <div className="mt-0.5 shrink-0">{typeIcons[event.type]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {event.link ? (
                    <Link
                      href={event.link}
                      className="text-sm font-medium text-white hover:text-zion-cyan transition truncate"
                    >
                      {cs ? event.titleCs : event.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-white truncate">{cs ? event.titleCs : event.title}</span>
                  )}
                  <span className="text-[10px] text-gray-500 shrink-0">{timeAgo(event.time, cs)}</span>
                </div>
                {(cs ? event.detailCs : event.detail) && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {cs ? event.detailCs : event.detail}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {events.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-8">
            {cs ? 'Žádné události k zobrazení. Čekám na živá data…' : 'No events to display. Waiting for live data…'}
          </div>
        )}
      </div>
    </section>
  );
}
