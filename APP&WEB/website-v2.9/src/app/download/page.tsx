'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowDownToLine,
  CheckCircle2,
  Cpu,
  Shield,
  TerminalSquare,
  Package,
  Monitor,
  ExternalLink,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { SITE_POOL_PRIMARY, SITE_RELEASE_LABEL, SITE_VERSION } from '@/lib/site';

const DownloadToolBrowser = dynamic(() => import('@/components/download/DownloadToolBrowser'));
const DownloadFaq = dynamic(() => import('@/components/download/DownloadFaq'));

const DOCS_URL = 'https://github.com/Zion-TerraNova/2.9.6/blob/main/docs/QUICK_START.md';

const getDesktopAgentFeatures = (cs: boolean) => [
  tr('downloadPage', 'gui_dashboard_with_real_time_hashrate_balance', lang),
  tr('downloadPage', 'one_click_mining_no_terminal_needed', lang),
  tr('downloadPage', 'built_in_wallet_generator_manager', lang),
  tr('downloadPage', 'auto_updates_system_tray_integration', lang),
  tr('downloadPage', 'remote_monitoring_gaming_mode', lang),
  tr('downloadPage', 'available_for_windows_macos_linux', lang),
];

const getCliQuickstartSteps = (cs: boolean) => [
  {
    title: tr('downloadPage', '1_create_wallet', lang),
    items: [
      tr('downloadPage', 'download_zion_cli_for_windows_below', lang),
      'Run: zion wallet new --mnemonic --out my-wallet.json --print',
      tr('downloadPage', 'write_down_24_words_on_paper_this_is_your_bac', lang),
    ],
  },
  {
    title: tr('downloadPage', '2_start_mining', lang),
    items: [
      tr('downloadPage', 'set_address_zion_config_set_miner_wallet_your', lang),
      `Run: zion mine start --pool stratum+tcp://${SITE_POOL_PRIMARY}`,
      tr('downloadPage', 'watch_hashrate_accepted_shares_in_console', lang),
    ],
  },
  {
    title: tr('downloadPage', '3_check_balance', lang),
    items: [
      'Run: zion wallet balance --address YOUR_ADDRESS',
      tr('downloadPage', 'or_visit_the_explorer_at_zionterranova_com_ex', lang),
      cs
        ? 'Poslat ZION: zion wallet send --to RECIPIENT --amount 100'
        : 'Send ZION: zion wallet send --to RECIPIENT --amount 100',
    ],
  },
];

/* ───────────────────────── component ───────────────────────── */

