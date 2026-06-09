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
  { label: 'Network', value: 'Mainnet Ready', descriptor: 'V3 Mainnet · Core + Edge topology · mining test' },
  { label: 'Mainnet Status', value: 'Ready', descriptor: 'Target 31 Dec 2026 (New Year\'s Eve)' }
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
      tr('roadmapPage', 'scratchpad_ekam_256_kib_4_passes_256_reads_ti', lang),
      tr('roadmapPage', 'epoch_rotating_npu_weights_2016_100_blocks_ti', lang),
      'UTXO model + Ed25519 signatures',
      tr('roadmapPage', 'decade_decay_emission_5_400_724_zion_block_10', lang),
      tr('roadmapPage', '16_28b_genesis_reserve_public_summary', lang),
      'LWMA DAA (60-block, ±25%)',
      'TX hash v2 + BLAKE3 body root (BODY_ROOT_V2)',
      tr('roadmapPage', 'fee_burning_all_fees_destroyed', lang),
      tr('roadmapPage', 'distribution_89_miner_5_humanit_5_issobella_1', lang),
      tr('roadmapPage', 'dual_mining_zion_chv3_vrsc_verushash', lang),
      tr('roadmapPage', 'mining_pool_stratum_v2_pplns', lang),
      tr('roadmapPage', 'p2p_network_ibd_sync_bootstrap_peers', lang),
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
      tr('roadmapPage', 'defi_ui_swap_bridge_portfolio_on_zionterranov', lang),
      tr('roadmapPage', 'defi_pages_bridge_dao_warp_bilingual_mainnet', lang),
      tr('roadmapPage', 'liquidity_seeded_50_wzion_0_0005_weth', lang),
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
    period: tr('roadmapPage', '2026_implementation_2027_gated_production', lang),
    color: 'from-purple-500 to-pink-500',
    border: 'border-purple-500/40',
    items: [
      tr('roadmapPage', 'ncl_ai_task_marketplace', lang),
      'AI Orchestrator — agent routing',
      'WARP adapters 7/7 implemented ✅ (2026-03-02)',
      tr('roadmapPage', 'ethereum_corridor_live_on_base_mainnet', lang),
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
      tr('roadmapPage', 'golden_egg_treasure_hunt_108_clues_8_25b_zion', lang),
      tr('roadmapPage', 'guild_system_territories_planned_2028', lang),
      tr('roadmapPage', 'ue5_integration_planned_2028_2029', lang),
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
      tr('roadmapPage', 'free_energy_quantum_engine_r_d', lang),
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
      tr('roadmapPage', 'zion_issobella_station_concept_roadmap_planne', lang),
      tr('roadmapPage', 'orbital_mining_deep_space_research_planned_20', lang),
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
  { name: tr('roadmapPage', 'website_v2_9_defi_live', lang), loc: '~6k', tests: 0, status: '✅', readiness: 85 },
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
    title: tr('roadmapPage', 'spec_freeze_core_rewrite', lang),
    period: tr('roadmapPage', 'feb_2026_completed_9_feb', lang),
    priority: 'P0 Blocker → ✅ DONE',
    progress: 100,
    status: 'done',
    description: cs
      ? '155 testů, 8 commitů. Emise, DAA, fee market, wallet, consensus hardening — vše zmrazeno.'
      : '155 tests, 8 commits. Emission, DAA, fee market, wallet, consensus hardening — all frozen.',
    sprints: [
      { id: '0.0', title: tr('roadmapPage', 'repo_migration_clean_repo_workspace_docker_ci', lang), done: true },
      { id: '0.1', title: tr('roadmapPage', 'emission_genesis_5_400_zion_block_16_28b_rese', lang), done: true },
      { id: '0.2', title: tr('roadmapPage', 'daa_consensus_lwma_60_block_25_fork_choice', lang), done: true },
      { id: '0.3', title: tr('roadmapPage', 'fee_market_mempool_fee_burning_double_spend_e', lang), done: true },
      { id: '0.4', title: tr('roadmapPage', 'wallet_tx_utxo_select_ed25519_broadcast_e2e', lang), done: true },
      { id: '0.5', title: tr('roadmapPage', 'consensus_hardening_maturity_100_reorg_10_fin', lang), done: true },
    ],
    exitCriteria: [
      { text: tr('roadmapPage', 'unit_tests_for_new_reward_model', lang), done: true },
      { text: tr('roadmapPage', 'genesis_produces_16_28b_reserve', lang), done: true },
      { text: tr('roadmapPage', 'lwma_daa_deterministic', lang), done: true },
      { text: tr('roadmapPage', 'max_reorg_depth_10_enforced', lang), done: true },
      { text: tr('roadmapPage', 'coinbase_maturity_100_enforced', lang), done: true },
      { text: tr('roadmapPage', 'wallet_send_e2e_working', lang), done: true },
    ],
  },
  {
    id: '1',
    title: 'Controlled Test Mainnet',
    period: 'Feb — May 2026',
    priority: 'P0 Blocker → ✅ DONE',
    progress: 100,
    status: 'done',
    description: '168h stability PASS (2026-03-03). Ekam Deeksha Tier 1+2 deployed (2026-03-17): 256 KiB scratchpad, epoch NPU weights, 10/10 pool accepted, 0 rejected. Controlled rehearsal completed. Core + Edge topology operational via Tailscale VPN. Closure evidence collected for public launch.',
    sprints: [
      { id: '1.0', title: tr('roadmapPage', 'network_identity_deploy_chain_reset_docker_3_', lang), done: true },
      { id: '1.1', title: tr('roadmapPage', 'config_validation_toml_parsing_boundary_check', lang), tests: 70, done: true },
      { id: '1.2', title: tr('roadmapPage', 'security_edge_case_reorg_double_spend_fork_ch', lang), tests: 29, done: true },
      { id: '1.3', title: tr('roadmapPage', 'ibd_hardening_timeouts_stall_detection_peer_s', lang), tests: 42, done: true },
      { id: '1.4', title: tr('roadmapPage', 'pool_payout_integration_batch_tx_poolwallet_j', lang), tests: 23, done: true },
      { id: '1.5', title: tr('roadmapPage', 'buyback_dao_treasury_100_dao_revenue_burn_add', lang), tests: 28, done: true },
      { id: '1.6', title: tr('roadmapPage', 'supply_buyback_api_getsupplyinfo_getnetworkin', lang), tests: 15, done: true },
      { id: '1.7', title: tr('roadmapPage', 'p2p_rate_limiting_200_msgs_peer_60s_escalatin', lang), tests: 13, done: true },
      { id: '1.8', title: tr('roadmapPage', 'health_check_metrics_gethealthcheck_getmetric', lang), tests: 8, done: true },
      { id: '1.9', title: tr('roadmapPage', 'stress_test_suite_high_tx_rapid_blocks_partit', lang), tests: 21, done: true },
      { id: '1.10', title: tr('roadmapPage', '168h_stability_run_archived_multi_host_valida', lang), done: true },
      { id: '1.11', title: tr('roadmapPage', 'live_partition_test_node_isolation_30_min_rec', lang), done: false },
      { id: '1.12', title: tr('roadmapPage', '100_miners_stress_simulate_100_stratum_client', lang), done: false },
      { id: '1.13', title: 'Ekam Deeksha Tier 1 — Scratchpad 256 KiB, 4 passes, 256 reads', tests: 108, done: true },
      { id: '1.14', title: 'Ekam Deeksha Tier 2 — Epoch NPU weights, rotate per 2016/100 blocks', tests: 14, done: true },
      { id: '1.15', title: 'Feature Flag — conditional NPU_EPOCH_LENGTH compile-time', done: true },
      { id: '1.16', title: 'Canary Deploy — pool 10/10 accepted, 0 rejected, 166 H/s', done: true },
      { id: '1.17', title: tr('roadmapPage', 'core_edge_topology_tailscale_vpn_sharerelay_p', lang), done: true },
      { id: '1.18', title: tr('roadmapPage', 'fee_split_89_5_5_1_canonical_addresses_genesi', lang), done: true }
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
      { text: 'Ekam Deeksha Tier 1+2 canary deploy — pool accept 100%', done: true }
    ]
  },
  {
    id: '2',
    title: tr('roadmapPage', 'node_ux_mining', lang),
    period: tr('roadmapPage', 'jun_jul_2026', lang),
    priority: 'P1 Important',
    progress: 0,
    status: 'upcoming',
    description: cs
      ? 'Node spustitelný za 10 min, block explorer, mining guides, RPC dokumentace.'
      : 'Node bootable in 10 min, block explorer, mining guides, RPC documentation.',
    sprints: [
      { id: '2.1', title: tr('roadmapPage', 'node_ux_readme_config_toml_structured_logging', lang), done: false },
      { id: '2.2', title: tr('roadmapPage', 'mining_polish_cpu_baseline_gpu_production_poo', lang), done: false },
      { id: '2.3', title: tr('roadmapPage', 'block_explorer_indexer_web_ui_supply_api_rich', lang), done: false },
    ],
    exitCriteria: [
      { text: tr('roadmapPage', 'node_bootable_in_10_min_per_readme', lang), done: false },
      { text: tr('roadmapPage', 'block_explorer_running_and_indexing', lang), done: false },
      { text: tr('roadmapPage', 'mining_guides_complete', lang), done: false },
      { text: tr('roadmapPage', 'rpc_api_documented', lang), done: false },
    ],
  },
  {
    id: '3',
    title: tr('roadmapPage', 'infrastructure_defi_legal', lang),
    period: tr('roadmapPage', 'mar_may_2026', lang),
    priority: 'P1 Important → ✅ DONE',
    progress: 100,
    status: 'done',
    description: 'Single public host + internal validator lanes active, monitoring running, legal/docs complete. wZION bridge live on Base Mainnet. L2 contracts deployed: Staking, Governance, Farm, AtomicSwap.',
    sprints: [
      { id: '3.1', title: tr('roadmapPage', 'public_host_monitoring_zion2_live_prometheus_', lang), done: true },
      { id: '3.2', title: tr('roadmapPage', 'docker_deploy_runbook_compose_live_web_deploy', lang), done: true },
      { id: '3.3', title: tr('roadmapPage', 'legal_compliance_disclaimers_token_not_securi', lang), done: true },
      { id: '3.4', title: tr('roadmapPage', 'wzion_bridge_deployed_on_base_mainnet', lang), done: true },
      { id: '3.5', title: tr('roadmapPage', 'uniswap_v3_pool_wzion_weth_0_3_seeded_on_base', lang), done: true },
      { id: '3.6', title: tr('roadmapPage', 'defi_ui_functional_swap_bridge_portfolio_on_w', lang), done: true },
      { id: '3.7', title: tr('roadmapPage', 'defi_l2_pages_cleanup_bridge_dao_warp_bilingu', lang), done: true },
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
    title: tr('roadmapPage', 'dress_rehearsal', lang),
    period: tr('roadmapPage', 'oct_nov_2026', lang),
    priority: 'P0 Blocker',
    progress: 0,
    status: 'upcoming',
    description: cs
      ? 'Summer Solstice rehearsal (20. června 2026) dokončena interně. Následuje 168h (7denní) stabilita, bezpečnostní audit (Trail of Bits / OtterSec / Halborn), code freeze, bug bounty program.'
      : 'Summer Solstice rehearsal (20 June 2026) completed internally. Next: 168h (7-day) stability run, security audit (Trail of Bits / OtterSec / Halborn), code freeze, bug bounty program.',
    sprints: [
      { id: '4.1', title: tr('roadmapPage', 'dress_rehearsal_staging_chain_1000_miners_dis', lang), done: false },
      { id: '4.2', title: tr('roadmapPage', 'security_audit_rfp_kickoff_mid_review_final_b', lang), done: false },
      { id: '4.3', title: tr('roadmapPage', 'code_freeze_feature_freeze_tag_v2_9_6_mainnet', lang), done: false },
    ],
    exitCriteria: [
      { text: tr('roadmapPage', '7_day_stability_run_without_crash', lang), done: false },
      { text: tr('roadmapPage', 'security_audit_no_critical_high_findings', lang), done: false },
      { text: tr('roadmapPage', 'code_freeze_tag_created', lang), done: false },
      { text: tr('roadmapPage', 'binary_releases_with_sha_256', lang), done: false },
      { text: tr('roadmapPage', 'bug_bounty_program_active', lang), done: false },
    ],
  },
  {
    id: '5',
    title: tr('roadmapPage', 'public_launch_decision_genesis', lang),
    period: tr('roadmapPage', 'target_31_december_2026_new_year', lang),
    priority: '🚀 P0 Blocker → Ready for launch',
    progress: 80,
    status: 'active',
    description: cs
      ? 'V3 je mainnet-ready. Phase 1 Foundation kompletní. Zbývající blockery: finální payout verifikace, bezpečnostní audit, bridge validator provisioning a komunitní příprava. Veřejný genesis target 31. prosince 2026.'
      : 'V3 is mainnet-ready. Phase 1 Foundation complete. Remaining blockers: final payout verification, security audit, bridge validator provisioning, and community preparation. Public genesis target 31 December 2026.',
    sprints: [
      { id: 'B-1', title: tr('roadmapPage', 'final_payout_verification_pplns_window_valida', lang), done: false },
      { id: 'B-2', title: tr('roadmapPage', 'security_audit_external_firm_booked', lang), done: false },
      { id: 'B-3', title: tr('roadmapPage', 'bridge_validator_key_provisioning_3_5_thresho', lang), done: false },
      { id: 'B-4', title: tr('roadmapPage', 'community_preparation_documentation_tutorials', lang), done: false },
      { id: 'B-5', title: tr('roadmapPage', 'ci_billing_resolution', lang), done: false },
      { id: 'T-14', title: tr('roadmapPage', 'genesis_freeze_all_parameters_frozen', lang), done: false },
      { id: 'T-7', title: tr('roadmapPage', 'community_announcement_wallets_available', lang), done: false },
      { id: 'T-2', title: tr('roadmapPage', 'final_node_software_release', lang), done: false },
      { id: 'T-0', title: tr('roadmapPage', 'public_genesis_go_decision', lang), done: false },
    ],
    exitCriteria: [
      { text: tr('roadmapPage', 'phase_1_foundation_complete', lang), done: true },
      { text: tr('roadmapPage', 'final_payout_verification', lang), done: false },
      { text: tr('roadmapPage', 'security_audit_no_critical_high_findings', lang), done: false },
      { text: tr('roadmapPage', 'bridge_validator_provisioning_3_5_threshold', lang), done: false },
      { text: tr('roadmapPage', 'genesis_block_hash_published', lang), done: false },
      { text: tr('roadmapPage', 'bootstrap_hosts_online_public_internal_quorum', lang), done: false },
      { text: tr('roadmapPage', 'pool_solo_mining_open', lang), done: false },
      { text: tr('roadmapPage', 'block_explorer_live', lang), done: false },
      { text: tr('roadmapPage', 'supply_api_live', lang), done: false },
    ],
  },
];

