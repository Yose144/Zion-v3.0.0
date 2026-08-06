'use client';

import { useState, useCallback } from 'react';
import { Activity, Atom, Braces, Database, Gauge, HelpCircle, Shield, TrendingUp } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { apiClient } from '@/lib/api';
import { usePolling } from '@/hooks/usePolling';

const LiveDashboardCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  totalBlocks: { cs: `Bloky celkem`, en: `Total Blocks` },
  totalNumberOfMinedBlocksSinceM: { cs: `Celkový počet vytěžených bloků od MainNet Genesis.`, en: `Total number of mined blocks since MainNet Genesis.` },
  totalSupply: { cs: `Zásoba celkem`, en: `Total Supply` },
  maximumZionSupplyIs144BillionI: { cs: `Maximální zásoba ZION je 144 miliard včetně genesis premine.`, en: `Maximum ZION supply is 144 billion including genesis premine.` },
  transactions: { cs: `Transakce`, en: `Transactions` },
  totalNumberOfTransactionsRecor: { cs: `Celkový počet transakcí zapsaných na blockchainu.`, en: `Total number of transactions recorded on the blockchain.` },
  difficulty: { cs: `Obtížnost`, en: `Difficulty` },
  currentMiningDifficultySetByLw: { cs: `Aktuální těžební obtížnost nastavená LWMA DAA.`, en: `Current mining difficulty set by LWMA DAA.` },
  mempoolSize: { cs: `Velikost mempoolu`, en: `Mempool Size` },
  transactionsWaitingForConfirma: { cs: `Transakce čekající na potvrzení v mempoolu.`, en: `Transactions waiting for confirmation in the mempool.` },
  missionConsole: { cs: `Mise console`, en: `Mission Console` },
  lastValidSnapshotWaitingForTel: { cs: `Poslední validní snapshot · čekám na obnovu telemetrie`, en: `Last valid snapshot · waiting for telemetry recovery` },
  continuumStatus: { cs: `Stav kontinuua`, en: `Continuum status` },
  galacticNetworkSync: { cs: `Synchronizace galakticke site`, en: `Galactic network sync` },
  snapshotActive: { cs: `Snapshot aktivni`, en: `Snapshot active` },
  updated: { cs: `Aktualizace`, en: `Updated` },
  live: { cs: `zive`, en: `live` },
  initializing: { cs: `spousteni`, en: `initializing` },
  latestBlock: { cs: `Posledni blok`, en: `Latest block` },
  waitingForSignal: { cs: `Cekani na signal`, en: `Waiting for signal` },
  difficulty_2: { cs: `Obtiznost`, en: `Difficulty` },
  defiPool: { cs: `DeFi Pool`, en: `DeFi Pool` },
  zionPrice: { cs: `Cena ZION`, en: `ZION Price` },
  tvlUsd: { cs: `TVL (USD)`, en: `TVL (USD)` },
  liquidity: { cs: `Likvidita`, en: `Liquidity` },
  ethUsd: { cs: `ETH/USD`, en: `ETH/USD` },
  primaryPriceFromWzionUsdt03Poo: { cs: `Primární cena z wZION/USDT 0.3% poolu na Base mainnet. Aktualizováno každých 30s.`, en: `Primary price from wZION/USDT 0.3% pool on Base mainnet. Updated every 30s.` },
};

interface BlockchainStats {
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
  latest_block?: { height: number; hash: string; timestamp: number };
  last_block?: { height: number; hash: string; timestamp: number };
}