export default function DownloadPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const desktopAgentFeatures = getDesktopAgentFeatures(cs);
  const cliQuickstartSteps = getCliQuickstartSteps(cs);

  return (
    <div className="pt-28 md:pt-32 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-5xl space-y-16">

        {/* ─── Hero ─── */}
        <section className="rounded-4xl border border-white/10 bg-black/60 p-10 backdrop-blur-xl">
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
              <ArrowDownToLine className="h-4 w-4" />
              {SITE_RELEASE_LABEL}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{tr('downloadPage', '1_unified_binary_4_platforms_windows_ready', lang)}</p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {tr('downloadPage', 'download_mine_earn', lang)}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {cs ? `ZION CLI v3.0.0 — oficiální release s Core+Edge topologií. Jedna unifikovaná binárka obsahuje celý stack:` : `ZION CLI v3.0.0 — official release with Core+Edge topology. One unified binary contains the whole stack:`}{' '}
              <span className="text-white font-semibold">node</span>,{' '}
              <span className="text-zion-gold font-semibold">miner</span>,{' '}
              <span className="text-zion-cyan font-semibold">wallet</span>,{' '}
              <span className="text-zion-purple font-semibold">pool</span>,{' '}
              <span className="text-white font-semibold">bridge</span>,{' '}
              <span className="text-white font-semibold">dao</span>{tr('downloadPage', 'and_more_download_the_windows_build_directly_', lang)}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="#downloads"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                <ArrowDownToLine className="h-4 w-4" />
                {tr('downloadPage', 'public_downloads', lang)}
              </Link>
              <Link
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors"
              >
                📖 {tr('downloadPage', 'complete_guide_cz_en', lang)}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('downloadPage', 'operator_gateway', lang)}</p>
            <h2 className="text-3xl font-semibold text-white">ZION CLI · Windows · Linux · macOS</h2>
            <p className="text-gray-400 max-w-3xl">
              {cs
                ? 'ZION CLI je sjednocený vstup do celého stacku: node, pool, miner, agent, bridge, dao, deploy a monitoring. Veřejné binárky pro Windows, Linux x86_64, Linux ARM64 a macOS Apple Silicon jsou teď živé přímo v download surface níže.'
                : 'ZION CLI is the unified entrypoint for the whole stack: node, pool, miner, agent, bridge, dao, deploy, and monitoring. Public binaries for Windows, Linux x86_64, Linux ARM64, and macOS Apple Silicon are now live directly in the download surface below.'}
            </p>
          </div>

          <div className="rounded-2xl border border-zion-cyan/20 bg-zion-cyan/5 p-5">
            <p className="text-sm text-gray-300">
              <span className="text-zion-cyan font-semibold">{tr('downloadPage', 'source_of_truth', lang)}</span>{' '}
              {tr('downloadPage', 'operator_commands_guide_faq_reference_and_tro', lang)}
              <Link href="/docs" className="text-zion-cyan underline hover:no-underline">ZION CLI</Link>
              {tr('downloadPage', 'section_of_the_docs_if_you_want_checksum_veri', lang)}
            </p>
          </div>
        </section>

        <section id="downloads">
          <DownloadToolBrowser cs={cs} />
        </section>

        {/* ─── Desktop Agent — placeholder ─── */}
        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('downloadPage', 'coming_soon', lang)}</p>
            <h2 className="text-3xl font-semibold text-white">Desktop Agent · {SITE_VERSION}</h2>
            <p className="text-gray-400">{tr('downloadPage', 'one_click_gui_for_mining_wallet_management_an', lang)}</p>
          </div>

          <div className="relative overflow-hidden rounded-4xl border border-zion-gold/20 bg-linear-to-br from-zion-gold/5 via-black/40 to-zion-purple/5 p-8">
            <div className="absolute top-4 right-4 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-3 py-1 text-xs font-semibold tracking-wider text-zion-gold">
              🚧 {tr('downloadPage', 'in_development', lang)}
            </div>

            <div className="flex items-start gap-4 mb-6">
              <Monitor className="mt-1 h-10 w-10 shrink-0 text-zion-gold" />
              <div>
                <h3 className="text-2xl font-semibold text-white">ZION Desktop Agent</h3>
                <p className="text-gray-400 mt-1">
                  {tr('downloadPage', 'full_gui_application_with_built_in_miner_wall', lang)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
              {desktopAgentFeatures.map((f) => (
                <div key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zion-gold" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed"
              >
                <Package className="h-4 w-4" />
                {tr('downloadPage', 'windows_coming_soon', lang)}
              </button>
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed"
              >
                <Package className="h-4 w-4" />
                {tr('downloadPage', 'macos_coming_soon', lang)}
              </button>
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed"
              >
                <Package className="h-4 w-4" />
                {tr('downloadPage', 'linux_coming_soon', lang)}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-zion-gold/20 bg-zion-gold/5 p-4">
              <p className="text-sm text-gray-300">
                <span className="text-zion-gold font-semibold">💡 {tr('downloadPage', 'want_early_access', lang)}</span>{' '}
                {tr('downloadPage', 'the_desktop_agent_will_be_available_in_our', lang)}
                <Link href="/shop" className="text-zion-gold underline hover:no-underline">
                  {tr('downloadPage', 'shop', lang)}
                </Link>{' '}
                {tr('downloadPage', 'as_a_premium_download_with_priority_support_a', lang)}
                <Link href="https://discord.gg/zion-terranova" target="_blank" className="text-zion-gold underline hover:no-underline">
                  Discord
                </Link>{' '}
                {tr('downloadPage', 'to_be_notified_when_it_launches', lang)}
              </p>
            </div>
          </div>
        </section>

        {/* ─── 3-step onboarding ─── */}
        <section className="rounded-4xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('downloadPage', 'quick_start', lang)}</p>
            <h2 className="text-3xl font-semibold text-white">{tr('downloadPage', '3_steps_to_mining', lang)}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {cliQuickstartSteps.map((step) => (
              <div key={step.title} className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-zion-cyan" />
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">{tr('downloadPage', 'step', lang)}</p>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white">{step.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {step.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zion-gold" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Requirements ─── */}
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('downloadPage', 'hardware', lang)}</p>
            <h2 className="text-3xl font-semibold text-white">{tr('downloadPage', 'system_requirements', lang)}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: tr('downloadPage', 'minimum', lang), value: tr('downloadPage', '2_core_cpu_2_gb_ram_100_mb_disk', lang) },
              { label: tr('downloadPage', 'recommended', lang), value: tr('downloadPage', '4_core_cpu_4_gb_ram_500_mb_ssd', lang) },
              { label: tr('downloadPage', 'supported_os', lang), value: tr('downloadPage', 'windows_10_11_linux_x86_64_arm64_macos_apple_', lang) },
              { label: tr('downloadPage', 'network', lang), value: tr('downloadPage', 'stable_internet_outbound_tcp_port_8444_pool_s', lang) },
            ].map((req) => (
              <div key={req.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <Cpu className="h-5 w-5 text-zion-gold" />
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{req.label}</p>
                </div>
                <p className="mt-3 text-lg text-white">{req.value}</p>
              </div>
            ))}
          </div>
        </section>

        <DownloadFaq cs={cs} />

        {/* ─── CTA ─── */}
        <section className="rounded-4xl border border-zion-gold/30 bg-linear-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-10 text-center">
          <TerminalSquare className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{tr('downloadPage', 'ready_to_mine', lang)}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {tr('downloadPage', 'join_our_community_for_mining_support_wallet_', lang)}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="https://discord.gg/zion-terranova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-zion-purple/70 px-6 py-3 text-sm font-semibold text-white border border-zion-purple"
            >
              {tr('downloadPage', 'join_discord', lang)}
            </Link>
            <Link
              href="https://t.me/zionterranova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-zion-cyan/70 px-6 py-3 text-sm font-semibold text-white border border-zion-cyan"
            >
              Telegram
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-6 py-3 text-sm font-semibold text-gray-900"
            >
              {tr('downloadPage', 'documentation', lang)}
            </Link>
            <Link
              href="#downloads"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-6 py-3 text-sm font-semibold text-white"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {tr('downloadPage', 'public_downloads', lang)}
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
