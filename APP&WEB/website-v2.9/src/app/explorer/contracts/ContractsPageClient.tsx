'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  FileCode,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Globe,
  Layers,
  ChevronLeft,
  Coins,
  Landmark,
  Vote,
  Tractor,
  Gavel,
  ArrowLeftRight,
  Droplets,
  BookOpen,
  Search,
  X,
  Loader2,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { CONTRACTS, CHAINS, ACTIVE_CHAIN } from '@/lib/defi-contracts';
import { SITE_RELEASE_LABEL } from '@/lib/site';
import { usePolling } from '@/hooks/usePolling';
import { formatNumber } from '@/lib/explorer/format';

type Category =
  | 'Token'
  | 'Bridge'
  | 'DEX'
  | 'Governance'
  | 'Treasury'
  | 'Staking'
  | 'Farm'
  | 'Auction'
  | 'Reference';

interface ContractMeta {
  category: Category;
  publicName: string;
}

interface ContractEntry {
  key: string;
  address: string;
  category: Category;
  publicName: string;
}

interface DefiStatusData {
  ok: boolean;
  data?: {
    wZION?: { totalSupply?: string };
    staking?: {
      totalStaked?: string;
      apr?: string;
      rewardPool?: string;
      cooldownDays?: number;
    };
    farm?: {
      rewardPerSecond?: string;
      poolCount?: number;
      totalAllocPoints?: number;
      rewardPool?: string;
    };
    governance?: { proposalCount?: number; votingPeriod?: number };
    bridge?: { threshold?: number; validatorCount?: number };
    pools?: {
      wzion_weth?: {
        active?: boolean;
        price_usd?: number;
        liquidity?: string;
        feeLabel?: string;
      };
      wzion_usdt?: {
        active?: boolean;
        price_usd?: number;
        liquidity?: string;
        feeLabel?: string;
      };
      wzion_sol?: {
        active?: boolean;
        price_usd?: number;
        liquidity?: string;
        feeLabel?: string;
      };
    };
    weth_usd?: number;
    sol_usd?: number;
  };
  fetchedAt?: number;
}

const copy = {
  title: { cs: 'Adresář kontraktů', en: 'Contract Directory' },
  subtitle: {
    cs: 'Veřejné kontrakty ZION ekosystému na Base Mainnet',
    en: 'Public ZION ecosystem contracts on Base Mainnet',
  },
  infoNote: {
    cs: 'Ověřené adresy kontraktů na Base mainnetu. Kliknutím na ikonu BaseScan zobrazíte zdrojový kód a transakce.',
    en: 'Verified contract addresses on Base mainnet. Click the BaseScan icon to view source and transactions.',
  },
  explorer: { cs: 'Explorer', en: 'Explorer' },
  contracts: { cs: 'Kontrakty', en: 'Contracts' },
  network: { cs: 'Síť', en: 'Network' },
  copy: { cs: 'Kopírovat', en: 'Copy' },
  copied: { cs: 'Zkopírováno', en: 'Copied' },
  viewOnBasescan: { cs: 'Zobrazit na BaseScanu', en: 'View on BaseScan' },
  referenceNote: {
    cs: 'V4 kontrakty jsou uvedeny pouze jako reference.',
    en: 'V4 contracts are shown for reference only.',
  },
  categoryTitle: {
    Token: { cs: 'Tokeny', en: 'Tokens' },
    Bridge: { cs: 'Bridge', en: 'Bridge' },
    DEX: { cs: 'DEX', en: 'DEX' },
    Governance: { cs: 'Governance', en: 'Governance' },
    Treasury: { cs: 'Treasury', en: 'Treasury' },
    Staking: { cs: 'Staking', en: 'Staking' },
    Farm: { cs: 'Farm', en: 'Farm' },
    Auction: { cs: 'Aukce', en: 'Auction' },
    Reference: { cs: 'Reference', en: 'Reference' },
  },
  all: { cs: 'Vše', en: 'All' },
  searchPlaceholder: {
    cs: 'Hledat kontrakt nebo adresu…',
    en: 'Search contract or address…',
  },
  clear: { cs: 'Zrušit', en: 'Clear' },
  noMatches: {
    cs: 'Žádný kontrakt neodpovídá zadanému filtru.',
    en: 'No contracts match the current filter.',
  },
  loading: { cs: 'Načítám on-chain data…', en: 'Loading on-chain data…' },
  live: { cs: 'Živě', en: 'Live' },
  totalSupply: { cs: 'Celková zásoba', en: 'Total Supply' },
  staked: { cs: 'Stakováno', en: 'Staked' },
  rewardPool: { cs: 'Odměnový pool', en: 'Reward Pool' },
  cooldown: { cs: 'Cooldown', en: 'Cooldown' },
  rewardPerSecond: { cs: 'Odměna/s', en: 'Reward/s' },
  pools: { cs: 'Pooly', en: 'Pools' },
  allocPoints: { cs: 'Alloc. body', en: 'Alloc. Points' },
  proposals: { cs: 'Návrhy', en: 'Proposals' },
  votingPeriod: { cs: 'Hlas. období', en: 'Voting Period' },
  validators: { cs: 'Validátoři', en: 'Validators' },
  threshold: { cs: 'Threshold', en: 'Threshold' },
  price: { cs: 'Cena', en: 'Price' },
  liquidity: { cs: 'Likvidita', en: 'Liquidity' },
  fee: { cs: 'Fee', en: 'Fee' },
} as const;

