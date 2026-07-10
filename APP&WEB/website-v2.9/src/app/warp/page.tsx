'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import {
  Activity,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  CircuitBoard,
  CloudLightning,
  Copy,
  Globe2,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
  Bitcoin,
  Coins,
  Droplets,
  Clock,
} from 'lucide-react';

const getWarpStats = (cs: boolean) => [
  { label: cs ? 'Chain rodiny' : 'Chain Families', value: '13', detail: cs ? 'EVM (6) · BTC · SOL · TRX · XLM · Cosmos · Cardano · Lightning · Aptos · NEAR · Sui · TON' : 'EVM (6) · BTC · SOL · TRX · XLM · Cosmos · Cardano · Lightning · Aptos · NEAR · Sui · TON', icon: Globe2 },
  { label: cs ? 'Živé koridory' : 'Live Corridors', value: '1', detail: cs ? 'EVM Lock/Mint — Base Mainnet (6 chainů)' : 'EVM Lock/Mint — Base Mainnet (6 chains)', icon: CheckCircle2 },
  { label: cs ? 'Guardian runtime' : 'Guardian Runtime', value: '5/5', detail: cs ? '5 validatorů aktivních · quorum 2/5' : '5 validators active · quorum 2/5', icon: ShieldCheck },
  { label: cs ? 'Testy' : 'Tests', value: '499', detail: cs ? '499 WARP testů prošlo · 0 chyb' : '499 WARP tests pass · 0 failures', icon: ShieldCheck },
];

const getCorridorRows = (cs: boolean): { title: string; subtitle: string; live: boolean; entries: { label: string; value: string }[] }[] => [
  {
    title: cs ? 'EVM Lock/Mint' : 'EVM Lock/Mint',
    subtitle: cs ? 'wZION ERC-20 · 6 chainů · Base Mainnet' : 'wZION ERC-20 · 6 chains · Base Mainnet',
    live: true,
    entries: [
      { label: cs ? 'Validátoři' : 'Validators', value: cs ? '5/5 Guardian validators aktivních · quorum 2/5 · replay-safe' : '5/5 Guardian validators active · quorum 2/5 · replay-safe' },
      { label: cs ? 'Chainy' : 'Chains', value: 'Base · BSC · Polygon · Arbitrum · Optimism · Avalanche' },
      { label: cs ? 'Stav' : 'Status', value: cs ? 'Živě na Base (8453) · wZION/USDT na Uniswap V4 + PancakeSwap V3 · 6-chain bridge relay' : 'Live on Base (8453) · wZION/USDT on Uniswap V4 + PancakeSwap V3 · 6-chain bridge relay' },
      { label: cs ? 'Integrace' : 'Integration', value: cs ? 'EVM peněženky, DeFi swap, DAO treasury, LP stakes, CEX listings' : 'EVM wallets, DeFi swap, DAO treasury, LP stakes, CEX listings' },
    ],
  },
  {
    title: cs ? 'Bitcoin HTLC most' : 'Bitcoin HTLC Bridge',
    subtitle: 'SegWit + Taproot · Lightning',
    live: false,
    entries: [
      { label: cs ? 'Bezpečnostní model' : 'Security Model', value: 'HTLC · 2-of-3 multi-sig · 24h timelock' },
      { label: cs ? 'Stav' : 'Status', value: cs ? 'Adaptér implementován (BOLT11 + LND REST) · čeká na LND node deploy' : 'Adapter implemented (BOLT11 + LND REST) · awaiting LND node deploy' },
      { label: cs ? 'Use case' : 'Use cases', value: cs ? 'Trustless swapy, Lightning exity, OTC bridging' : 'Trustless swaps, Lightning exits, OTC bridging' },
    ],
  },
  {
    title: cs ? 'Solana SPL program' : 'Solana SPL Program',
    subtitle: 'PDA-secured · ZION SPL',
    live: false,
    entries: [
      { label: cs ? 'Finalita' : 'Finality', value: cs ? 'Tower BFT integrace plánována' : 'Tower BFT integration planned' },
      { label: cs ? 'Stav' : 'Status', value: cs ? 'Adaptér implementován · SPL mint s PDA · čeká na deploy' : 'Adapter implemented · SPL mint with PDA · awaiting deploy' },
      { label: cs ? 'Využití' : 'Utility', value: cs ? 'Game assety, routing likvidity, warp swapy' : 'Game assets, liquidity routing, warp swaps' },
    ],
  },
  {
    title: cs ? 'Non-EVM chainy' : 'Non-EVM Chains',
    subtitle: cs ? 'ZION nativní · 10 rodin' : 'ZION native · 10 families',
    live: false,
    entries: [
      { label: cs ? 'Implementováno' : 'Implemented', value: 'Tron · Stellar · Cosmos · Cardano · Aptos · Sui · NEAR · TON' },
      { label: cs ? 'Stav' : 'Status', value: cs ? 'Adaptéry + signery hotové (499 testů) · čeká na kontrakt deploy per chain' : 'Adapters + signers ready (499 tests) · awaiting contract deploy per chain' },
      { label: cs ? 'Token' : 'Token', value: cs ? 'ZION (ne wZION) — nativní reprezentace na non-EVM chainech' : 'ZION (not wZION) — native representation on non-EVM chains' },
    ],
  },
];

