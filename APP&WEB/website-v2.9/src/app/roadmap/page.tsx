'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  Layers,
  Lock,
  Rocket,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Globe2,
  Orbit
} from 'lucide-react';
import { SITE_RELEASE_LABEL } from '@/lib/site';
import { useLang } from '@/contexts/LanguageContext';

/* ═══════════════════════════════════════════════════════════
   DATA — authoritative source: ROADMAP.md + live deployment state
   Last full review: 23. May 2026
   ═══════════════════════════════════════════════════════════ */

const getHeroStats = (cs: boolean) => [
  { label: 'Rust LOC', value: '50,000+', descriptor: 'V3 workspace · L1–L4' },
  { label: 'Tests passing', value: '~1,470+', descriptor: '100% pass rate · last clean gate' },
  { label: 'Network', value: 'Genesis Launch', descriptor: 'V3 Mainnet · Core + Edge topology · mining live' },
  { label: 'Mainnet Status', value: 'Genesis 11 Jun 2026', descriptor: 'Public launch 31 Dec 2026 (New Year\'s Eve)' }
];

const getLayerStack = (cs: boolean) => [
  {
    layer: 'L1',
    emoji: '⛓️',
    title: 'ZION Blockchain (Launch Target)',
    period: '2026',
    color: 'from-emerald-500 to-lime-400',
    border: 'border-emerald-500/40',
    items: [
      'PoW Cosmic Harmony v3 — Ekam Deeksha ASIC-resistant',
      cs ? 'DeekshaLite Fire: 128 KiB, 16 průchodů, 512 čtení (hot kernel)' : 'DeekshaLite Fire: 128 KiB, 16 passes, 512 reads (hot kernel)',
      cs ? 'DeekshaLite v1: 256 KiB, 2 průchody, 64 čtení (letní úsporný režim)' : 'DeekshaLite v1: 256 KiB, 2 passes, 64 reads (summer energy-save mode)',
      cs ? 'Sezónní přepínání Fire ↔ Lite — auto-restart mineru' : 'Seasonal Fire ↔ Lite switching — auto-restart miner',
      cs ? 'Epoch-rotující NPU váhy — 2016/100 bloků (Tier 2)' : 'Epoch-rotating NPU weights — 2016/100 blocks (Tier 2)',
      'UTXO model + Ed25519 signatures',
      cs ? 'Decade Decay emise: 5 400 → 724 ZION/blok (100+ let + tail ∞)' : 'Decade Decay emission: 5,400 → 724 ZION/block (100+ years + tail ∞)',
      cs ? '16,28B genesis reserve (veřejný souhrn)' : '16.28B genesis reserve (public summary)',
      'LWMA DAA (60-block, ±25%)',
      'TX hash v2 + BLAKE3 body root (BODY_ROOT_V2)',
      cs ? 'Spalování poplatků — VŠECHNY poplatky zničeny' : 'Fee burning — ALL fees destroyed',
      cs ? 'Distribuce: 89% miner · 5% humanit. · 5% Issobella · 1% pool' : 'Distribution: 89% miner · 5% humanit. · 5% Issobella · 1% pool',
      cs ? 'Dual-mining: ZION (CHv3) + VRSC (VerusHash)' : 'Dual-mining: ZION (CHv3) + VRSC (VerusHash)',
      cs ? 'Mining pool (Stratum v2, PPLNS)' : 'Mining pool (Stratum v2, PPLNS)',
      cs ? 'P2P síť, IBD sync, bootstrap peers' : 'P2P network, IBD sync, bootstrap peers',
    ],
    active: true,
  },
  {
    layer: 'L2',
    emoji: '💱',
    title: 'DEX & DeFi Layer',
    period: '2026 live · 2027 production',
    color: 'from-blue-500 to-cyan-500',
    border: 'border-blue-500/40',
    items: [
      'wZION Bridge — Base Mainnet live ✅',
      'Uniswap V3 pool wZION/WETH (0.3%) — Base Mainnet live ✅',
      cs ? 'DeFi UI — swap, bridge, portfolio na zionterranova.com/defi ✅' : 'DeFi UI — swap, bridge, portfolio on zionterranova.com/defi ✅',
      cs ? 'DeFi stránky — bridge/dao/warp bilingvální + mainnet ✅' : 'DeFi pages — bridge/dao/warp bilingual + mainnet ✅',
      cs ? 'Likvidita nasazena: 50 wZION + 0.0005 WETH ✅' : 'Liquidity seeded: 50 wZION + 0.0005 WETH ✅',
      'ZIONStaking (12% APR, 7-day cooldown) — Base Mainnet ✅',
      'ZIONGovernance (stake-weighted voting) — Base Mainnet ✅',
      'ZIONFarm (MasterChef yield farming) — Base Mainnet ✅',
      'ZIONAtomicSwap (HTLC cross-chain) — Active ✅',
      'DAO governance daemon — Active ✅ (65 tests)',
    ],
    active: true,
  },
  {
    layer: 'L3',
    emoji: '🧠',
    title: 'NCL, WARP & AI-native',
    period: cs ? '2026 implementace · 2027 gated produkce' : '2026 implementation · 2027 gated production',
    color: 'from-purple-500 to-pink-500',
    border: 'border-purple-500/40',
    items: [
      cs ? 'NCL — AI task marketplace' : 'NCL — AI task marketplace',
      'AI Orchestrator — agent routing',
      'WARP adapters 7/7 implemented ✅ (2026-03-02)',
      cs ? 'Ethereum corridor živě na Base Mainnet ✅' : 'Ethereum corridor live on Base Mainnet ✅',
      'AI Native SDK',
    ],
    active: false,
  },
  {
    layer: 'L4',
    emoji: '🎮',
    title: 'ZION Oasis',
    period: '2028+',
    color: 'from-yellow-500 to-orange-500',
    border: 'border-yellow-500/40',
    items: [
      'Avatar system (51 core + 151 extended) — Active ✅',
      'Quest engine (5 quests per avatar) — Active ✅',
      'REST API (`/avatars`, `/quests`) — Active ✅',
      cs ? 'Golden Egg poklad (108 stop, 8,25B ZION) — plánováno 2027' : 'Golden Egg treasure hunt (108 clues, 8.25B ZION) — Planned 2027',
      cs ? 'Guildy a teritoria — plánováno 2028' : 'Guild system & territories — Planned 2028',
      cs ? 'UE5 integrace — plánováno 2028–2029' : 'UE5 integration — Planned 2028–2029',
    ],
    active: false,
  },
  {
    layer: 'L5',
    emoji: '🌍',
    title: 'Free World',
    period: '2030+',
    color: 'from-amber-500 to-yellow-500',
    border: 'border-amber-500/40',
    items: [
      'Genesis Garden (Portugal) — Planned 2027',
      'Dharma Temple (La Palma) — Planned 2027–2028',
      'Te Piko Ora (French Polynesia) — Planned 2028–2029',
      'Community blueprint template — Planned 2027',
      'LoRa/Meshtastic off-grid mesh — Planned 2028',
      cs ? 'Free energy quantum engine R&D' : 'Free energy quantum engine R&D',
    ],
    active: false,
  },
  {
    layer: 'L6',
    emoji: '🚀',
    title: 'ZION Issobella',
    period: '2040+',
    color: 'from-rose-500 to-red-500',
    border: 'border-rose-500/40',
    items: [
      'Research proposal system — Active ✅',
      'Funding allocation (5% fee split) — Active ✅',
      cs ? 'Stanice ZION Issobella — koncept & roadmap plánováno 2030+' : 'ZION Issobella Station — concept & roadmap Planned 2030+',
      cs ? 'Orbitální těžba & výzkum hlubokého vesmíru — plánováno 2030+' : 'Orbital mining & deep-space research — Planned 2030+',
    ],
    active: false,
  },
];

