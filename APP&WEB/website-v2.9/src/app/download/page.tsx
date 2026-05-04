'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowDownToLine, CheckCircle2, Cpu, Shield, TerminalSquare,
  Package, Monitor, ExternalLink,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { SITE_POOL_PRIMARY, SITE_RELEASE_LABEL, SITE_VERSION } from '@/lib/site';

const DownloadToolBrowser = dynamic(() => import('@/components/download/DownloadToolBrowser'));
const DownloadFaq = dynamic(() => import('@/components/download/DownloadFaq'));

const DOCS_URL = 'https://github.com/Zion-TerraNova/2.9.6/blob/main/docs/QUICK_START.md';

const getDesktopAgentFeatures = (cs: boolean) => [
  cs ? 'GUI dashboard s hashratem a zustatkem v realnem case' : 'GUI Dashboard with real-time hashrate & balance',
  cs ? 'Tezba na jedno kliknuti — bez terminalu' : 'One-click mining — no terminal needed',
  cs ? 'Vestaveny generator a sprava penezenek' : 'Built-in wallet generator & manager',
  cs ? 'Auto-updaty a integrace do system tray' : 'Auto-updates & system tray integration',
  cs ? 'Vzdalene monitorovani a Gaming mode' : 'Remote monitoring & Gaming mode',
  cs ? 'Dostupne pro Windows, macOS a Linux' : 'Available for Windows, macOS & Linux',
];

const getSteps = (cs: boolean) => [
  {
    name: 'Miner',
    id: 'miner',
    desc: 'CPU/GPU miner with Cosmic Harmony v3 — connect to pool and start earning ZION',
    icon: <Zap className="h-6 w-6" />,
    prefix: 'zion-miner',
    color: 'text-zion-gold',
    quickCmd: `zion-miner --pool stratum+tcp://${SITE_POOL_PRIMARY} --wallet YOUR_ADDRESS`,
  },
  {
    name: 'Wallet',
    id: 'wallet',
    desc: 'Generate wallets, check balance, send transactions — Ed25519 + BIP39 mnemonic',
    icon: <Wallet className="h-6 w-6" />,
    prefix: 'zion-wallet',
    color: 'text-zion-cyan',
    quickCmd: 'zion-wallet gen-mnemonic --out my-wallet.json --print',
  },
  {
    name: 'Node',
    id: 'node',
    desc: 'Full blockchain node — verify transactions, serve RPC, support decentralization',
    icon: <Server className="h-6 w-6" />,
    prefix: 'zion-node',
    color: 'text-zion-purple',
    quickCmd: 'zion-node --network mainnet --rpc-port 8443 --p2p-port 8333',
  },
];

const desktopAgentFeatures = [
  'GUI Dashboard with real-time hashrate & balance',
  'One-click mining — no terminal needed',
  'Built-in wallet generator & manager',
  'Auto-updates & system tray integration',
  'Remote monitoring & Gaming mode',
  'Available for Windows, macOS & Linux',
];

const faqItems = [
  {
    q: 'Do I need a Node to mine?',
    a: `No. Connect your miner to the public pool (${SITE_POOL_PRIMARY}). The pool handles blockchain communication. A node is only needed if you want to verify transactions yourself or run your own pool.`,
  },
  {
    q: 'How do I create a wallet?',
    a: 'Download the Wallet CLI and run: zion-wallet gen-mnemonic --out my-wallet.json --print. Write down the 24 words on paper — they are your backup. Never share them online.',
  },
  {
    q: 'Windows Defender blocks the binary?',
    a: 'Click "More info" → "Run anyway". The binaries are open-source (MIT license) but unsigned. You can also add C:\\ZION\\ to exclusions in Windows Security.',
  },
  {
    q: 'macOS says "cannot be opened"?',
    a: 'Run: xattr -d com.apple.quarantine zion-miner-macos-arm64 — or go to System Settings → Privacy & Security → Allow Anyway.',
  },
  {
    q: 'What is Consciousness Mining?',
    a: 'Your consciousness level (PHYSICAL → COSMIC) multiplies block rewards up to 15×. Level up by consistent mining, discovering blocks, and contributing to network health.',
  },
  {
    q: 'Can I mine on Raspberry Pi?',
    a: 'Yes! Download the linux-arm64 version. RPi 4/5 works well. Hashrate will be lower than desktop CPUs but fully functional.',
  },
];

