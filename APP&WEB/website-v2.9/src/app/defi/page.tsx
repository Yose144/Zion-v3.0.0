'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useCallback, useEffect, useId } from 'react';
import {
  ArrowLeftRight,
  Wallet,
  Layers,
  ExternalLink,
  Activity,
  RefreshCw,
  BarChart3,
  Flame,
  Link2,
  Lock,
  CheckCircle2,
  ArrowRight,
  PiggyBank,
  Sprout,
  Scale,
  Droplets,
  AlertTriangle,
  TrendingUp,
  Gavel,
  Clock,
  Trophy,
  ChefHat,
  Globe,
  Sparkles,
  Zap,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import dynamic from 'next/dynamic';

const SwapWidget      = dynamic(() => import('@/components/SwapWidget'), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-white/5" /> });
const LiFiWidget      = dynamic(() => import('@/components/LiFiWidget'), { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-2xl bg-white/5" /> });
const BridgeBurnWidget= dynamic(() => import('@/components/BridgeBurnWidget'), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-white/5" /> });
const DefiBalances    = dynamic(() => import('@/components/DefiBalances'), { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-2xl bg-white/5" /> });
const StakingPanel    = dynamic(() => import('@/components/StakingPanel'), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-white/5" /> });
const FarmingPanel    = dynamic(() => import('@/components/FarmingPanel'), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-white/5" /> });
const GovernancePanel = dynamic(() => import('@/components/GovernancePanel'), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-white/5" /> });
const BridgeValidators = dynamic(() => import('@/components/BridgeValidators'), { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-2xl bg-white/5" /> });

import { CONTRACTS, SEED_PRICE_USD, CCA_AUCTION_PARAMS, PANCAKE_V3 } from '@/lib/defi-contracts';
import { useNetworkStatus } from '@/hooks/useWebSocketSubscription';

const DefiCopy = {
  defiHubBaseMainnet: { cs: `Multichain Hub · Base Mainnet`, en: `Multichain Hub · Base Mainnet` },
  wzionEcosystem: { cs: `wZION ekosystém`, en: `wZION ecosystem` },
  manageWzion: { cs: `Spravuj wZION`, en: `Manage wZION` },
  swapBridgeAndManageWzionOnBase: { cs: `Swapuj, přemosťuj a spravuj wZION na Base. Reálné kontrakty, reálná likvidita, živé ceny z on-chain poolů.`, en: `Swap, bridge, and manage wZION on Base. Real contracts, real liquidity, live prices from on-chain pools.` },
  live: { cs: `Živě`, en: `Live` },
  polling: { cs: `Polling`, en: `Polling` },
  autoRefresh60s: { cs: `Auto-refresh 60 s`, en: `Auto-Refresh 60s` },
  wzionUsdtUniswapV3: { cs: `wZION/USDT · Uniswap V3`, en: `wZION/USDT · Uniswap V3` },
  ziondexSwap: { cs: `ZionDex Swap`, en: `ZionDex Swap` },
  aboutZiondex: { cs: `O ZionDex`, en: `About ZionDex` },
  quickOverview: { cs: `Rychlý přehled`, en: `Quick Overview` },
  price: { cs: `Cena`, en: `Price` },
  supply: { cs: `Supply`, en: `Supply` },
  switch: { cs: `Přepnout`, en: `Switch` },
  connectWallet: { cs: `Připojit peněženku`, en: `Connect Wallet` },
  openUniswapUsdt: { cs: `Otevřít Uniswap (USDT)`, en: `Open Uniswap (USDT)` },
  defiHubEarlyBeta: { cs: `Multichain Hub — raná beta`, en: `Multichain Hub — Early Beta` },
  wzionContractsAreDeployedOnBas: { cs: `wZION kontrakty jsou nasazeny na Base mainnetu, ale likvidita je zatím nízká. Používejte malé částky a buďte opatrní při velkých swapech.`, en: `wZION contracts are deployed on Base mainnet, but liquidity is still low. Use small amounts and be cautious with large swaps.` },
  defiSections: { cs: `Multichain sekce`, en: `Multichain sections` },
  lowDexLiquidity: { cs: `Nízká DEX likvidita`, en: `Low DEX Liquidity` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  defiTelemetry: { cs: `Multichain telemetrie`, en: `Multichain Telemetry` },
  wzionMetricsAggregatedFromBase: { cs: `Metriky wZION agregované z Base kontraktů, pool API a bridge relayeru v reálném čase.`, en: `wZION metrics aggregated from Base contracts, pool API, and bridge relayer in real time.` },
  currentPriceFromThePrimaryWzio: { cs: `Aktuální cena z primárního wZION/USDT poolu nebo seed cena.`, en: `Current price from the primary wZION/USDT pool or seed price.` },
  totalInPools: { cs: `celkem v poolech`, en: `total in pools` },
  liquidity: { cs: `Likvidita`, en: `Liquidity` },
  pools: { cs: `Pooly`, en: `Pools` },
  active: { cs: `aktivní`, en: `active` },
  wzionSupply: { cs: `wZION Supply`, en: `wZION Supply` },
  totalCirculating: { cs: `celkový oběh`, en: `total circulating` },
  bridge: { cs: `Bridge`, en: `Bridge` },
  online: { cs: `Online`, en: `Online` },
  offline: { cs: `Offline`, en: `Offline` },
  k55Validators: { cs: `5/5 validátorů`, en: `5/5 validators` },
  validators: { cs: `Validátoři`, en: `Validators` },
  guardianRelay: { cs: `Guardian relay`, en: `Guardian relay` },
  auction: { cs: `Aukce`, en: `Auction` },
  ccaSold: { cs: `prodáno CCA`, en: `CCA sold` },
  primary: { cs: `primární`, en: `primary` },
  k1h: { cs: `1h`, en: `1h` },
  loadingPriceData: { cs: `Načítám cenová data…`, en: `Loading price data…` },
  priceDataNotAvailableYet: { cs: `Cenová data zatím nedostupná`, en: `Price data not available yet` },
  status: { cs: `Stav`, en: `Status` },
  inactive: { cs: `neaktivní`, en: `inactive` },
  loading: { cs: `načítám`, en: `loading` },
  contracts: { cs: `Kontrakty`, en: `Contracts` },
  baseMainnetContracts: { cs: `Kontrakty na Base Mainnet`, en: `Base Mainnet Contracts` },
  contract: { cs: `Kontrakt`, en: `Contract` },
  address: { cs: `Adresa`, en: `Address` },
  tradeWzion: { cs: `Obchoduj wZION`, en: `Trade wZION` },
  wzionIsAvailableOnUniswapV3Bas: { cs: `wZION je k dispozici na Uniswap V3 (Base). Primární pool wZION/USDT s 0.3% fee.`, en: `wZION is available on Uniswap V3 (Base). Primary wZION/USDT pool with 0.3% fee.` },
  openUniswap: { cs: `Otevřít Uniswap`, en: `Open Uniswap` },
  trade: { cs: `Obchodování`, en: `Trade` },
  swapTradeOnDexAndTrackTheWzion: { cs: `Swapuj, obchoduj na DEX a sleduj cenu wZION na Base Mainnet.`, en: `Swap, trade on DEX, and track the wZION price on Base Mainnet.` },
  swapWzion: { cs: `Swap wZION`, en: `Swap wZION` },
  lifiUniswapIntegration: { cs: `LiFi + Uniswap integrace`, en: `LiFi + Uniswap integration` },
  instantSwapBetweenWzionEthUsdt: { cs: `Okamžitý swap mezi wZION, ETH, USDT a dalšími tokeny. LiFi agreguje 30+ DEX a 20+ bridge.`, en: `Instant swap between wZION, ETH, USDT, and other tokens. LiFi aggregates 30+ DEX and 20+ bridges.` },
  swapBelow: { cs: `Swap níže`, en: `Swap below` },
  dexPools: { cs: `DEX Pooly`, en: `DEX Pools` },
  uniswapV3: { cs: `Uniswap V3`, en: `Uniswap V3` },
  wzionUsdtPrimaryPoolOnUniswapV: { cs: `wZION/USDT primární pool na Uniswap V3. Sekundární pooly WETH/SOL jsou inicializované, ale bez aktivní likvidity.`, en: `wZION/USDT primary pool on Uniswap V3. Secondary WETH/SOL pools are initialized but carry no active liquidity.` },
  ccaAuction: { cs: `CCA Aukce`, en: `CCA Auction` },
  k6647mWzionForUsdc: { cs: `66.47M wZION za USDC`, en: `66.47M wZION for USDC` },
  active_2: { cs: `Aktivní`, en: `Active` },
  continuousClearingAuctionOnUni: { cs: `Continuous Clearing Auction na Uniswap. Vyklízecí cena se kontinuálně upravuje podle poptávky.`, en: `Continuous Clearing Auction on Uniswap. Clearing price continuously adjusts based on demand.` },
  placeBids: { cs: `Přihazovat`, en: `Place bids` },
  k2ndLargestDexOnBase: { cs: `2. největší DEX na Base`, en: `2nd largest DEX on Base` },
  wzionUsdtPoolOnPancakeswapV3An: { cs: `wZION/USDT pool na PancakeSwap V3. Další možnost likvidity a swapu pro wZION.`, en: `wZION/USDT pool on PancakeSwap V3. Another liquidity and swap option for wZION.` },
  swapOnPancakeswap: { cs: `Swap na PancakeSwap`, en: `Swap on PancakeSwap` },
  crossChainSwap: { cs: `Cross-chain swap`, en: `Cross-chain Swap` },
  directSwapBalances: { cs: `Direct swap + zůstatky`, en: `Direct Swap + Balances` },
  yield: { cs: `Výnosy`, en: `Yield` },
  earnWzion: { cs: `Získej wZION`, en: `Earn wZION` },
  stakeOrFarmWzionToEarnRegularR: { cs: `Stakeuj nebo farm wZION a získej pravidelné odměny.`, en: `Stake or farm wZION to earn regular rewards.` },
  staking: { cs: `Staking`, en: `Staking` },
  farming: { cs: `Farming`, en: `Farming` },
  infrastructure: { cs: `Infrastruktura`, en: `Infrastructure` },
  wzionBridge: { cs: `wZION Bridge`, en: `wZION Bridge` },
  moveBetweenL1AndL2AndGovernThe: { cs: `Přenos mezi L1 a L2 a on-chain řízení protokolu.`, en: `Move between L1 and L2 and govern the protocol on-chain.` },
  l1Base55Validators: { cs: `L1 ↔ Base · 5/5 validátorů`, en: `L1 ↔ Base · 5/5 validators` },
  lockZionOnL1AndReceiveWzionOnB: { cs: `Zamkni ZION na L1 a získej wZION na Base. Spal wZION pro odemčení zpět na L1. 1:1 peg, multi-validátorový relay.`, en: `Lock ZION on L1 and receive wZION on Base. Burn wZION to unlock back to L1. 1:1 peg, multi-validator relay.` },
  openBridge: { cs: `Otevřít bridge`, en: `Open bridge` },
  howBridgeWorks: { cs: `Jak Bridge funguje`, en: `How Bridge Works` },
  lockZionOnL1RelayMintsWzionOnB: { cs: `Zamkni ZION na L1 → relay mintne wZION na Base (1:1 peg)`, en: `Lock ZION on L1 → relay mints wZION on Base (1:1 peg)` },
  burnWzionOnBaseRelayUnlocksZio: { cs: `Spal wZION na Base → relay odemkne ZION na L1 (do ~5 min)`, en: `Burn wZION on Base → relay unlocks ZION on L1 (within ~5 min)` },
  bridgeVault100mZion: { cs: `Bridge Vault · 100M ZION`, en: `Bridge Vault · 100M ZION` },
  relayOnline: { cs: `Relay Online`, en: `Relay Online` },
  relayOffline: { cs: `Relay Offline`, en: `Relay Offline` },
  k6UtxoLockTransactions1667mZion: { cs: `6 UTXO lock transakcí (~16.67M ZION každá) odesláno na bridge vault v blocích 11611–11612. Relay mintne wZION na Base po dosažení finality (60 bloků).`, en: `6 UTXO lock transactions (~16.67M ZION each) sent to the bridge vault in blocks 11611–11612. Relay mints wZION on Base after finality (60 blocks).` },
  locked: { cs: `Zamčeno`, en: `Locked` },
  lockTxs: { cs: `Lock TX`, en: `Lock TXs` },
  wzionMints: { cs: `wZION Mints`, en: `wZION Mints` },
  confirmed: { cs: `potvrzeno`, en: `confirmed` },
  l1Unlocks: { cs: `L1 Odemčeno`, en: `L1 Unlocks` },
  block: { cs: `blok`, en: `block` },
  lastScan: { cs: `poslední scan`, en: `last scan` },
  vault: { cs: `Vault`, en: `Vault` },
  finality60Blocks: { cs: `Finality: 60 bloků`, en: `Finality: 60 blocks` },
  reverseBridgeE2eVerified202606: { cs: `Reverse bridge ověřen E2E (2026-06-29)`, en: `Reverse bridge E2E verified (2026-06-29)` },
  governance: { cs: `Governance`, en: `Governance` },
  wzionGovernance: { cs: `wZION Governance`, en: `wZION Governance` },
  voteOnProtocolParametersAndMon: { cs: `Hlasuj o parametrech protokolu a sleduj treasury na Base Mainnet.`, en: `Vote on protocol parameters and monitor the treasury on Base Mainnet.` },
  governancePanel: { cs: `Governance panel`, en: `Governance Panel` },
  dexPools_2: { cs: `DEX pooly`, en: `DEX Pools` },
  wzionUsdtOnUniswapV3AndPancake: { cs: `wZION/USDT na Uniswap V3 a PancakeSwap V3. Aktuální aktivní likvidita: ~240 tis. wZION + ~44 USDT.`, en: `wZION/USDT on Uniswap V3 and PancakeSwap V3. Current active liquidity: ~240k wZION + ~44 USDT.` },
  k2ndLargestDexOnBase115mDailyVo: { cs: `2. největší DEX na Base · $115M denní volume`, en: `2nd largest DEX on Base · $115M daily volume` },
  live_2: { cs: `Live`, en: `Live` },
  poolAddress: { cs: `Pool adresa`, en: `Pool address` },
  seedPrice: { cs: `seed price`, en: `seed price` },
  feeTiers: { cs: `Fee tiers`, en: `Fee tiers` },
  multiTier: { cs: `multi-tier`, en: `multi-tier` },
  addLiquidity: { cs: `Přidat likviditu`, en: `Add Liquidity` },
  poolOnBasescan: { cs: `Pool na Basescan`, en: `Pool on Basescan` },
  factoryContract: { cs: `Factory kontrakt`, en: `Factory Contract` },
  pancakeswapV3PoolWasCreatedAnd: { cs: `PancakeSwap V3 pool byl vytvořen a inicializován, ale NFT pozice #2054747 byla spálena. V poolu aktuálně není žádná aktivní likvidita. Primární likvidita zůstává na Uniswap V3 wZION/USDT.`, en: `PancakeSwap V3 pool was created and initialized, but NFT position #2054747 has been burned. There is currently no active liquidity in the pool. Primary liquidity remains on Uniswap V3 wZION/USDT.` },
  uniswapV3Pools: { cs: `Uniswap V3 pooly`, en: `Uniswap V3 pools` },
  initializedNoLiquidity: { cs: `inicializovaný, bez likvidity`, en: `initialized, no liquidity` },
  uniswapCcaAuction: { cs: `Uniswap CCA Aukce`, en: `Uniswap CCA Auction` },
  continuousClearingAuction6647m: { cs: `Continuous Clearing Auction · 66.47M wZION za USDC.`, en: `Continuous Clearing Auction · 66.47M wZION for USDC.` },
  continuousClearingAuction6647m_2: { cs: `Continuous Clearing Auction · 66.47M wZION za USDC`, en: `Continuous Clearing Auction · 66.47M wZION for USDC` },
  graduated: { cs: `Graduováno`, en: `Graduated` },
  bidOnUniswap: { cs: `Přiházet na Uniswap`, en: `Bid on Uniswap` },
  clearingPrice: { cs: `Vyklízecí cena`, en: `Clearing Price` },
  usdcRaised: { cs: `USDC vybráno`, en: `USDC Raised` },
  total: { cs: `celkem`, en: `total` },
  wzionSold: { cs: `wZION prodáno`, en: `wZION Sold` },
  of: { cs: `z`, en: `of` },
  remaining: { cs: `Zbývá`, en: `Remaining` },
  days6Months: { cs: `dní (~6 měsíců)`, en: `days (~6 months)` },
  block_2: { cs: `Blok`, en: `Block` },
  end: { cs: `Konec`, en: `End` },
  howCcaAuctionWorks: { cs: `Jak CCA aukce funguje`, en: `How CCA Auction Works` },
  participantsBidUsdcForWzionWit: { cs: `Účastníci přihazují USDC za wZION s max cenou`, en: `Participants bid USDC for wZION with a max price` },
  clearingPriceContinuouslyAdjus: { cs: `Vyklízecí cena se kontinuálně upravuje na základě poptávky`, en: `Clearing price continuously adjusts based on demand` },
  afterGraduationLbpPoolOnUniswa: { cs: `Po graduaci → LBP pool na Uniswap V3 + USDC pro tým`, en: `After graduation → LBP pool on Uniswap V3 + USDC for team` },
  noGraduationExitbidRefundsUsdc: { cs: `Negrace? exitBid() vrátí USDC, sweepUnsoldTokens() vrátí wZION`, en: `No graduation? exitBid() refunds USDC, sweepUnsoldTokens() returns wZION` },
  contractDetails: { cs: `Detaily kontraktu`, en: `Contract Details` },
  token: { cs: `Token`, en: `Token` },
  currency: { cs: `Měna`, en: `Currency` },
  startBlock: { cs: `Start blok`, en: `Start block` },
  endBlock: { cs: `End blok`, en: `End block` },
  floorPrice: { cs: `Floor price`, en: `Floor price` },
  noteEndBlockIsImmutableAndCann: { cs: `Poznámka: END_BLOCK je immutable a nelze změnit — aukce běží ~184 dní (zamýšleno 30). Po END_BLOCK lze exitBid() pro refund nebo sweepUnsoldTokens() pro vrácení neprodaných wZION. Viz AUCTION_CCA_BASE.md.`, en: `Note: END_BLOCK is immutable and cannot be changed — auction runs ~184 days (intended 30). After END_BLOCK, exitBid() for refund or sweepUnsoldTokens() to reclaim unsold wZION. See AUCTION_CCA_BASE.md.` },
};

// ─── Price Sparkline (SVG, no deps) ──────────────────────────────────────────

function PriceSparkline({
  prices,
  width = 400,
  height = 80,
}: {
  prices: number[];
  width?: number;
  height?: number;
}) {
  const fillIdBase = useId();
  const fillId = `spark-fill-${fillIdBase}`;
  if (prices.length < 2) return null;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || max * 0.01;
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * w;
    const y = pad + h - ((p - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(' ');
  // Fill area
  const first = pts[0];
  const last = pts[pts.length - 1];
  const fillPts = `${first} ${polyline} ${last.split(',')[0]},${pad + h} ${pad},${pad + h}`;
  const up = prices[prices.length - 1] >= prices[0];
  const stroke = up ? '#10b981' : '#f87171';
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#${fillId})`} />
      <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* last dot */}
      <circle
        cx={parseFloat(pts[pts.length - 1].split(',')[0])}
        cy={parseFloat(pts[pts.length - 1].split(',')[1])}
        r="2.5"
        fill={stroke}
      />
    </svg>
  );
}

// ─── Stat Card helper (matches /pool) ───────────────────────────────────────

function SkeletonValue({ className = 'h-4 w-16' }: { className?: string }) {
  return <span className={`inline-block animate-pulse rounded bg-white/10 ${className}`} />;
}

function StatCard({
  icon,
  colorClass,
  bgClass,
  label,
  value,
  sub,
  tip,
  loading = false,
}: {
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  label: string;
  value: string;
  sub?: string;
  tip?: string;
  loading?: boolean;
}) {
  return (
    <div className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bgClass} mb-3 ${colorClass}`}>
        {icon}
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
        {tip && (
          <div className="relative group/tooltip">
            <HelpCircle className="h-3 w-3 text-gray-600 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-44 rounded-lg border border-white/10 bg-black/90 backdrop-blur-xl px-2 py-1.5 text-[10px] text-gray-300 shadow-xl z-20">
              {tip}
            </div>
          </div>
        )}
      </div>
      <p className="text-lg font-bold text-white font-mono mt-0.5">
        {loading ? <SkeletonValue className="h-6 w-20" /> : value}
      </p>
      {sub && !loading && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Multichain Sections (same pattern as /pool) ──────────────────────────────────

type SectionTab = 'overview' | 'swap' | 'earn' | 'bridge' | 'governance' | 'pools' | 'auction';

const SECTIONS: { key: SectionTab; labelCs: string; labelEn: string; icon: typeof Activity }[] = [
  { key: 'overview', labelCs: 'Přehled', labelEn: 'Overview', icon: Activity },
  { key: 'swap', labelCs: 'Swap', labelEn: 'Swap', icon: RefreshCw },
  { key: 'earn', labelCs: 'Výnosy', labelEn: 'Earn', icon: TrendingUp },
  { key: 'bridge', labelCs: 'Bridge', labelEn: 'Bridge', icon: ArrowLeftRight },
  { key: 'governance', labelCs: 'Governance', labelEn: 'Governance', icon: Scale },
  { key: 'pools', labelCs: 'Pooly', labelEn: 'Pools', icon: Droplets },
  { key: 'auction', labelCs: 'Aukce', labelEn: 'Auction', icon: Gavel },
];

// ─── Reusable Bridge explainer card (removes duplicate JSX) ───────────────────

function BridgeHowItWorks({ cs, showLinks = false }: { cs: boolean; showLinks?: boolean }) {
  return (
    <div className="zion-rainbow-card p-6 space-y-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
      <div className="flex items-center gap-2 mb-2">
        <Flame className="h-5 w-5 text-zion-gold" />
        <h3 className="font-semibold text-white text-sm">
          {DefiCopy.howBridgeWorks[cs ? 'cs' : 'en']}
        </h3>
      </div>
      <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
        <div className="flex gap-3">
          <span className="shrink-0 rounded-lg bg-zion-cyan/10 border border-zion-cyan/20 px-2 py-1 text-zion-cyan font-mono text-[10px]">L1→L2</span>
          <p>{DefiCopy.lockZionOnL1RelayMintsWzionOnB[cs ? 'cs' : 'en']}</p>
        </div>
        <div className="flex gap-3">
          <span className="shrink-0 rounded-lg bg-zion-gold/10 border border-zion-gold/20 px-2 py-1 text-zion-gold font-mono text-[10px]">L2→L1</span>
          <p>{DefiCopy.burnWzionOnBaseRelayUnlocksZio[cs ? 'cs' : 'en']}</p>
        </div>
      </div>
      {showLinks && (
        <div className="pt-2 flex flex-wrap gap-2">
          <a
            href={`https://basescan.org/address/${CONTRACTS.ZIONBridge}`}
            target="_blank"
            rel="noopener noreferrer"
            className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
          >
            Bridge Contract <ExternalLink className="h-2.5 w-2.5" />
          </a>
          <a
            href={`https://basescan.org/token/${CONTRACTS.wZION}`}
            target="_blank"
            rel="noopener noreferrer"
            className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
          >
            wZION Token <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DefiPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { connected, account, isBaseMainnet, connect, switchToBase } = useWallet();
  const [activeTab, setActiveTab] = useState<SectionTab>('overview');
  const [wZIONSupply, setWZIONSupply] = useState<string | null>(null);
  const [wZIONPrice, setWZIONPrice] = useState<{ wzion_per_weth: number; usd_per_wzion: number } | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  // Chart data from GeckoTerminal OHLCV (loaded immediately, refreshed every 60s)
  const [chartPrices, setChartPrices] = useState<number[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    l1_locks_detected: number;
    l1_locks_finalized: number;
    evm_mints_confirmed: number;
    evm_burns_detected: number;
    l1_unlocks_submitted: number;
    l1_unlocks_confirmed: number;
    last_l1_height: number;
    errors_total: number;
    validator_count?: number;
    validator_threshold?: string;
    validators?: string[];
  } | null>(null);
  interface PoolEntry {
    pair: string;
    dex: string;
    fee: number;
    feeLabel: string;
    active: boolean;
    tick: number;
    balances: Record<string, number | string>;
    price_usd: number;
    tvl_usd: number;
  }

  const [poolStats, setPoolStats] = useState<{
    tvl_usd: number;
    total_wzion_liquidity: number;
    active_pools: number;
    total_pools: number;
    wzion_supply: number;
    deployer_wzion: number;
    primary_price_usd: number;
    primary_dex: string;
    pools: {
      wzion_usdt: PoolEntry;
      wzion_weth: PoolEntry;
      wzion_sol: PoolEntry;
      ps_wzion_usdt: PoolEntry;
    };
    contracts?: {
      staking: { wzion: number };
      farm: { wzion: number };
      treasury: { wzion: number };
      governance: { wzion: number };
      bridge: { wzion: number };
    };
  } | null>(null);
  const [auctionData, setAuctionData] = useState<{
    clearingPriceUsd: number;
    currencyRaised: number;
    totalCleared: number;
    remainingSupply: number;
    isGraduated: boolean;
    wzionBalance: number;
    usdcBalance: number;
    currentBlock: number;
    progressPct: number;
    daysRemaining: number;
    pctSold: number;
  } | null>(null);

  // ── WebSocket subscription for real-time network status ─────────────────────
  const { data: _networkStatus, isConnected: wsConnected } = useNetworkStatus(true);

  // ── Fetch wZION total supply from API ──────────────────────────────────────

  const fetchSupply = useCallback(async () => {
    try {
      const res = await fetch('/api/defi/status');
      if (!res.ok) return null;
      const data = await res.json();
      return data.ok ? data.data?.wZION?.totalSupply ?? null : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshSupply = async () => {
      const supply = await fetchSupply();
      if (!cancelled) setWZIONSupply(supply);
    };

    const refreshPrice = async () => {
      try {
        const res = await fetch('/api/defi/price');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && !cancelled) {
          setWZIONPrice({
            wzion_per_weth: data.price.wzion_per_weth,
            usd_per_wzion: data.price.usd_per_wzion,
          });
        }
      } catch { /* ignore */ }
    };

    const refreshChart = async () => {
      try {
        const res = await fetch('/api/defi/chart', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok && Array.isArray(data.prices) && data.prices.length > 0) {
          setChartPrices(data.prices);
          setChartLoading(false);
        } else if (!cancelled) {
          setChartLoading(false);
        }
      } catch {
        if (!cancelled) setChartLoading(false);
      }
    };

    void refreshSupply();
    void refreshPrice();
    void refreshChart();

    const refreshBridge = async () => {
      try {
        const res = await fetch('/api/bridge/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBridgeStatus(data);
      } catch { /* ignore */ }
    };
    void refreshBridge();

    const refreshPools = async () => {
      try {
        const res = await fetch('/api/defi/pools', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok) {
          const primary = data.pools?.wzion_usdt?.active ? data.pools.wzion_usdt : null;
          setPoolStats({
            tvl_usd: data.summary?.total_tvl_usd ?? 0,
            total_wzion_liquidity: data.summary?.total_wzion_liquidity ?? 0,
            active_pools: data.summary?.active_pools ?? 0,
            total_pools: data.summary?.total_pools ?? 0,
            wzion_supply: data.summary?.wzion_supply ?? 0,
            deployer_wzion: data.summary?.deployer_wzion ?? 0,
            primary_price_usd: primary?.price_usd ?? data.pools?.wzion_usdt?.price_usd ?? 0,
            primary_dex: data.primary_dex ?? 'Uniswap V3',
            pools: {
              wzion_usdt: data.pools?.wzion_usdt ?? defaultPoolEntry('wZION/USDT', '0.3%'),
              wzion_weth: data.pools?.wzion_weth ?? defaultPoolEntry('ETH/wZION', '1.0%'),
              wzion_sol: data.pools?.wzion_sol ?? defaultPoolEntry('wZION/SOL', '0.01%'),
              ps_wzion_usdt: data.pools?.ps_wzion_usdt ?? defaultPoolEntry('wZION/USDT', '0.25%'),
            },
            contracts: data.contracts,
          });
        }
      } catch { /* ignore */ }
    };

    function defaultPoolEntry(pair: string, feeLabel: string): PoolEntry {
      return {
        pair,
        dex: 'Uniswap V3',
        fee: 0,
        feeLabel,
        active: false,
        tick: 0,
        balances: { wzion: 0, token1: 0, token1Symbol: 'USDT' },
        price_usd: 0,
        tvl_usd: 0,
      };
    }
    void refreshPools();

    const refreshAuction = async () => {
      try {
        const res = await fetch('/api/defi/auction', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok) setAuctionData({
          clearingPriceUsd: data.clearingPriceUsd ?? 0,
          currencyRaised: data.currencyRaised ?? 0,
          totalCleared: data.totalCleared ?? 0,
          remainingSupply: data.remainingSupply ?? 0,
          isGraduated: data.isGraduated ?? false,
          wzionBalance: data.wzionBalance ?? 0,
          usdcBalance: data.usdcBalance ?? 0,
          currentBlock: data.currentBlock ?? 0,
          progressPct: data.progressPct ?? 0,
          daysRemaining: data.daysRemaining ?? 0,
          pctSold: data.pctSold ?? 0,
        });
      } catch { /* ignore */ }
    };
    void refreshAuction();

    const loadAll = async () => {
      await Promise.all([
        refreshSupply(),
        refreshPrice(),
        refreshBridge(),
        refreshPools(),
        refreshChart(),
        refreshAuction(),
      ]).catch(() => {});
      if (!cancelled) setDataLoaded(true);
    };
    void loadAll();

    const interval = setInterval(() => {
      void refreshSupply();
      void refreshPrice();
      void refreshBridge();
      void refreshPools();
      void refreshChart();
      void refreshAuction();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchSupply]);

  return (
    <div className="zion-page text-white">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      {/* ═══════ HERO ═══════ */}
      <section className="zion-container relative z-10 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Sparkles className="h-4 w-4" />
                {DefiCopy.defiHubBaseMainnet[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{DefiCopy.wzionEcosystem[cs ? 'cs' : 'en']}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {DefiCopy.manageWzion[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {DefiCopy.swapBridgeAndManageWzionOnBase[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className={wsConnected ? 'zion-badge-green' : 'zion-badge'}>
                  <Zap className={`h-3 w-3 ${wsConnected ? 'text-zion-cyan' : 'text-zion-gold'}`} />
                  {wsConnected ? (DefiCopy.live[cs ? 'cs' : 'en']) : (DefiCopy.polling[cs ? 'cs' : 'en'])}
                </span>
                <span className="zion-badge">
                  <RefreshCw className="h-3 w-3 text-zion-cyan" /> {DefiCopy.autoRefresh60s[cs ? 'cs' : 'en']}
                </span>
                <span className="zion-badge">
                  <Globe className="h-3 w-3 text-zion-cyan" /> Base
                </span>
                <span className="zion-badge-green">
                  {DefiCopy.wzionUsdtUniswapV3[cs ? 'cs' : 'en']}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/dex" className="zion-button-primary text-sm">
                  <Zap className="h-4 w-4" />
                  {DefiCopy.ziondexSwap[cs ? 'cs' : 'en']}
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/ziondex" className="zion-button-secondary text-sm">
                  {DefiCopy.aboutZiondex[cs ? 'cs' : 'en']}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Quick info / connect side card */}
            <div className="w-full lg:max-w-md space-y-3">
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{DefiCopy.quickOverview[cs ? 'cs' : 'en']}</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <BarChart3 className="h-4 w-4 text-zion-gold" />
                      {DefiCopy.price[cs ? 'cs' : 'en']}
                    </div>
                    {dataLoaded ? (
                      <span className="font-mono text-white">
                        ${(poolStats?.primary_price_usd ?? wZIONPrice?.usd_per_wzion ?? SEED_PRICE_USD).toFixed(5)}
                      </span>
                    ) : (
                      <SkeletonValue />
                    )}
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Droplets className="h-4 w-4 text-zion-gold" />
                      TVL
                    </div>
                    {dataLoaded ? (
                      <span className="font-mono text-white">${(poolStats?.tvl_usd ?? 0).toFixed(2)}</span>
                    ) : (
                      <SkeletonValue />
                    )}
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Activity className="h-4 w-4 text-zion-gold" />
                      {DefiCopy.supply[cs ? 'cs' : 'en']}
                    </div>
                    {dataLoaded ? (
                      <span className="font-mono text-white">{wZIONSupply ?? '—'}</span>
                    ) : (
                      <SkeletonValue />
                    )}
                  </div>
                  {connected ? (
                    <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-zion-cyan animate-pulse" />
                          <span className="font-mono text-xs text-zion-cyan">
                            {account?.slice(0, 6)}…{account?.slice(-4)}
                          </span>
                        </div>
                        {isBaseMainnet ? (
                          <span className="text-[10px] text-gray-400">Base</span>
                        ) : (
                          <button
                            onClick={switchToBase}
                            className="zion-button-secondary !px-2 !py-1 !text-[10px]"
                          >
                            {DefiCopy.switch[cs ? 'cs' : 'en']}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={connect}
                      className="w-full zion-button-primary"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      {DefiCopy.connectWallet[cs ? 'cs' : 'en']}
                    </button>
                  )}
                </div>
                <a
                  href={`https://app.uniswap.org/swap?chain=base&inputCurrency=${CONTRACTS.USDT}&outputCurrency=${CONTRACTS.wZION}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors"
                >
                  {DefiCopy.openUniswapUsdt[cs ? 'cs' : 'en']} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════ Early Beta Banner ═══════ */}
      <section className="zion-container relative z-10 mb-6">
        <div className="zion-rainbow-card p-4 border-zion-gold/30 bg-zion-gold/10" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-zion-gold shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-200">
                {DefiCopy.defiHubEarlyBeta[cs ? 'cs' : 'en']}
              </p>
              <p className="text-xs text-amber-200/70 mt-1">
                {DefiCopy.wzionContractsAreDeployedOnBas[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ Multichain SECTION TABS ═══════ */}
      <section className="zion-container relative z-10 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          className="zion-rainbow-card p-4 md:p-5"
          style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
              {DefiCopy.defiSections[cs ? 'cs' : 'en']}
            </span>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = activeTab === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveTab(s.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'zion-rainbow-sub'
                      : 'border border-white/10 bg-black/40 text-gray-300 hover:border-white/25 hover:text-white'
                  }`}
                  style={isActive ? ({ '--rc': '228, 30, 43' } as React.CSSProperties) : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cs ? s.labelCs : s.labelEn}
                </button>
              );
            })}
          </div>
        </motion.div>
      </section>

      {activeTab === 'overview' && (
      <>
        {/* ═══════ Low Liquidity Warning ═══════ */}
        {dataLoaded && (poolStats?.tvl_usd ?? 0) < 500 && (
          <section className="zion-container relative z-10 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              className="zion-rainbow-card p-4"
              style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-zion-gold shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-200 mb-1">
                    {DefiCopy.lowDexLiquidity[cs ? 'cs' : 'en']}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {cs
                      ? `Aktuální aktivní likvidita na DEX je nízká (~$${(poolStats?.tvl_usd ?? 0).toFixed(2)} TVL). Velké swapy mohou mít výrazný price impact. Doporučujeme používat malé částky nebo přidat likviditu do Uniswap V3 wZION/USDT poolu.`
                      : `Current active DEX liquidity is low (~$${(poolStats?.tvl_usd ?? 0).toFixed(2)} TVL). Large swaps may have significant price impact. Consider small amounts or add liquidity to the Uniswap V3 wZION/USDT pool.`}
                  </p>
                </div>
              </div>
            </motion.div>
          </section>
        )}

        {/* ═══════ Multichain TELEMETRY ═══════ */}
        <section className="zion-container relative z-10 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="zion-rainbow-card p-5 md:p-6"
            style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DefiCopy.telemetry[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Activity className="h-7 w-7 text-zion-cyan" />
                {DefiCopy.defiTelemetry[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-sm text-gray-400">
                {DefiCopy.wzionMetricsAggregatedFromBase[cs ? 'cs' : 'en']}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard
                icon={<TrendingUp className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"

                label={DefiCopy.price[cs ? 'cs' : 'en']}
                value={`$${(poolStats?.primary_price_usd ?? wZIONPrice?.usd_per_wzion ?? SEED_PRICE_USD).toFixed(6)}`}
                sub="USDT / wZION"
                tip={DefiCopy.currentPriceFromThePrimaryWzio[cs ? 'cs' : 'en']}
                loading={!dataLoaded}
              />
              <StatCard
                icon={<Droplets className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"

                label="TVL"
                value={`$${(poolStats?.tvl_usd ?? 0).toFixed(2)}`}
                sub={DefiCopy.totalInPools[cs ? 'cs' : 'en']}
                loading={!dataLoaded}
              />
              <StatCard
                icon={<Activity className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"

                label={DefiCopy.liquidity[cs ? 'cs' : 'en']}
                value={`${(poolStats?.total_wzion_liquidity ?? 0).toFixed(0)}`}
                sub="wZION"
                loading={!dataLoaded}
              />
              <StatCard
                icon={<Layers className="h-5 w-5" />}
                colorClass="text-zion-purple"
                bgClass="bg-zion-purple/10"

                label={DefiCopy.pools[cs ? 'cs' : 'en']}
                value={String(poolStats?.active_pools ?? 0)}
                sub={DefiCopy.active[cs ? 'cs' : 'en']}
                loading={!dataLoaded}
              />
              <StatCard
                icon={<Wallet className="h-5 w-5" />}
                colorClass="text-zion-purple"
                bgClass="bg-zion-purple/10"

                label={DefiCopy.wzionSupply[cs ? 'cs' : 'en']}
                value={wZIONSupply ?? '—'}
                sub={DefiCopy.totalCirculating[cs ? 'cs' : 'en']}
                loading={!dataLoaded}
              />
              <StatCard
                icon={<ArrowLeftRight className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"

                label={DefiCopy.bridge[cs ? 'cs' : 'en']}
                value={bridgeStatus?.online ? (DefiCopy.online[cs ? 'cs' : 'en']) : (DefiCopy.offline[cs ? 'cs' : 'en'])}
                sub={bridgeStatus?.validator_threshold ?? DefiCopy.k55Validators[cs ? 'cs' : 'en']}
                loading={!dataLoaded}
              />
              <StatCard
                icon={<ShieldCheck className="h-5 w-5" />}
                colorClass="text-zion-purple"
                bgClass="bg-zion-purple/10"

                label={DefiCopy.validators[cs ? 'cs' : 'en']}
                value={bridgeStatus?.validator_threshold ?? '—'}
                sub={bridgeStatus?.validator_count
                  ? `${bridgeStatus.validator_count} ${DefiCopy.guardianRelay[cs ? 'cs' : 'en']}`
                  : DefiCopy.guardianRelay[cs ? 'cs' : 'en']}
                loading={!dataLoaded}
              />
              <StatCard
                icon={<Gavel className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"

                label={DefiCopy.auction[cs ? 'cs' : 'en']}
                value={`${(auctionData?.pctSold ?? 0).toFixed(2)}%`}
                sub={DefiCopy.ccaSold[cs ? 'cs' : 'en']}
                loading={!dataLoaded}
              />
            </div>
          </motion.div>
        </section>

        {/* ═══════ wZION/USDT Price Chart ═══════ */}
        <section className="zion-container relative z-10 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="zion-rainbow-card p-5"
            style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <TrendingUp className="h-4 w-4 text-zion-gold" />
                <span className="text-sm font-semibold text-white">wZION / USDT</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zion-gold/20 text-zion-gold border border-zion-gold/30">
                  {DefiCopy.primary[cs ? 'cs' : 'en']}
                </span>
                <span className="text-[10px] text-gray-500">0.3% fee · Base Mainnet</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-bold font-mono text-white">
                    ${(poolStats?.primary_price_usd ?? wZIONPrice?.usd_per_wzion ?? SEED_PRICE_USD).toFixed(6)}
                  </p>
                  {chartPrices.length >= 2 && (() => {
                    const chg = ((chartPrices[chartPrices.length - 1] - chartPrices[0]) / chartPrices[0]) * 100;
                    return (
                      <p className={`text-[10px] text-right ${chg >= 0 ? 'text-zion-cyan' : 'text-zion-purple'}`}>
                        {chg >= 0 ? '+' : ''}{chg.toFixed(2)}% ({DefiCopy.k1h[cs ? 'cs' : 'en']})
                      </p>
                    );
                  })()}
                </div>
                <a
                  href={`https://dexscreener.com/base/${CONTRACTS.UniV3PoolUSDT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                >
                  DexScreener <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="relative h-48 w-full">
              {chartPrices.length >= 2 ? (
                <PriceSparkline prices={chartPrices} height={192} />
              ) : chartLoading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-gray-600 animate-pulse">
                    {DefiCopy.loadingPriceData[cs ? 'cs' : 'en']}
                  </p>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-gray-600">
                    {DefiCopy.priceDataNotAvailableYet[cs ? 'cs' : 'en']}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              <div className="zion-rainbow-sub p-2" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-gray-500 mb-0.5">TVL</p>
                <p className="text-white font-mono">${(poolStats?.tvl_usd ?? 0).toFixed(2)}</p>
              </div>
              <div className="zion-rainbow-sub p-2" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-gray-500 mb-0.5">{DefiCopy.liquidity[cs ? 'cs' : 'en']}</p>
                <p className="text-white font-mono">
                  {(poolStats?.total_wzion_liquidity ?? 0) > 0
                    ? `${(poolStats!.total_wzion_liquidity).toLocaleString(undefined, { maximumFractionDigits: 0 })} wZION`
                    : '—'}
                </p>
              </div>
              <div className="zion-rainbow-sub p-2" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-gray-500 mb-0.5">USDT</p>
                <p className="text-white font-mono">
                  {(Number(poolStats?.pools?.wzion_usdt?.balances?.usdt ?? 0)) > 0
                    ? (Number(poolStats!.pools.wzion_usdt.balances.usdt)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '—'}
                </p>
              </div>
              <div className="zion-rainbow-sub p-2" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-gray-500 mb-0.5">Tick</p>
                <p className="text-white font-mono">{poolStats?.pools?.wzion_usdt?.tick ?? '—'}</p>
              </div>
              <div className="zion-rainbow-sub p-2" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-gray-500 mb-0.5">{DefiCopy.status[cs ? 'cs' : 'en']}</p>
                <p className={poolStats?.pools?.wzion_usdt?.active ? 'text-zion-cyan' : 'text-zion-gold'}>
                  {poolStats?.pools?.wzion_usdt?.active ? (DefiCopy.active[cs ? 'cs' : 'en']) : (poolStats ? (DefiCopy.inactive[cs ? 'cs' : 'en']) : (DefiCopy.loading[cs ? 'cs' : 'en']))}
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══════ Contract Addresses ═══════ */}
        <section className="zion-container relative z-10 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DefiCopy.contracts[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Layers className="h-7 w-7 text-zion-cyan" />
                {DefiCopy.baseMainnetContracts[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="zion-rainbow-card overflow-hidden p-0" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="p-4 text-left font-medium text-gray-400">{DefiCopy.contract[cs ? 'cs' : 'en']}</th>
                      <th className="p-4 text-left font-medium text-gray-400">{DefiCopy.address[cs ? 'cs' : 'en']}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(CONTRACTS).map(([name, addr]) => (
                      <tr key={name} className="border-b border-white/5 hover:bg-white/3">
                        <td className="p-4 font-mono text-gray-200">{name}</td>
                        <td className="p-4">
                          <a
                            href={`https://basescan.org/address/${addr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-zion-gold/80 transition-colors hover:text-zion-gold inline-flex items-center gap-1"
                          >
                            {addr}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══════ CTA ═══════ */}
        <section className="zion-container relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="zion-cta-banner"
          >
            <h2 className="text-2xl font-bold mb-3">
              {DefiCopy.tradeWzion[cs ? 'cs' : 'en']}
            </h2>
            <p className="mx-auto mb-6 max-w-lg text-gray-100">
              {DefiCopy.wzionIsAvailableOnUniswapV3Bas[cs ? 'cs' : 'en']}
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <a
                href={`https://app.uniswap.org/swap?chain=base&inputCurrency=${CONTRACTS.USDT}&outputCurrency=${CONTRACTS.wZION}`}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-primary"
              >
                {DefiCopy.openUniswap[cs ? 'cs' : 'en']}
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={`https://dexscreener.com/base/${CONTRACTS.UniV3PoolUSDT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary"
              >
                DexScreener
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </motion.div>
        </section>
      </>
      )}

      {activeTab === 'swap' && (
      <>
        {/* ═══════ TRADE wZION ═══════ */}
        <section className="zion-container relative z-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DefiCopy.trade[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <RefreshCw className="h-7 w-7 text-zion-cyan" />
                {DefiCopy.tradeWzion[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-sm text-gray-400">{DefiCopy.swapTradeOnDexAndTrackTheWzion[cs ? 'cs' : 'en']}</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div
                className="zion-rainbow-card p-5"
                style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zion-purple/10 border border-zion-purple/20">
                      <RefreshCw className="h-5 w-5 text-zion-purple" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{DefiCopy.swapWzion[cs ? 'cs' : 'en']}</h3>
                      <p className="text-[11px] text-gray-500">{DefiCopy.lifiUniswapIntegration[cs ? 'cs' : 'en']}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zion-cyan/10 border border-zion-cyan/20 px-3 py-1 text-[10px] font-semibold text-zion-cyan">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {DefiCopy.live[cs ? 'cs' : 'en']}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{DefiCopy.instantSwapBetweenWzionEthUsdt[cs ? 'cs' : 'en']}</p>
                <div className="flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  <span>{DefiCopy.swapBelow[cs ? 'cs' : 'en']}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>

              <Link
                href={`https://app.uniswap.org/swap?chain=base&inputCurrency=${CONTRACTS.USDT}&outputCurrency=${CONTRACTS.wZION}`}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-rainbow-card p-5 transition-transform duration-200 hover:scale-[1.01] block"
                style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zion-gold/10 border border-zion-gold/20">
                      <Droplets className="h-5 w-5 text-zion-gold" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{DefiCopy.dexPools[cs ? 'cs' : 'en']}</h3>
                      <p className="text-[11px] text-gray-500">{DefiCopy.uniswapV3[cs ? 'cs' : 'en']}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zion-cyan/10 border border-zion-cyan/20 px-3 py-1 text-[10px] font-semibold text-zion-cyan">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {DefiCopy.live[cs ? 'cs' : 'en']}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{DefiCopy.wzionUsdtPrimaryPoolOnUniswapV[cs ? 'cs' : 'en']}</p>
                <div className="flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  <span>{DefiCopy.openUniswap[cs ? 'cs' : 'en']}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </Link>

              <Link
                href={CCA_AUCTION_PARAMS.uniswapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-rainbow-card p-5 transition-transform duration-200 hover:scale-[1.01] block"
                style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zion-gold/10 border border-zion-gold/20">
                      <Gavel className="h-5 w-5 text-zion-gold" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{DefiCopy.ccaAuction[cs ? 'cs' : 'en']}</h3>
                      <p className="text-[11px] text-gray-500">{DefiCopy.k6647mWzionForUsdc[cs ? 'cs' : 'en']}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zion-gold/10 border border-zion-gold/20 px-3 py-1 text-[10px] font-semibold text-zion-gold">
                    <Clock className="h-3.5 w-3.5" />
                    {DefiCopy.active_2[cs ? 'cs' : 'en']}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{DefiCopy.continuousClearingAuctionOnUni[cs ? 'cs' : 'en']}</p>
                <div className="flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  <span>{DefiCopy.placeBids[cs ? 'cs' : 'en']}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </Link>

              <Link
                href={PANCAKE_V3.swapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-rainbow-card p-5 transition-transform duration-200 hover:scale-[1.01] block"
                style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zion-gold/10 border border-zion-gold/20">
                      <ChefHat className="h-5 w-5 text-zion-gold" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">PancakeSwap V3</h3>
                      <p className="text-[11px] text-gray-500">{DefiCopy.k2ndLargestDexOnBase[cs ? 'cs' : 'en']}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zion-cyan/10 border border-zion-cyan/20 px-3 py-1 text-[10px] font-semibold text-zion-cyan">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {DefiCopy.live[cs ? 'cs' : 'en']}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{DefiCopy.wzionUsdtPoolOnPancakeswapV3An[cs ? 'cs' : 'en']}</p>
                <div className="flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  <span>{DefiCopy.swapOnPancakeswap[cs ? 'cs' : 'en']}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* ═══════ Real Swap Widgets ═══════ */}
        <section className="zion-container relative z-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="space-y-6 max-w-5xl"
          >
            <div className="zion-rainbow-card p-5 md:p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw className="h-4 w-4 text-zion-purple" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">{DefiCopy.crossChainSwap[cs ? 'cs' : 'en']}</h3>
              </div>
              <LiFiWidget />
            </div>
            <div className="zion-rainbow-card p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="h-4 w-4 text-zion-purple" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">{DefiCopy.directSwapBalances[cs ? 'cs' : 'en']}</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SwapWidget />
                <div className="space-y-6">
                  <DefiBalances />
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </>
      )}

      {activeTab === 'earn' && (
      <>
        {/* ═══════ EARN wZION ═══════ */}
        <section className="zion-container relative z-10 mb-10 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-2 mb-2"
          >
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DefiCopy.yield[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <PiggyBank className="h-7 w-7 text-zion-gold" />
              {DefiCopy.earnWzion[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{DefiCopy.stakeOrFarmWzionToEarnRegularR[cs ? 'cs' : 'en']}</p>
          </motion.div>

          <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="zion-rainbow-sub p-4 mb-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-zion-gold" />
                <h3 className="text-base font-semibold text-white">{DefiCopy.staking[cs ? 'cs' : 'en']}</h3>
              </div>
            </div>
            <StakingPanel />
          </div>

          <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="zion-rainbow-sub p-4 mb-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-zion-gold" />
                <h3 className="text-base font-semibold text-white">{DefiCopy.farming[cs ? 'cs' : 'en']}</h3>
              </div>
            </div>
            <FarmingPanel />
          </div>
        </section>
      </>
      )}

      {activeTab === 'bridge' && (
      <>
      {/* ═══════ BRIDGE PRODUCT ═══════ */}
      <section className="zion-container relative z-10 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DefiCopy.infrastructure[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ArrowLeftRight className="h-7 w-7 text-zion-cyan" />
              {DefiCopy.wzionBridge[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{DefiCopy.moveBetweenL1AndL2AndGovernThe[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Link
              href="/bridge"
              className="zion-rainbow-card p-6 transition-transform duration-200 hover:scale-[1.01] block"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zion-purple/10 border border-zion-purple/20">
                  <ArrowLeftRight className="h-5 w-5 text-zion-purple" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{DefiCopy.wzionBridge[cs ? 'cs' : 'en']}</h3>
                  <p className="text-[11px] text-gray-500">{bridgeStatus?.validator_threshold ?? DefiCopy.l1Base55Validators[cs ? 'cs' : 'en']}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed mb-3">{DefiCopy.lockZionOnL1AndReceiveWzionOnB[cs ? 'cs' : 'en']}</p>
              <div className="flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                <span>{DefiCopy.openBridge[cs ? 'cs' : 'en']}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <BridgeHowItWorks cs={cs} showLinks />
          </div>
        </motion.div>
      </section>

      {/* ═══════ Bridge Vault Status + Burn Widget ═══════ */}
      <section className="zion-container relative z-10 mb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-6 max-w-5xl"
        >
          {/* Bridge Vault Status */}
          <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-zion-purple" />
              <h3 className="font-semibold text-white text-sm">
                {DefiCopy.bridgeVault100mZion[cs ? 'cs' : 'en']}
              </h3>
              <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold ${
                bridgeStatus?.online
                  ? 'bg-zion-cyan/10 text-zion-cyan border border-zion-cyan/20'
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${bridgeStatus?.online ? 'bg-zion-cyan animate-pulse' : 'bg-gray-500'}`} />
                {bridgeStatus?.online ? (DefiCopy.relayOnline[cs ? 'cs' : 'en']) : (DefiCopy.relayOffline[cs ? 'cs' : 'en'])}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {DefiCopy.k6UtxoLockTransactions1667mZion[cs ? 'cs' : 'en']}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{DefiCopy.locked[cs ? 'cs' : 'en']}</p>
                <p className="text-base font-semibold text-white mt-1">~100M</p>
                <p className="text-[10px] text-gray-500">ZION</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{DefiCopy.lockTxs[cs ? 'cs' : 'en']}</p>
                <p className="text-base font-semibold text-white mt-1">6</p>
                <p className="text-[10px] text-gray-500">UTXO</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{DefiCopy.wzionMints[cs ? 'cs' : 'en']}</p>
                <p className="text-base font-semibold text-white mt-1 flex items-center gap-1">
                  {bridgeStatus?.evm_mints_confirmed ?? '—'}
                  {bridgeStatus && bridgeStatus.evm_mints_confirmed > 0 && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-zion-cyan" />
                  )}
                </p>
                <p className="text-[10px] text-gray-500">{DefiCopy.confirmed[cs ? 'cs' : 'en']}</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{DefiCopy.l1Unlocks[cs ? 'cs' : 'en']}</p>
                <p className="text-base font-semibold text-white mt-1 flex items-center gap-1">
                  {bridgeStatus?.l1_unlocks_confirmed ?? '—'}
                  {bridgeStatus && (bridgeStatus.l1_unlocks_confirmed ?? 0) > 0 && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-zion-cyan" />
                  )}
                </p>
                <p className="text-[10px] text-gray-500">{DefiCopy.confirmed[cs ? 'cs' : 'en']}</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">L1 {DefiCopy.block[cs ? 'cs' : 'en']}</p>
                <p className="text-base font-semibold text-white mt-1">{bridgeStatus?.last_l1_height ?? '—'}</p>
                <p className="text-[10px] text-gray-500">{DefiCopy.lastScan[cs ? 'cs' : 'en']}</p>
              </div>
            </div>

            {bridgeStatus?.validators && bridgeStatus.validators.length > 0 && (
              <div className="mt-4">
                <BridgeValidators
                  validators={bridgeStatus.validators}
                  threshold={bridgeStatus.validator_threshold}
                  count={bridgeStatus.validator_count}
                  cs={cs}
                />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                wZION: <span className="text-gray-400 font-mono">{CONTRACTS.wZION?.slice(0, 8)}…{CONTRACTS.wZION?.slice(-4)}</span>
              </span>
              <span className="text-gray-600">·</span>
              <span>{DefiCopy.vault[cs ? 'cs' : 'en']}: <span className="text-gray-400 font-mono">zion1w0r0…w0t0</span></span>
              <span className="text-gray-600">·</span>
              <span>{DefiCopy.finality60Blocks[cs ? 'cs' : 'en']}</span>
              <span className="text-gray-600">·</span>
              <span className="inline-flex items-center gap-1 text-zion-cyan">
                <CheckCircle2 className="h-3 w-3" />
                {DefiCopy.reverseBridgeE2eVerified202606[cs ? 'cs' : 'en']}
              </span>
            </div>
          </div>

          {/* Burn widget + How it works */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BridgeBurnWidget />
            <BridgeHowItWorks cs={cs} showLinks />
          </div>
        </motion.div>
      </section>
      </>
      )}

      {activeTab === 'governance' && (
      <>
        {/* ═══════ GOVERNANCE ═══════ */}
        <section className="zion-container relative z-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DefiCopy.governance[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Scale className="h-7 w-7 text-zion-purple" />
                {DefiCopy.wzionGovernance[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-sm text-gray-400">{DefiCopy.voteOnProtocolParametersAndMon[cs ? 'cs' : 'en']}</p>
            </div>
          </motion.div>
          <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="zion-rainbow-sub p-4 mb-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-zion-gold" />
                <h3 className="text-base font-semibold text-white">{DefiCopy.governancePanel[cs ? 'cs' : 'en']}</h3>
              </div>
            </div>
            <GovernancePanel />
          </div>
        </section>
      </>
      )}

      {activeTab === 'pools' && (
      <>
        {/* ═══════ DEX POOLS ═══════ */}
        <section className="zion-container relative z-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DefiCopy.liquidity[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Droplets className="h-7 w-7 text-zion-cyan" />
                {DefiCopy.dexPools_2[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-sm text-gray-400">{DefiCopy.wzionUsdtOnUniswapV3AndPancake[cs ? 'cs' : 'en']}</p>
            </div>
          </motion.div>
        </section>

        {/* ── PancakeSwap V3 ── */}
        <section className="zion-container relative z-10 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="zion-rainbow-card p-6"
            style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <ChefHat className="h-6 w-6 text-zion-gold" />
                <div>
                  <h2 className="text-lg font-bold text-white">
                    PancakeSwap V3
                  </h2>
                  <p className="text-[10px] text-gray-500">
                    {DefiCopy.k2ndLargestDexOnBase115mDailyVo[cs ? 'cs' : 'en']}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold bg-zion-cyan/10 text-zion-cyan border border-zion-cyan/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-zion-cyan animate-pulse" />
                  {DefiCopy.live_2[cs ? 'cs' : 'en']}
                </span>
                <a
                  href={PANCAKE_V3.swapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-primary !px-4 !py-2 !text-xs"
                >
                  {DefiCopy.swapOnPancakeswap[cs ? 'cs' : 'en']}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{DefiCopy.poolAddress[cs ? 'cs' : 'en']}</p>
                <p className="text-sm font-semibold text-white font-mono">0x46cc...6f47</p>
                <p className="text-[10px] text-gray-500">wZION/USDT · 0.25% fee · NFT #2054747</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{DefiCopy.price[cs ? 'cs' : 'en']}</p>
                <p className="text-sm font-semibold text-white font-mono">$0.0002</p>
                <p className="text-[10px] text-gray-500">{DefiCopy.seedPrice[cs ? 'cs' : 'en']}</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{DefiCopy.feeTiers[cs ? 'cs' : 'en']}</p>
                <p className="text-sm font-semibold text-white">0.01% · 0.05% · 0.25% · 1%</p>
                <p className="text-[10px] text-gray-500">{DefiCopy.multiTier[cs ? 'cs' : 'en']}</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-2">
              <a
                href={PANCAKE_V3.swapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
              >
                {DefiCopy.swapWzion[cs ? 'cs' : 'en']} <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href={PANCAKE_V3.addLiquidityUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
              >
                {DefiCopy.addLiquidity[cs ? 'cs' : 'en']} <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href={`https://basescan.org/address/${CONTRACTS.PancakeV3PoolUSDT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
              >
                {DefiCopy.poolOnBasescan[cs ? 'cs' : 'en']} <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href={`https://basescan.org/address/${PANCAKE_V3.factory}`}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
              >
                {DefiCopy.factoryContract[cs ? 'cs' : 'en']} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            {/* Status note */}
            <div className="mt-4 flex items-start gap-3 zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <AlertTriangle className="h-4 w-4 text-zion-gold shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {DefiCopy.pancakeswapV3PoolWasCreatedAnd[cs ? 'cs' : 'en']}
              </p>
            </div>
          </motion.div>
        </section>

        {/* ── Active Pools Detail ── */}
        <section className="zion-container relative z-10 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
          >
            <div className="flex flex-col gap-2 mb-4">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DefiCopy.uniswapV3[cs ? 'cs' : 'en']}</p>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Droplets className="h-5 w-5 text-zion-cyan" />
                {DefiCopy.uniswapV3Pools[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* wZION/USDT — active V3 pool */}
              <div
                className="zion-rainbow-card p-4"
                style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{poolStats?.pools?.wzion_usdt?.pair ?? 'wZION/USDT'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zion-purple/20 text-zion-purple border border-zion-purple/30">
                      {DefiCopy.primary[cs ? 'cs' : 'en']}
                    </span>
                    <span className="text-[10px] text-gray-400">{poolStats?.pools?.wzion_usdt?.feeLabel ?? '0.3%'}</span>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{DefiCopy.price[cs ? 'cs' : 'en']}:</span>
                    <span className="font-mono text-white">${(poolStats?.pools?.wzion_usdt?.price_usd ?? 0).toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{DefiCopy.liquidity[cs ? 'cs' : 'en']}:</span>
                    <span className="font-mono text-white">
                      {(Number(poolStats?.pools?.wzion_usdt?.balances?.wzion ?? 0)) > 0
                        ? `${(Number(poolStats!.pools.wzion_usdt.balances.wzion)).toLocaleString(undefined, { maximumFractionDigits: 0 })} wZION`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">USDT:</span>
                    <span className="font-mono text-white">
                      {(Number(poolStats?.pools?.wzion_usdt?.balances?.usdt ?? 0)) > 0
                        ? (Number(poolStats!.pools.wzion_usdt.balances.usdt)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">TVL:</span>
                    <span className="font-mono text-white">${(poolStats?.pools?.wzion_usdt?.tvl_usd ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tick:</span>
                    <span className="font-mono text-white">{poolStats?.pools?.wzion_usdt?.tick ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{DefiCopy.status[cs ? 'cs' : 'en']}:</span>
                    <span className={poolStats?.pools?.wzion_usdt?.active ? 'text-zion-cyan' : 'text-zion-gold'}>
                      {poolStats?.pools?.wzion_usdt?.active ? (DefiCopy.active[cs ? 'cs' : 'en']) : (DefiCopy.inactive[cs ? 'cs' : 'en'])}
                    </span>
                  </div>
                </div>
              </div>

              {/* ETH/wZION — initialized, no liquidity */}
              <div
                className="zion-rainbow-card p-4 opacity-70"
                style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{poolStats?.pools?.wzion_weth?.pair ?? 'ETH/wZION'}</span>
                  <span className="text-[10px] text-gray-400">{poolStats?.pools?.wzion_weth?.feeLabel ?? '1.0%'}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{DefiCopy.liquidity[cs ? 'cs' : 'en']}:</span>
                    <span className="font-mono text-gray-500">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{DefiCopy.status[cs ? 'cs' : 'en']}:</span>
                    <span className="text-zion-gold/70">{DefiCopy.initializedNoLiquidity[cs ? 'cs' : 'en']}</span>
                  </div>
                </div>
              </div>

              {/* wZION/SOL — initialized, no liquidity */}
              <div
                className="zion-rainbow-card p-4 opacity-70"
                style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{poolStats?.pools?.wzion_sol?.pair ?? 'wZION/SOL'}</span>
                  <span className="text-[10px] text-gray-400">{poolStats?.pools?.wzion_sol?.feeLabel ?? '0.01%'}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{DefiCopy.liquidity[cs ? 'cs' : 'en']}:</span>
                    <span className="font-mono text-gray-500">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{DefiCopy.status[cs ? 'cs' : 'en']}:</span>
                    <span className="text-zion-gold/70">{DefiCopy.initializedNoLiquidity[cs ? 'cs' : 'en']}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </>
      )}

      {activeTab === 'auction' && (
      <>
        {/* ═══════ CCA AUCTION ═══════ */}
        <section className="zion-container relative z-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DefiCopy.auction[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Gavel className="h-7 w-7 text-zion-gold" />
                {DefiCopy.uniswapCcaAuction[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-sm text-gray-400">{DefiCopy.continuousClearingAuction6647m[cs ? 'cs' : 'en']}</p>
            </div>
          </motion.div>
        </section>

        {/* ── Uniswap CCA Auction ── */}
        <section className="zion-container relative z-10 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="zion-rainbow-card p-6"
            style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Gavel className="h-6 w-6 text-zion-gold" />
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {DefiCopy.uniswapCcaAuction[cs ? 'cs' : 'en']}
                  </h2>
                  <p className="text-[10px] text-gray-500">
                    {DefiCopy.continuousClearingAuction6647m_2[cs ? 'cs' : 'en']}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold ${
                  auctionData?.isGraduated
                    ? 'bg-zion-cyan/10 text-zion-cyan border border-zion-cyan/20'
                    : 'bg-zion-gold/10 text-zion-gold border border-zion-gold/20'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${auctionData?.isGraduated ? 'bg-zion-cyan' : 'bg-zion-gold animate-pulse'}`} />
                  {auctionData?.isGraduated
                    ? (DefiCopy.graduated[cs ? 'cs' : 'en'])
                    : (DefiCopy.active_2[cs ? 'cs' : 'en'])}
                </span>
                <a
                  href={CCA_AUCTION_PARAMS.uniswapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-primary !px-4 !py-2 !text-xs"
                >
                  {DefiCopy.bidOnUniswap[cs ? 'cs' : 'en']}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {/* Clearing price */}
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3 w-3 text-zion-gold" />
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{DefiCopy.clearingPrice[cs ? 'cs' : 'en']}</p>
                </div>
                <p className="text-lg font-bold text-white font-mono">
                  ${(auctionData?.clearingPriceUsd ?? 0).toFixed(7)}
                </p>
                <p className="text-[10px] text-gray-500">USDC / wZION</p>
              </div>

              {/* USDC raised */}
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Droplets className="h-3 w-3 text-zion-cyan" />
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{DefiCopy.usdcRaised[cs ? 'cs' : 'en']}</p>
                </div>
                <p className="text-lg font-bold text-white font-mono">
                  ${(auctionData?.currencyRaised ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-gray-500">{DefiCopy.total[cs ? 'cs' : 'en']}</p>
              </div>

              {/* wZION sold */}
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="h-3 w-3 text-zion-gold" />
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{DefiCopy.wzionSold[cs ? 'cs' : 'en']}</p>
                </div>
                <p className="text-lg font-bold text-white font-mono">
                  {(auctionData?.totalCleared ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-[10px] text-gray-500">
                  {DefiCopy.of[cs ? 'cs' : 'en']} {CCA_AUCTION_PARAMS.totalSupply.toLocaleString()} ({(auctionData?.pctSold ?? 0).toFixed(4)}%)
                </p>
              </div>

              {/* Time remaining */}
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3 w-3 text-zion-gold" />
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{DefiCopy.remaining[cs ? 'cs' : 'en']}</p>
                </div>
                <p className="text-lg font-bold text-white font-mono">
                  {(auctionData?.daysRemaining ?? 184).toFixed(0)}
                </p>
                <p className="text-[10px] text-gray-500">{DefiCopy.days6Months[cs ? 'cs' : 'en']}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>{DefiCopy.block_2[cs ? 'cs' : 'en']} {auctionData?.currentBlock?.toLocaleString() ?? '…'}</span>
                <span>{(auctionData?.progressPct ?? 0).toFixed(3)}%</span>
                <span>{DefiCopy.end[cs ? 'cs' : 'en']} {CCA_AUCTION_PARAMS.endBlock.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-zion-gold to-zion-gold transition-all duration-500"
                  style={{ width: `${Math.min(100, auctionData?.progressPct ?? 0)}%` }}
                />
              </div>
            </div>

            {/* Auction details + links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Left: How it works */}
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  {DefiCopy.howCcaAuctionWorks[cs ? 'cs' : 'en']}
                </h3>
                <div className="flex gap-2 text-gray-300">
                  <span className="shrink-0 rounded-lg bg-zion-gold/10 border border-zion-gold/20 px-1.5 py-0.5 text-zion-gold font-mono text-[9px]">1</span>
                  <p>{DefiCopy.participantsBidUsdcForWzionWit[cs ? 'cs' : 'en']}</p>
                </div>
                <div className="flex gap-2 text-gray-300">
                  <span className="shrink-0 rounded-lg bg-zion-gold/10 border border-zion-gold/20 px-1.5 py-0.5 text-zion-gold font-mono text-[9px]">2</span>
                  <p>{DefiCopy.clearingPriceContinuouslyAdjus[cs ? 'cs' : 'en']}</p>
                </div>
                <div className="flex gap-2 text-gray-300">
                  <span className="shrink-0 rounded-lg bg-zion-gold/10 border border-zion-gold/20 px-1.5 py-0.5 text-zion-gold font-mono text-[9px]">3</span>
                  <p>{DefiCopy.afterGraduationLbpPoolOnUniswa[cs ? 'cs' : 'en']}</p>
                </div>
                <div className="flex gap-2 text-gray-300">
                  <span className="shrink-0 rounded-lg bg-zion-gold/10 border border-zion-gold/20 px-1.5 py-0.5 text-zion-gold font-mono text-[9px]">4</span>
                  <p>{DefiCopy.noGraduationExitbidRefundsUsdc[cs ? 'cs' : 'en']}</p>
                </div>
              </div>

              {/* Right: Contract info */}
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  {DefiCopy.contractDetails[cs ? 'cs' : 'en']}
                </h3>
                <div className="flex justify-between">
                  <span className="text-gray-400">{DefiCopy.auction[cs ? 'cs' : 'en']}</span>
                  <a
                    href={CCA_AUCTION_PARAMS.basescanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-zion-gold/80 hover:text-zion-gold inline-flex items-center gap-1"
                  >
                    {CCA_AUCTION_PARAMS.auctionContract.slice(0, 8)}…{CCA_AUCTION_PARAMS.auctionContract.slice(-4)}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{DefiCopy.token[cs ? 'cs' : 'en']}</span>
                  <span className="font-mono text-gray-300">wZION (18d)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{DefiCopy.currency[cs ? 'cs' : 'en']}</span>
                  <span className="font-mono text-gray-300">USDC (6d, Base)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{DefiCopy.startBlock[cs ? 'cs' : 'en']}</span>
                  <span className="font-mono text-gray-300">{CCA_AUCTION_PARAMS.startBlock.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{DefiCopy.endBlock[cs ? 'cs' : 'en']}</span>
                  <span className="font-mono text-gray-300">{CCA_AUCTION_PARAMS.endBlock.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{DefiCopy.floorPrice[cs ? 'cs' : 'en']}</span>
                  <span className="font-mono text-gray-300">$0.00019/wZION</span>
                </div>
              </div>
            </div>

            {/* Warning about 184-day duration */}
            <div className="mt-4 flex items-start gap-3 zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <AlertTriangle className="h-4 w-4 text-zion-gold shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {DefiCopy.noteEndBlockIsImmutableAndCann[cs ? 'cs' : 'en']}
              </p>
            </div>
          </motion.div>
        </section>
      </>
      )}

    </div>
  );
}