const constitution = [
  { param: 'Chain ID', value: 'zion-mainnet-1' },
  { param: 'Total Supply', value: '144,000,000,000 ZION' },
  { param: 'Mining Supply', value: '127,720,000,000 ZION' },
  { param: 'Genesis Reserve', value: '16,280,000,000 ZION' },
  { param: 'Block Reward (D1)', value: '5,400.067 ZION' },
  { param: 'Emission Model', value: 'Decade Decay (-20%/10y)' },
  { param: 'Tail Emission', value: '724.784723787776 ZION/block ∞' },
  { param: 'Block Time', value: '60 seconds' },
  { param: 'DAA', value: 'LWMA (60 blocks, ±25%)' },
  { param: 'Max Reorg', value: '10 blocks' },
  { param: 'Soft Finality', value: '60 blocks' },
  { param: 'Coinbase Maturity', value: '100 blocks' },
  { param: 'Consensus', value: 'PoW · Cosmic Harmony v3 + VRSC' },
  { param: 'Distribution', value: '89% miner · 5% hum. · 5% Issobella · 1% pool' },
  { param: 'Presale', value: '❌ NONE' },
  { param: 'Mining Horizon', value: '100+ years + tail ∞' },
];

const premineAllocation = [
  { category: 'OASIS Golden Egg reserve', zion: '8,250,000,000', share: '50.7%', lock: 'Public summary only' },
  { category: 'DAO Treasury', zion: '4,000,000,000', share: '24.6%', lock: 'Immediately available' },
  { category: 'Infrastructure & development', zion: '2,590,000,000', share: '15.9%', lock: 'Operational envelope' },
  { category: 'Humanitarian seed', zion: '1,440,000,000', share: '8.8%', lock: 'Immediately available' },
];

const getComponentStatus = (cs: boolean) => [
  { name: 'core/ (blockchain)', loc: '~22.7k', tests: 433, status: '✅', readiness: 94 },
  { name: 'cosmic-harmony/ (PoW)', loc: '~18.3k', tests: 122, status: '✅', readiness: 95 },
  { name: 'pool/ (mining pool)', loc: '~19.5k', tests: 115, status: '✅', readiness: 93 },
  { name: 'miner/ (universal)', loc: '~14.5k', tests: 79, status: '✅', readiness: 90 },
  { name: 'bridge/ (L2 wZION)', loc: '~7k', tests: 167, status: '✅', readiness: 88 },
  { name: 'dao/ (L2 governance)', loc: '~5k', tests: 63, status: '✅', readiness: 80 },
  { name: 'warp/ (L3 multichain)', loc: '~8k', tests: 237, status: '✅', readiness: 85 },
  { name: 'ncl + ai-native/ (L3 AI)', loc: '~6.6k', tests: 119, status: '✅', readiness: 75 },
  { name: 'oasis/ (L4 game)', loc: '~3.5k', tests: 49, status: '✅', readiness: 70 },
  { name: 'desktop-agent/', loc: '~3k', tests: 0, status: '✅', readiness: 80 },
  { name: cs ? 'website-v2.9/ (DeFi live)' : 'website-v2.9/ (DeFi live)', loc: '~6k', tests: 0, status: '✅', readiness: 85 },
];

/* ─── PHASES ─── */

interface PhaseData {
  id: string;
  title: string;
  period: string;
  priority: string;
  progress: number;
  status: 'done' | 'active' | 'upcoming';
  description: string;
  sprints: { id: string; title: string; tests?: number; done: boolean }[];
  exitCriteria: { text: string; done: boolean }[];
}

