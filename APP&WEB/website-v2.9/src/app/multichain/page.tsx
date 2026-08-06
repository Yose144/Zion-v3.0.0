'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Globe2,
  Zap,
  ExternalLink,
  Server,
  ShieldCheck,
  Activity,
  Cpu,
  Layers,
  Code2,
  Boxes,
  Bitcoin,
  Coins,
  Droplets,
  ArrowRight,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useState, useCallback, type CSSProperties } from 'react';
import {
  getBridgeStatus,
  formatUptime,
  bridgeEfficiency,
  BRIDGE_CONTRACTS,
  type BridgeStatus,
} from '@/lib/bridge-api';
import { usePolling } from '@/hooks/usePolling';
import {
  getEscrowAddress,
  getPendingHtlcs,
  type HtlcRecord,
} from '@/lib/swap-api';
import { getDAOStats, type DAOStats as DAOStatsType } from '@/lib/dao-api';

/* ── Copy ── */
const MC = {
  hero: { cs: `Multichain · L2 Value Layer`, en: `Multichain · L2 Value Layer` },
  heroSub: { cs: `Jeden unified servis. Pět protokolů. Tridaštní cross-chain infrastruktura.`, en: `One unified service. Five protocols. Cross-chain infrastructure done right.` },
  heroDesc: { cs: `Unified multichain servis spojuje Bridge, WARP, HTLC Swap, ZionDex a DAO do jednoho servisu. 13 chain rodin, 5/7 validator consensus, trustless atomic swaps, AMM routing s intent-based settlement.`, en: `The unified multichain service unifies Bridge, WARP, HTLC Swap, ZionDex, and DAO into a single service. 13 chain families, 5/7 validator consensus, trustless atomic swaps, AMM routing with intent-based settlement.` },
  /* sections */
  bridge: { cs: `Bridge · L1 ↔ L2`, en: `Bridge · L1 ↔ L2` },
  bridgeDesc: { cs: `Lock-mint / burn-release. 1:1 peg, 5/7 Guardian validátory, 60-block L1 finalita. Žádné protokolové poplatky.`, en: `Lock-mint / burn-release. 1:1 peg, 5/7 Guardian validators, 60-block L1 finality. No protocol fees.` },
  warp: { cs: `WARP · Cross-Chain`, en: `WARP · Cross-Chain` },
  warpDesc: { cs: `Universal cross-chain bridge pro 13 chain rodin. EVM, Bitcoin, Solana, Cosmos, Cardano, Lightning, Aptos, NEAR, Sui, TON, Tron, Stellar, ZionL1.`, en: `Universal cross-chain bridge for 13 chain families. EVM, Bitcoin, Solana, Cosmos, Cardano, Lightning, Aptos, NEAR, Sui, TON, Tron, Stellar, ZionL1.` },
  swap: { cs: `Atomic Swap · HTLC`, en: `Atomic Swap · HTLC` },
  swapDesc: { cs: `Trustless cross-chain swap pomocí SHA-256 hashlock + timelock. Žádný třetí stran. Claim nebo refund.`, en: `Trustless cross-chain swap using SHA-256 hashlock + timelock. No third party. Claim or refund.` },
  dex: { cs: `ZionDex · AMM Router`, en: `ZionDex · AMM Router` },
  dexDesc: { cs: `Constant-product AMM s multi-hop routing. Top-N quote paths. Intent-based settlement se solver auction. Synthetic bridge pools pro cross-chain.`, en: `Constant-product AMM with multi-hop routing. Top-N quote paths. Intent-based settlement with solver auction. Synthetic bridge pools for cross-chain.` },
  dao: { cs: `DAO · Governance`, en: `DAO · Governance` },
  daoDesc: { cs: `Multi-layer governance. Proposal lifecycle: Create → Vote → Tally → Quorum → Timelock → Execute. L1 memo scanner. 5-of-7 multi-sig treasury.`, en: `Multi-layer governance. Proposal lifecycle: Create → Vote → Tally → Quorum → Timelock → Execute. L1 memo scanner. 5-of-7 multi-sig treasury.` },
  api: { cs: `API · Endpoints`, en: `API · Endpoints` },
  apiDesc: { cs: `30+ HTTP endpoints na portu 8453. Bridge, WARP, HTLC, DEX, DAO, Wallet, Pool — vše v jednom servisu.`, en: `30+ HTTP endpoints on port 8453. Bridge, WARP, HTLC, DEX, DAO, Wallet, Pool — all in one service.` },
  /* stats */
  chains: { cs: `Chain rodiny`, en: `Chain families` },
  validators: { cs: `Validátory`, en: `Validators` },
  endpoints: { cs: `API endpoints`, en: `API endpoints` },
  tests: { cs: `Testy`, en: `Tests` },
  /* CTA */
  github: { cs: `GitHub · Multi-Chain`, en: `GitHub · Multi-Chain` },
  docs: { cs: `Dokumentace`, en: `Documentation` },
  explorer: { cs: `Explorer`, en: `Explorer` },
  /* status */
  relayOnline: { cs: `Relay Online`, en: `Relay Online` },
  relayOffline: { cs: `Relay Offline`, en: `Relay Offline` },
  liveOnBase: { cs: `Živě na Base`, en: `Live on Base` },
  /* chain families */
  chainFamiliesList: { cs: `EVM (6) · BTC · SOL · TRX · XLM · Cosmos · Cardano · Lightning · Aptos · NEAR · Sui · TON`, en: `EVM (6) · BTC · SOL · TRX · XLM · Cosmos · Cardano · Lightning · Aptos · NEAR · Sui · TON` },
  /* API table */
  method: { cs: `Metoda`, en: `Method` },
  path: { cs: `Cesta`, en: `Path` },
  description: { cs: `Popis`, en: `Description` },
};