const getOnboarding = (cs: boolean) => [
  {
    title: cs ? '1 · Zřízení přístupu' : '1 · Provision access',
    items: [
      cs ? 'Whitelist validátorů nebo převzetí veřejných endpointů' : 'Whitelist validators or fetch public endpoints',
      cs ? 'Vygenerujte API tokeny (read/transfer scopes)' : 'Generate API tokens (read/transfer scopes)',
      cs ? 'Stáhněte SDK z oficiálního GitHubu' : 'Download SDK from official GitHub',
    ],
  },
  {
    title: cs ? '2 · Zapojení likvidity' : '2 · Wire liquidity',
    items: [
      cs ? 'Uzamkněte aktiva do vybraného corridor poolu' : 'Lock assets into chosen corridor pool',
      cs ? 'Nastavte validator quorum + alert webhooky' : 'Set validator quorum + alert webhooks',
      cs ? 'Spusťte smoke test na sandbox chain páru' : 'Run smoke test using sandbox chain pairs',
    ],
  },
  {
    title: cs ? '3 · Monitorovat + optimalizovat' : '3 · Monitor + optimize',
    items: [
      cs ? 'Odebírat streamy validator dashboardu' : 'Subscribe to validator dashboard streams',
      cs ? 'Zapnout compact block relay metriky' : 'Enable compact block relay metrics',
      cs ? 'Naplánovat týdenní failover + incident drills' : 'Schedule weekly failover + incident drills',
    ],
  },
];

const getSwapPairs = (cs: boolean) => [
  {
    from: 'BTC',
    to: 'ZION',
    icon: Bitcoin,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    status: 'planned',
    desc: cs ? 'Bitcoin HTLC most — trustless swapy BTC ↔ ZION přes 2-of-3 multi-sig · Lightning exity' : 'Bitcoin HTLC bridge — trustless BTC ↔ ZION swaps via 2-of-3 multi-sig · Lightning exits',
    eta: cs ? 'Adaptér hotov · čeká na LND node' : 'Adapter ready · awaiting LND node',
  },
  {
    from: 'ETH',
    to: 'wZION',
    icon: Droplets,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    status: 'live',
    desc: cs ? 'Uniswap V4 + PancakeSwap V3 na Base — wZION/USDT (0.3% + 0.25% fee) · 6-chain bridge' : 'Uniswap V4 + PancakeSwap V3 on Base — wZION/USDT (0.3% + 0.25% fee) · 6-chain bridge',
    eta: cs ? 'Dostupné nyní' : 'Available now',
  },
  {
    from: 'SOL',
    to: 'ZION',
    icon: Coins,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    status: 'research',
    desc: cs ? 'Solana SPL program — PDA-secured ZION mint, Tower BFT finalita' : 'Solana SPL program — PDA-secured ZION mint, Tower BFT finality',
    eta: cs ? 'Adaptér hotov · čeká na deploy' : 'Adapter ready · awaiting deploy',
  },
  {
    from: 'ZION L1',
    to: 'wZION',
    icon: ArrowLeftRight,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    status: 'live',
    desc: cs ? 'Nativní L1 ↔ L2 bridge — lock ZION na L1, mint wZION na EVM chainech (1:1 peg)' : 'Native L1 ↔ L2 bridge — lock ZION on L1, mint wZION on EVM chains (1:1 peg)',
    eta: cs ? 'Dostupné nyní' : 'Available now',
  },
];

