'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { CONTRACTS, CHAINS, ACTIVE_CHAIN } from '@/lib/defi-contracts';
import { SITE_RELEASE_LABEL } from '@/lib/site';

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

const grouped: Record<Category, ContractEntry[]> = {
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

for (const entry of entries) {
  grouped[entry.category].push(entry);
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

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={ok ? copy.copied[cs ? 'cs' : 'en'] : copy.copy[cs ? 'cs' : 'en']}
      className="text-white/30 hover:text-white/70 transition-colors"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-zion-cyan" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ContractCard({
  entry,
  cs,
  baseUrl,
}: {
  entry: ContractEntry;
  cs: boolean;
  baseUrl: string;
}) {
  const config = CATEGORY_CONFIG[entry.category];
  const CategoryIcon = config.icon;

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
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ${config.badge}`}
        >
          <CategoryIcon className="w-3 h-3" />
          {entry.category}
        </span>
      </div>

      <div className="rounded-lg bg-black/40 border border-white/5 p-2.5">
        <span className="font-mono text-xs text-white/70 break-all">{entry.address}</span>
      </div>

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

  const network = CHAINS[ACTIVE_CHAIN.id];
  const baseUrl = network.explorerBase;

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

        {/* ═══════ CATEGORY SECTIONS ═══════ */}
        <div className="space-y-10">
          {CATEGORY_ORDER.map((category, categoryIndex) => {
            const group = grouped[category];
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
                    {group.map((entry, idx) => (
                      <ContractCard
                        key={entry.key}
                        entry={entry}
                        cs={cs}
                        baseUrl={baseUrl}
                      />
                    ))}
                  </div>
                </div>
              </motion.section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