/* ── API endpoints table ── */
const API_ENDPOINTS = [
  { group: 'Bridge', endpoints: [
    { m: 'POST', p: '/v1/bridge/submit', d: 'Submit bridge lock/burn transaction' },
  ]},
  { group: 'WARP', endpoints: [
    { m: 'GET', p: '/chains', d: 'List all supported chain families' },
    { m: 'GET', p: '/transfers', d: 'List all cross-chain transfers' },
    { m: 'POST', p: '/transfers/outbound', d: 'Initiate outbound transfer' },
    { m: 'POST', p: '/transfers/inbound', d: 'Report inbound transfer detected' },
    { m: 'POST', p: '/transfers/:id/advance', d: 'Advance transfer state machine' },
  ]},
  { group: 'HTLC Swap', endpoints: [
    { m: 'POST', p: '/v1/multichain/swaps/htlc/lock', d: 'Create HTLC lock' },
    { m: 'POST', p: '/v1/multichain/swaps/htlc/claim', d: 'Claim HTLC with preimage' },
    { m: 'POST', p: '/v1/multichain/swaps/htlc/refund', d: 'Refund expired HTLC' },
    { m: 'GET', p: '/v1/multichain/swaps/htlc/:hash', d: 'Get HTLC status by hashlock' },
  ]},
  { group: 'ZionDex', endpoints: [
    { m: 'GET', p: '/v1/swap/pools', d: 'List all AMM pools' },
    { m: 'POST', p: '/v1/swap/quote', d: 'Single swap quote' },
    { m: 'POST', p: '/v1/swap/quote/multi', d: 'Top-N multi-path quotes' },
    { m: 'POST', p: '/v1/swap/execute', d: 'Execute swap' },
    { m: 'POST', p: '/v1/swap/intent', d: 'Create swap intent' },
    { m: 'POST', p: '/v1/swap/intent/:id/bid', d: 'Submit solver bid' },
    { m: 'POST', p: '/v1/swap/intent/:id/settle', d: 'Settle intent auction' },
  ]},
  { group: 'Wallet', endpoints: [
    { m: 'POST', p: '/v1/wallet/address', d: 'Derive multi-chain address' },
    { m: 'POST', p: '/v1/wallet/sign', d: 'Sign message (EVM/ZionL1)' },
  ]},
  { group: 'Pool', endpoints: [
    { m: 'GET', p: '/v1/pool/stats', d: 'Pool statistics' },
    { m: 'GET', p: '/v1/pool/payouts', d: 'Pool payout history' },
  ]},
  { group: 'General', endpoints: [
    { m: 'GET', p: '/health', d: 'Service health check' },
    { m: 'GET', p: '/v1/multichain/chains', d: 'List connected chains' },
    { m: 'GET', p: '/v1/multichain/contracts', d: 'Contract address registry' },
  ]},
];