const CATEGORY_ORDER: Category[] = [
  'Token',
  'Bridge',
  'DEX',
  'Governance',
  'Treasury',
  'Staking',
  'Farm',
  'Auction',
  'Reference',
];

const CONTRACT_META: Record<string, ContractMeta> = {
  wZION: { category: 'Token', publicName: 'wZION Token' },
  WETH: { category: 'Token', publicName: 'WETH (Base)' },
  USDC: { category: 'Token', publicName: 'USDC (Base)' },
  USDT: { category: 'Token', publicName: 'USDT (Base)' },
  SOL: { category: 'Token', publicName: 'SOL (Base)' },
  ZIONBridge: { category: 'Bridge', publicName: 'ZION Bridge' },
  ZIONAtomicSwap: { category: 'Bridge', publicName: 'ZION Atomic Swap' },
  UniV3Factory: { category: 'DEX', publicName: 'Uniswap V3 Factory' },
  UniV3PoolWETH: { category: 'DEX', publicName: 'Uniswap V3 wZION/WETH Pool' },
  UniV3PoolUSDT: { category: 'DEX', publicName: 'Uniswap V3 wZION/USDT Pool' },
  UniV3PoolSOL: { category: 'DEX', publicName: 'Uniswap V3 wZION/SOL Pool' },
  UniV3Router: { category: 'DEX', publicName: 'Uniswap V3 Swap Router' },
  QuoterV2: { category: 'DEX', publicName: 'Uniswap V3 Quoter V2' },
  PositionManager: { category: 'DEX', publicName: 'Uniswap V3 Position Manager (NFT)' },
  V4PoolManager: { category: 'Reference', publicName: '(reference) Uniswap V4 Pool Manager' },
  V4PositionManager: { category: 'Reference', publicName: '(reference) Uniswap V4 Position Manager' },
  V4StateView: { category: 'Reference', publicName: '(reference) Uniswap V4 State View' },
  V4Quoter: { category: 'Reference', publicName: '(reference) Uniswap V4 Quoter' },
  V4UniversalRouter: { category: 'Reference', publicName: '(reference) Uniswap V4 Universal Router' },
  ZIONGovernance: { category: 'Governance', publicName: 'Governance' },
  ZIONTreasury: { category: 'Treasury', publicName: 'Treasury' },
  ZIONStaking: { category: 'Staking', publicName: 'Staking' },
  ZIONFarm: { category: 'Farm', publicName: 'Farm' },
  CCAAuction: { category: 'Auction', publicName: 'Uniswap CCA Auction' },
  PancakeV3Factory: { category: 'DEX', publicName: 'PancakeSwap V3 Factory' },
  PancakeV3NFTPositionManager: { category: 'DEX', publicName: 'PancakeSwap V3 Position Manager (NFT)' },
  PancakeV3SwapRouter: { category: 'DEX', publicName: 'PancakeSwap V3 Swap Router' },
  PancakeV3QuoterV2: { category: 'DEX', publicName: 'PancakeSwap V3 Quoter V2' },
  PancakeV3SmartRouter: { category: 'DEX', publicName: 'PancakeSwap V3 Smart Router' },
  PancakeV3PoolUSDT: { category: 'DEX', publicName: 'PancakeSwap V3 wZION/USDT Pool' },
};

