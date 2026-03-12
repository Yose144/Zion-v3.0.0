'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowDownToLine, CheckCircle2, Cpu, Shield, TerminalSquare,
  ChevronDown, Package, Zap, Wallet, Server, Monitor,
  ShoppingCart, ExternalLink, Github,
} from 'lucide-react';
import { useState } from 'react';
import { SITE_POOL_PRIMARY, SITE_RELEASE_LABEL, SITE_VERSION } from '@/lib/site';

/* ───────────────────────── data ───────────────────────── */

const GH = 'https://github.com/Zion-TerraNova/2.9.6/releases/download/v2.9.6';
const GH_RELEASE = 'https://github.com/Zion-TerraNova/2.9.6/releases/tag/v2.9.6';

type CLIBuild = {
  os: string;
  suffix: string;
  icon: string;
  reqs: string[];
};

const platforms: CLIBuild[] = [
  { os: 'Windows 10 / 11 — x64',  suffix: 'windows-x86_64.exe', icon: '🪟', reqs: ['Windows 10+ (64-bit)'] },
  { os: 'Linux — Intel / AMD',     suffix: 'linux-x86_64',       icon: '🐧', reqs: ['Ubuntu 22.04+', 'Debian 12+', 'RHEL 9+'] },
  { os: 'Linux — ARM64 (RPi)',     suffix: 'linux-arm64',        icon: '🐧', reqs: ['Raspberry Pi 4/5', 'Oracle Cloud', 'AWS Graviton'] },
  { os: 'macOS — Apple Silicon',   suffix: 'macos-arm64',        icon: '🍎', reqs: ['macOS 12+', 'Apple M1 / M2 / M3 / M4'] },
];

type ToolInfo = {
  name: string;
  id: string;
  desc: string;
  icon: React.ReactNode;
  prefix: string;
  color: string;
  quickCmd: string;
};

const tools: ToolInfo[] = [
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
    quickCmd: 'zion-node --network mainnet --rpc-port 8444 --p2p-port 8334',
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
      'Download zion-wallet for your OS',
      'Run: zion-wallet gen-mnemonic --out my-wallet.json --print',
      'Write down 24 words on paper — this is your backup!',
    ],
  },
  {
    title: '2. Start Mining',
    items: [
      'Download zion-miner for your OS',
      `Run: zion-miner --pool stratum+tcp://${SITE_POOL_PRIMARY} --wallet YOUR_ADDRESS`,
      'Watch hashrate & accepted shares in console',
    ],
  },
  {
    title: '3. Check Balance',
    items: [
      'Run: zion-wallet balance --address YOUR_ADDRESS --node https://node.zionterranova.com',
      'Or visit the Explorer at zionterranova.com/explorer',
      'Send ZION: zion-wallet send --wallet my-wallet.json --to RECIPIENT --amount 100',
    ],
  },
];

/* ───────────────────────── component ───────────────────────── */