/* ── Chain families ── */
const CHAIN_FAMILIES = [
  { name: 'EVM', icon: Coins, chains: 'Base, Ethereum, Arbitrum, Optimism, BSC, Polygon, Avalanche, zkSync, Linea', status: 'live' },
  { name: 'Bitcoin', icon: Bitcoin, chains: 'BTC via mempool.space + HTLC', status: 'live' },
  { name: 'Solana', icon: Zap, chains: 'SPL program adapter', status: 'ready' },
  { name: 'Cosmos', icon: Globe2, chains: 'IBC adapter', status: 'ready' },
  { name: 'Cardano', icon: Layers, chains: 'CBOR encoding', status: 'ready' },
  { name: 'Lightning', icon: Zap, chains: 'BOLT11 + LND REST', status: 'ready' },
  { name: 'Aptos', icon: Boxes, chains: 'BCS encoding', status: 'ready' },
  { name: 'NEAR', icon: Globe2, chains: 'NEAR signer', status: 'ready' },
  { name: 'Sui', icon: Droplets, chains: 'BCS encoding', status: 'ready' },
  { name: 'TON', icon: Server, chains: 'TON Cell encoding', status: 'ready' },
  { name: 'Tron', icon: ArrowLeftRight, chains: 'TRX adapter', status: 'ready' },
  { name: 'Stellar', icon: Globe2, chains: 'XLM adapter', status: 'ready' },
  { name: 'ZionL1', icon: ShieldCheck, chains: 'Native L1 adapter', status: 'live' },
];

