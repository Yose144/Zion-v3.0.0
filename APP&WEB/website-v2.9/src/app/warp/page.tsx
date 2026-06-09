'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircuitBoard,
  CloudLightning,
  Globe2,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';

const getWarpStats = (cs: boolean) => [
  { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'corridors_planned', lang), value: '11', detail: 'BTC · ETH · SOL · L2 + Lightning', icon: CloudLightning },
  { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'live_corridors', lang), value: '1', detail: tr('APP_WEB_website_v2_9_src_app_warp_page', 'ethereum_lock_mint_base_mainnet', lang), icon: CheckCircle2 },
  { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'guardian_runtime', lang), value: '1 + quorum', detail: tr('APP_WEB_website_v2_9_src_app_warp_page', 'zion2_public_host_internal_validator_lanes', lang), icon: ShieldCheck },
  { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'development_phase', lang), value: tr('APP_WEB_website_v2_9_src_app_warp_page', 'phase_2', lang), detail: tr('APP_WEB_website_v2_9_src_app_warp_page', 'eth_live_btc_sol_in_design', lang), icon: Globe2 },
];

const getCorridorRows = (cs: boolean): { title: string; subtitle: string; live: boolean; entries: { label: string; value: string }[] }[] => [
  {
    title: tr('APP_WEB_website_v2_9_src_app_warp_page', 'ethereum_lock_mint', lang),
    subtitle: 'wZION ERC-20 · Base Mainnet',
    live: true,
    entries: [
      { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'validators', lang), value: tr('APP_WEB_website_v2_9_src_app_warp_page', 'relay_daemon_multi_sig_quorum_deployment_audited', lang) },
      { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'status', lang), value: tr('APP_WEB_website_v2_9_src_app_warp_page', 'live_on_base_mainnet_chain_8453_wzion_weth_uniswap', lang) },
      { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'integration', lang), value: tr('APP_WEB_website_v2_9_src_app_warp_page', 'evm_wallets_defi_swap_dao_treasury_lp_stakes', lang) },
    ],
  },
  {
    title: tr('APP_WEB_website_v2_9_src_app_warp_page', 'bitcoin_htlc_bridge', lang),
    subtitle: 'SegWit + Taproot',
    live: false,
    entries: [
      { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'security_model', lang), value: 'HTLC · 2-of-3 multi-sig · 24h timelock' },
      { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'status', lang), value: tr('APP_WEB_website_v2_9_src_app_warp_page', 'architecture_design_gated_corridor_not_a_live_laun', lang) },
      { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'use_cases', lang), value: tr('APP_WEB_website_v2_9_src_app_warp_page', 'trustless_swaps_lightning_exits_otc_bridging', lang) },
    ],
  },
  {
    title: tr('APP_WEB_website_v2_9_src_app_warp_page', 'solana_spl_program', lang),
    subtitle: 'PDA-secured',
    live: false,
    entries: [
      { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'finality', lang), value: tr('APP_WEB_website_v2_9_src_app_warp_page', 'tower_bft_integration_planned', lang) },
      { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'status', lang), value: tr('APP_WEB_website_v2_9_src_app_warp_page', 'research_phase_after_btc_bridge', lang) },
      { label: tr('APP_WEB_website_v2_9_src_app_warp_page', 'utility', lang), value: tr('APP_WEB_website_v2_9_src_app_warp_page', 'game_assets_liquidity_routing_warp_swaps', lang) },
    ],
  },
];

const getOnboarding = (cs: boolean) => [
  {
    title: tr('APP_WEB_website_v2_9_src_app_warp_page', '1_provision_access', lang),
    items: [
      tr('APP_WEB_website_v2_9_src_app_warp_page', 'whitelist_validators_or_fetch_public_endpoints', lang),
      tr('APP_WEB_website_v2_9_src_app_warp_page', 'generate_api_tokens_read_transfer_scopes', lang),
      tr('APP_WEB_website_v2_9_src_app_warp_page', 'download_sdk_from_official_github', lang),
    ],
  },
  {
    title: tr('APP_WEB_website_v2_9_src_app_warp_page', '2_wire_liquidity', lang),
    items: [
      tr('APP_WEB_website_v2_9_src_app_warp_page', 'lock_assets_into_chosen_corridor_pool', lang),
      tr('APP_WEB_website_v2_9_src_app_warp_page', 'set_validator_quorum_alert_webhooks', lang),
      tr('APP_WEB_website_v2_9_src_app_warp_page', 'run_smoke_test_using_sandbox_chain_pairs', lang),
    ],
  },
  {
    title: tr('APP_WEB_website_v2_9_src_app_warp_page', '3_monitor_optimize', lang),
    items: [
      tr('APP_WEB_website_v2_9_src_app_warp_page', 'subscribe_to_validator_dashboard_streams', lang),
      tr('APP_WEB_website_v2_9_src_app_warp_page', 'enable_compact_block_relay_metrics', lang),
      tr('APP_WEB_website_v2_9_src_app_warp_page', 'schedule_weekly_failover_incident_drills', lang),
    ],
  },
];