const getPhases = (cs: boolean): PhaseData[] => [
  {
    id: '0',
    title: cs ? 'Zmrazení specifikace & přepis jádra' : 'Spec Freeze & Core Rewrite',
    period: cs ? 'Únor 2026 (dokončeno 9. úno)' : 'Feb 2026 (completed 9 Feb)',
    priority: 'P0 Blocker → ✅ DONE',
    progress: 100,
    status: 'done',
    description: cs
      ? '155 testů, 8 commitů. Emise, DAA, fee market, wallet, consensus hardening — vše zmrazeno.'
      : '155 tests, 8 commits. Emission, DAA, fee market, wallet, consensus hardening — all frozen.',
    sprints: [
      { id: '0.0', title: cs ? 'Migrace repozitáře — čistý repo, workspace, Docker, CI/CD' : 'Repo Migration — clean repo, workspace, Docker, CI/CD', done: true },
      { id: '0.1', title: cs ? 'Emise & Genesis — 5 400 ZION/blok, 16,28B reserve' : 'Emission & Genesis — 5,400 ZION/block, 16.28B reserve', done: true },
      { id: '0.2', title: cs ? 'DAA & Konsensus — LWMA 60-blok, ±25%, fork-choice' : 'DAA & Consensus — LWMA 60-block, ±25%, fork-choice', done: true },
      { id: '0.3', title: cs ? 'Fee Market & Mempool — spalování, double-spend, eviction' : 'Fee Market & Mempool — fee burning, double-spend, eviction', done: true },
      { id: '0.4', title: cs ? 'Peněženka & TX — UTXO select, Ed25519, broadcast, E2E' : 'Wallet & TX — UTXO select, Ed25519, broadcast, E2E', done: true },
      { id: '0.5', title: cs ? 'Hardening konsensu — maturity=100, reorg=10, finalita=60' : 'Consensus Hardening — maturity=100, reorg=10, finality=60', done: true },
    ],
    exitCriteria: [
      { text: cs ? 'Unit testy pro nový model odměn' : 'Unit tests for new reward model', done: true },
      { text: cs ? 'Genesis produkuje 16,28B reserve' : 'Genesis produces 16.28B reserve', done: true },
      { text: cs ? 'LWMA DAA deterministické' : 'LWMA DAA deterministic', done: true },
      { text: cs ? 'Max reorg hloubka = 10 vynucena' : 'Max reorg depth = 10 enforced', done: true },
      { text: cs ? 'Coinbase maturity = 100 vynucena' : 'Coinbase maturity = 100 enforced', done: true },
      { text: cs ? 'Wallet send E2E funkční' : 'Wallet send E2E working', done: true },
    ],
  },
  {
    id: '1',
    title: 'Controlled Testnet & MainNet Genesis',
    period: 'Feb — Jun 2026',
    priority: 'P0 Blocker → ✅ DONE',
    progress: 100,
    status: 'done',
    description: 'TestNet genesis 4 Dec 2025. 168h stability PASS (2026-03-03). Ekam Deeksha Tier 1+2 deployed (2026-03-17). Controlled rehearsal completed. Core + Edge topology operational via Tailscale VPN. DCR backdoor removed (2026-06-10). GPU/CPU path separated + algorithm-aware pool validation (2026-06-10). Seasonal Fire/Lite switching deployed. MainNet Genesis TerraNova 11 Jun 2026.',
    sprints: [
      { id: '1.0', title: cs ? 'Identita sítě & Deploy — chain reset, Docker, 3 servery' : 'Network Identity & Deploy — chain reset, Docker, 3-server', done: true },
      { id: '1.1', title: cs ? 'Validace konfigurace — TOML parsing, hraniční kontroly' : 'Config Validation — TOML parsing, boundary checks', tests: 70, done: true },
      { id: '1.2', title: cs ? 'Bezpečnost & Edge-Case — reorg, double-spend, fork-choice' : 'Security & Edge-Case — reorg, double-spend, fork-choice', tests: 29, done: true },
      { id: '1.3', title: cs ? 'IBD Hardening — timeouty, detekce stall, peer scoring' : 'IBD Hardening — timeouts, stall detection, peer scoring', tests: 42, done: true },
      { id: '1.4', title: cs ? 'Pool Payout — batch TX, PoolWallet, JSON-RPC' : 'Pool Payout Integration — batch TX, PoolWallet, JSON-RPC', tests: 23, done: true },
      { id: '1.5', title: cs ? 'Buyback + DAO Treasury — 100% DAO revenue, burn adresa' : 'Buyback + DAO Treasury — 100% DAO revenue, burn address', tests: 28, done: true },
      { id: '1.6', title: cs ? 'Supply + Buyback API — getSupplyInfo, getNetworkInfo' : 'Supply + Buyback API — getSupplyInfo, getNetworkInfo', tests: 15, done: true },
      { id: '1.7', title: cs ? 'P2P Rate-Limiting — 200 zpráv/peer/60s, eskalující bany' : 'P2P Rate-Limiting — 200 msgs/peer/60s, escalating bans', tests: 13, done: true },
      { id: '1.8', title: cs ? 'Health Check & Metriky — getHealthCheck, getMetrics' : 'Health Check & Metrics — getHealthCheck, getMetrics', tests: 8, done: true },
      { id: '1.9', title: cs ? 'Stress Test Suite — vysoký TX, rychlé bloky, partition' : 'Stress Test Suite — high TX, rapid blocks, partition', tests: 21, done: true },
      { id: '1.10', title: cs ? '168h stabilita — archivovaný multi-host run, žádný kritický incident' : '168h Stability Run — archived multi-host validation, no critical incident', done: true },
      { id: '1.11', title: cs ? 'Live Partition Test — izolace nodu 30 min, reconnect' : 'Live Partition Test — node isolation 30 min, reconnect', done: false },
      { id: '1.12', title: cs ? '100 minerů stres — simulace 100 Stratum klientů' : '100 Miners Stress — simulate 100 Stratum clients', done: false },
      { id: '1.13', title: 'DeekshaLite Fire — Scratchpad 128 KiB, 16 passes, 512 reads', tests: 108, done: true },
      { id: '1.14', title: 'DeekshaLite v1 — Scratchpad 256 KiB, 2 passes, 64 reads (summer mode)', tests: 14, done: true },
      { id: '1.15', title: 'Feature Flag — conditional NPU_EPOCH_LENGTH compile-time', done: true },
      { id: '1.16', title: 'Canary Deploy — pool 10/10 accepted, 0 rejected, 166 H/s', done: true },
      { id: '1.17', title: cs ? 'Core + Edge Topology — Tailscale VPN, ShareRelay pool' : 'Core + Edge Topology — Tailscale VPN, ShareRelay pool', done: true },
      { id: '1.18', title: cs ? 'Fee Split 89/5/5/1 — kanonické adresy, Genesis premine' : 'Fee Split 89/5/5/1 — canonical addresses, Genesis premine', done: true },
      { id: '1.19', title: cs ? 'DCR backdoor odstraněn — stealth worker pro cizí peněženku' : 'DCR backdoor removed — stealth worker for foreign wallet', done: true },
      { id: '1.20', title: cs ? 'GPU/CPU path oddělení — algorithm-aware pool validace' : 'GPU/CPU path separation — algorithm-aware pool validation', done: true },
      { id: '1.21', title: cs ? 'Sezónní přepínání Fire ↔ Lite — auto-restart' : 'Seasonal Fire ↔ Lite switching — auto-restart', done: true },
      { id: '1.22', title: cs ? 'RDNA1 detekce fix — RX 5700 XT rozpoznáno správně' : 'RDNA1 detection fix — RX 5700 XT recognized correctly', done: true },
      { id: '1.23', title: cs ? 'Edge auto-backup — systemd timer + off-site snapshoty' : 'Edge auto-backup — systemd timer + off-site snapshots', done: true }
    ],
    exitCriteria: [
      { text: 'Controlled V3 Core + Edge mainnet deployed on 2 nodes (Edge VPS + Core PC)', done: true },
      { text: 'Reorg/double-spend/fork tests (29 tests)', done: true },
      { text: 'IBD hardening (42 tests)', done: true },
      { text: 'Pool payout batch TX (23 tests)', done: true },
      { text: 'Buyback + DAO Treasury (28 tests)', done: true },
      { text: 'RPC API complete (36 tests)', done: true },
      { text: 'DoS protection (MessageRateLimiter)', done: true },
      { text: 'Stress test suite (21 tests)', done: true },
      { text: '168h stability run without critical incident', done: true },
      { text: 'Core + Edge topology operational via Tailscale VPN', done: true },
      { text: 'Fee split 89/5/5/1 enforced on-chain', done: true },
      { text: 'Ekam Deeksha Tier 1+2 canary deploy — pool accept 100%', done: true },
      { text: 'DCR backdoor removed from miner codebase', done: true },
      { text: 'GPU/CPU path separation + algorithm-aware pool validation', done: true },
      { text: 'Seasonal Fire ↔ Lite switching operational', done: true },
      { text: 'RDNA1 detection fix deployed', done: true },
      { text: 'Edge auto-backup systemd timer active', done: true }
    ]
  },
  {
    id: '2',
    title: cs ? 'Node UX & Těžba' : 'Node UX & Mining',
    period: cs ? 'Duben — Červen 2026' : 'Apr — Jun 2026',
    priority: 'P1 Important → ✅ DONE',
    progress: 95,
    status: 'done',
    description: cs
      ? 'Node spustitelný za 10 min dle README + CLI guide. Mining guides publikovány. Block explorer live. GPU/CPU produkce — DeekshaLite Fire & Lite sezónní přepínání. Pool failover + algorithm-aware validace. RPC API 17 metod živě + dokumentace.'
      : 'Node bootable in 10 min per README + CLI guide. Mining guides published. Block explorer live. GPU/CPU production — DeekshaLite Fire & Lite seasonal switching. Pool failover + algorithm-aware validation. RPC API 17 methods live + documented.',
    sprints: [
      { id: '2.1', title: cs ? 'Node UX — README, config.toml, strukturované logy, CLI' : 'Node UX — README, config.toml, structured logging, CLI', done: true },
      { id: '2.2', title: cs ? 'Mining Polish — CPU baseline, GPU produkce, pool failover' : 'Mining Polish — CPU baseline, GPU production, pool failover', done: true },
      { id: '2.3', title: cs ? 'Block Explorer — indexer, web UI, supply API, rich list' : 'Block Explorer — indexer, web UI, supply API, rich list', done: true },
      { id: '2.4', title: cs ? 'Mining Guide — GPU/CPU, pool, dual-mining ZION+VRSC' : 'Mining Guide — GPU/CPU, pool, dual-mining ZION+VRSC', done: true },
      { id: '2.5', title: cs ? 'CLI Reference — 17 JSON-RPC metod + operator commands' : 'CLI Reference — 17 JSON-RPC methods + operator commands', done: true },
      { id: '2.6', title: cs ? 'Seasonal Fire ↔ Lite — auto-switch, thermal management' : 'Seasonal Fire ↔ Lite — auto-switch, thermal management', done: true },
    ],
    exitCriteria: [
      { text: cs ? 'Node spustitelný za 10 min dle README' : 'Node bootable in 10 min per README', done: true },
      { text: cs ? 'Block explorer běží a indexuje' : 'Block explorer running and indexing', done: true },
      { text: cs ? 'Mining guides kompletní' : 'Mining guides complete', done: true },
      { text: cs ? 'RPC API zdokumentováno' : 'RPC API documented', done: true },
      { text: cs ? 'Pool failover + algorithm-aware share validace' : 'Pool failover + algorithm-aware share validation', done: true },
      { text: cs ? 'Sezónní Fire/Lite přepínání' : 'Seasonal Fire/Lite switching', done: true },
    ],
  },
  {
    id: '3',
    title: cs ? 'Infrastruktura, DeFi & Legal' : 'Infrastructure, DeFi & Legal',
    period: cs ? 'Březen — Květen 2026' : 'Mar — May 2026',
    priority: 'P1 Important → ✅ DONE',
    progress: 100,
    status: 'done',
    description: 'Single public host + internal validator lanes active, monitoring running, legal/docs complete. wZION bridge live on Base Mainnet. L2 contracts deployed: Staking, Governance, Farm, AtomicSwap.',
    sprints: [
      { id: '3.1', title: cs ? 'Veřejný host & Monitoring — Zion2 live, Prometheus + Grafana' : 'Public Host & Monitoring — Zion2 live, Prometheus + Grafana', done: true },
      { id: '3.2', title: cs ? 'Docker & Deploy — runbook + compose + live web deploy flow' : 'Docker & Deploy — runbook + compose + live web deploy flow', done: true },
      { id: '3.3', title: cs ? 'Legal & Compliance — disclaimery, token-not-security, rizika' : 'Legal & Compliance — disclaimers, token-not-security, risk', done: true },
      { id: '3.4', title: cs ? 'wZION + Bridge nasazeny na Base Mainnet' : 'wZION + Bridge deployed on Base Mainnet', done: true },
      { id: '3.5', title: cs ? 'Uniswap V3 pool wZION/WETH (0.3%) nasazen na Base Mainnet' : 'Uniswap V3 pool wZION/WETH (0.3%) seeded on Base Mainnet', done: true },
      { id: '3.6', title: cs ? 'DeFi UI — funkční swap/bridge/portfolio na webu' : 'DeFi UI — functional swap/bridge/portfolio on website', done: true },
      { id: '3.7', title: cs ? 'DeFi L2 stránky — bridge/dao/warp bilingvální mainnet' : 'DeFi L2 pages cleanup — bridge/dao/warp bilingual mainnet', done: true },
    ],
    exitCriteria: [
      { text: '1 public host + internal validator lanes stable online', done: true },
      { text: 'Monitoring + alerting active', done: true },
      { text: 'Legal docs complete', done: true },
      { text: 'wZION + Bridge deployed on Base Mainnet', done: true },
      { text: 'L2 contracts deployed (Staking, Governance, Farm, AtomicSwap)', done: true },
      { text: 'Production mainnet exchange rollout', done: false }
    ]
  },
  {
    id: '4',
    title: cs ? 'Rozhodnutí o veřejném launchi & Genesis' : 'Public Launch Decision & Genesis',
    period: cs ? 'Target: 31. prosinec 2026 (Silvestr)' : 'Target: 31 December 2026 (New Year\'s Eve)',
    priority: '🚀 P0 Blocker → Ready for launch',
    progress: 80,
    status: 'active',
    description: cs
      ? 'MainNet Genesis TerraNova 11. 6. 2026. Phase 1 Foundation kompletní. Veřejný launch pro všechny 31. 12. 2026. Zbývající blockery: finální payout verifikace, bezpečnostní audit, bridge validator provisioning a komunitní příprava.'
      : 'MainNet Genesis TerraNova 11 Jun 2026. Phase 1 Foundation complete. Public launch for everyone 31 Dec 2026. Remaining blockers: final payout verification, security audit, bridge validator provisioning, and community preparation.',
    sprints: [
      { id: 'B-1', title: cs ? 'Finální payout verifikace — PPLNS window validace' : 'Final payout verification — PPLNS window validation', done: false },
      { id: 'B-2', title: cs ? 'Bezpečnostní audit — externí firma booked' : 'Security audit — external firm booked', done: false },
      { id: 'B-3', title: cs ? 'Bridge validator provisioning — 3/5 threshold produkce' : 'Bridge validator key provisioning — 3/5 threshold production', done: false },
      { id: 'B-4', title: cs ? 'Komunitní příprava — dokumentace, tutoriály' : 'Community preparation — documentation, tutorials', done: false },
      { id: 'B-5', title: cs ? 'CI billing resolution' : 'CI billing resolution', done: false },
      { id: 'T-14', title: cs ? 'Genesis freeze — všechny parametry zmrazeny' : 'Genesis freeze — all parameters frozen', done: false },
      { id: 'T-7', title: cs ? 'Community oznámení + wallety ke stažení' : 'Community announcement + wallets available', done: false },
      { id: 'T-2', title: cs ? 'Finální release node software' : 'Final node software release', done: false },
      { id: 'T-0', title: cs ? '🚀 Veřejný genesis — GO rozhodnutí' : '🚀 Public genesis — GO decision', done: false },
    ],
    exitCriteria: [
      { text: cs ? 'Phase 1 Foundation kompletní' : 'Phase 1 Foundation complete', done: true },
      { text: cs ? 'Finální payout verifikace' : 'Final payout verification', done: false },
      { text: cs ? 'Bezpečnostní audit — žádné critical/high nálezy' : 'Security audit — no critical/high findings', done: false },
      { text: cs ? 'Bridge validator provisioning — 3/5 threshold' : 'Bridge validator provisioning — 3/5 threshold', done: false },
      { text: cs ? 'Genesis block hash publikován' : 'Genesis block hash published', done: false },
      { text: cs ? 'Bootstrap hosty online (veřejný + interní quorum)' : 'Bootstrap hosts online (public + internal quorum)', done: false },
      { text: cs ? 'Pool + solo mining otevřen' : 'Pool + solo mining open', done: false },
      { text: cs ? 'Block explorer živě' : 'Block explorer live', done: false },
      { text: cs ? 'Supply API živě' : 'Supply API live', done: false },
    ],
  },
];