interface DefiPrice {
  ok?: boolean;
  source?: string;
  price?: {
    usd_per_wzion?: number;
    weth_per_wzion?: number;
    wzion_per_weth?: number;
    weth_usd?: number;
    tick?: number;
  };
  liquidity?: string;
  tvl?: { weth?: number; wzion?: number; usd?: number };
  fetchedAt?: number;
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
  const locale = LiveDashboardCopy.enUs[cs ? 'cs' : 'en'];
  const [stats, setStats] = useState<BlockchainStats>(placeholderStats);
  const [defiPrice, setDefiPrice] = useState<DefiPrice | null>(null);
  const [loadedAtLeastOnce, setLoadedAtLeastOnce] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiClient<BlockchainStats | null>('/blockchain/stats');
      if (!data || typeof data !== 'object') throw new Error('Invalid blockchain stats payload');
      setStats(data);
      setLoadedAtLeastOnce(true);
      setLastSuccessAt(Date.now());
      setError(null);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('API not available, using placeholder data');
      setLoadedAtLeastOnce(true);
      if (!loadedAtLeastOnce) setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [loadedAtLeastOnce]);

  const fetchDefiPrice = useCallback(async () => {
    try {
      const data = await apiClient<DefiPrice | null>('/defi/price');
      if (data && typeof data === 'object') setDefiPrice(data);
    } catch { /* DeFi price is optional */ }
  }, []);

  usePolling(fetchStats, 30_000);
  usePolling(fetchDefiPrice, 30_000);

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
  const staleTelemetry = loadedAtLeastOnce && !!error;

  const metrics = [
    { icon: Database, label: LiveDashboardCopy.totalBlocks[cs ? 'cs' : 'en'], value: (stats.total_blocks ?? 0).toLocaleString(locale), tip: LiveDashboardCopy.totalNumberOfMinedBlocksSinceM[cs ? 'cs' : 'en'], color: 'text-zion-gold', rc: '252, 209, 22' },
    { icon: Gauge, label: LiveDashboardCopy.totalSupply[cs ? 'cs' : 'en'], value: formattedSupply, tip: LiveDashboardCopy.maximumZionSupplyIs144BillionI[cs ? 'cs' : 'en'], color: 'text-zion-purple', rc: '228, 30, 43' },
    { icon: Atom, label: LiveDashboardCopy.transactions[cs ? 'cs' : 'en'], value: (stats.total_transactions ?? 0).toLocaleString(locale), tip: LiveDashboardCopy.totalNumberOfTransactionsRecor[cs ? 'cs' : 'en'], color: 'text-zion-cyan', rc: '7, 137, 48' },
    { icon: Shield, label: LiveDashboardCopy.difficulty[cs ? 'cs' : 'en'], value: (stats.difficulty ?? 0).toLocaleString(locale), tip: LiveDashboardCopy.currentMiningDifficultySetByLw[cs ? 'cs' : 'en'], color: 'text-zion-cyan', rc: '7, 137, 48' },
    { icon: Braces, label: LiveDashboardCopy.mempoolSize[cs ? 'cs' : 'en'], value: (stats.mempool_size ?? stats.tx_pool_size ?? 0).toLocaleString(locale), tip: LiveDashboardCopy.transactionsWaitingForConfirma[cs ? 'cs' : 'en'], color: 'text-zion-gold', rc: '252, 209, 22' },
  ];

  return (
    <section className="py-8 px-4">
      <div className="zion-container space-y-4">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-zion-gold" />
          <h2 className="text-lg font-semibold text-white">{LiveDashboardCopy.missionConsole[cs ? 'cs' : 'en']}</h2>
          <span className={`ml-auto inline-flex h-2 w-2 rounded-full ${staleTelemetry ? 'bg-zion-gold' : 'bg-zion-cyan'} animate-pulse`} />
          <span className="text-xs text-gray-400">
            {staleTelemetry
              ? (LiveDashboardCopy.snapshotActive[cs ? 'cs' : 'en'])
              : (loadedAtLeastOnce ? LiveDashboardCopy.live[cs ? 'cs' : 'en'] : LiveDashboardCopy.initializing[cs ? 'cs' : 'en'])}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="zion-rainbow-sub group p-3" style={{ '--rc': m.rc } as React.CSSProperties}>
              <m.icon className={`w-4 h-4 ${m.color} mb-1`} />
              <div className="text-xl font-bold text-white">{m.value}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">{m.label}</div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="group/tooltip relative">
                  <HelpCircle className="w-3 h-3 text-white/40" />
                  <div className="absolute right-0 top-4 w-44 p-2 rounded-lg bg-black/90 border border-white/10 text-[10px] text-gray-300 opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-20 pointer-events-none">
                    {m.tip}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="zion-rainbow-card p-3" style={{ '--rc': '107, 114, 128' } as React.CSSProperties}>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{LiveDashboardCopy.latestBlock[cs ? 'cs' : 'en']}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold text-white">#{latestBlock?.height ?? stats.block_height ?? '—'}</span>
              <span className="text-xs text-gray-400">{formattedTimestamp}</span>
            </div>
            <p className="font-mono text-[10px] text-zion-cyan break-all mt-1">{latestBlock?.hash ?? (LiveDashboardCopy.waitingForSignal[cs ? 'cs' : 'en'])}</p>
          </div>

          <div className="zion-rainbow-card p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{LiveDashboardCopy.defiPool[cs ? 'cs' : 'en']}</p>
              <TrendingUp className="w-4 h-4 text-zion-cyan" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <p className="text-xs text-gray-400">{LiveDashboardCopy.zionPrice[cs ? 'cs' : 'en']}</p>
                <p className="text-base font-bold text-white">${defiPrice?.price?.usd_per_wzion?.toFixed(6) ?? '0.000200'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{LiveDashboardCopy.tvlUsd[cs ? 'cs' : 'en']}</p>
                <p className="text-base font-bold text-white">${(defiPrice?.tvl?.usd ?? 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