const steps = [
  {
    title: '1. Create Wallet',
    items: [
      cs ? 'Stahnete zion-wallet pro svuj OS' : 'Download zion-wallet for your OS',
      'Run: zion-wallet gen-mnemonic --out my-wallet.json --print',
      cs ? 'Zapiste si 24 slov na papir — to je vase zaloha!' : 'Write down 24 words on paper — this is your backup!',
    ],
  },
  {
    title: cs ? '2. Spust tezbu' : '2. Start Mining',
    items: [
      cs ? 'Stahnete zion-miner pro svuj OS' : 'Download zion-miner for your OS',
      `Run: zion-miner --pool stratum+tcp://${SITE_POOL_PRIMARY} --wallet YOUR_ADDRESS`,
      cs ? 'Sledujte hashrate a prijate shares v konzoli' : 'Watch hashrate & accepted shares in console',
    ],
  },
  {
    title: cs ? '3. Zkontroluj zustatek' : '3. Check Balance',
    items: [
      'Run: zion-wallet balance --address YOUR_ADDRESS --node https://node.zionterranova.com',
      cs ? 'Nebo navstivte Explorer na zionterranova.com/explorer' : 'Or visit the Explorer at zionterranova.com/explorer',
      cs ? 'Poslat ZION: zion-wallet send --wallet my-wallet.json --to RECIPIENT --amount 100' : 'Send ZION: zion-wallet send --wallet my-wallet.json --to RECIPIENT --amount 100',
    ],
  },
];

/* ───────────────────────── component ───────────────────────── */