export default function WarpPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const warpStats = getWarpStats(cs);
  const corridorRows = getCorridorRows(cs);
  const onboarding = getOnboarding(cs);

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
        <div className="zion-container max-w-6xl space-y-16">

        {/* ── Hero ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl md:rounded-[32px] border border-white/10 bg-black/60 p-6 md:p-10 backdrop-blur-xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Sparkles className="h-4 w-4" />
                Warp 2.0 · Corridor Ops
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{tr('APP_WEB_website_v2_9_src_app_warp_page', 'cross_chain_flight_deck', lang)}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {tr('APP_WEB_website_v2_9_src_app_warp_page', 'liquidity_without_borders', lang)}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? 'Trustless Bitcoin swapy, Ethereum lock/mint na Base Mainnet, Solana SPL mint a AMM routing z jedné konzole. Ethereum corridor je živě — BTC a SOL v návrhu.'
                  : 'Trustless Bitcoin swaps, Ethereum lock/mint on Base Mainnet, Solana SPL mint and AMM routing from one console. Ethereum corridor is live — BTC and SOL in design.'}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/defi" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 text-sm font-semibold text-black">
                  {tr('APP_WEB_website_v2_9_src_app_warp_page', 'open_defi_hub', lang)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/bridge" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white">
                  {tr('APP_WEB_website_v2_9_src_app_warp_page', 'bridge_operations', lang)}
                </Link>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {warpStats.map((chip) => (
                <div key={chip.label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('APP_WEB_website_v2_9_src_app_warp_page', 'corridor_grid', lang)}</p>
            <h2 className="text-3xl font-semibold text-white">{tr('APP_WEB_website_v2_9_src_app_warp_page', 'validator_backed_bridges', lang)}</h2>
          </div>
          <div className="space-y-6">
            {corridorRows.map((row) => (
              <div key={row.title} className={`rounded-3xl border p-6 ${row.live ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-black/40'}`}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{row.subtitle}</p>
                    <h3 className="text-2xl font-semibold text-white">{row.title}</h3>
                  </div>
                  {row.live ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {tr('APP_WEB_website_v2_9_src_app_warp_page', 'live', lang)}
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-gray-300">
                      {tr('APP_WEB_website_v2_9_src_app_warp_page', 'in_development', lang)}
                    </span>
                  )}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {row.entries.map((entry) => (
                    <div key={entry.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
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
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('APP_WEB_website_v2_9_src_app_warp_page', 'operations_runbook', lang)}</p>
            <h2 className="text-3xl font-semibold text-white">{tr('APP_WEB_website_v2_9_src_app_warp_page', 'bring_a_new_corridor_online', lang)}</h2>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {onboarding.map((block, idx) => (
              <div key={block.title} className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <div className="flex items-center gap-3">
                  <CircuitBoard className="h-5 w-5 text-zion-cyan" />
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">{tr('APP_WEB_website_v2_9_src_app_warp_page', 'stage', lang)} {idx + 1}</p>
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
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-r from-zion-purple/30 via-zion-gold/10 to-zion-purple/30 p-10 text-center">
          <Activity className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{tr('APP_WEB_website_v2_9_src_app_warp_page', 'need_custom_routing_or_institutional_onboarding', lang)}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs
              ? 'Core tým provozuje managed validátory a může pomoci s bootstrapem vašeho koridoru, připojením OTC likvidity nebo přidáním nových chainů. Ozvěte se přes oficiální kanály nebo založte issue na veřejném GitHubu.'
              : 'The core team runs managed validators and can help bootstrap your corridor, connect OTC liquidity, or add new chains. Reach out via official channels or open an issue on the public GitHub.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="https://github.com/Zion-TerraNova" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              {tr('APP_WEB_website_v2_9_src_app_warp_page', 'open_github_discussions', lang)}
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-6 py-3 text-sm font-semibold text-gray-900">
              {tr('APP_WEB_website_v2_9_src_app_warp_page', 'review_integration_docs', lang)}
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