const getPostLaunch = (cs: boolean) => [
  {
    title: tr('roadmapPage', '6a_silent_mainnet', lang),
    sub: tr('roadmapPage', 'days_1_30', lang),
    items: cs
      ? ['Monitor orphan rate < 2%', 'Difficulty stabilita 60s ± 10%', 'Explorer + Supply API veřejný', 'Hotfix releases pokud potřeba']
      : ['Monitor orphan rate < 2%', 'Difficulty stability 60s ± 10%', 'Explorer + Supply API public', 'Hotfix releases if needed'],
  },
  {
    title: tr('roadmapPage', '6b_dex_listings', lang),
    sub: tr('roadmapPage', 'days_14_45', lang),
    items: [
      'wZION ERC-20 deployed on Base Mainnet ✅',
      'Uniswap V3 pool wZION/WETH live ✅',
      tr('roadmapPage', 'defi_ui_on_zionterranova_com_defi', lang),
      tr('roadmapPage', 'deepen_liquidity_price_discovery', lang),
      'CoinGecko / DexScreener listing',
    ],
  },
  {
    title: '6C: CMC & CoinGecko',
    sub: tr('roadmapPage', 'days_30_60', lang),
    items: ['CoinGecko application', 'CoinMarketCap application', 'Supply data feed'],
  },
  {
    title: '6D: CEX Outreach',
    sub: tr('roadmapPage', 'days_45_120', lang),
    items: cs
      ? ['Tier-3: MEXC, XT, CoinEx', 'Tier-2: Gate.io, KuCoin (po volume)', 'Binance / Coinbase — NE jako první krok']
      : ['Tier-3: MEXC, XT, CoinEx', 'Tier-2: Gate.io, KuCoin (after volume)', 'Binance / Coinbase — NOT a first step'],
  },
];