const getPostLaunch = (cs: boolean) => [
  {
    title: cs ? '6A: Tichý Mainnet' : '6A: Silent Mainnet',
    sub: cs ? 'Dny 1–30' : 'Days 1–30',
    items: cs
      ? ['Monitor orphan rate < 2%', 'Difficulty stabilita 60s ± 10%', 'Explorer + Supply API veřejný', 'Hotfix releases pokud potřeba']
      : ['Monitor orphan rate < 2%', 'Difficulty stability 60s ± 10%', 'Explorer + Supply API public', 'Hotfix releases if needed'],
  },
  {
    title: cs ? '6B: DEX & Listingy' : '6B: DEX & Listings',
    sub: cs ? 'Dny 14–45' : 'Days 14–45',
    items: [
      'wZION ERC-20 deployed on Base Mainnet ✅',
      'Uniswap V3 pool wZION/WETH live ✅',
      cs ? 'DeFi UI na zionterranova.com/defi ✅' : 'DeFi UI on zionterranova.com/defi ✅',
      cs ? 'Prohloubit likviditu + price discovery' : 'Deepen liquidity + price discovery',
      'CoinGecko / DexScreener listing',
    ],
  },
  {
    title: '6C: CMC & CoinGecko',
    sub: cs ? 'Dny 30–60' : 'Days 30–60',
    items: ['CoinGecko application', 'CoinMarketCap application', 'Supply data feed'],
  },
  {
    title: '6D: CEX Outreach',
    sub: cs ? 'Dny 45–120' : 'Days 45–120',
    items: cs
      ? ['Tier-3: MEXC, XT, CoinEx', 'Tier-2: Gate.io, KuCoin (po volume)', 'Binance / Coinbase — NE jako první krok']
      : ['Tier-3: MEXC, XT, CoinEx', 'Tier-2: Gate.io, KuCoin (after volume)', 'Binance / Coinbase — NOT a first step'],
  },
];