interface CategoryConfig {
  icon: React.ComponentType<{ className?: string }>;
  rgb: string;
  badge: string;
}

const CATEGORY_CONFIG: Record<Category, CategoryConfig> = {
  Token: { icon: Coins, rgb: '252, 209, 22', badge: 'text-zion-gold bg-zion-gold/10 border-zion-gold/20' },
  Bridge: { icon: ArrowLeftRight, rgb: '6, 182, 212', badge: 'text-zion-cyan bg-zion-cyan/10 border-zion-cyan/20' },
  DEX: { icon: Droplets, rgb: '147, 51, 234', badge: 'text-zion-purple bg-zion-purple/10 border-zion-purple/20' },
  Governance: { icon: Vote, rgb: '6, 182, 212', badge: 'text-zion-cyan bg-zion-cyan/10 border-zion-cyan/20' },
  Treasury: { icon: Landmark, rgb: '252, 209, 22', badge: 'text-zion-gold bg-zion-gold/10 border-zion-gold/20' },
  Staking: { icon: Layers, rgb: '6, 182, 212', badge: 'text-zion-cyan bg-zion-cyan/10 border-zion-cyan/20' },
  Farm: { icon: Tractor, rgb: '34, 197, 94', badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  Auction: { icon: Gavel, rgb: '147, 51, 234', badge: 'text-zion-purple bg-zion-purple/10 border-zion-purple/20' },
  Reference: { icon: BookOpen, rgb: '156, 163, 175', badge: 'text-gray-400 bg-white/5 border-white/10' },
};

const entries: ContractEntry[] = Object.entries(CONTRACTS).map(([key, address]) => {
  const meta = CONTRACT_META[key] ?? { category: 'Reference' as Category, publicName: key };
  return { key, address, ...meta };
});

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$—';
  if (n < 0.0001) return `$${n.toExponential(2)}`;
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  })}`;
}

function fmtAmount(raw: string | number | undefined, suffix = ''): string {
  if (raw === undefined || raw === null) return '—';
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!Number.isFinite(n)) return '—';
  const s = formatNumber(n);
  return suffix ? `${s} ${suffix}` : s;
}

function getContractStats(
  key: string,
  defi: DefiStatusData | null,
  cs: boolean,
): { label: string; value: string }[] {
  const d = defi?.data;
  if (!d) return [];

  switch (key) {
    case 'wZION':
      return d.wZION?.totalSupply
        ? [{ label: copy.totalSupply[cs ? 'cs' : 'en'], value: fmtAmount(d.wZION.totalSupply, 'wZION') }]
        : [];
    case 'WETH':
      return Number.isFinite(d.weth_usd) && (d.weth_usd ?? 0) > 0
        ? [{ label: 'WETH/USD', value: fmtUsd(d.weth_usd as number) }]
        : [];
    case 'SOL':
      return Number.isFinite(d.sol_usd) && (d.sol_usd ?? 0) > 0
        ? [{ label: 'SOL/USD', value: fmtUsd(d.sol_usd as number) }]
        : [];
    case 'ZIONBridge':
      return d.bridge
        ? [
            {
              label: copy.validators[cs ? 'cs' : 'en'],
              value: `${d.bridge.validatorCount ?? 0} / ${d.bridge.threshold ?? 0}`,
            },
          ]
        : [];
    case 'ZIONStaking':
      return [
        ...(d.staking?.totalStaked
          ? [{ label: copy.staked[cs ? 'cs' : 'en'], value: fmtAmount(d.staking.totalStaked, 'wZION') }]
          : []),
        ...(d.staking?.apr
          ? [{ label: 'APR', value: d.staking.apr }]
          : []),
        ...(d.staking?.rewardPool
          ? [{ label: copy.rewardPool[cs ? 'cs' : 'en'], value: fmtAmount(d.staking.rewardPool, 'wZION') }]
          : []),
        ...(d.staking?.cooldownDays
          ? [{ label: copy.cooldown[cs ? 'cs' : 'en'], value: `${d.staking.cooldownDays}d` }]
          : []),
      ];
    case 'ZIONFarm':
      return [
        ...(d.farm?.rewardPerSecond
          ? [{ label: copy.rewardPerSecond[cs ? 'cs' : 'en'], value: fmtAmount(d.farm.rewardPerSecond, 'wZION/s') }]
          : []),
        ...(d.farm?.poolCount !== undefined
          ? [{ label: copy.pools[cs ? 'cs' : 'en'], value: String(d.farm.poolCount) }]
          : []),
        ...(d.farm?.totalAllocPoints
          ? [{ label: copy.allocPoints[cs ? 'cs' : 'en'], value: formatNumber(d.farm.totalAllocPoints) }]
          : []),
        ...(d.farm?.rewardPool
          ? [{ label: copy.rewardPool[cs ? 'cs' : 'en'], value: fmtAmount(d.farm.rewardPool, 'wZION') }]
          : []),
      ];
    case 'ZIONGovernance':
      return [
        ...(d.governance?.proposalCount !== undefined
          ? [{ label: copy.proposals[cs ? 'cs' : 'en'], value: String(d.governance.proposalCount) }]
          : []),
        ...(d.governance?.votingPeriod
          ? [{ label: copy.votingPeriod[cs ? 'cs' : 'en'], value: formatNumber(d.governance.votingPeriod) }]
          : []),
      ];
    case 'UniV3PoolUSDT':
    case 'UniV3PoolWETH':
    case 'UniV3PoolSOL': {
      const poolKey =
        key === 'UniV3PoolUSDT'
          ? 'wzion_usdt'
          : key === 'UniV3PoolWETH'
          ? 'wzion_weth'
          : 'wzion_sol';
      const pool = d.pools?.[poolKey as keyof typeof d.pools] as
        | { active?: boolean; price_usd?: number; liquidity?: string; feeLabel?: string }
        | undefined;
      if (!pool) return [];
      const price = pool.active === false ? '—' : fmtUsd(pool.price_usd ?? 0);
      return [
        { label: copy.price[cs ? 'cs' : 'en'], value: price },
        { label: copy.liquidity[cs ? 'cs' : 'en'], value: formatNumber(Number(pool.liquidity ?? 0)) },
        { label: copy.fee[cs ? 'cs' : 'en'], value: pool.feeLabel ?? '—' },
      ];
    }
    default:
      return [];
  }
}

function CopyButton({ text, cs }: { text: string; cs: boolean }) {
  const [ok, setOk] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  };

  const label = ok ? copy.copied[cs ? 'cs' : 'en'] : copy.copy[cs ? 'cs' : 'en'];

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className="text-white/30 hover:text-white/70 transition-colors"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-zion-cyan" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ContractStats({
  contractKey,
  defi,
  cs,
}: {
  contractKey: string;
  defi: DefiStatusData | null;
  cs: boolean;
}) {
  const stats = useMemo(() => getContractStats(contractKey, defi, cs), [contractKey, defi, cs]);
  if (!stats.length) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {stats.map(({ label, value }) => (
        <div key={label} className="rounded-lg bg-black/30 border border-white/5 px-2.5 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">{label}</p>
          <p className="text-xs font-mono text-white/80 truncate" title={value}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ContractCard({
  entry,
  cs,
  baseUrl,
  defi,
}: {
  entry: ContractEntry;
  cs: boolean;
  baseUrl: string;
  defi: DefiStatusData | null;
}) {
  const config = CATEGORY_CONFIG[entry.category];
  const CategoryIcon = config.icon;
  const hasLive = getContractStats(entry.key, defi, cs).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.02 }}
      className="zion-rainbow-sub p-4 rounded-2xl"
      style={{ '--rc': config.rgb } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 text-white/40 shrink-0" />
          <h3 className="text-sm font-semibold text-white truncate" title={entry.publicName}>
            {entry.publicName}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasLive && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              title={copy.live[cs ? 'cs' : 'en']}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {copy.live[cs ? 'cs' : 'en']}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ${config.badge}`}
          >
            <CategoryIcon className="w-3 h-3" />
            {entry.category}
          </span>
        </div>
      </div>

      <div className="rounded-lg bg-black/40 border border-white/5 p-2.5">
        <span className="font-mono text-xs text-white/70 break-all">{entry.address}</span>
      </div>

      <ContractStats contractKey={entry.key} defi={defi} cs={cs} />

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Globe className="w-3 h-3" />
          <span>{copy.network[cs ? 'cs' : 'en']}:</span>
          <span className="text-zion-cyan">Base</span>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={entry.address} cs={cs} />
          <a
            href={`${baseUrl}/${entry.address}`}
            target="_blank"
            rel="noopener noreferrer"
            title={copy.viewOnBasescan[cs ? 'cs' : 'en']}
            aria-label={copy.viewOnBasescan[cs ? 'cs' : 'en']}
            className="text-white/30 hover:text-zion-gold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}