export default function DownloadPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [activeTool, setActiveTool] = useState<string>('miner');

  const tool = tools.find((t) => t.id === activeTool)!;

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-5xl space-y-16">

        {/* ─── Hero ─── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-4xl border border-white/10 bg-black/60 p-10 backdrop-blur-xl"
        >
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
              <ArrowDownToLine className="h-4 w-4" />
              {SITE_RELEASE_LABEL}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">12 native Rust binaries · 4 platforms</p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                Download. Mine. Earn.
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              ZION CLI bootstrap bundle pro live {SITE_VERSION} — <span className="text-zion-gold font-semibold">Miner</span>,{' '}
              <span className="text-zion-cyan font-semibold">Wallet</span> &{' '}
              <span className="text-zion-purple font-semibold">Node</span> — for Windows, Linux & macOS.
              Pre-compiled native Rust binaries. Aktuální download artefakty jsou stále hostované pod release tagem v2.9.6,
              ale zůstávají kompatibilní s Deeksha testnetem.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={GH_RELEASE}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                <Github className="h-4 w-4" />
                GitHub Release
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/Zion-TerraNova/2.9.6/blob/main/docs/QUICK_START.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors"
              >
                📖 Complete Guide (CZ/EN)
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </motion.section>

        {/* ─── CLI Tools — tab switcher ─── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Native Rust CLI</p>
            <h2 className="text-3xl font-semibold text-white">Miner · Wallet · Node</h2>
          </div>

          {/* Tool tabs */}
          <div className="flex gap-2 flex-wrap">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id)}
                className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all ${
                  activeTool === t.id
                    ? 'bg-white/15 border border-white/30 text-white'
                    : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {t.icon}
                {t.name}
              </button>
            ))}
          </div>

          {/* Tool description */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className={`text-sm font-semibold ${tool.color}`}>{tool.name}</p>
            <p className="text-gray-300 mt-1">{tool.desc}</p>
            <div className="mt-3 rounded-xl bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto">
              <span className="text-gray-500">$</span> {tool.quickCmd}
            </div>
          </div>

          {/* Platform cards */}
          <div className="space-y-4">
            {platforms.map((p) => {
              const filename = `${tool.prefix}-${p.suffix}`;
              const url = `${GH}/${filename}`;
              return (
                <div
                  key={p.suffix}
                  className="rounded-3xl border border-white/10 bg-black/40 p-5 hover:border-white/20 transition-colors"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {p.icon} {p.os}
                      </h3>
                      <p className="text-sm text-gray-400 font-mono mt-1">{filename}</p>
                    </div>
                    <Link
                      href={url}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                    >
                      <ArrowDownToLine className="h-4 w-4" />
                      Download
                    </Link>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                    {p.reqs.map((r) => (
                      <span key={r} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{r}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* One-click install */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">One-line install (Linux / macOS)</p>
            <div className="rounded-xl bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto">
              <span className="text-gray-500">$</span>{' '}
              curl -fsSL https://raw.githubusercontent.com/Zion-TerraNova/2.9.6/main/install.sh | bash
            </div>
          </div>
        </motion.section>

        {/* ─── Desktop Agent — placeholder ─── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Coming Soon</p>
            <h2 className="text-3xl font-semibold text-white">Desktop Agent · {SITE_VERSION}</h2>
            <p className="text-gray-400">One-click GUI for mining, wallet management and monitoring — no terminal needed</p>
          </div>

          <div className="relative overflow-hidden rounded-4xl border border-zion-gold/20 bg-linear-to-br from-zion-gold/5 via-black/40 to-zion-purple/5 p-8">
            <div className="absolute top-4 right-4 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-3 py-1 text-xs font-semibold tracking-wider text-zion-gold">
              🚧 IN DEVELOPMENT
            </div>

            <div className="flex items-start gap-4 mb-6">
              <Monitor className="mt-1 h-10 w-10 shrink-0 text-zion-gold" />
              <div>
                <h3 className="text-2xl font-semibold text-white">ZION Desktop Agent</h3>
                <p className="text-gray-400 mt-1">
                  Full GUI application with built-in miner, wallet, and real-time dashboard.
                  Available soon for Windows, macOS & Linux.
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
                Windows — Coming Soon
              </button>
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed"
              >
                <Package className="h-4 w-4" />
                macOS — Coming Soon
              </button>
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed"
              >
                <Package className="h-4 w-4" />
                Linux — Coming Soon
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-zion-gold/20 bg-zion-gold/5 p-4">
              <p className="text-sm text-gray-300">
                <span className="text-zion-gold font-semibold">💡 Want early access?</span>{' '}
                The Desktop Agent will be available in our{' '}
                <Link href="/shop" className="text-zion-gold underline hover:no-underline">
                  Shop
                </Link>{' '}
                as a premium download with priority support and auto-updates.
                Join{' '}
                <Link href="https://discord.gg/zion-terranova" target="_blank" className="text-zion-gold underline hover:no-underline">
                  Discord
                </Link>{' '}
                to be notified when it launches.
              </p>
            </div>
          </div>
        </motion.section>

        {/* ─── 3-step onboarding ─── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-4xl border border-white/10 bg-white/5 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Quick Start</p>
            <h2 className="text-3xl font-semibold text-white">3 steps to mining</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.title} className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-zion-cyan" />
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Step</p>
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
        </motion.section>

        {/* ─── Requirements ─── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Hardware</p>
            <h2 className="text-3xl font-semibold text-white">System Requirements</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: 'Minimum', value: '2-core CPU, 2 GB RAM, 100 MB disk' },
              { label: 'Recommended', value: '4+ core CPU, 4 GB RAM, 500 MB SSD' },
              { label: 'Supported OS', value: 'Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon)' },
              { label: 'Network', value: 'Stable internet, outbound TCP port 3333' },
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
        </motion.section>

        {/* ─── FAQ ─── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-4xl border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Support</p>
            <h2 className="text-3xl font-semibold text-white">FAQ</h2>
          </div>
          <div className="space-y-3">
            {faqItems.map((faq, idx) => (
              <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="text-lg font-semibold text-white pr-4">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-zion-gold transition-transform ${openFaqIndex === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaqIndex === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-5 pb-5"
                  >
                    <p className="text-gray-300 leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.section>

        {/* ─── CTA ─── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-4xl border border-zion-gold/30 bg-linear-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-10 text-center"
        >
          <TerminalSquare className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">Ready to mine?</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            Join our community for mining support, wallet help, and project updates.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="https://discord.gg/zion-terranova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-zion-purple/70 px-6 py-3 text-sm font-semibold text-white border border-zion-purple"
            >
              Join Discord
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
              Documentation
            </Link>
            <Link
              href={GH_RELEASE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-6 py-3 text-sm font-semibold text-white"
            >
              <Github className="h-4 w-4" />
              GitHub
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