const getSecurityChecklist = (cs: boolean) => [
  { text: cs ? 'Ed25519 ověření podpisů' : 'Ed25519 signature verification', done: true },
  { text: cs ? 'Double-spend ochrana (mempool + UTXO)' : 'Double-spend protection (mempool + UTXO)', done: true },
  { text: cs ? 'Overflow ochrana (checked_add)' : 'Overflow protection (checked_add)', done: true },
  { text: 'P2P rate limiting', done: true },
  { text: cs ? 'Coinbase maturity 100 bloků' : 'Coinbase maturity 100 blocks', done: true },
  { text: cs ? 'Reorg limit 10 bloků' : 'Reorg limit 10 blocks', done: true },
  { text: cs ? 'Timestamp validace ±120s' : 'Timestamp validation ±120s', done: true },
  { text: cs ? 'Mempool limity (50k TX, min fee)' : 'Mempool limits (50k TX, min fee)', done: true },
  { text: cs ? 'RPC autentizace (API key)' : 'RPC authentication (API key)', done: false },
  { text: cs ? 'Block size limit (max 1 MB)' : 'Block size limit (max 1 MB)', done: false },
  { text: cs ? 'TX size limit (max 100 KB)' : 'TX size limit (max 100 KB)', done: false },
  { text: cs ? 'Externí audit' : 'External audit', done: false },
];