export default function ContractsPageClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [defi, setDefi] = useState<DefiStatusData | null>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchDefi = useCallback(async () => {
    try {
      const res = await fetch('/api/defi/status', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as DefiStatusData;
        setDefi(json);
      }
    } catch {
      // silent fail — page still works without live stats
    } finally {
      setInitialLoading(false);
    }
  }, []);

  usePolling(fetchDefi, 30_000);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (activeCategory !== 'All' && e.category !== activeCategory) return false;
      if (!normalizedQuery) return true;
      return (
        e.publicName.toLowerCase().includes(normalizedQuery) ||
        e.address.toLowerCase().includes(normalizedQuery) ||
        e.key.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, activeCategory]);

  const groupedByCategory = useMemo(() => {
    const g: Record<Category, ContractEntry[]> = {
      Token: [],
      Bridge: [],
      DEX: [],
      Governance: [],
      Treasury: [],
      Staking: [],
      Farm: [],
      Auction: [],
      Reference: [],
    };
    for (const e of filtered) {
      g[e.category].push(e);
    }
    return g;
  }, [filtered]);

  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = {
      Token: 0,
      Bridge: 0,
      DEX: 0,
      Governance: 0,
      Treasury: 0,
      Staking: 0,
      Farm: 0,
      Auction: 0,
      Reference: 0,
    };
    for (const e of entries) {
      if (
        !normalizedQuery ||
        e.publicName.toLowerCase().includes(normalizedQuery) ||
        e.address.toLowerCase().includes(normalizedQuery) ||
        e.key.toLowerCase().includes(normalizedQuery)
      ) {
        counts[e.category]++;
      }
    }
    return counts;
  }, [normalizedQuery]);

  const allCount = useMemo(
    () => CATEGORY_ORDER.reduce((sum, c) => sum + categoryCounts[c], 0),
    [categoryCounts],
  );

  const network = CHAINS[ACTIVE_CHAIN.id];
  const baseUrl = network.explorerBase;

  const filterCategories: (Category | 'All')[] = ['All', ...CATEGORY_ORDER];

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-10 pt-6 pb-8">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link
            href="/explorer"
            className="hover:text-white/70 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            {copy.explorer[cs ? 'cs' : 'en']}
          </Link>
          <span>/</span>
          <span className="text-white/80">{copy.contracts[cs ? 'cs' : 'en']}</span>
        </div>

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
          style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <FileCode className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {copy.contracts[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {copy.subtitle[cs ? 'cs' : 'en']}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {copy.title[cs ? 'cs' : 'en']}
                </h1>
              </div>
            </div>

            <div className="zion-rainbow-sub p-6 rounded-2xl" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">{copy.network[cs ? 'cs' : 'en']}</div>
              <div className="text-2xl font-bold text-zion-cyan">{network.label}</div>
              <div className="text-[11px] text-gray-500 mt-1">Chain ID {network.chainId}</div>
            </div>
          </div>
        </motion.section>

        {/* ── INFO NOTE ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="zion-rainbow-sub p-4 rounded-2xl"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-zion-cyan shrink-0 mt-0.5" />
            <p className="text-sm text-white/70">{copy.infoNote[cs ? 'cs' : 'en']}</p>
          </div>
        </motion.div>

        {/* ── SEARCH & FILTER ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="zion-rainbow-sub p-4 rounded-2xl"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveCategory('All');
                }}
                placeholder={copy.searchPlaceholder[cs ? 'cs' : 'en']}
                aria-label={copy.searchPlaceholder[cs ? 'cs' : 'en']}
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-zion-cyan/50 transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  aria-label={copy.clear[cs ? 'cs' : 'en']}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {filterCategories.map((cat) => {
                const active = activeCategory === cat;
                const count = cat === 'All' ? allCount : categoryCounts[cat];
                const config = cat === 'All' ? null : CATEGORY_CONFIG[cat];
                const CategoryIcon = config?.icon;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                      active
                        ? 'bg-zion-cyan/15 border-zion-cyan/40 text-zion-cyan'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {CategoryIcon && <CategoryIcon className="w-3 h-3" />}
                    <span>{cat === 'All' ? copy.all[cs ? 'cs' : 'en'] : cat}</span>
                    <span className="text-white/30">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {initialLoading && (
            <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {copy.loading[cs ? 'cs' : 'en']}
            </div>
          )}
        </motion.div>

        {/* ═══════ CATEGORY SECTIONS ═══════ */}
        <div className="space-y-10">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 text-white/40 text-sm"
            >
              {copy.noMatches[cs ? 'cs' : 'en']}
            </motion.div>
          ) : (
            CATEGORY_ORDER.map((category, categoryIndex) => {
              if (activeCategory !== 'All' && category !== activeCategory) return null;
              const group = groupedByCategory[category];
              if (!group.length) return null;

              const config = CATEGORY_CONFIG[category];
              const CategoryIcon = config.icon;

              return (
                <motion.section
                  key={category}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.06 + categoryIndex * 0.04 }}
                >
                  <div className="flex flex-col gap-2 mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl bg-zion-cyan/10 border border-zion-cyan/20`}>
                        <CategoryIcon className="w-5 h-5 text-zion-cyan" />
                      </div>
                      <h2 className="text-2xl font-semibold text-white">
                        {copy.categoryTitle[category][cs ? 'cs' : 'en']}
                      </h2>
                      <span className="text-sm text-white/30">({group.length})</span>
                    </div>
                    {category === 'Reference' && (
                      <p className="text-sm text-white/40 pl-12">{copy.referenceNote[cs ? 'cs' : 'en']}</p>
                    )}
                  </div>

                  <div
                    className="zion-rainbow-card p-5 rounded-3xl"
                    style={{ '--rc': config.rgb } as React.CSSProperties}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {group.map((entry) => (
                        <ContractCard
                          key={entry.key}
                          entry={entry}
                          cs={cs}
                          baseUrl={baseUrl}
                          defi={defi}
                        />
                      ))}
                    </div>
                  </div>
                </motion.section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