const getRoadmap = (cs: boolean) => [
  {
    phase: cs ? 'Fáze 1 (Hotovo)' : 'Phase 1 (Done)',
    title: cs ? 'EVM Corridor — 6 chainů' : 'EVM Corridor — 6 chains',
    desc: cs ? 'wZION ERC-20 na Base, BSC, Polygon, Arbitrum, Optimism, Avalanche · Uniswap V4 + PancakeSwap V3 · 5/5 Guardian validators · bridge relay live' : 'wZION ERC-20 on Base, BSC, Polygon, Arbitrum, Optimism, Avalanche · Uniswap V4 + PancakeSwap V3 · 5/5 Guardian validators · bridge relay live',
    done: true,
  },
  {
    phase: cs ? 'Fáze 2 (Hotovo)' : 'Phase 2 (Done)',
    title: cs ? 'DEX Liquidity + CCA Auction' : 'DEX Liquidity + CCA Auction',
    desc: cs ? 'wZION/USDT na Uniswap V4 (0.3%) + PancakeSwap V3 (0.25%) · Uniswap CCA aukce (66.47M wZION za USDC) · LiFi agregátor (30+ DEX) · DexScreener integrace' : 'wZION/USDT on Uniswap V4 (0.3%) + PancakeSwap V3 (0.25%) · Uniswap CCA auction (66.47M wZION for USDC) · LiFi aggregator (30+ DEX) · DexScreener integration',
    done: true,
  },
  {
    phase: cs ? 'Fáze 3 (Hotovo)' : 'Phase 3 (Done)',
    title: cs ? '13 Chain Family Adaptéry' : '13 Chain Family Adapters',
    desc: cs ? 'WARP adaptéry + signery pro všech 13 chain rodin: EVM (6), BTC, Solana, Tron, Stellar, Cosmos, Cardano, Lightning (BOLT11+LND), Aptos, NEAR, Sui, TON · 499 testů prošlo' : 'WARP adapters + signers for all 13 chain families: EVM (6), BTC, Solana, Tron, Stellar, Cosmos, Cardano, Lightning (BOLT11+LND), Aptos, NEAR, Sui, TON · 499 tests pass',
    done: true,
  },
  {
    phase: cs ? 'Fáze 4 (Aktivní)' : 'Phase 4 (Active)',
    title: cs ? 'Non-EVM Deploy + BTC Lightning' : 'Non-EVM Deploy + BTC Lightning',
    desc: cs ? 'Deploy ZION kontraktů na non-EVM chainech (Solana, Tron, Stellar, Cosmos, Cardano, Aptos, Sui, NEAR, TON) · LND node setup pro Lightning · cross-chain AMM routing' : 'Deploy ZION contracts on non-EVM chains (Solana, Tron, Stellar, Cosmos, Cardano, Aptos, Sui, NEAR, TON) · LND node setup for Lightning · cross-chain AMM routing',
    done: false,
  },
];