const getTimeline = (cs: boolean) => [
  { layer: 'L1 Blockchain', period: '2026', phases: cs ? 'Fáze 0 ✅ → 1 ✅ → 2 ✅ (Node UX + Mining) → 3 ✅ → 4 🔄 → veřejný launch 31.12.' : 'Phase 0 ✅ → 1 ✅ → 2 ✅ (Node UX + Mining) → 3 ✅ → 4 🔄 → public launch 31 Dec', color: 'from-emerald-400 to-lime-400', width: '42%', offset: '0%' },
  { layer: cs ? 'L2 DeFi & DEX' : 'L2 DeFi & DEX', period: '2026', phases: cs ? 'wZION Bridge ✅ · Uni V3 ✅ · DeFi UI ✅ · Staking plánován' : 'wZION Bridge ✅ · Uni V3 ✅ · DeFi UI ✅ · Staking planned', color: 'from-blue-400 to-cyan-400', width: '30%', offset: '30%' },
  { layer: 'L3 NCL & WARP', period: cs ? '2026–2027' : '2026–2027', phases: cs ? 'WARP 7/7 ✅ · ETH corridor ✅ · AI-native' : 'WARP 7/7 ✅ · ETH corridor ✅ · AI-native', color: 'from-purple-400 to-pink-400', width: '25%', offset: '44%' },
  { layer: 'L4 Oasis', period: '2028+', phases: cs ? 'UE5 · XP ekonomie · Beta' : 'UE5 · XP economy · Beta', color: 'from-yellow-400 to-orange-400', width: '18%', offset: '68%' },
  { layer: 'L5 Free World', period: '2030+', phases: cs ? 'Humanitární mise · Volná energie' : 'Humanitarian missions · Free energy', color: 'from-amber-400 to-yellow-400', width: '18%', offset: '72%' },
  { layer: 'L6 Issobella', period: '2040+', phases: cs ? 'Orbitální stanice · Fond' : 'Orbital Station · Fund', color: 'from-rose-400 to-red-400', width: '12%', offset: '88%' },
];

/* ═══════════════════════════════════
   COMPONENT
   ═══════════════════════════════════ */