const getSecurityChecklist = (cs: boolean) => [
  { text: tr('roadmapPage', 'ed25519_signature_verification', lang), done: true },
  { text: tr('roadmapPage', 'double_spend_protection_mempool_utxo', lang), done: true },
  { text: tr('roadmapPage', 'overflow_protection_checked_add', lang), done: true },
  { text: 'P2P rate limiting', done: true },
  { text: tr('roadmapPage', 'coinbase_maturity_100_blocks', lang), done: true },
  { text: tr('roadmapPage', 'reorg_limit_10_blocks', lang), done: true },
  { text: tr('roadmapPage', 'timestamp_validation_120s', lang), done: true },
  { text: tr('roadmapPage', 'mempool_limits_50k_tx_min_fee', lang), done: true },
  { text: tr('roadmapPage', 'rpc_authentication_api_key', lang), done: false },
  { text: tr('roadmapPage', 'block_size_limit_max_1_mb', lang), done: false },
  { text: tr('roadmapPage', 'tx_size_limit_max_100_kb', lang), done: false },
  { text: tr('roadmapPage', 'external_audit', lang), done: false },
];

const getTimeline = (cs: boolean) => [
  { layer: 'L1 Blockchain', period: '2026', phases: tr('roadmapPage', 'phase_0_1_168h_pass_2_4_launch_gate', lang), color: 'from-emerald-400 to-lime-400', width: '42%', offset: '0%' },
  { layer: tr('roadmapPage', 'l2_defi_dex', lang), period: '2026', phases: tr('roadmapPage', 'wzion_bridge_uni_v3_defi_ui_staking_planned', lang), color: 'from-blue-400 to-cyan-400', width: '30%', offset: '30%' },
  { layer: 'L3 NCL & WARP', period: tr('roadmapPage', '2026_2027', lang), phases: tr('roadmapPage', 'warp_7_7_eth_corridor_ai_native', lang), color: 'from-purple-400 to-pink-400', width: '25%', offset: '44%' },
  { layer: 'L4 Oasis', period: '2028+', phases: tr('roadmapPage', 'ue5_xp_economy_beta', lang), color: 'from-yellow-400 to-orange-400', width: '18%', offset: '68%' },
  { layer: 'L5 Free World', period: '2030+', phases: tr('roadmapPage', 'humanitarian_missions_free_energy', lang), color: 'from-amber-400 to-yellow-400', width: '18%', offset: '72%' },
  { layer: 'L6 Issobella', period: '2040+', phases: tr('roadmapPage', 'orbital_station_fund', lang), color: 'from-rose-400 to-red-400', width: '12%', offset: '88%' },
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
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> {tr('roadmapPage', '1_501_tests_passing', lang)}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('roadmapPage', 'architecture', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-gold" />
              Layer Stack
            </h2>
            <p className="text-sm text-gray-400">{tr('roadmapPage', 'each_layer_is_independent_l1_is_never_comprom', lang)}</p>
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
                        {tr('roadmapPage', 'active', lang)}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('roadmapPage', 'telemetry', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Code2 className="h-7 w-7 text-zion-cyan" />
              {tr('roadmapPage', 'component_status', lang)}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{tr('roadmapPage', 'component', lang)}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">LOC</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{tr('roadmapPage', 'tests', lang)}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{tr('roadmapPage', 'status', lang)}</th>
                  <th className="py-3 px-4 text-xs uppercase tracking-[0.3em] text-gray-400 font-medium">{tr('roadmapPage', 'readiness', lang)}</th>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('roadmapPage', 'execution', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-purple" />
              Fáze 0 – 5 · Core + Edge mainnet → Full MainNet
            </h2>
            <p className="text-sm text-gray-400">{tr('roadmapPage', 'every_phase_has_clear_exit_criteria_no_shortc', lang)}</p>
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
                    ? { text: tr('roadmapPage', 'done', lang), cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' }
                    : phase.status === 'active'
                    ? { text: tr('roadmapPage', 'active_1', lang), cls: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan' }
                    : { text: tr('roadmapPage', 'upcoming', lang), cls: 'border-white/20 bg-white/5 text-gray-300' };

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
                          <h3 className="text-xl font-semibold text-white">{tr('roadmapPage', 'phase', lang)} {phase.id} — {phase.title}</h3>
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
                              {sprint.tests ? <span className="text-gray-600 ml-1">({sprint.tests} {tr('roadmapPage', 'tests_1', lang)})</span> : null}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('roadmapPage', 'after_launch', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-zion-gold" />
              {tr('roadmapPage', 'phase_6_post_launch_exchange', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('roadmapPage', 'only_after_go_decision_stability_dex_cex_cmc_', lang)}</p>
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
                { n: '5️⃣', label: tr('roadmapPage', 'tier_2_cex_after_volume', lang), cls: 'text-gray-400' },
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
                <h2 className="text-2xl font-semibold text-white">{tr('roadmapPage', 'launch_constitution_draft', lang)}</h2>
                <p className="text-sm text-gray-400">{tr('roadmapPage', 'frozen_parameters_for_potential_public_genesi', lang)}</p>
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
                <p className="text-sm text-gray-400">{tr('roadmapPage', '16_280_000_000_zion_public_summary_for_launch', lang)}</p>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('roadmapPage', 'security', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-emerald-400" />
              {tr('roadmapPage', 'launch_readiness_security_checklist', lang)}
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
            <span>{tr('roadmapPage', 'completed', lang)}</span>
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
          className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-10 text-center"
        >
          <Rocket className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">
            {tr('roadmapPage', 'public_launch_gate_ready_for_launch', lang)}
          </h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs
              ? 'L1 je srdce. Stavíme zdola nahoru. Phase 1 Foundation je kompletní. V3 je mainnet-ready — zbývá dokončit blockery: finální payout verifikace, bezpečnostní audit a bridge validator provisioning. Veřejný genesis přichází po GO rozhodnutí.'
              : 'L1 is the heart. We build bottom-up. Phase 1 Foundation is complete. V3 is mainnet-ready — remaining blockers: final payout verification, security audit, and bridge validator provisioning. Public genesis follows GO decision.'}
          </p>
          <p className="mt-2 text-sm text-gray-300 max-w-2xl mx-auto">
            {cs
              ? 'Právní pozice: ZION = protocol-native utility token, NE security. Žádné ICO/IEO/IDO. Tokeny jsou'
              : 'Legal position: ZION = protocol-native utility token, NOT a security. No ICO/IEO/IDO. Tokens are'}{' '}
            <strong className="text-white">mined, not sold</strong>.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
            {['144B total supply', '5,400 ZION/block (D1)', 'Decade Decay -20%/10y', 'Fee burning', tr('roadmapPage', '100_yrs_mining', lang), '5% Issobella Fund'].map((item) => (
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
              <BookOpen className="h-4 w-4" /> {tr('roadmapPage', 'documentation', lang)}
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white border border-white/10">
              <Activity className="h-4 w-4" /> {tr('roadmapPage', 'live_dashboard', lang)}
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
          ZION TerraNova {SITE_RELEASE_LABEL} — L1 Blockchain · L2 Bridge/DAO/DeFi · L3 AI Native/WARP/NCL · L4 Oasis · L5 Free World · L6 Issobella · 6-layer architecture · {tr('roadmapPage', 'last_updated', lang)}: 2026-05-23
        </p>
      </div>
    </div>
  );
}