export default function WarpPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const warpStats = getWarpStats(cs);
  const corridorRows = getCorridorRows(cs);
  const onboarding = getOnboarding(cs);
  const swapPairs = getSwapPairs(cs);
  const roadmap = getRoadmap(cs);

  const [warpChain, setWarpChain] = useState('ethereum');
  const [warpRecipient, setWarpRecipient] = useState('');
  const [warpAmount, setWarpAmount] = useState('');
  const [warpMemo, setWarpMemo] = useState('');
  const [warpCopied, setWarpCopied] = useState(false);
  const [warpTransferId, setWarpTransferId] = useState('');
  const [warpTransferStatus, setWarpTransferStatus] = useState<any>(null);
  const [warpLoading, setWarpLoading] = useState(false);

  useEffect(() => {
    if (warpRecipient) {
      setWarpMemo(`WARP:1:${warpChain}:${warpRecipient}`);
    } else {
      setWarpMemo('');
    }
  }, [warpChain, warpRecipient]);

  const copyWarpMemo = async () => {
    if (!warpMemo) return;
    try {
      await navigator.clipboard.writeText(warpMemo);
      setWarpCopied(true);
      setTimeout(() => setWarpCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const checkWarpTransfer = async () => {
    if (!warpTransferId) return;
    setWarpLoading(true);
    try {
      const res = await fetch(`/api/warp/transfers/${encodeURIComponent(warpTransferId)}`);
      const data = await res.json();
      setWarpTransferStatus(data);
    } catch (e: any) {
      setWarpTransferStatus({ error: e.message });
    } finally {
      setWarpLoading(false);
    }
  };

  return (
    <div className="zion-page">
        <div className="zion-container max-w-6xl space-y-16">

        {/* ── Hero ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Sparkles className="h-4 w-4" />
                Warp 2.0 · Corridor Ops
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? 'Cross-chain řídicí panel' : 'Cross-chain flight deck'}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? 'Likvidita bez hranic' : 'Liquidity without borders'}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? 'WARP bridge pokrývá 13 chain rodin — EVM (6 chainů), BTC, Solana, Tron, Stellar, Cosmos, Cardano, Lightning, Aptos, NEAR, Sui, TON. EVM corridor je živě (6 chainů, 2 DEX). Non-EVM adaptéry hotové, čekají na kontrakt deploy.'
                  : 'WARP bridge covers 13 chain families — EVM (6 chains), BTC, Solana, Tron, Stellar, Cosmos, Cardano, Lightning, Aptos, NEAR, Sui, TON. EVM corridor is live (6 chains, 2 DEX). Non-EVM adapters ready, awaiting contract deploy.'}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/defi" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 text-sm font-semibold text-black">
                  {cs ? 'Otevřít DeFi Hub' : 'Open DeFi Hub'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/bridge" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                  {cs ? 'Bridge operace' : 'Bridge operations'}
                </Link>
                <Link href="/cex" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                  {cs ? 'CEX Listings' : 'CEX Listings'}
                </Link>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {warpStats.map((chip) => (
                <div key={chip.label} className="zion-rainbow-sub px-5 py-4" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                  <chip.icon className="h-6 w-6 text-zion-gold" />
                  <p className="mt-3 text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-3xl font-semibold text-white">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Corridor grid ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Síť koridorů' : 'Corridor grid'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Mosty kryté validátory' : 'Validator-backed bridges'}</h2>
          </div>
          <div className="space-y-6">
            {corridorRows.map((row) => (
              <div key={row.title} className="zion-rainbow-card p-6" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{row.subtitle}</p>
                    <h3 className="text-2xl font-semibold text-white">{row.title}</h3>
                  </div>
                  {row.live ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {cs ? 'Živě' : 'Live'}
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-gray-300">
                      {cs ? 'Ve vývoji' : 'In development'}
                    </span>
                  )}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {row.entries.map((entry) => (
                    <div key={entry.label} className="zion-rainbow-sub p-4" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{entry.label}</p>
                      <p className="mt-2 text-sm text-gray-200 leading-relaxed">{entry.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Onboarding runbook ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Operační runbook' : 'Operations runbook'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Připojit nový koridór online' : 'Bring a new corridor online'}</h2>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {onboarding.map((block, idx) => (
              <div key={block.title} className="zion-rainbow-sub p-5" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <CircuitBoard className="h-5 w-5 text-zion-cyan" />
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">{cs ? 'Fáze' : 'Stage'} {idx + 1}</p>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white">{block.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Lock className="h-4 w-4 text-zion-gold mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Cross-Chain Swap Preview ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Cross-chain swapy' : 'Cross-chain swaps'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Swap mezi základními kryptoměnami' : 'Swap between base cryptocurrencies'}</h2>
            <p className="text-gray-400 max-w-2xl">
              {cs
                ? 'Cross-chain swapy mezi BTC, ETH, SOL a ZION. EVM corridor je živě (6 chainů, 2 DEX) — non-EVM adaptéry hotové, čekají na deploy.'
                : 'Cross-chain swaps between BTC, ETH, SOL, and ZION. EVM corridor is live (6 chains, 2 DEX) — non-EVM adapters ready, awaiting deploy.'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {swapPairs.map((pair) => {
              const PairIcon = pair.icon;
              const statusConfig = {
                live: { label: cs ? 'Živě' : 'Live', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
                planned: { label: cs ? 'Plánováno' : 'Planned', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: Clock },
                research: { label: cs ? 'Výzkum' : 'Research', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Clock },
              }[pair.status as 'live' | 'planned' | 'research'];
              const StatusIcon = statusConfig.icon;
              return (
                <div key={`${pair.from}-${pair.to}`} className={`zion-rainbow-card p-5 ${pair.border} border`} style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${pair.bg} ${pair.border} border`}>
                        <PairIcon className={`h-5 w-5 ${pair.color}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">{pair.from}</span>
                        <ArrowLeftRight className="h-4 w-4 text-gray-500" />
                        <span className="text-lg font-bold text-white">{pair.to}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full ${statusConfig.bg} ${statusConfig.border} border px-3 py-1 text-[10px] font-semibold ${statusConfig.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed mb-3">{pair.desc}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <Clock className="h-3 w-3" />
                    {pair.eta}
                  </div>
                  {pair.status === 'live' && (
                    <Link href="/defi" className="mt-3 inline-flex items-center gap-1 text-xs text-zion-cyan hover:text-white transition-colors">
                      {cs ? 'Otevřít swap' : 'Open swap'} <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Roadmap ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Roadmapa' : 'Roadmap'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Multichain plán' : 'Multichain plan'}</h2>
          </div>
          <div className="space-y-4">
            {roadmap.map((item, i) => (
              <div key={item.title} className={`zion-rainbow-card p-5 ${item.done ? 'border-emerald-500/20' : 'border-white/10'} border`} style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex items-center gap-3 shrink-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${item.done ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <span className={`text-xs uppercase tracking-wider font-semibold ${item.done ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {item.phase}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">{item.desc}</p>
                  </div>
                  {i < roadmap.length - 1 && (
                    <div className="hidden sm:block w-px h-12 bg-white/10" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Onboarding runbook (original) ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Operační runbook' : 'Operations runbook'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Připojit nový koridór online' : 'Bring a new corridor online'}</h2>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {onboarding.map((block, idx) => (
              <div key={block.title} className="zion-rainbow-sub p-5" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <CircuitBoard className="h-5 w-5 text-zion-cyan" />
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">{cs ? 'Fáze' : 'Stage'} {idx + 1}</p>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white">{block.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Lock className="h-4 w-4 text-zion-gold mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Initiate WARP Transfer ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'WARP transfer' : 'WARP transfer'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Iniciovat WARP transfer' : 'Initiate WARP Transfer'}</h2>
            <p className="text-gray-400 max-w-2xl">
              {cs
                ? 'Sestavte memo pro cross-chain transfer a sledujte stav transakce přes WARP daemon API.'
                : 'Build a memo for cross-chain transfer and track transaction status via the WARP daemon API.'}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Memo Builder */}
            <div className="zion-rainbow-card p-6" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zion-purple/10 border border-zion-purple/20">
                  <CircuitBoard className="h-5 w-5 text-zion-purple" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? 'Memo builder' : 'Memo Builder'}</p>
                  <h3 className="text-xl font-semibold text-white">{cs ? 'Sestavit transfer memo' : 'Build transfer memo'}</h3>
                </div>
              </div>

              <div className="space-y-4">
                {/* Chain selector */}
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? 'Cílový chain' : 'Target chain'}</label>
                  <select
                    value={warpChain}
                    onChange={(e) => setWarpChain(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zion-purple/50 transition-colors"
                  >
                    <option value="ethereum">Ethereum</option>
                    <option value="bitcoin">Bitcoin</option>
                    <option value="solana">Solana</option>
                    <option value="stellar">Stellar</option>
                    <option value="tron">Tron</option>
                  </select>
                </div>

                {/* Recipient address */}
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? 'Adresa příjemce' : 'Recipient address'}</label>
                  <input
                    type="text"
                    value={warpRecipient}
                    onChange={(e) => setWarpRecipient(e.target.value)}
                    placeholder={cs ? 'zion1...' : 'zion1...'}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-purple/50 transition-colors"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? 'Částka' : 'Amount'} (ZION)</label>
                  <input
                    type="number"
                    value={warpAmount}
                    onChange={(e) => setWarpAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-purple/50 transition-colors"
                  />
                </div>

                {/* Generated memo */}
                <div className="zion-rainbow-sub p-4" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? 'Vygenerovaný memo' : 'Generated memo'}</p>
                    <button
                      onClick={copyWarpMemo}
                      disabled={!warpMemo}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {warpCopied ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          {cs ? 'Zkopírováno' : 'Copied'}
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          {cs ? 'Kopírovat memo' : 'Copy Memo'}
                        </>
                      )}
                    </button>
                  </div>
                  <code className="mt-2 block break-all text-sm text-zion-cyan font-mono">
                    {warpMemo || (cs ? 'Vyplňte adresu příjemce...' : 'Enter recipient address...')}
                  </code>
                </div>

                {/* Instructions */}
                <div className="flex items-start gap-2 rounded-xl border border-zion-gold/20 bg-zion-gold/5 p-4">
                  <ArrowRight className="h-4 w-4 text-zion-gold mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-300">
                    {cs
                      ? 'Pošlete ZION na zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7 s tímto memem.'
                      : 'Send ZION to zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7 with this memo.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Transfer Status Tracker */}
            <div className="zion-rainbow-card p-6" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zion-cyan/10 border border-zion-cyan/20">
                  <Search className="h-5 w-5 text-zion-cyan" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? 'Sledování stavu' : 'Status tracker'}</p>
                  <h3 className="text-xl font-semibold text-white">{cs ? 'Sledovat stav transferu' : 'Track transfer status'}</h3>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? 'Transfer ID' : 'Transfer ID'}</label>
                  <div className="mt-2 flex gap-3">
                    <input
                      type="text"
                      value={warpTransferId}
                      onChange={(e) => setWarpTransferId(e.target.value)}
                      placeholder={cs ? 'WARP-...' : 'WARP-...'}
                      onKeyDown={(e) => { if (e.key === 'Enter') checkWarpTransfer(); }}
                      className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-cyan/50 transition-colors"
                    />
                    <button
                      onClick={checkWarpTransfer}
                      disabled={!warpTransferId || warpLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-zion-cyan to-zion-purple px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {warpLoading ? (
                        <>
                          <Activity className="h-4 w-4 animate-pulse" />
                          {cs ? 'Načítání...' : 'Loading...'}
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          {cs ? 'Zkontrolovat' : 'Check Status'}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Status response */}
                {warpTransferStatus !== null && (
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-2">{cs ? 'Odpověď' : 'Response'}</p>
                    <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-xs text-gray-200 font-mono leading-relaxed">
                      <code>{JSON.stringify(warpTransferStatus, null, 2)}</code>
                    </pre>
                  </div>
                )}

                {warpTransferStatus === null && (
                  <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
                    <Lock className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-400">
                      {cs
                        ? 'Zadejte transfer ID pro zobrazení stavu transakce z WARP daemonu.'
                        : 'Enter a transfer ID to query the transaction status from the WARP daemon.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Institutional CTA ── */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="zion-cta-banner">
          <Activity className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{cs ? 'Potřebujete vlastní routing nebo institucionální onboarding?' : 'Need custom routing or institutional onboarding?'}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs
              ? 'Core tým provozuje managed validátory a může pomoci s bootstrapem vašeho koridoru, připojením OTC likvidity nebo přidáním nových chainů. Ozvěte se přes oficiální kanály nebo založte issue na veřejném GitHubu.'
              : 'The core team runs managed validators and can help bootstrap your corridor, connect OTC liquidity, or add new chains. Reach out via official channels or open an issue on the public GitHub.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="https://github.com/Zion-TerraNova" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              {cs ? 'Otevřít GitHub diskuse' : 'Open GitHub discussions'}
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-6 py-3 text-sm font-semibold text-gray-900">
              {cs ? 'Projít integrační docs' : 'Review integration docs'}
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
