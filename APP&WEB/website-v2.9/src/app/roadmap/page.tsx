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
  Lock,
  Rocket,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Globe2,
} from 'lucide-react';
import { SITE_RELEASE_LABEL } from '@/lib/site';
import { useLang } from '@/contexts/LanguageContext';

const t = {
  cs: {
    badge: `${SITE_RELEASE_LABEL} · Roadmap`,
    missionControl: 'Mission Control',
    title: 'Plán letu k veřejnému launchi',
    subtitle: 'One Love Mainnet Stable — node, pool i multichain běží v produkci. MainNet Genesis 11. 6. 2026 úspěšný, Bridge/DeFi Run 3.0.6 nasazen, wZION token live na Base Mainnet. Cíl veřejného launchi zůstává ',
    subtitleStrong: '31. 12. 2026',
    updated: 'Aktualizováno 6. 8. 2026',
    publicLaunch: 'Cíl veřejného launchi · 31. 12. 2026',
    testsPassing: '2 155+ testů prochází',
    heroStats: [
      { label: 'Rust LOC', value: '176 000+', descriptor: 'workspace' },
      { label: 'Testů', value: '2 155+', descriptor: '100 % pass rate' },
      { label: 'Síť', value: 'MainNet', descriptor: 'Edge topologie' },
      { label: 'Status', value: 'Genesis 11. 6. 2026', descriptor: 'Launch 31. 12. 2026' },
    ],
    componentStatus: 'Stav komponent',
    componentStatusSub: 'Telemetry',
    component: 'Komponenta',
    loc: 'LOC',
    tests: 'Testy',
    status: 'Stav',
    readiness: 'Připravenost',
    execution: 'Exekuce',
    phasesTitle: 'Fáze 0 – 4 · MainNet → Veřejný launch',
    phasesSub: 'Každá fáze má jasná exit criteria. Žádné zkratky.',
    phase: 'Fáze',
    done: 'Dokončeno',
    active: 'Probíhá',
    upcoming: 'Plánováno',
    testsUnit: 'testů',
    exitCriteria: 'Exit Criteria',
    phase0Title: 'Spec Freeze & Core Rewrite',
    phase0Period: 'Únor 2026',
    phase0Priority: 'P0 Blocker → ✅ DONE',
    phase0Desc: '155 testů, 8 commitů. Emise, DAA, fee market, wallet, consensus hardening — vše zmrazeno.',
    phase1Title: 'Controlled Testnet & MainNet Genesis',
    phase1Period: 'Únor — Červen 2026',
    phase1Priority: 'P0 Blocker → ✅ DONE',
    phase1Desc: 'TestNet genesis 4. 12. 2025. 168h stabilita PASS. Ekam Deekša Tier 1+2 nasazen. Edge topologie v provozu. MainNet Genesis TerraNova 11. 6. 2026.',
    phase2Title: 'Node UX & Těžba',
    phase2Period: 'Duben — Červen 2026',
    phase2Priority: 'P1 Important → ✅ DONE',
    phase2Desc: 'Node spustitelný za 10 min dle README + CLI guide. Mining guides publikovány. Block explorer live. GPU/CPU produkce — DeekshaLite Fire & Lite sezónní přepínání. RPC API 17 metod.',
    phase3Title: 'Infrastruktura, DeFi & Legal',
    phase3Period: 'Březen — Červen 2026',
    phase3Priority: 'P1 Important → ✅ DONE',
    phase3Desc: 'Veřejný host + monitoring, legal/docs complete. wZION bridge live na Base Mainnet. L2 kontrakty nasazeny: Staking, Governance, Farm, AtomicSwap.',
    phase4Title: 'Veřejný launch & Security Closure',
    phase4Period: 'Cíl: 31. 12. 2026',
    phase4Priority: '🚀 P0 Blocker → Active',
    phase4Desc: 'MainNet Genesis 11. 6. 2026. Phase 1 Foundation kompletní. Veřejný launch 31. 12. 2026. Zbývá finální payout verifikace, bezpečnostní audit, bridge validator provisioning a komunitní příprava.',
    afterLaunch: 'Po launchi',
    postLaunchTitle: 'Fáze 5 · Post-Launch & Exchange',
    postLaunchSub: 'Pouze po GO rozhodnutí: stabilita → DEX → CEX → CMC/CG. Žádný hype první den.',
    exchangeSequence: 'Exchange Sequence',
    launchConstitution: 'Launch Constitution',
    launchConstitutionSub: 'Zmrazené parametry pro potenciální veřejný launch',
    genesisReserve: 'Genesis Reserve',
    genesisReserveSub: '16,28B ZION · veřejný souhrn',
    security: 'Bezpečnost',
    securityTitle: 'Launch Readiness Security Checklist',
    securityCompleted: 'dokončeno',
    ctaTitle: 'Public Launch Gate — Ready for launch',
    ctaSubtitle: 'L1 je srdce, které stavíme zdola nahoru. Mainnet běží, L2 je live, vše směřuje k veřejnému launchi.',
    ctaLegal: 'Právní pozice: ZION je nativní protokolní token — ',
    ctaLegalStrong: 'mined, not sold',
    ctaChips: ['144B total supply', '5 400 ZION/block (D1)', 'Decade Decay -20 %/10y', 'Fee burning', '100+ let těžby', '5 % Issobella Fund'],
    documentation: 'Dokumentace',
    liveDashboard: 'Live Dashboard',
    lastUpdated: 'Poslední aktualizace',
  },
  en: {
    badge: `${SITE_RELEASE_LABEL} · Roadmap`,
    missionControl: 'Mission Control',
    title: 'Flight plan to public launch',
    subtitle: 'One Love Mainnet Stable — node, pool, and multichain are in production. MainNet Genesis 11 Jun 2026 successful, Bridge/DeFi Run 3.0.6 deployed, wZION token live on Base Mainnet. Public launch target remains ',
    subtitleStrong: '31 Dec 2026',
    updated: 'Updated 6 Aug 2026',
    publicLaunch: 'Public launch target · 31 Dec 2026',
    testsPassing: '2,155+ tests passing',
    heroStats: [
      { label: 'Rust LOC', value: '176,000+', descriptor: 'workspace' },
      { label: 'Tests', value: '2,155+', descriptor: '100% pass rate' },
      { label: 'Network', value: 'MainNet', descriptor: 'Edge topology' },
      { label: 'Status', value: 'Genesis 11 Jun 2026', descriptor: 'Launch 31 Dec 2026' },
    ],
    componentStatus: 'Component Status',
    componentStatusSub: 'Telemetry',
    component: 'Component',
    loc: 'LOC',
    tests: 'Tests',
    status: 'Status',
    readiness: 'Readiness',
    execution: 'Execution',
    phasesTitle: 'Phase 0 – 4 · MainNet → Public Launch',
    phasesSub: 'Every phase has clear exit criteria. No shortcuts.',
    phase: 'Phase',
    done: 'Done',
    active: 'Active',
    upcoming: 'Upcoming',
    testsUnit: 'tests',
    exitCriteria: 'Exit Criteria',
    phase0Title: 'Spec Freeze & Core Rewrite',
    phase0Period: 'Feb 2026',
    phase0Priority: 'P0 Blocker → ✅ DONE',
    phase0Desc: '155 tests, 8 commits. Emission, DAA, fee market, wallet, consensus hardening — all frozen.',
    phase1Title: 'Controlled Testnet & MainNet Genesis',
    phase1Period: 'Feb – Jun 2026',
    phase1Priority: 'P0 Blocker → ✅ DONE',
    phase1Desc: 'TestNet genesis 4 Dec 2025. 168h stability PASS. Ekam Deeksha Tier 1+2 deployed. Edge topology operational. MainNet Genesis TerraNova 11 Jun 2026.',
    phase2Title: 'Node UX & Mining',
    phase2Period: 'Apr – Jun 2026',
    phase2Priority: 'P1 Important → ✅ DONE',
    phase2Desc: 'Node bootable in 10 min per README + CLI guide. Mining guides published. Block explorer live. GPU/CPU production — DeekshaLite Fire & Lite seasonal switching. RPC API 17 methods.',
    phase3Title: 'Infrastructure, DeFi & Legal',
    phase3Period: 'Mar – Jun 2026',
    phase3Priority: 'P1 Important → ✅ DONE',
    phase3Desc: 'Public host + monitoring, legal/docs complete. wZION bridge live on Base Mainnet. L2 contracts deployed: Staking, Governance, Farm, AtomicSwap.',
    phase4Title: 'Public Launch & Security Closure',
    phase4Period: 'Target: 31 Dec 2026',
    phase4Priority: '🚀 P0 Blocker → Active',
    phase4Desc: 'MainNet Genesis 11 Jun 2026. Phase 1 Foundation complete. Public launch 31 Dec 2026. Remaining blockers: final payout verification, security audit, bridge validator provisioning, and community preparation.',
    afterLaunch: 'After Launch',
    postLaunchTitle: 'Phase 5 · Post-Launch & Exchange',
    postLaunchSub: 'Only after GO decision: stability → DEX → CEX → CMC/CG. No hype on day one.',
    exchangeSequence: 'Exchange Sequence',
    launchConstitution: 'Launch Constitution',
    launchConstitutionSub: 'Frozen parameters for potential public launch',
    genesisReserve: 'Genesis Reserve',
    genesisReserveSub: '16.28B ZION · public summary',
    security: 'Security',
    securityTitle: 'Launch Readiness Security Checklist',
    securityCompleted: 'completed',
    ctaTitle: 'Public Launch Gate — Ready for launch',
    ctaSubtitle: 'L1 is the heart we build bottom-up. Mainnet is live, L2 is live, everything is moving toward public launch.',
    ctaLegal: 'Legal position: ZION is a native protocol token — ',
    ctaLegalStrong: 'mined, not sold',
    ctaChips: ['144B total supply', '5,400 ZION/block (D1)', 'Decade Decay -20%/10y', 'Fee burning', '100+ years mining', '5% Issobella Fund'],
    documentation: 'Documentation',
    liveDashboard: 'Live Dashboard',
    lastUpdated: 'Last updated',
  },
};

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