export default function DownloadPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const desktopAgentFeatures = getDesktopAgentFeatures(cs);
  const steps = getSteps(cs);

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-5xl space-y-16">

        {/* ─── Hero ─── */}
        <section className="rounded-4xl border border-white/10 bg-black/60 p-10 backdrop-blur-xl">
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
              <ArrowDownToLine className="h-4 w-4" />
              {SITE_RELEASE_LABEL}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? '16 nativnich Rust binarek · 4 platformy' : '16 native Rust binaries · 4 platforms'}</p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {cs ? 'Stahni. Tez. Vydelavej.' : 'Download. Mine. Earn.'}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {cs ? `ZION CLI bootstrap bundle pro verejnou rehearsal linii ${SITE_VERSION} — ` : `ZION CLI bootstrap bundle for the public rehearsal line ${SITE_VERSION} — `}<span className="text-white font-semibold">CLI</span>,{' '}
              <span className="text-zion-gold font-semibold">Miner</span>,{' '}
              <span className="text-zion-cyan font-semibold">Wallet</span> {cs ? 'a' : '&'}{' '}
              <span className="text-zion-purple font-semibold">Node</span>{cs ? ' — pro Windows, Linux a macOS. Predkompilovane nativni Rust binarky. Aktualni download artefakty jsou stale hostovane pod release tagem v2.9.6, ale zustavaji kompatibilni s verejnou linii v2.9.9 Pure Code nad kanonickou runtime cestou v2.9.8.' : ' — for Windows, Linux & macOS. Pre-compiled native Rust binaries. Current download artifacts are still hosted under the v2.9.6 release tag, but remain compatible with the public v2.9.9 Pure Code line on top of the canonical v2.9.8 runtime path.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="#downloads"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                <ArrowDownToLine className="h-4 w-4" />
                {cs ? 'Verejne downloady' : 'Public Downloads'}
              </Link>
              <Link
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors"
              >
                📖 {cs ? 'Kompletni pruvodce (CZ/EN)' : 'Complete Guide (CZ/EN)'}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Operator gateway' : 'Operator gateway'}</p>
            <h2 className="text-3xl font-semibold text-white">ZION CLI · Windows · Linux · macOS</h2>
            <p className="text-gray-400 max-w-3xl">
              {cs
                ? 'ZION CLI je sjednocený vstup do celého stacku: node, pool, miner, agent, bridge, dao, deploy a monitoring. Veřejné binárky pro Windows, Linux x86_64, Linux ARM64 a macOS Apple Silicon jsou teď živé přímo v download surface níže.'
                : 'ZION CLI is the unified entrypoint for the whole stack: node, pool, miner, agent, bridge, dao, deploy, and monitoring. Public binaries for Windows, Linux x86_64, Linux ARM64, and macOS Apple Silicon are now live directly in the download surface below.'}
            </p>
          </div>

          <div className="rounded-2xl border border-zion-cyan/20 bg-zion-cyan/5 p-5">
            <p className="text-sm text-gray-300">
              <span className="text-zion-cyan font-semibold">{cs ? 'Zdroj pravdy:' : 'Source of truth:'}</span>{' '}
              {cs ? 'operátorské příkazy, guide, FAQ, reference a troubleshooting jsou v sekci ' : 'operator commands, guide, FAQ, reference, and troubleshooting live in the '}
              <Link href="/docs" className="text-zion-cyan underline hover:no-underline">ZION CLI</Link>
              {cs ? ' v dokumentaci. Pokud chcete checksum verifikaci, ke každé binárce je na serveru i odpovídající soubor .sha256.' : ' section of the docs. If you want checksum verification, each binary also has a matching .sha256 file on the server.'}
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
            <p className="text-gray-400">{cs ? 'GUI na jedno kliknuti pro tezbu, spravu penezenky a monitoring — bez terminalu' : 'One-click GUI for mining, wallet management and monitoring — no terminal needed'}</p>
          </div>

          <div className="relative overflow-hidden rounded-4xl border border-zion-gold/20 bg-linear-to-br from-zion-gold/5 via-black/40 to-zion-purple/5 p-8">
            <div className="absolute top-4 right-4 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-3 py-1 text-xs font-semibold tracking-wider text-zion-gold">
              🚧 {cs ? 'VE VYVOJI' : 'IN DEVELOPMENT'}
            </div>

            <div className="flex items-start gap-4 mb-6">
              <Monitor className="mt-1 h-10 w-10 shrink-0 text-zion-gold" />
              <div>
                <h3 className="text-2xl font-semibold text-white">ZION Desktop Agent</h3>
                <p className="text-gray-400 mt-1">
                  {cs ? 'Plna GUI aplikace s vestavenym minerem, penezenkou a dashboardem v realnem case. Brzy dostupna pro Windows, macOS a Linux.' : 'Full GUI application with built-in miner, wallet, and real-time dashboard. Available soon for Windows, macOS & Linux.'}
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
                {cs ? 'Windows — Brzy' : 'Windows — Coming Soon'}
              </button>
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed"
              >
                <Package className="h-4 w-4" />
                {cs ? 'macOS — Brzy' : 'macOS — Coming Soon'}
              </button>
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed"
              >
                <Package className="h-4 w-4" />
                {cs ? 'Linux — Brzy' : 'Linux — Coming Soon'}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-zion-gold/20 bg-zion-gold/5 p-4">
              <p className="text-sm text-gray-300">
                <span className="text-zion-gold font-semibold">💡 {cs ? 'Chcete predbezny pristup?' : 'Want early access?'}</span>{' '}
                {cs ? 'Desktop Agent bude dostupny v nasem ' : 'The Desktop Agent will be available in our '}
                <Link href="/shop" className="text-zion-gold underline hover:no-underline">
                  {cs ? 'Shopu' : 'Shop'}
                </Link>{' '}
                {cs ? 'jako premium download s prioritni podporou a auto-updaty. Pripojte se na ' : 'as a premium download with priority support and auto-updates. Join '}
                <Link href="https://discord.gg/zion-terranova" target="_blank" className="text-zion-gold underline hover:no-underline">
                  Discord
                </Link>{' '}
                {cs ? 'a dostanete upozorneni pri launchi.' : 'to be notified when it launches.'}
              </p>
            </div>
          </div>
        </section>

        {/* ─── 3-step onboarding ─── */}
        <section className="rounded-4xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Rychly start' : 'Quick Start'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? '3 kroky k tezbe' : '3 steps to mining'}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.title} className="rounded-3xl border border-white/10 bg-black/30 p-6">
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
        <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Hardware' : 'Hardware'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Systemove pozadavky' : 'System Requirements'}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: cs ? 'Minimum' : 'Minimum', value: cs ? '2jadrovy CPU, 2 GB RAM, 100 MB disk' : '2-core CPU, 2 GB RAM, 100 MB disk' },
              { label: cs ? 'Doporucene' : 'Recommended', value: cs ? '4+ jadrovy CPU, 4 GB RAM, 500 MB SSD' : '4+ core CPU, 4 GB RAM, 500 MB SSD' },
              { label: cs ? 'Podporovane OS' : 'Supported OS', value: cs ? 'Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon)' : 'Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon)' },
              { label: cs ? 'Sit' : 'Network', value: cs ? 'Stabilni internet, odchozi TCP port 3333' : 'Stable internet, outbound TCP port 3333' },
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
          <h2 className="mt-6 text-3xl font-semibold text-white">{cs ? 'Pripraven tezit?' : 'Ready to mine?'}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs ? 'Pripojte se ke komunite pro podporu s tezbou, pomoc s penezenkou a aktuality projektu.' : 'Join our community for mining support, wallet help, and project updates.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="https://discord.gg/zion-terranova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-zion-purple/70 px-6 py-3 text-sm font-semibold text-white border border-zion-purple"
            >
              {cs ? 'Pripojit Discord' : 'Join Discord'}
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
              {cs ? 'Dokumentace' : 'Documentation'}
            </Link>
            <Link
              href="#downloads"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-6 py-3 text-sm font-semibold text-white"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {cs ? 'Verejne downloady' : 'Public Downloads'}
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