/* ── Component ── */
export default function MultichainPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const t = (k: keyof typeof MC) => MC[k][cs ? 'cs' : 'en'];

  /* Bridge status */
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const fetchBridge = useCallback(async () => {
    try { setBridgeStatus(await getBridgeStatus()); } catch { /* ignore */ }
  }, []);
  usePolling(fetchBridge, 15000);

  /* HTLC stats */
  const [escrowAddr, setEscrowAddr] = useState<string>('');
  const [pendingHtlcs, setPendingHtlcs] = useState<HtlcRecord[]>([]);
  const fetchHtlc = useCallback(async () => {
    try {
      const [addrResp, htlcs] = await Promise.all([getEscrowAddress(), getPendingHtlcs()]);
      setEscrowAddr(addrResp?.escrow_address ?? '');
      setPendingHtlcs(htlcs);
    } catch { /* ignore */ }
  }, []);
  usePolling(fetchHtlc, 15000);

  /* DAO stats */
  const [daoStats, setDaoStats] = useState<DAOStatsType | null>(null);
  const fetchDao = useCallback(async () => {
    try { setDaoStats(await getDAOStats()); } catch { /* ignore */ }
  }, []);
  usePolling(fetchDao, 30000);

  const relayOnline = bridgeStatus?.relay_online ?? false;

  return (
    <div className="zion-page">
      <div className="zion-container max-w-6xl space-y-20">

        {/* ═══════════════ HERO ═══════════════ */}
        <section className="pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="zion-rainbow-card p-6 sm:p-8 md:p-10"
            style={{ '--rc': '7, 137, 48' } as CSSProperties}
          >
            <div className="flex flex-col gap-6">
              <div className="zion-kicker border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan">
                <Layers className="h-4 w-4" />
                ZION Multichain
              </div>
              <div>
                <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                  {t('hero')}
                </h1>
                <p className="mt-3 text-lg text-gray-300">{t('heroSub')}</p>
              </div>
              <p className="text-base text-gray-400 max-w-3xl leading-relaxed">
                {t('heroDesc')}
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: t('chains'), value: '13', icon: Globe2, color: 'text-zion-cyan' },
                  { label: t('validators'), value: '5/7', icon: ShieldCheck, color: 'text-zion-gold' },
                  { label: t('endpoints'), value: '30+', icon: Code2, color: 'text-zion-cyan' },
                  { label: t('tests'), value: '562', icon: Activity, color: 'text-zion-cyan' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <s.icon className={`h-5 w-5 ${s.color} mb-1`} />
                    <div className="text-xl font-bold text-white">{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-wrap gap-3">
                <Link href="https://github.com/Zion-TerraNova/v3-Mainnet" target="_blank" className="zion-button-primary text-sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('github')}
                </Link>
                <Link href="/docs" className="zion-button-secondary text-sm">
                  <Code2 className="h-3.5 w-3.5" />
                  {t('docs')}
                </Link>
                <Link href="/explorer" className="zion-button-secondary text-sm">
                  <Activity className="h-3.5 w-3.5" />
                  {t('explorer')}
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══════════════ BRIDGE ═══════════════ */}
        <section id="bridge" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-zion-cyan/10 p-2.5 border border-zion-cyan/20">
              <ArrowLeftRight className="h-6 w-6 text-zion-cyan" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('bridge')}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{t('bridgeDesc')}</p>
            </div>
            <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${relayOnline ? 'bg-zion-cyan/15 text-zion-cyan border border-zion-cyan/30' : 'bg-zion-purple/15 text-zion-purple border border-zion-purple/30'}`}>
              <Activity className="h-3 w-3" />
              {relayOnline ? t('relayOnline') : t('relayOffline')}
            </span>
          </div>

          {/* Bridge stats */}
          {bridgeStatus && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: cs ? 'Locks' : 'Locks', value: bridgeStatus.total_locks ?? '—' },
                { label: cs ? 'Unlocks' : 'Unlocks', value: bridgeStatus.total_unlocks ?? '—' },
                { label: 'Uptime', value: formatUptime(bridgeStatus.uptime_seconds) },
                { label: cs ? 'Efficiency' : 'Efficiency', value: `${bridgeEfficiency(bridgeStatus)}%` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                  <div className="text-lg font-bold text-white">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Bridge widget — link to /defi for full widget */}
          <div className="zion-rainbow-card p-5 sm:p-6" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{cs ? 'Bridge operace' : 'Bridge operations'}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {cs ? 'Lock ZION na L1 → přijmi wZION na Base. Nebo spal wZION → přijmi ZION. 1:1 peg, žádné poplatky.' : 'Lock ZION on L1 → receive wZION on Base. Or burn wZION → receive ZION. 1:1 peg, no fees.'}
                </p>
              </div>
              <Link href="/defi#bridge" className="zion-button-primary text-sm shrink-0">
                <ArrowLeftRight className="h-4 w-4" />
                {cs ? 'Otevřít' : 'Open'}
              </Link>
            </div>
          </div>

          {/* Contracts */}
          <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
            <p className="text-sm text-gray-300">
              <span className="text-zion-cyan font-semibold">{cs ? 'Kontrakty:' : 'Contracts:'}</span>{' '}
              {Object.entries(BRIDGE_CONTRACTS).map(([chain, addr]) => (
                <span key={chain} className="font-mono text-xs">
                  {chain}: <span className="text-zion-gold">{addr}</span>{' '}
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* ═══════════════ WARP ═══════════════ */}
        <section id="warp" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-zion-cyan/10 p-2.5 border border-zion-cyan/20">
              <Globe2 className="h-6 w-6 text-zion-cyan" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('warp')}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{t('warpDesc')}</p>
            </div>
          </div>

          {/* Chain families grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHAIN_FAMILIES.map((cf) => (
              <div
                key={cf.name}
                className={`rounded-xl border p-4 transition-all ${
                  cf.status === 'live'
                    ? 'border-zion-cyan/25 bg-zion-cyan/[0.06]'
                    : 'border-white/10 bg-black/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <cf.icon className={`h-5 w-5 ${cf.status === 'live' ? 'text-zion-cyan' : 'text-gray-400'}`} />
                  <span className="font-semibold text-white text-sm">{cf.name}</span>
                  {cf.status === 'live' && (
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-zion-cyan">● Live</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{cf.chains}</p>
              </div>
            ))}
          </div>

          {/* WARP status + cross-chain swap link */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="zion-rainbow-card p-5" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
              <h3 className="text-lg font-semibold text-white mb-3">
                {cs ? 'Cross-chain swap (LiFi)' : 'Cross-chain swap (LiFi)'}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {cs ? '30+ DEX, 20+ bridge protokolů. wZION na 6 chainech.' : '30+ DEX, 20+ bridge protocols. wZION on 6 chains.'}
              </p>
              <Link href="/defi#swap" className="zion-button-primary text-sm">
                <ArrowRight className="h-4 w-4" />
                {cs ? 'Otevřít LiFi widget' : 'Open LiFi widget'}
              </Link>
            </div>
            <div className="zion-rainbow-card p-5" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
              <h3 className="text-lg font-semibold text-white mb-3">
                {cs ? 'WARP Transfer Status' : 'WARP Transfer Status'}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {cs ? 'Query transfer status by ID. WARP daemon API na portu 8453.' : 'Query transfer status by ID. WARP daemon API on port 8453.'}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-gray-400">{cs ? 'Chain rodiny' : 'Chain families'}</span>
                  <span className="font-mono text-zion-cyan">13</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-gray-400">{cs ? 'Živé koridory' : 'Live corridors'}</span>
                  <span className="font-mono text-zion-cyan">EVM (6)</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-gray-400">{cs ? 'Quorum' : 'Quorum'}</span>
                  <span className="font-mono text-zion-gold">2/5</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-gray-400">{cs ? 'API port' : 'API port'}</span>
                  <span className="font-mono text-zion-cyan">8453</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ SWAP (HTLC) ═══════════════ */}
        <section id="swap" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-zion-gold/10 p-2.5 border border-zion-gold/20">
              <Zap className="h-6 w-6 text-zion-gold" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('swap')}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{t('swapDesc')}</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-zion-gold/15 text-zion-gold border border-zion-gold/30 px-3 py-1 text-xs font-semibold">
              <Activity className="h-3 w-3" />
              {pendingHtlcs.length} {cs ? 'aktivních' : 'active'}
            </span>
          </div>

          {/* HTLC stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
              <div className="text-lg font-bold text-white font-mono text-xs break-all">{escrowAddr || '—'}</div>
              <div className="text-xs text-gray-500 mt-1">{cs ? 'Escrow adresa' : 'Escrow address'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
              <div className="text-lg font-bold text-white">{pendingHtlcs.length}</div>
              <div className="text-xs text-gray-500">{cs ? 'Aktivní HTLC' : 'Active HTLC'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
              <div className="text-lg font-bold text-white">100 ZION</div>
              <div className="text-xs text-gray-500">{cs ? 'Minimum' : 'Minimum'}</div>
            </div>
          </div>

          {/* HTLC pending table */}
          {pendingHtlcs.length > 0 && (
            <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
              <h3 className="text-sm font-semibold text-white mb-3">{cs ? 'Aktivní HTLC zámky' : 'Active HTLC Locks'}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/10">
                      <th className="text-left py-2 px-2">{cs ? 'Hashlock' : 'Hashlock'}</th>
                      <th className="text-right py-2 px-2">{cs ? 'Částka' : 'Amount'}</th>
                      <th className="text-left py-2 px-2">{cs ? 'Chain' : 'Chain'}</th>
                      <th className="text-left py-2 px-2">{cs ? 'Timelock' : 'Timelock'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingHtlcs.slice(0, 10).map((h) => (
                      <tr key={h.hash_hex} className="border-b border-white/5">
                        <td className="py-2 px-2 font-mono text-zion-gold text-[10px]">{h.hash_hex.slice(0, 16)}…</td>
                        <td className="py-2 px-2 text-right text-white">{h.amount_flowers} ZION</td>
                        <td className="py-2 px-2 text-gray-300">{h.target_chain}</td>
                        <td className="py-2 px-2 text-gray-400">{h.timeout_mins}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HTLC info — full swap functionality is embedded above via widgets */}
          <div className="zion-rainbow-card p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
            <h3 className="text-lg font-semibold text-white mb-2">{cs ? 'HTLC Atomic Swap' : 'HTLC Atomic Swap'}</h3>
            <p className="text-sm text-gray-400">
              {cs ? 'Vytvoř lock, claim nebo refund pomocí SHA-256 hashlock + timelock. Escrow adresa drží tokeny do claimu/refundu. Minimum 100 ZION na lock.' : 'Create lock, claim, or refund using SHA-256 hashlock + timelock. Escrow holds tokens until claim/refund. Minimum 100 ZION per lock.'}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/30 p-2 text-center">
                <div className="text-white font-semibold">SHA-256</div>
                <div className="text-gray-500">Hashlock</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-2 text-center">
                <div className="text-white font-semibold">Timelock</div>
                <div className="text-gray-500">{cs ? 'Refund' : 'Refund'}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-2 text-center">
                <div className="text-white font-semibold">Trustless</div>
                <div className="text-gray-500">{cs ? 'Bez 3. strany' : 'No 3rd party'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ DEX ═══════════════ */}
        <section id="dex" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-zion-purple/10 p-2.5 border border-zion-purple/20">
              <Cpu className="h-6 w-6 text-zion-purple" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('dex')}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{t('dexDesc')}</p>
            </div>
          </div>

          {/* DEX widgets — link to /defi for full widgets */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="zion-rainbow-card p-5" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
              <h3 className="text-lg font-semibold text-white mb-2">{cs ? 'Cross-chain swap' : 'Cross-chain swap'}</h3>
              <p className="text-sm text-gray-400 mb-4">
                {cs ? 'ZionDex Router API. Multi-hop routing. Top-N quote paths.' : 'ZionDex Router API. Multi-hop routing. Top-N quote paths.'}
              </p>
              <Link href="/defi#swap" className="zion-button-primary text-sm">
                <ArrowRight className="h-4 w-4" />
                {cs ? 'Otevřít swap' : 'Open swap'}
              </Link>
            </div>
            <div className="zion-rainbow-card p-5" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
              <h3 className="text-lg font-semibold text-white mb-2">{cs ? 'wZION / ETH na Base' : 'wZION / ETH on Base'}</h3>
              <p className="text-sm text-gray-400 mb-4">
                {cs ? 'Uniswap V3 pool. 0.3% fee. 1% slippage tolerance.' : 'Uniswap V3 pool. 0.3% fee. 1% slippage tolerance.'}
              </p>
              <Link href="/defi#swap" className="zion-button-primary text-sm">
                <ArrowRight className="h-4 w-4" />
                {cs ? 'Otevřít swap' : 'Open swap'}
              </Link>
            </div>
          </div>

          {/* ZionDex Dashboard link */}
          <div className="zion-rainbow-card p-5" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">ZionDex Dashboard</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {cs ? 'Plný dashboard: Swap, Liquidity, Portfolio, Bridge, Atomic.' : 'Full dashboard: Swap, Liquidity, Portfolio, Bridge, Atomic.'}
                </p>
              </div>
              <Link href="/defi" className="zion-button-primary text-sm shrink-0">
                <ArrowRight className="h-4 w-4" />
                {cs ? 'Otevřít' : 'Open'}
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════ DAO ═══════════════ */}
        <section id="dao" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-zion-purple/10 p-2.5 border border-zion-purple/20">
              <ShieldCheck className="h-6 w-6 text-zion-purple" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('dao')}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{t('daoDesc')}</p>
            </div>
          </div>

          {/* DAO stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: cs ? 'Treasury' : 'Treasury', value: daoStats ? `${(daoStats.treasury_balance / 1e6).toFixed(2)}M ZION` : '—', icon: Coins, color: 'text-zion-gold' },
              { label: cs ? 'Proposals' : 'Proposals', value: daoStats?.governance?.total_proposals?.toString() ?? '—', icon: ShieldCheck, color: 'text-zion-purple' },
              { label: cs ? 'Active' : 'Active', value: daoStats?.active?.toString() ?? '—', icon: Activity, color: 'text-zion-cyan' },
              { label: cs ? 'Quorum' : 'Quorum', value: daoStats ? `${daoStats.quorum_percent}%` : '—', icon: Layers, color: 'text-zion-cyan' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                <s.icon className={`h-5 w-5 ${s.color} mx-auto mb-1`} />
                <div className="text-lg font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* DAO info */}
          <div className="zion-rainbow-sub p-4" style={{ '--rc': '59, 130, 246' } as CSSProperties}>
            <p className="text-sm text-gray-300">
              <span className="text-zion-purple font-semibold">{cs ? 'Governance fáze:' : 'Governance phases:'}</span>{' '}
              {cs ? 'Fáze 1 (Stewardship 2025) → Fáze 2 (Hybrid DAO 2026) → Fáze 3 (Full DAO 2026+). L1 memo scanner parsuje \'DAO:vote:<id>:yes\' formát. Multi-sig treasury 5-of-7 s daily limits.' : 'Phase 1 (Stewardship 2025) → Phase 2 (Hybrid DAO 2026) → Phase 3 (Full DAO 2026+). L1 memo scanner parses \'DAO:vote:<id>:yes\' format. Multi-sig treasury 5-of-7 with daily limits.'}
            </p>
          </div>
        </section>

        {/* ═══════════════ API ═══════════════ */}
        <section id="api" className="space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gray-500/10 p-2.5 border border-gray-500/20">
              <Code2 className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('api')}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{t('apiDesc')}</p>
            </div>
            <span className="ml-auto font-mono text-sm text-zion-cyan">127.0.0.1:8453</span>
          </div>

          {/* API table */}
          <div className="zion-rainbow-card p-5" style={{ '--rc': '107, 114, 128' } as CSSProperties}>
            <div className="space-y-4">
              {API_ENDPOINTS.map((group) => (
                <div key={group.group}>
                  <h3 className="text-sm font-semibold text-zion-gold uppercase tracking-wider mb-2">
                    {group.group}
                  </h3>
                  <div className="space-y-1">
                    {group.endpoints.map((ep) => (
                      <div
                        key={ep.p}
                        className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs"
                      >
                        <span className={`font-mono font-bold w-12 shrink-0 ${
                          ep.m === 'GET' ? 'text-zion-cyan' :
                          ep.m === 'POST' ? 'text-zion-gold' : 'text-gray-400'
                        }`}>
                          {ep.m}
                        </span>
                        <span className="font-mono text-white shrink-0">{ep.p}</span>
                        <span className="text-gray-500 ml-auto text-right">{ep.d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
