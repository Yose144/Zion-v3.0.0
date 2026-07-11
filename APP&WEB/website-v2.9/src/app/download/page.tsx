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

const getDesktopAgentFeatures = (cs: boolean) => [
  cs ? 'GUI dashboard s hashratem a zůstatkem v reálném čase' : 'GUI Dashboard with real-time hashrate & balance',
  cs ? 'Těžba na jedno kliknutí — bez terminálu' : 'One-click mining — no terminal needed',
  cs ? 'Vestavěný generátor a správa peněženek' : 'Built-in wallet generator & manager',
  cs ? 'Auto-updaty a integrace do system tray' : 'Auto-updates & system tray integration',
  cs ? 'Vzdálené monitorování a Gaming mode' : 'Remote monitoring & Gaming mode',
  cs ? 'Dostupné pro Windows, macOS a Linux' : 'Available for Windows, macOS & Linux',
];

const getCliQuickstartSteps = (cs: boolean) => [
  {
    title: cs ? '1. Vytvoř peněženku' : '1. Create Wallet',
    items: [
      cs ? 'Stáhni ZION CLI pro Windows níže' : 'Download ZION CLI for Windows below',
      'Run: zion wallet new --mnemonic --out my-wallet.json --print',
      cs ? 'Zapiš si 24 slov na papír — to je tvá záloha!' : 'Write down 24 words on paper — this is your backup!',
    ],
  },
  {
    title: cs ? '2. Spusť těžbu' : '2. Start Mining',
    items: [
      cs ? 'Nastav adresu: zion config set miner.wallet YOUR_ADDRESS' : 'Set address: zion config set miner.wallet YOUR_ADDRESS',
      `Run: zion mine start --pool stratum+tcp://${SITE_POOL_PRIMARY}`,
      cs ? 'Sleduj hashrate a přijaté shares v konzoli' : 'Watch hashrate & accepted shares in console',
    ],
  },
  {
    title: cs ? '3. Zkontroluj zůstatek' : '3. Check Balance',
    items: [
      'Run: zion wallet balance --address YOUR_ADDRESS',
      cs ? 'Nebo navštiv Explorer na zionterranova.com/explorer' : 'Or visit the Explorer at zionterranova.com/explorer',
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
    <div className="zion-page">
      <div className="zion-container max-w-5xl space-y-16">

        {/* ─── Hero ─── */}
        <section
          className="zion-rainbow-card p-5 sm:p-8 md:p-10"
          style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-6">
            <div className="zion-kicker border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <ArrowDownToLine className="h-4 w-4" />
              {SITE_RELEASE_LABEL}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? '4 platformy · jeden binární soubor · interaktivní menu' : '4 platforms · one binary · interactive menu'}</p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {cs ? 'Stáhni. Těž. Vydělávej.' : 'Download. Mine. Earn.'}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {cs ? `ZION v3.0.5-beta — zjednodušený Community CLI. Jeden binary s interaktivním menu: ` : `ZION v3.0.5-beta — simplified Community CLI. One binary with an interactive menu: `}{' '}
              <span className="text-white font-semibold">wallet</span>,{' '}
              <span className="text-zion-gold font-semibold">node</span>,{' '}
              <span className="text-zion-cyan font-semibold">miner</span>,{' '}
              <span className="text-zion-purple font-semibold">pool</span>
              {cs ? ' — vše v jednom. Dostupné pro ' : ' — all in one. Available for '}{' '}
              <span className="text-emerald-400 font-semibold">Linux x86_64</span>,{' '}
              <span className="text-purple-400 font-semibold">macOS Apple Silicon</span>,{' '}
              <span className="text-indigo-400 font-semibold">macOS Intel</span>{' '}
              {cs ? 'a ' : ' and '}{' '}
              <span className="text-blue-400 font-semibold">Windows x86_64</span>
              {cs ? '. ARM64 (Raspberry Pi) ze zdrojů.' : '. ARM64 (Raspberry Pi) from source.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="#downloads"
                className="zion-button-primary text-sm"
              >
                <ArrowDownToLine className="h-4 w-4" />
                {cs ? 'Stáhnout binárky' : 'Download binaries'}
              </Link>
              <Link
                href="https://github.com/Zion-TerraNova/v3-Mainnet/releases"
                target="_blank"
                rel="noreferrer"
                className="zion-button-secondary text-sm"
              >
                <ExternalLink className="h-3 w-3" />
                {cs ? 'GitHub Releases' : 'GitHub Releases'}
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Veřejný mainnet release' : 'Public mainnet release'}</p>
            <h2 className="text-3xl font-semibold text-white">ZION v3.0.5-beta · 4 platformy</h2>
            <p className="text-gray-400 max-w-3xl">
              {cs
                ? 'Zjednodušený Community CLI — jeden binary s interaktivním menu pro wallet, node, miner a pool. Dostupný pro Linux x86_64, macOS (Apple Silicon + Intel) a Windows x86_64 přímo z GitHub Releases s SHA256 verifikací. ARM64 (Raspberry Pi) build ze zdrojů.'
                : 'Simplified Community CLI — one binary with an interactive menu for wallet, node, miner, and pool. Available for Linux x86_64, macOS (Apple Silicon + Intel), and Windows x86_64 directly from GitHub Releases with SHA256 verification. ARM64 (Raspberry Pi) build from source.'}
            </p>
          </div>

          <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <p className="text-sm text-gray-300">
              <span className="text-zion-cyan font-semibold">{cs ? 'Zdroj pravdy:' : 'Source of truth:'}</span>{' '}
              {cs ? 'operátorské příkazy, guide, FAQ, reference a troubleshooting jsou v sekci ' : 'operator commands, guide, FAQ, reference, and troubleshooting live in the '}
              <Link href="/docs" className="text-zion-cyan underline hover:no-underline">ZION CLI</Link>
              {cs ? ' v dokumentaci. Zdrojový kód je open-source na ' : ' section of the docs. Source code is open-source on '}
              <Link href="https://github.com/Zion-TerraNova/v3-Mainnet" target="_blank" className="text-zion-cyan underline hover:no-underline">GitHub</Link>
              {cs ? ' (MIT licence).' : ' (MIT license).'}
            </p>
          </div>
        </section>

        <section id="downloads">
          <DownloadToolBrowser cs={cs} />
        </section>

        {/* ─── Desktop Agent — placeholder ─── */}
        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Brzy' : 'Coming Soon'}</p>
            <h2 className="text-3xl font-semibold text-white">Desktop Agent · {SITE_VERSION}</h2>
            <p className="text-gray-400">{cs ? 'GUI na jedno kliknutí pro těžbu, správu peněženky a monitoring — bez terminálu' : 'One-click GUI for mining, wallet management and monitoring — no terminal needed'}</p>
          </div>

          <div className="relative overflow-hidden zion-rainbow-card p-8" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="absolute top-4 right-4 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-3 py-1 text-xs font-semibold tracking-wider text-zion-gold">
              🚧 {cs ? 'VE VYVOJI' : 'IN DEVELOPMENT'}
            </div>

            <div className="flex items-start gap-4 mb-6">
              <Monitor className="mt-1 h-10 w-10 shrink-0 text-zion-gold" />
              <div>
                <h3 className="text-2xl font-semibold text-white">ZION Desktop Agent</h3>
                <p className="text-gray-400 mt-1">
                  {cs ? 'Plná GUI aplikace s vestavěným minerem, peněženkou a dashboardem v reálném čase. Brzy dostupná pro Windows, macOS a Linux.' : 'Full GUI application with built-in miner, wallet, and real-time dashboard. Available soon for Windows, macOS & Linux.'}
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
                className="zion-button-secondary opacity-50 cursor-not-allowed text-sm"
              >
                <Package className="h-4 w-4" />
                {cs ? 'Windows — Brzy' : 'Windows — Coming Soon'}
              </button>
              <button
                disabled
                className="zion-button-secondary opacity-50 cursor-not-allowed text-sm"
              >
                <Package className="h-4 w-4" />
                {cs ? 'macOS — Brzy' : 'macOS — Coming Soon'}
              </button>
              <button
                disabled
                className="zion-button-secondary opacity-50 cursor-not-allowed text-sm"
              >
                <Package className="h-4 w-4" />
                {cs ? 'Linux — Brzy' : 'Linux — Coming Soon'}
              </button>
            </div>

            <div className="mt-6 zion-rainbow-sub p-4" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-sm text-gray-300">
                <span className="text-zion-gold font-semibold">💡 {cs ? 'Chcete předběžný přístup?' : 'Want early access?'}</span>{' '}
                {cs ? 'Desktop Agent bude dostupný v našem ' : 'The Desktop Agent will be available in our '}
                <Link href="/shop" className="text-zion-gold underline hover:no-underline">
                  {cs ? 'Shopu' : 'Shop'}
                </Link>{' '}
                {cs ? 'jako premium download s prioritní podporou a auto-updaty. Připojte se na ' : 'as a premium download with priority support and auto-updates. Join '}
                <Link href="https://discord.gg/zion-terranova" target="_blank" className="text-zion-gold underline hover:no-underline">
                  Discord
                </Link>{' '}
                {cs ? 'a dostanete upozornění při launchi.' : 'to be notified when it launches.'}
              </p>
            </div>
          </div>
        </section>

        {/* ─── 3-step onboarding ─── */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Rychlý start' : 'Quick Start'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? '3 kroky k těžbě' : '3 steps to mining'}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {cliQuickstartSteps.map((step) => (
              <div key={step.title} className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-zion-cyan" />
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">{cs ? 'Krok' : 'Step'}</p>
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
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Hardware' : 'Hardware'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Systémové požadavky' : 'System Requirements'}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: cs ? 'Minimum' : 'Minimum', value: cs ? '2jádrový CPU, 2 GB RAM, 100 MB disk' : '2-core CPU, 2 GB RAM, 100 MB disk' },
              { label: cs ? 'Doporučené' : 'Recommended', value: cs ? '4+ jádrový CPU, 4 GB RAM, 500 MB SSD' : '4+ core CPU, 4 GB RAM, 500 MB SSD' },
              { label: cs ? 'Podporované OS' : 'Supported OS', value: cs ? 'Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon)' : 'Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon)' },
              { label: cs ? 'Síť' : 'Network', value: cs ? 'Stabilní internet, odchozí TCP port 8444 (pool stratum)' : 'Stable internet, outbound TCP port 8444 (pool stratum)' },
            ].map((req) => (
              <div key={req.label} className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
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
        <section className="zion-cta-banner">
          <TerminalSquare className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{cs ? 'Připraven těžit?' : 'Ready to mine?'}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs ? 'Připojte se ke komunitě pro podporu s těžbou, pomoc s peněženkou a aktuality projektu.' : 'Join our community for mining support, wallet help, and project updates.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="https://discord.gg/zion-terranova"
              target="_blank"
              rel="noreferrer"
              className="zion-button-primary text-sm"
            >
              {cs ? 'Připojit se na Discord' : 'Join Discord'}
            </Link>
            <Link
              href="https://t.me/zionterranova"
              target="_blank"
              rel="noreferrer"
              className="zion-button-secondary text-sm"
            >
              Telegram
            </Link>
            <Link
              href="/docs"
              className="zion-button-secondary text-sm"
            >
              {cs ? 'Dokumentace' : 'Documentation'}
            </Link>
            <Link
              href="#downloads"
              className="zion-button-secondary text-sm"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {cs ? 'Veřejné downloady' : 'Public Downloads'}
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