export default function RoadmapPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const copy = cs ? t.cs : t.en;

  const heroStats = copy.heroStats;

  const componentStatus = [
    { name: 'core/ (blockchain)', loc: '~22.7k', tests: 433, status: '✅', readiness: 94 },
    { name: 'cosmic-harmony/ (PoW)', loc: '~18.3k', tests: 122, status: '✅', readiness: 95 },
    { name: 'pool/ (mining pool)', loc: '~19.5k', tests: 115, status: '✅', readiness: 93 },
    { name: 'miner/ (universal)', loc: '~14.5k', tests: 79, status: '✅', readiness: 90 },
    { name: 'bridge/ (L2 wZION)', loc: '~7k', tests: 167, status: '✅', readiness: 88 },
    { name: 'dao/ (L2 governance)', loc: '~5k', tests: 63, status: '✅', readiness: 80 },
    { name: 'multichain/', loc: '~29k', tests: 574, status: '✅', readiness: 92 },
    { name: 'ncl + ai-native/ (L3 AI)', loc: '~6.6k', tests: 119, status: '✅', readiness: 75 },
    { name: 'oasis/ (L4 game)', loc: '~3.5k', tests: 49, status: '✅', readiness: 70 },
    { name: 'desktop-agent/', loc: '~3k', tests: 0, status: '✅', readiness: 80 },
    { name: cs ? 'website-v2.9/ (DeFi live)' : 'website-v2.9/ (DeFi live)', loc: '~6k', tests: 0, status: '✅', readiness: 85 },
  ];

  const phases: PhaseData[] = [
    {
      id: '0',
      title: copy.phase0Title,
      period: copy.phase0Period,
      priority: copy.phase0Priority,
      progress: 100,
      status: 'done',
      description: copy.phase0Desc,
      sprints: [
        { id: '0.0', title: cs ? 'Migrace repozitáře — čistý repo, workspace, Docker, CI/CD' : 'Repo Migration — clean repo, workspace, Docker, CI/CD', done: true },
        { id: '0.1', title: cs ? 'Emise & Genesis — 5 400 ZION/blok, 16,28B reserve' : 'Emission & Genesis — 5,400 ZION/block, 16.28B reserve', done: true },
        { id: '0.2', title: cs ? 'DAA & Konsensus — LWMA 60-blok, ±25 %, fork-choice' : 'DAA & Consensus — LWMA 60-block, ±25%, fork-choice', done: true },
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
      title: copy.phase1Title,
      period: copy.phase1Period,
      priority: copy.phase1Priority,
      progress: 100,
      status: 'done',
      description: copy.phase1Desc,
      sprints: [
        { id: '1.0', title: cs ? 'Identita sítě & Deploy — chain reset, Docker, 3 servery' : 'Network Identity & Deploy — chain reset, Docker, 3-server', done: true },
        { id: '1.1', title: cs ? 'Validace konfigurace — TOML parsing, hraniční kontroly' : 'Config Validation — TOML parsing, boundary checks', tests: 70, done: true },
        { id: '1.2', title: cs ? 'Bezpečnost & Edge-Case — reorg, double-spend, fork-choice' : 'Security & Edge-Case — reorg, double-spend, fork-choice', tests: 29, done: true },
        { id: '1.3', title: cs ? 'IBD Hardening — timeouty, detekce stall, peer scoring' : 'IBD Hardening — timeouts, stall detection, peer scoring', tests: 42, done: true },
        { id: '1.4', title: cs ? 'Pool Payout — batch TX, PoolWallet, JSON-RPC' : 'Pool Payout Integration — batch TX, PoolWallet, JSON-RPC', tests: 23, done: true },
        { id: '1.5', title: cs ? 'Buyback + DAO Treasury — 100 % DAO revenue, burn adresa' : 'Buyback + DAO Treasury — 100% DAO revenue, burn address', tests: 28, done: true },
        { id: '1.6', title: cs ? 'Supply + Buyback API — getSupplyInfo, getNetworkInfo' : 'Supply + Buyback API — getSupplyInfo, getNetworkInfo', tests: 15, done: true },
        { id: '1.7', title: cs ? 'P2P Rate-Limiting — 200 zpráv/peer/60s, eskalující bany' : 'P2P Rate-Limiting — 200 msgs/peer/60s, escalating bans', tests: 13, done: true },
        { id: '1.8', title: cs ? 'Health Check & Metriky — getHealthCheck, getMetrics' : 'Health Check & Metrics — getHealthCheck, getMetrics', tests: 8, done: true },
        { id: '1.9', title: cs ? 'Stress Test Suite — vysoký TX, rychlé bloky, partition' : 'Stress Test Suite — high TX, rapid blocks, partition', tests: 21, done: true },
        { id: '1.10', title: cs ? '168h stabilita — archivovaný multi-host run, žádný kritický incident' : '168h Stability Run — archived multi-host validation, no critical incident', done: true },
        { id: '1.11', title: cs ? 'Live Partition Test — izolace nodu 30 min, reconnect' : 'Live Partition Test — node isolation 30 min, reconnect', done: false },
        { id: '1.12', title: cs ? '100 minerů stres — simulace 100 Stratum klientů' : '100 Miners Stress — simulate 100 Stratum clients', done: false },
        { id: '1.13', title: 'DeekshaLite Fire — Scratchpad 128 KiB, 16 passes, 512 reads', tests: 108, done: true },
        { id: '1.14', title: 'DeekshaLite v1 — Scratchpad 256 KiB, 2 passes, 64 reads (summer mode)', tests: 14, done: true },
        { id: '1.15', title: 'Fee Split 89/5/5/1 — canonical addresses, Genesis premine', done: true },
        { id: '1.16', title: 'DCR backdoor removed from miner codebase', done: true },
        { id: '1.17', title: 'GPU/CPU path separation + algorithm-aware pool validation', done: true },
        { id: '1.18', title: 'Seasonal Fire ↔ Lite switching operational', done: true },
        { id: '1.19', title: 'Edge auto-backup systemd timer active', done: true },
      ],
      exitCriteria: [
        { text: cs ? 'Controlled V3 Edge server mainnet deployed on 2 nodes' : 'Controlled V3 Edge server mainnet deployed on 2 nodes', done: true },
        { text: cs ? 'Reorg/double-spend/fork tests (29 testů)' : 'Reorg/double-spend/fork tests (29 tests)', done: true },
        { text: cs ? 'IBD hardening (42 testy)' : 'IBD hardening (42 tests)', done: true },
        { text: cs ? 'Pool payout batch TX (23 testy)' : 'Pool payout batch TX (23 tests)', done: true },
        { text: cs ? 'Buyback + DAO Treasury (28 testů)' : 'Buyback + DAO Treasury (28 tests)', done: true },
        { text: cs ? 'RPC API complete (36 testů)' : 'RPC API complete (36 tests)', done: true },
        { text: cs ? 'DoS protection (MessageRateLimiter)' : 'DoS protection (MessageRateLimiter)', done: true },
        { text: cs ? 'Stress test suite (21 testů)' : 'Stress test suite (21 tests)', done: true },
        { text: cs ? '168h stability run without critical incident' : '168h stability run without critical incident', done: true },
        { text: cs ? 'Edge server topology operational via private network' : 'Edge server topology operational via private network', done: true },
        { text: cs ? 'Fee split 89/5/5/1 enforced on-chain' : 'Fee split 89/5/5/1 enforced on-chain', done: true },
        { text: cs ? 'Ekam Deeksha Tier 1+2 canary deploy — pool accept 100 %' : 'Ekam Deeksha Tier 1+2 canary deploy — pool accept 100%', done: true },
        { text: cs ? 'Block retention fix deployed (set_block_retention always called)' : 'Block retention fix deployed (set_block_retention always called)', done: true },
      ],
    },
    {
      id: '2',
      title: copy.phase2Title,
      period: copy.phase2Period,
      priority: copy.phase2Priority,
      progress: 100,
      status: 'done',
      description: copy.phase2Desc,
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
      title: copy.phase3Title,
      period: copy.phase3Period,
      priority: copy.phase3Priority,
      progress: 100,
      status: 'done',
      description: copy.phase3Desc,
      sprints: [
        { id: '3.1', title: cs ? 'Veřejný host & Monitoring — Zion2 live, Prometheus + Grafana' : 'Public Host & Monitoring — Zion2 live, Prometheus + Grafana', done: true },
        { id: '3.2', title: cs ? 'Docker & Deploy — runbook + compose + live web deploy flow' : 'Docker & Deploy — runbook + compose + live web deploy flow', done: true },
        { id: '3.3', title: cs ? 'Legal & Compliance — disclaimery, token-not-security, rizika' : 'Legal & Compliance — disclaimers, token-not-security, risk', done: true },
        { id: '3.4', title: 'wZION + Bridge deployed on Base Mainnet', done: true },
        { id: '3.5', title: 'Uniswap V3 pool wZION/WETH (0.3%) seeded on Base Mainnet', done: true },
        { id: '3.6', title: 'DeFi UI — functional swap/bridge/portfolio on website', done: true },
        { id: '3.7', title: 'DeFi L2 pages cleanup — bridge/dao/warp bilingual mainnet', done: true },
      ],
      exitCriteria: [
        { text: cs ? '1 public host + internal validator lanes stable online' : '1 public host + internal validator lanes stable online', done: true },
        { text: cs ? 'Monitoring + alerting active' : 'Monitoring + alerting active', done: true },
        { text: cs ? 'Legal docs complete' : 'Legal docs complete', done: true },
        { text: cs ? 'wZION + Bridge deployed on Base Mainnet' : 'wZION + Bridge deployed on Base Mainnet', done: true },
        { text: cs ? 'L2 contracts deployed (Staking, Governance, Farm, AtomicSwap)' : 'L2 contracts deployed (Staking, Governance, Farm, AtomicSwap)', done: true },
        { text: cs ? 'multichain /health OK' : 'multichain /health OK', done: true },
      ],
    },
    {
      id: '4',
      title: copy.phase4Title,
      period: copy.phase4Period,
      priority: copy.phase4Priority,
      progress: 80,
      status: 'active',
      description: copy.phase4Desc,
      sprints: [
        { id: 'B-1', title: cs ? 'Finální payout verifikace — PPLNS window validace' : 'Final payout verification — PPLNS window validation', done: false },
        { id: 'B-2', title: cs ? 'Bezpečnostní audit — externí firma booked' : 'Security audit — external firm booked', done: false },
        { id: 'B-3', title: cs ? 'Bridge validator provisioning — 3/5 threshold produkce' : 'Bridge validator key provisioning — 3/5 threshold production', done: false },
        { id: 'B-4', title: cs ? 'Komunitní příprava — dokumentace, tutoriály' : 'Community preparation — documentation, tutorials', done: false },
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
        { text: cs ? 'Genesis block hash publikován' : 'Genesis block hash published', done: true },
        { text: cs ? 'Bootstrap hosty online (veřejný + interní quorum)' : 'Bootstrap hosts online (public + internal quorum)', done: true },
        { text: cs ? 'Pool + solo mining otevřen' : 'Pool + solo mining open', done: true },
        { text: cs ? 'Block explorer živě' : 'Block explorer live', done: true },
        { text: cs ? 'Supply API živě' : 'Supply API live', done: true },
      ],
    },
  ];

  const postLaunch = [
    {
      title: cs ? '6A: Tichý Mainnet' : '6A: Silent Mainnet',
      sub: cs ? 'Dny 1–30' : 'Days 1–30',
      items: cs
        ? ['Monitor orphan rate < 2 %', 'Difficulty stabilita 60s ± 10 %', 'Explorer + Supply API veřejný', 'Hotfix releases pokud potřeba']
        : ['Monitor orphan rate < 2%', 'Difficulty stability 60s ± 10%', 'Explorer + Supply API public', 'Hotfix releases if needed'],
    },
    {
      title: cs ? '6B: DEX & Listingy' : '6B: DEX & Listings',
      sub: cs ? 'Dny 14–45' : 'Days 14–45',
      items: [
        'wZION ERC-20 deployed on Base Mainnet ✅',
        'Uniswap V3 pool wZION/WETH live ✅',
        'DeFi UI on zionterranova.com/defi ✅',
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
      title: cs ? '6D: CEX Outreach' : '6D: CEX Outreach',
      sub: cs ? 'Dny 45–120' : 'Days 45–120',
      items: cs
        ? ['Tier-3: MEXC, XT, CoinEx', 'Tier-2: Gate.io, KuCoin (po volume)', 'Binance / Coinbase — NE jako první krok']
        : ['Tier-3: MEXC, XT, CoinEx', 'Tier-2: Gate.io, KuCoin (after volume)', 'Binance / Coinbase — NOT a first step'],
    },
  ];

  const securityChecklist = [
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

  const secDone = securityChecklist.filter((i) => i.done).length;
  const secTotal = securityChecklist.length;

  return (
    <div className="zion-page">
      <div className="zion-container max-w-7xl space-y-14">

        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Target className="h-4 w-4" />
                {copy.badge}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{copy.missionControl}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {copy.title}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {copy.subtitle}
                <strong className="text-white">{copy.subtitleStrong}</strong>.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3 text-zion-gold" /> {copy.updated}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <CalendarDays className="h-3 w-3 text-zion-cyan" /> {copy.publicLaunch}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> {copy.testsPassing}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {heroStats.map((chip) => (
                <div key={chip.label} className="zion-rainbow-sub px-5 py-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-3xl font-semibold text-white mt-2">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.descriptor}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* COMPONENT STATUS */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{copy.componentStatusSub}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Code2 className="h-7 w-7 text-zion-cyan" />
              {copy.componentStatus}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{copy.component}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{copy.loc}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{copy.tests}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{copy.status}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{copy.readiness}</th>
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

        {/* PHASES */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{copy.execution}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-purple" />
              {copy.phasesTitle}
            </h2>
            <p className="text-sm text-gray-400">{copy.phasesSub}</p>
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
                    ? { text: copy.done, cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' }
                    : phase.status === 'active'
                    ? { text: copy.active, cls: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan' }
                    : { text: copy.upcoming, cls: 'border-white/20 bg-white/5 text-gray-300' };

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

                    <div className={`flex-1 zion-rainbow-sub p-6 ${statusColor}`} style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-white">{copy.phase} {phase.id} — {phase.title}</h3>
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
                              {sprint.tests ? <span className="text-gray-600 ml-1">({sprint.tests} {copy.testsUnit})</span> : null}
                            </span>
                          </div>
                        ))}
                      </div>

                      <details className="mt-5 group">
                        <summary className="text-xs uppercase tracking-[0.3em] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors select-none">
                          {copy.exitCriteria} ({phase.exitCriteria.filter((e) => e.done).length}/{phase.exitCriteria.length}) ▸
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

        {/* POST-LAUNCH */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{copy.afterLaunch}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-gold" />
              {copy.postLaunchTitle}
            </h2>
            <p className="text-sm text-gray-400">{copy.postLaunchSub}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {postLaunch.map((block, idx) => (
              <motion.div
                key={block.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="zion-rainbow-sub p-5"
                style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
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
          <div className="mt-6 zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-3">{copy.exchangeSequence}</p>
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

        {/* CONSTITUTION + GENESIS RESERVE */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          <div className="zion-rainbow-card p-8" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
            <div className="flex items-center gap-3 mb-5">
              <Lock className="h-6 w-6 text-zion-gold" />
              <div>
                <h2 className="text-2xl font-semibold text-white">{copy.launchConstitution}</h2>
                <p className="text-sm text-gray-400">{copy.launchConstitutionSub}</p>
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

          <div className="zion-section">
            <div className="flex items-center gap-3 mb-5">
              <Scale className="h-6 w-6 text-zion-purple" />
              <div>
                <h2 className="text-2xl font-semibold text-white">{copy.genesisReserve}</h2>
                <p className="text-sm text-gray-400">{copy.genesisReserveSub}</p>
              </div>
            </div>
            <div className="space-y-4">
              {premineAllocation.map((row) => (
                <div key={row.category} className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
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

        {/* SECURITY CHECKLIST */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{copy.security}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-emerald-400" />
              {copy.securityTitle}
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
            <span>{copy.securityCompleted}</span>
            <div className="h-2 flex-1 max-w-xs rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(secDone / secTotal) * 100}%` }} />
            </div>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.28 }}
          className="zion-cta-banner"
        >
          <Rocket className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">
            {copy.ctaTitle}
          </h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {copy.ctaSubtitle}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            {copy.ctaLegal}{' '}
            <strong className="text-white">{copy.ctaLegalStrong}</strong>.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
            {copy.ctaChips.map((item) => (
              <span key={item} className="rounded-full bg-white/80 px-4 py-2 font-semibold text-gray-900">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/defi" className="zion-button-primary">
              <Activity className="h-4 w-4" /> DeFi Hub
            </Link>
            <Link href="/docs" className="zion-button-secondary">
              <BookOpen className="h-4 w-4" /> {copy.documentation}
            </Link>
            <Link href="/dashboard" className="zion-button-secondary">
              <Activity className="h-4 w-4" /> {copy.liveDashboard}
            </Link>
            <a
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="zion-button-secondary"
            >
              <ExternalLink className="h-4 w-4" /> GitHub
            </a>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          ZION TerraNova {SITE_RELEASE_LABEL} · MainNet · {copy.lastUpdated}: 2026-08-06
        </p>
      </div>
    </div>
  );
}
