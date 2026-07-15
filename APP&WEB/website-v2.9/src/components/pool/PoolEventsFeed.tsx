'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Pickaxe, Users, Clock, RefreshCw, Droplets } from 'lucide-react';

interface PoolEvent {
  id: string;
  type: 'block' | 'miner' | 'payout';
  time: number;
  title: string;
  titleCs: string;
  detail?: string;
  detailCs?: string;
  link?: string;
}

async function fetchPoolStats(): Promise<{
  blocks: number;
  miners: number;
  payouts: number;
  totalPaid: number;
}> {
  try {
    const res = await fetch('/api/pool/stats', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { blocks: 0, miners: 0, payouts: 0, totalPaid: 0 };
    const data = await res.json();
    return {
      blocks: data.aggregate?.blocks_found ?? 0,
      miners: data.aggregate?.active_miners ?? 0,
      payouts: data.pplns?.payout_rounds ?? 0,
      totalPaid: data.pplns?.total_paid_zion ?? 0,
    };
  } catch {
    return { blocks: 0, miners: 0, payouts: 0, totalPaid: 0 };
  }
}

function usePoolEvents() {
  const [events, setEvents] = useState<PoolEvent[]>([]);
  const [lastBlocks, setLastBlocks] = useState(0);
  const [lastMiners, setLastMiners] = useState(0);
  const [lastPayouts, setLastPayouts] = useState(0);

  const refresh = useCallback(async () => {
    const stats = await fetchPoolStats();
    const now = Date.now();
    const newEvents: PoolEvent[] = [];

    if (stats.blocks > lastBlocks && lastBlocks > 0) {
      newEvents.push({
        id: `block-${stats.blocks}`,
        type: 'block',
        time: now,
        title: `Block found! Total: ${stats.blocks}`,
        titleCs: `Blok nalezen! Celkem: ${stats.blocks}`,
        link: '/explorer',
      });
    }
    if (stats.miners > lastMiners && lastMiners > 0) {
      newEvents.push({
        id: `miner-${now}`,
        type: 'miner',
        time: now,
        title: `${stats.miners} active miners`,
        titleCs: `${stats.miners} aktivních minerů`,
      });
    }
    if (stats.payouts > lastPayouts && lastPayouts > 0) {
      newEvents.push({
        id: `payout-${now}`,
        type: 'payout',
        time: now,
        title: `Payout round #${stats.payouts} completed`,
        titleCs: `Výplatní kolo #${stats.payouts} dokončeno`,
        detail: `Total paid: ${stats.totalPaid.toFixed(2)} ZION`,
        detailCs: `Celkem vyplaceno: ${stats.totalPaid.toFixed(2)} ZION`,
      });
    }

    setLastBlocks(stats.blocks);
    setLastMiners(stats.miners);
    setLastPayouts(stats.payouts);

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
  }, [lastBlocks, lastMiners, lastPayouts]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { events, refresh };
}

const typeIcons: Record<string, React.ReactNode> = {
  block: <Box className="h-4 w-4 text-zion-gold" />,
  miner: <Users className="h-4 w-4 text-purple-400" />,
  payout: <Droplets className="h-4 w-4 text-emerald-400" />,
};

function timeAgo(ts: number, cs: boolean): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return cs ? 'právě teď' : 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${cs ? 'zpět' : 'ago'}`;
  const h = Math.floor(m / 60);
  return `${h}h ${cs ? 'zpět' : 'ago'}`;
}

export default function PoolEventsFeed({ cs }: { cs: boolean }) {
  const { events, refresh } = usePoolEvents();

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Události' : 'Events'}</p>
          <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
            <Clock className="h-7 w-7 text-zion-cyan" />
            {cs ? 'Živý pool feed' : 'Live Pool Feed'}
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
              className="flex items-start gap-3 zion-rainbow-sub p-3 transition-colors"
              style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
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
