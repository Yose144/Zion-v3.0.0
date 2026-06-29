'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import {
  Activity,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  CircuitBoard,
  CloudLightning,
  Globe2,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
  Bitcoin,
  Coins,
  Droplets,
  Clock,
} from 'lucide-react';

const getWarpStats = (cs: boolean) => [
  { label: cs ? 'Plánované koridory' : 'Corridors Planned', value: '4', detail: 'BTC · ETH · SOL · ZION L1', icon: CloudLightning },
  { label: cs ? 'Živé koridory' : 'Live Corridors', value: '1', detail: cs ? 'Ethereum Lock/Mint — Base Mainnet' : 'Ethereum Lock/Mint — Base Mainnet', icon: CheckCircle2 },
  { label: cs ? 'Guardian runtime' : 'Guardian Runtime', value: '5/5', detail: cs ? '5 validatorů aktivních · quorum 2/5' : '5 validators active · quorum 2/5', icon: ShieldCheck },
  { label: cs ? 'Fáze vývoje' : 'Development Phase', value: cs ? 'Fáze 2' : 'Phase 2', detail: cs ? 'ETH live · BTC + SOL v návrhu' : 'ETH live · BTC + SOL in design', icon: Globe2 },
];

const getCorridorRows = (cs: boolean): { title: string; subtitle: string; live: boolean; entries: { label: string; value: string }[] }[] => [
  {
    title: cs ? 'Ethereum Lock/Mint' : 'Ethereum Lock/Mint',
    subtitle: 'wZION ERC-20 · Base Mainnet',
    live: true,
    entries: [
      { label: cs ? 'Validátoři' : 'Validators', value: cs ? '5/5 Guardian validators aktivních · quorum 2/5 · replay-safe' : '5/5 Guardian validators active · quorum 2/5 · replay-safe' },
      { label: cs ? 'Stav' : 'Status', value: cs ? 'Živě na Base Mainnet (chain 8453) · wZION/WETH + wZION/USDC Uniswap V3 pools aktivní' : 'Live on Base Mainnet (chain 8453) · wZION/WETH + wZION/USDC Uniswap V3 pools active' },
      { label: cs ? 'Integrace' : 'Integration', value: cs ? 'EVM peněženky, DeFi swap, DAO treasury, LP stakes, CEX listings' : 'EVM wallets, DeFi swap, DAO treasury, LP stakes, CEX listings' },
    ],
  },
  {
    title: cs ? 'Bitcoin HTLC most' : 'Bitcoin HTLC Bridge',
    subtitle: 'SegWit + Taproot',
    live: false,
    entries: [
      { label: cs ? 'Bezpečnostní model' : 'Security Model', value: 'HTLC · 2-of-3 multi-sig · 24h timelock' },
      { label: cs ? 'Stav' : 'Status', value: cs ? 'Návrh architektury — gated corridor, ne live launch slib' : 'Architecture design — gated corridor, not a live launch promise' },
      { label: cs ? 'Use case' : 'Use cases', value: cs ? 'Trustless swapy, Lightning exity, OTC bridging' : 'Trustless swaps, Lightning exits, OTC bridging' },
    ],
  },
  {
    title: cs ? 'Solana SPL program' : 'Solana SPL Program',
    subtitle: 'PDA-secured',
    live: false,
    entries: [
      { label: cs ? 'Finalita' : 'Finality', value: cs ? 'Plánovaná integrace Tower BFT' : 'Tower BFT integration planned' },
      { label: cs ? 'Stav' : 'Status', value: cs ? 'Výzkumná fáze — po BTC mostu' : 'Research phase — after BTC bridge' },
      { label: cs ? 'Využití' : 'Utility', value: cs ? 'Game assety, routing likvidity, warp swapy' : 'Game assets, liquidity routing, warp swaps' },
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
    to: 'wZION',
    icon: Bitcoin,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    status: 'planned',
    desc: cs ? 'Bitcoin HTLC most — trustless swapy BTC ↔ wZION přes 2-of-3 multi-sig' : 'Bitcoin HTLC bridge — trustless BTC ↔ wZION swaps via 2-of-3 multi-sig',
    eta: cs ? 'Po BTC corridor launch' : 'After BTC corridor launch',
  },
  {
    from: 'ETH',
    to: 'wZION',
    icon: Droplets,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    status: 'live',
    desc: cs ? 'Uniswap V3 na Base — wZION/WETH pool (1% fee) + wZION/USDC pool (0.3% fee)' : 'Uniswap V3 on Base — wZION/WETH pool (1% fee) + wZION/USDC pool (0.3% fee)',
    eta: cs ? 'Dostupné nyní' : 'Available now',
  },
  {
    from: 'SOL',
    to: 'wZION',
    icon: Coins,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    status: 'research',
    desc: cs ? 'Solana SPL program — PDA-secured mint, Tower BFT finalita' : 'Solana SPL program — PDA-secured mint, Tower BFT finality',
    eta: cs ? 'Výzkumná fáze — po BTC mostu' : 'Research phase — after BTC bridge',
  },
  {
    from: 'ZION',
    to: 'wZION',
    icon: ArrowLeftRight,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    status: 'live',
    desc: cs ? 'Nativní L1 ↔ L2 bridge — lock ZION na L1, mint wZION na Base (1:1 peg)' : 'Native L1 ↔ L2 bridge — lock ZION on L1, mint wZION on Base (1:1 peg)',
    eta: cs ? 'Dostupné nyní' : 'Available now',
  },
];

const getRoadmap = (cs: boolean) => [
  {
    phase: cs ? 'Fáze 1 (Hotovo)' : 'Phase 1 (Done)',
    title: cs ? 'Ethereum Corridor' : 'Ethereum Corridor',
    desc: cs ? 'wZION ERC-20 na Base Mainnet, Uniswap V3 pools, 5/5 Guardian validators, bridge relay live' : 'wZION ERC-20 on Base Mainnet, Uniswap V3 pools, 5/5 Guardian validators, bridge relay live',
    done: true,
  },
  {
    phase: cs ? 'Fáze 2 (Aktivní)' : 'Phase 2 (Active)',
    title: cs ? 'DEX Liquidity + CEX Listings' : 'DEX Liquidity + CEX Listings',
    desc: cs ? 'Seed liquidity na Uniswap V3, DexScreener integrace, CEX listing aplikace (XT.COM, Azbit, P2B, KuCoin, Gate.io)' : 'Seed liquidity on Uniswap V3, DexScreener integration, CEX listing applications (XT.COM, Azbit, P2B, KuCoin, Gate.io)',
    done: true,
  },
  {
    phase: cs ? 'Fáze 3 (Plánováno)' : 'Phase 3 (Planned)',
    title: cs ? 'Bitcoin HTLC Bridge' : 'Bitcoin HTLC Bridge',
    desc: cs ? 'SegWit + Taproot HTLC most, 2-of-3 multi-sig, 24h timelock, Lightning exity, OTC bridging' : 'SegWit + Taproot HTLC bridge, 2-of-3 multi-sig, 24h timelock, Lightning exits, OTC bridging',
    done: false,
  },
  {
    phase: cs ? 'Fáze 4 (Výzkum)' : 'Phase 4 (Research)',
    title: cs ? 'Solana SPL + Multi-chain AMM' : 'Solana SPL + Multi-chain AMM',
    desc: cs ? 'Solana SPL program s PDA-secured mint, Tower BFT finalita, AMM routing pro cross-chain swapy' : 'Solana SPL program with PDA-secured mint, Tower BFT finality, AMM routing for cross-chain swaps',
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

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
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
                  ? 'Trustless Bitcoin swapy, Ethereum lock/mint na Base Mainnet, Solana SPL mint a AMM routing z jedné konzole. Ethereum corridor je živě — BTC a SOL v návrhu.'
                  : 'Trustless Bitcoin swaps, Ethereum lock/mint on Base Mainnet, Solana SPL mint and AMM routing from one console. Ethereum corridor is live — BTC and SOL in design.'}
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
                ? 'Plánované cross-chain swapy mezi BTC, ETH, SOL a wZION. Ethereum a ZION L1 koridory jsou živé — BTC a SOL v návrhu.'
                : 'Planned cross-chain swaps between BTC, ETH, SOL, and wZION. Ethereum and ZION L1 corridors are live — BTC and SOL in design.'}
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
