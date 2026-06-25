'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Atom, Braces, Database, Gauge, HelpCircle, Shield } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { apiClient } from '@/lib/api';
import { usePolling } from '@/hooks/usePolling';
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL } from '@/lib/site';

interface BlockchainStats {
  // NOTE: Backend schema can vary across deployments.
  // Keep fields optional and use safe fallbacks in rendering.
  total_blocks?: number;
  total_supply?: number;
  circulating_supply?: number;
  max_supply?: number;
  premine_supply?: number;
  mined_supply?: number;
  total_transactions?: number;
  mempool_size?: number;
  tx_pool_size?: number;
  difficulty?: number;
  block_height?: number;
  latest_block?: {
    height: number;
    hash: string;
    timestamp: number;
  };
  last_block?: {
    height: number;
    hash: string;
    timestamp: number;
  };
}

const placeholderStats: BlockchainStats = {
  total_blocks: 0,
  total_supply: 144_000_000_000,
  max_supply: 144_000_000_000,
  total_transactions: 0,
  mempool_size: 0,
  difficulty: 0,
};

export default function LiveDashboard() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = cs ? 'cs-CZ' : 'en-US';
  const [stats, setStats] = useState<BlockchainStats>(placeholderStats);
  const [loadedAtLeastOnce, setLoadedAtLeastOnce] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiClient<BlockchainStats | null>('/blockchain/stats');

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid blockchain stats payload');
      }

      setStats(data);
      setLoadedAtLeastOnce(true);
      setLastSuccessAt(Date.now());
      setError(null);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('API not available, using placeholder data');
        setLoadedAtLeastOnce(true);
        return;
      }

      if (!loadedAtLeastOnce) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  }, [loadedAtLeastOnce]);

  usePolling(fetchStats, 30_000);

  const supply = stats.total_supply ?? stats.max_supply ?? stats.circulating_supply ?? 0;
  const formattedSupply = supply >= 1e9
    ? (supply / 1e9).toFixed(2) + 'B'
    : supply >= 1e6
    ? (supply / 1e6).toFixed(2) + 'M'
    : supply.toLocaleString(locale);
  const latestBlock = stats.last_block ?? stats.latest_block ?? null;
  const formattedTimestamp = latestBlock?.timestamp
    ? new Date(latestBlock.timestamp * 1000).toLocaleString(locale)
    : '—';
  const mempoolSize = stats.mempool_size ?? stats.tx_pool_size ?? 0;
  const staleTelemetry = loadedAtLeastOnce && !!error;

  const highlightCards = [
    {
      label: cs ? 'Bloky celkem' : 'Total Blocks',
      value: (stats.total_blocks ?? 0).toLocaleString(locale),
      icon: Database,
      accent: 'from-zion-gold/25 to-zion-purple/10',
      tip: cs ? 'Celkový počet vytěžených bloků od MainNet Genesis.' : 'Total number of mined blocks since MainNet Genesis.',
    },
    {
      label: cs ? 'Zásoba celkem' : 'Total Supply',
      value: formattedSupply,
      icon: Gauge,
      accent: 'from-zion-purple/25 to-zion-cyan/10',
      tip: cs ? 'Maximální zásoba ZION je 144 miliard včetně genesis premine.' : 'Maximum ZION supply is 144 billion including genesis premine.',
    },
    {
      label: cs ? 'Transakce' : 'Transactions',
      value: (stats.total_transactions ?? 0).toLocaleString(locale),
      icon: Atom,
      accent: 'from-zion-cyan/25 to-zion-gold/10',
      tip: cs ? 'Celkový počet transakcí zapsaných na blockchainu.' : 'Total number of transactions recorded on the blockchain.',
    },
  ];

  const auxCards = [
    { label: cs ? 'Obtížnost' : 'Difficulty', value: (stats.difficulty ?? 0).toLocaleString(locale), icon: Shield, tip: cs ? 'Aktuální těžební obtížnost nastavená LWMA DAA.' : 'Current mining difficulty set by LWMA DAA.' },
    { label: cs ? 'Velikost mempoolu' : 'Mempool Size', value: mempoolSize.toLocaleString(locale), icon: Braces, tip: cs ? 'Transakce čekající na potvrzení v mempoolu.' : 'Transactions waiting for confirmation in the mempool.' },
  ];

  return (
    <section className="py-20 px-4">
      <div className="zion-container space-y-10">
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 px-4 py-2">
            <Activity className="w-5 h-5 text-zion-gold animate-pulse" />
            <span className="text-sm tracking-wide uppercase text-gray-300">{cs ? 'Mise console' : 'Mission Console'}</span>
          </div>
          <div className="text-xl sm:text-2xl md:text-3xl font-semibold text-gradient">{SITE_RELEASE_LABEL} · runtime {SITE_RUNTIME_LABEL} · Mainnet Launch Countdown Telemetry</div>
          {staleTelemetry && (
            <span className="text-xs text-cyan-200 bg-cyan-500/10 rounded-full px-3 py-1 border border-cyan-500/30">
              {cs ? 'Poslední validní snapshot · čekám na obnovu telemetrie' : 'Last valid snapshot · waiting for telemetry recovery'}
            </span>
          )}
          {error && (
            <span className="text-xs text-amber-300 bg-amber-500/10 rounded-full px-3 py-1 border border-amber-500/30">
              ⚠️ {error}
            </span>
          )}
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="zion-rainbow-card backdrop-blur-xl p-6 space-y-6"
            style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase text-gray-400 tracking-[0.4em]">{cs ? 'Stav kontinuua' : 'Continuum status'}</p>
                <h3 className="text-2xl font-semibold text-white">{cs ? 'Synchronizace galakticke site' : 'Galactic network sync'}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className={`inline-flex h-2 w-2 rounded-full ${staleTelemetry ? 'bg-amber-300' : 'bg-emerald-400'} animate-pulse`} />
                {staleTelemetry
                  ? (cs ? 'Snapshot aktivni' : 'Snapshot active')
                  : `${cs ? 'Aktualizace' : 'Updated'} ${loadedAtLeastOnce ? (cs ? 'zive' : 'live') : (cs ? 'spousteni' : 'initializing')}`}
                {lastSuccessAt && (
                  <span>
                    · {new Date(lastSuccessAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {highlightCards.map((card) => (
                <div
                  key={card.label}
                  className={`group relative rounded-2xl border border-white/10 bg-linear-to-br ${card.accent} p-4`}
                >
                  <card.icon className="w-5 h-5 text-white/70 mb-3" />
                  <div className="text-2xl font-bold text-white">{card.value}</div>
                  <div className="text-xs uppercase tracking-wide text-gray-300">{card.label}</div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="group/tooltip relative">
                      <HelpCircle className="w-3.5 h-3.5 text-white/50" />
                      <div className="absolute right-0 top-5 w-48 p-2 rounded-lg bg-black/90 border border-white/10 text-[10px] text-gray-300 opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-20 pointer-events-none">
                        {card.tip}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {auxCards.map((card) => (
                <div key={card.label} className="group relative rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">{card.label}</p>
                      <p className="text-xl font-semibold text-white">{card.value}</p>
                    </div>
                    <card.icon className="w-5 h-5 text-zion-gold" />
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-linear-to-r from-zion-gold via-zion-purple to-transparent" />
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="group/tooltip relative">
                      <HelpCircle className="w-3.5 h-3.5 text-white/50" />
                      <div className="absolute right-0 top-5 w-48 p-2 rounded-lg bg-black/90 border border-white/10 text-[10px] text-gray-300 opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-20 pointer-events-none">
                        {card.tip}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="zion-rainbow-card backdrop-blur-xl p-6 flex flex-col gap-6"
            style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
          >
            <div>
              <p className="text-xs uppercase text-gray-500 tracking-[0.3em]">{cs ? 'Posledni blok' : 'Latest block'}</p>
              <h3 className="text-3xl font-semibold text-white">
                #{latestBlock?.height ?? stats.block_height ?? '—'}
              </h3>
              <p className="text-sm text-gray-400">{formattedTimestamp}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-gray-400 mb-2">Hash</p>
              <p className="font-mono text-xs text-zion-cyan break-all">
                {latestBlock?.hash ?? (cs ? 'Cekani na signal' : 'Waiting for signal')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Mempool</p>
                <p className="text-xl font-semibold text-white">{(stats.mempool_size ?? 0).toLocaleString(locale)}</p>
              </div>
              <div>
                <p className="text-gray-400">{cs ? 'Obtiznost' : 'Difficulty'}</p>
                <p className="text-xl font-semibold text-white">{(stats.difficulty ?? 0).toLocaleString(locale)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-linear-to-br from-zion-purple/20 to-zion-cyan/10 p-4 text-sm text-gray-200">
              Blockchain telemetry pulled live from the {SITE_RELEASE_LABEL} V3 mainnet API every 30 s, on top of the {SITE_RUNTIME_LABEL} runtime.
              Current public runtime is a Core + Edge topology (Core PC + Hetzner Edge VPS).
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