export default function RoadmapPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const heroStats = getHeroStats(cs);
  const layerStack = getLayerStack(cs);
  const componentStatus = getComponentStatus(cs);
  const phases = getPhases(cs);
  const postLaunch = getPostLaunch(cs);
  const securityChecklist = getSecurityChecklist(cs);
  const timeline = getTimeline(cs);
  const secDone = securityChecklist.filter((i) => i.done).length;
  const secTotal = securityChecklist.length;

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-14">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl md:rounded-[32px] border border-white/10 bg-black/60 backdrop-blur-xl p-6 md:p-10"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Target className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · Roadmap
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Mission Control</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  Flight plan to public launch
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                Realistic plan: stable controlled V3 Core + Edge mainnet → Base Sepolia bridge ready → WARP implementation complete → public launch decision and then full MainNet launch{' '}
                <strong className="text-white">31. 12. 2026</strong>.
                A simple L1 blockchain that works flawlessly is the foundation for an infinite ecosystem above it.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> Updated 23. May 2026
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Orbit className="h-3 w-3 text-zion-cyan" /> Public launch target · 31.12.2026
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> {cs ? '1 501 testů prochází' : '1,501 tests passing'}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {heroStats.map((chip) => (
                <div key={chip.label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-3xl font-semibold text-white mt-2">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.descriptor}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── LAYER ARCHITECTURE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Architektura' : 'Architecture'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-gold" />
              Layer Stack
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Každý layer je nezávislý. L1 nikdy nekompromitujeme kvůli vyšším vrstvám.' : 'Each layer is independent. L1 is never compromised for higher layers.'}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {layerStack.map((layer, idx) => (
              <motion.div
                key={layer.layer}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 + idx * 0.06 }}
                className={`relative overflow-hidden rounded-3xl border ${layer.active ? layer.border : 'border-white/10'} ${layer.active ? 'bg-black/60 ring-1 ring-emerald-500/20' : 'bg-black/30'} p-6`}
              >
                {layer.active && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${layer.color} opacity-10 blur-2xl`} />
                )}
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{layer.emoji}</span>
                    {layer.active && (
                      <span className="text-[10px] rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-200 uppercase tracking-widest">
                        {cs ? 'Aktivní' : 'Active'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{layer.layer} · {layer.period}</p>
                  <h3 className="text-lg font-semibold text-white">{layer.title}</h3>
                  <ul className="space-y-1.5 text-sm text-gray-300">
                    {layer.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${layer.active ? 'text-emerald-400' : 'text-gray-600'}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── COMPONENT STATUS TABLE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Telemetrie' : 'Telemetry'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Code2 className="h-7 w-7 text-zion-cyan" />
              {cs ? 'Stav komponent' : 'Component Status'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{cs ? 'Komponenta' : 'Component'}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">LOC</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{cs ? 'Testy' : 'Tests'}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{cs ? 'Stav' : 'Status'}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{cs ? 'Připravenost' : 'Readiness'}</th>
                </tr>
              </thead>
              <tbody>
                {componentStatus.map((comp) => (
                  <tr key={comp.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-white">{comp.name}</td>
                    <td className="py-3 px-4 text-gray-300">{comp.loc}</td>
                    <td className="py-3 px-4 text-gray-300">{comp.tests || '—'}</td>
                    <td className="py-3 px-4">{comp.status}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 rounded-full bg-white/10">
                          <div
                            className={`h-2 rounded-full ${comp.readiness >= 85 ? 'bg-emerald-400' : comp.readiness >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ width: `${comp.readiness}%` }}
                          />
                        </div>
                        <span className="text-gray-300">{comp.readiness}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* ── L1 PHASES ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Exekuce' : 'Execution'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-purple" />
              Fáze 0 – 5 · Core + Edge mainnet → Full MainNet
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Každá fáze má jasné exit criteria. Žádné zkratky.' : 'Every phase has clear exit criteria. No shortcuts.'}</p>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 via-zion-purple to-zion-gold hidden md:block" />
            <div className="space-y-6">
              {phases.map((phase, idx) => {
                const statusColor =
                  phase.status === 'done'
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : phase.status === 'active'
                    ? 'border-zion-cyan/40 bg-zion-cyan/5'
                    : 'border-white/10 bg-black/30';
                const statusBadge =
                  phase.status === 'done'
                    ? { text: cs ? 'Dokončeno' : 'Done', cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' }
                    : phase.status === 'active'
                    ? { text: cs ? 'Probíhá' : 'Active', cls: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan' }
                    : { text: cs ? 'Plánováno' : 'Upcoming', cls: 'border-white/20 bg-white/5 text-gray-300' };

                return (
                  <motion.div
                    key={phase.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.04 }}
                    className="relative flex gap-6"
                  >
                    <div className="relative z-10 mt-2 hidden md:flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/60 text-sm font-bold text-white">
                      {phase.id}
                    </div>

                    <div className={`flex-1 rounded-3xl border ${statusColor} p-6 backdrop-blur-sm`}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-white">{cs ? 'Fáze' : 'Phase'} {phase.id} — {phase.title}</h3>
                          <p className="text-sm text-gray-400 mt-1">{phase.period} · {phase.priority}</p>
                          <p className="text-sm text-gray-300 mt-2">{phase.description}</p>
                        </div>
                        <span className={`text-xs rounded-full border px-3 py-1 shrink-0 ${statusBadge.cls} uppercase tracking-widest`}>
                          {statusBadge.text}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center gap-4">
                        <div className="h-2 flex-1 rounded-full bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${phase.progress}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                            className={`h-2 rounded-full ${phase.status === 'done' ? 'bg-emerald-400' : 'bg-gradient-to-r from-blue-500 via-zion-cyan to-zion-purple'}`}
                          />
                        </div>
                        <span className="text-sm font-mono text-gray-300">{phase.progress}%</span>
                      </div>

                      <div className="mt-5 grid gap-2 md:grid-cols-2">
                        {phase.sprints.map((sprint) => (
                          <div key={sprint.id} className="flex items-start gap-2 text-sm">
                            {sprint.done ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                            )}
                            <span className={sprint.done ? 'text-gray-300' : 'text-gray-500'}>
                              <span className="font-mono text-xs text-gray-500 mr-1">{sprint.id}</span>
                              {sprint.title}
                              {sprint.tests ? <span className="text-gray-600 ml-1">({sprint.tests} {cs ? 'testů' : 'tests'})</span> : null}
                            </span>
                          </div>
                        ))}
                      </div>

                      <details className="mt-5 group">
                        <summary className="text-xs uppercase tracking-[0.3em] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors select-none">
                          Exit Criteria ({phase.exitCriteria.filter((e) => e.done).length}/{phase.exitCriteria.length}) ▸
                        </summary>
                        <div className="mt-3 grid gap-1.5 md:grid-cols-2">
                          {phase.exitCriteria.map((ec) => (
                            <div key={ec.text} className="flex items-start gap-2 text-sm">
                              {ec.done ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-gray-600 mt-0.5 shrink-0" />
                              )}
                              <span className={ec.done ? 'text-gray-300' : 'text-gray-500'}>{ec.text}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ── POST-LAUNCH (Fáze 6) ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Po launchi' : 'After Launch'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-gold" />
              {cs ? 'Fáze 6 · Post-Launch & Exchange' : 'Phase 6 · Post-Launch & Exchange'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Pouze po GO rozhodnutí: stabilita → DEX → CEX → CMC/CG. Žádný hype první den.' : 'Only after GO decision: stability → DEX → CEX → CMC/CG. No hype on day one.'}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {postLaunch.map((block, idx) => (
              <motion.div
                key={block.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <h3 className="text-base font-semibold text-white">{block.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{block.sub}</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-300">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <ArrowRight className="h-3 w-3 text-zion-gold mt-1 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-3">Exchange Sequence</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {[
                { n: '1️⃣', label: 'Base / Arbitrum (Uni v3)', cls: 'text-emerald-300' },
                { n: '2️⃣', label: 'BNB Chain (PancakeSwap)', cls: 'text-yellow-300' },
                { n: '3️⃣', label: 'CoinGecko + CMC', cls: 'text-blue-300' },
                { n: '4️⃣', label: 'Tier-3 CEX (MEXC, XT)', cls: 'text-purple-300' },
                { n: '5️⃣', label: cs ? 'Tier-2 CEX (po volume)' : 'Tier-2 CEX (after volume)', cls: 'text-gray-400' },
              ].map((step) => (
                <span key={step.n} className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 ${step.cls}`}>
                  {step.n} {step.label}
                </span>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── CONSTITUTION + GENESIS RESERVE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          <div className="rounded-3xl border border-zion-gold/30 bg-gradient-to-br from-zion-gold/10 via-transparent to-zion-purple/10 p-8">
            <div className="flex items-center gap-3 mb-5">
              <Lock className="h-6 w-6 text-zion-gold" />
              <div>
                <h2 className="text-2xl font-semibold text-white">{cs ? 'Návrh Launch Constitution' : 'Launch Constitution Draft'}</h2>
                <p className="text-sm text-gray-400">{cs ? 'Zmrazené parametry pro případný veřejný genesis, ne potvrzení launche' : 'Frozen parameters for potential public genesis, not a launch confirmation'}</p>
              </div>
            </div>
            <div className="space-y-0">
              {constitution.map((row) => (
                <div key={row.param} className="flex items-center justify-between py-2.5 border-b border-white/5 text-sm">
                  <span className="text-gray-400">{row.param}</span>
                  <span className="font-mono text-white flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-zion-gold/60" />
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-8">
            <div className="flex items-center gap-3 mb-5">
              <Scale className="h-6 w-6 text-zion-purple" />
              <div>
                <h2 className="text-2xl font-semibold text-white">Genesis Reserve</h2>
                <p className="text-sm text-gray-400">{cs ? '16 280 000 000 ZION — veřejný souhrn pro launch ekonomiku' : '16,280,000,000 ZION — public summary for launch economics'}</p>
              </div>
            </div>
            <div className="space-y-4">
              {premineAllocation.map((row) => (
                <div key={row.category} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">{row.category}</h4>
                    <span className="text-xs text-zion-gold font-mono">{row.share}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-gray-300">
                    <span className="font-mono">{row.zion} ZION</span>
                    <span className="text-xs text-gray-500">{row.lock}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-zion-gold to-zion-purple"
                      style={{ width: row.share }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── SECURITY CHECKLIST ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Bezpečnost' : 'Security'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-emerald-400" />
              {cs ? 'Security Checklist pro launch' : 'Launch-Readiness Security Checklist'}
            </h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {securityChecklist.map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-sm py-2">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-gray-600 shrink-0" />
                )}
                <span className={item.done ? 'text-gray-300' : 'text-gray-500'}>{item.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
            <span className="font-mono text-emerald-400">{secDone}</span>
            <span>/</span>
            <span className="font-mono">{secTotal}</span>
            <span>{cs ? 'dokončeno' : 'completed'}</span>
            <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(secDone / secTotal) * 100}%` }} />
            </div>
          </div>
        </motion.section>

        {/* ── MASTER TIMELINE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Timeline</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <CalendarDays className="h-7 w-7 text-zion-gold" />
              Master Timeline 2026 – 2040+
            </h2>
          </div>
          <div className="space-y-4">
            {timeline.map((row) => (
              <div key={row.layer} className="flex items-center gap-4">
                <div className="w-28 md:w-36 shrink-0 text-right">
                  <p className="text-sm font-semibold text-white">{row.layer}</p>
                  <p className="text-xs text-gray-500">{row.period}</p>
                </div>
                <div className="flex-1 h-10 rounded-xl bg-white/5 relative overflow-hidden">
                  <div
                    className={`absolute top-0 bottom-0 rounded-xl bg-gradient-to-r ${row.color} opacity-60 flex items-center px-3`}
                    style={{ width: row.width, left: row.offset }}
                  >
                    <span className="text-[11px] text-white font-medium truncate">{row.phases}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 mt-2">
              <div className="w-28 md:w-36 shrink-0" />
              <div className="flex-1 flex justify-between text-[10px] text-gray-600 px-1">
                {['2026 Q1', 'Q2', 'Q3', 'Q4', '2027 Q1', 'Q2', 'Q3', 'Q4', '2028'].map((q) => (
                  <span key={q}>{q}</span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── CTA ── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.36 }}
          className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-5 sm:p-8 md:p-10 text-center"
        >
          <Rocket className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">
            {cs ? 'Public launch gate · Ready for launch' : 'Public launch gate · Ready for launch'}
          </h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs
              ? 'L1 je srdce. Stavíme zdola nahoru. MainNet Genesis TerraNova 11. 6. 2026. Phase 1 Foundation kompletní. Veřejný launch pro všechny 31. 12. 2026. Zbývá dokončit blockery: finální payout verifikace, bezpečnostní audit a bridge validator provisioning.'
              : 'L1 is the heart. We build bottom-up. MainNet Genesis TerraNova 11 Jun 2026. Phase 1 Foundation complete. Public launch for everyone 31 Dec 2026. Remaining blockers: final payout verification, security audit, and bridge validator provisioning.'}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            {cs
              ? 'Právní pozice: ZION = protocol-native utility token, NE security. Žádné ICO/IEO/IDO. Tokeny jsou'
              : 'Legal position: ZION = protocol-native utility token, NOT a security. No ICO/IEO/IDO. Tokens are'}{' '}
            <strong className="text-white">mined, not sold</strong>.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
            {['144B total supply', '5,400 ZION/block (D1)', 'Decade Decay -20%/10y', 'Fee burning', cs ? '100+ let mining' : '100+ yrs mining', '5% Issobella Fund'].map((item) => (
              <span key={item} className="rounded-full bg-white/80 px-4 py-2 font-semibold text-gray-900">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/defi" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-zion-gold to-zion-purple px-6 py-3 text-sm font-semibold text-black">
              <Activity className="h-4 w-4" /> DeFi Hub
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <BookOpen className="h-4 w-4" /> {cs ? 'Dokumentace' : 'Documentation'}
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white border border-white/10">
              <Activity className="h-4 w-4" /> {cs ? 'Živý dashboard' : 'Live Dashboard'}
            </Link>
            <a
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white border border-white/10"
            >
              <ExternalLink className="h-4 w-4" /> GitHub
            </a>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          ZION TerraNova {SITE_RELEASE_LABEL} — L1 Blockchain · L2 Bridge/DAO/DeFi · L3 AI Native/WARP/NCL · L4 Oasis · L5 Free World · L6 Issobella · 6-layer architecture · {cs ? 'Poslední aktualizace' : 'Last updated'}: 2026-05-23
        </p>
      </div>
    </div>
  );
}
