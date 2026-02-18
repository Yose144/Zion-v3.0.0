"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Cog,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Github,
  Globe,
  HardDrive,
  Layers,
  Monitor,
  Network,
  Pickaxe,
  Rocket,
  Server,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  Users,
  Wifi,
  Zap,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   SHARED HELPERS
   ═══════════════════════════════════════════════════════════ */

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      {title && (
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">
          {title}
        </div>
      )}
      <pre className="bg-black/60 border border-white/10 rounded-xl p-4 pr-12 text-sm text-zion-cyan/80 font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/30 hover:text-white/70 transition-all"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="scroll-mt-28" />;
}

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */

const GH_GUIDE =
  "https://github.com/Zion-TerraNova/2.9.5-NativeAwakening/blob/main/docs/MINING_GUIDE.md";
const GH_RELEASE =
  "https://github.com/Zion-TerraNova/2.9.5-NativeAwakening/releases/tag/v2.9.6";
const POOL = "pool.zionterranova.com";

/* ── Algorithms ── */
const algorithms = [
  {
    name: "Cosmic Harmony v3",
    type: "CPU + GPU",
    memory: "256 KB",
    bestFor: "Balanced mining, anti-ASIC",
    stratum: `stratum+tcp://${POOL}:3333`,
  },
  {
    name: "RandomX",
    type: "CPU",
    memory: "2 GB",
    bestFor: "CPU-optimized, Monero-proven",
    stratum: `stratum+tcp://${POOL}:3334`,
  },
  {
    name: "Yescrypt",
    type: "CPU",
    memory: "4 KB",
    bestFor: "Low-memory devices, RPi",
    stratum: `stratum+tcp://${POOL}:3335`,
  },
  {
    name: "Autolykos v2",
    type: "GPU",
    memory: "2.5 GB",
    bestFor: "GPU mining, Ergo-proven",
    stratum: `stratum+tcp://${POOL}:3336`,
  },
];

/* ── Mining guide tabs ── */
type GuideTab = "cpu" | "gpu" | "pool" | "solo";

const guideTabs: {
  id: GuideTab;
  label: string;
  icon: typeof Cpu;
  color: string;
}[] = [
  { id: "cpu", label: "CPU Mining", icon: Cpu, color: "text-zion-cyan" },
  { id: "gpu", label: "GPU Mining", icon: Monitor, color: "text-zion-gold" },
  { id: "pool", label: "Pool Mining", icon: Users, color: "text-zion-purple" },
  {
    id: "solo",
    label: "Solo Mining",
    icon: Sparkles,
    color: "text-emerald-400",
  },
];

/* ── Hardware comparison ── */
const hardware = [
  { hw: "Raspberry Pi 5", hr: "~200 H/s", power: "10W", eff: "20 H/W" },
  { hw: "Intel i7-12700K", hr: "~8 KH/s", power: "125W", eff: "64 H/W" },
  { hw: "AMD Ryzen 9 7950X", hr: "~15 KH/s", power: "170W", eff: "88 H/W" },
  { hw: "Apple M3 Pro", hr: "~12 KH/s", power: "30W", eff: "400 H/W" },
  { hw: "Apple M4 Max", hr: "~22 KH/s", power: "40W", eff: "550 H/W" },
  { hw: "NVIDIA RTX 4070", hr: "~85 MH/s", power: "200W", eff: "425 KH/W" },
  { hw: "NVIDIA RTX 4090", hr: "~160 MH/s", power: "350W", eff: "457 KH/W" },
  { hw: "AMD RX 7900 XTX", hr: "~130 MH/s", power: "300W", eff: "433 KH/W" },
];

/* ── Node setup data ── */
const nodeRequirements = [
  { icon: Cpu, label: "CPU", value: "2+ cores (ARM64 or x86_64)", color: "text-zion-cyan" },
  { icon: HardDrive, label: "RAM", value: "4 GB minimum (8 GB rec.)", color: "text-zion-gold" },
  { icon: Database, label: "Disk", value: "20 GB SSD (grows ~2 GB/yr)", color: "text-zion-purple" },
  { icon: Wifi, label: "Network", value: "Stable broadband, 10 Mbps+", color: "text-emerald-400" },
  { icon: Monitor, label: "OS", value: "Linux, macOS, Windows (WSL2)", color: "text-blue-400" },
];

const ports = [
  { port: "8334", protocol: "TCP", purpose: "P2P peer-to-peer", required: true },
  { port: "8444", protocol: "TCP", purpose: "JSON-RPC API", required: false },
  { port: "3333", protocol: "TCP", purpose: "Stratum mining", required: false },
  { port: "8080", protocol: "TCP", purpose: "Pool API", required: false },
];

const networkConfigs = [
  { name: "Mainnet", file: "mainnet.toml", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", description: "Production network — real ZION" },
  { name: "Testnet", file: "testnet.toml", badge: "bg-zion-gold/10 text-zion-gold border-zion-gold/20", description: "Testing with free test coins" },
  { name: "Devnet", file: "devnet.toml", badge: "bg-zion-purple/10 text-zion-purple border-zion-purple/20", description: "Local development network" },
];

const cliCommands = [
  { cmd: "zion-node --version", desc: "Check installed version" },
  { cmd: "zion-node --config mainnet.toml", desc: "Start with config file" },
  { cmd: "zion-node --network mainnet --rpc-port 8444", desc: "Override RPC port" },
  { cmd: `zion-node --peers ${POOL}:8334`, desc: "Manual peer list" },
  { cmd: "zion-node --log-level debug", desc: "Verbose logging" },
  { cmd: "zion-node --data-dir /custom/path", desc: "Custom data directory" },
];

/* ── In-page nav ── */
const sections = [
  { id: "quick-start", label: "Quick Start" },
  { id: "algorithms", label: "Algorithms" },
  { id: "guides", label: "Mining Guides" },
  { id: "hardware", label: "Hardware" },
  { id: "node-setup", label: "Node Setup" },
  { id: "faq", label: "FAQ" },
];

/* ── FAQ ── */
const faqItems = [
  { q: "Do I need a Node to mine?", a: "No. Connect your miner to the public pool (pool.zionterranova.com:3333). The pool handles blockchain communication. A node is only needed for solo mining or if you want to verify transactions yourself." },
  { q: "Windows Defender blocks the binary?", a: 'Click "More info" → "Run anyway". The binaries are open-source (MIT license) but unsigned. You can also add C:\\ZION\\ to exclusions in Windows Security.' },
  { q: "macOS says 'cannot be opened'?", a: "Run: xattr -d com.apple.quarantine zion-miner-macos-arm64 — or go to System Settings → Privacy & Security → Allow Anyway." },
  { q: "What is Consciousness Mining?", a: "Your consciousness level (PHYSICAL → COSMIC) multiplies block rewards up to 15×. Level up by consistent mining, discovering blocks, and contributing to network health." },
  { q: "Node won't start / No peers connecting?", a: "Check Rust ≥ 1.75 (rustc --version). Ensure port 8334 is free (lsof -i :8334). Verify firewall allows TCP 8334. Try manual peers: --peers pool.zionterranova.com:8334." },
  { q: "Can I mine on Raspberry Pi?", a: "Yes! Download the linux-arm64 version. RPi 4/5 works well with Yescrypt algorithm for best perf/watt." },
];

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function MiningUnifiedClient() {
  const [activeTab, setActiveTab] = useState<GuideTab>("cpu");
  const [activeNetwork, setActiveNetwork] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen pt-28 md:pt-32 pb-24 px-4 overflow-x-hidden">
      {/* ── Background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/15 to-transparent" />
      </div>

      <div className="relative z-10 container mx-auto max-w-5xl space-y-16">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative rounded-4xl border border-white/10 bg-black/60 backdrop-blur-xl p-8 md:p-12 overflow-hidden"
        >
          <div className="absolute inset-0 bg-linear-to-br from-zion-gold/5 via-transparent to-zion-purple/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-zion-gold/10 border border-zion-gold/20">
                <Pickaxe className="w-7 h-7 text-zion-gold" />
              </div>
              <div>
                <h1 className="text-3xl md:text-5xl font-bold text-gradient">
                  Mining & Node Guide
                </h1>
                <p className="text-white/40 text-sm mt-0.5">
                  ZION v2.9.6 · Cosmic Harmony v3 · CPU / GPU / Pool / Solo
                </p>
              </div>
            </div>
            <p className="text-white/50 max-w-2xl text-lg mt-4">
              Everything you need — from first wallet to running a full node.
              Native Rust binaries for Windows, Linux & macOS. No dependencies.
            </p>

            {/* In-page nav */}
            <div className="mt-6 flex flex-wrap gap-2">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="px-3 py-1.5 rounded-xl text-xs bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  {s.label}
                </a>
              ))}
            </div>

            {/* CTA links */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/download"
                className="inline-flex items-center gap-2 rounded-2xl bg-zion-gold/20 border border-zion-gold/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zion-gold/30 transition-colors"
              >
                <ArrowDownToLine className="h-4 w-4" />
                Download Binaries
              </Link>
              <Link
                href={GH_GUIDE}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/10 transition-colors"
              >
                <Github className="h-4 w-4" />
                Full Guide on GitHub
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="/pool"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/10 transition-colors"
              >
                <Globe className="h-4 w-4" />
                Pool Dashboard
              </Link>
            </div>
          </div>
        </motion.section>

        {/* ═══════ QUICK START ═══════ */}
        <SectionAnchor id="quick-start" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-white/10 bg-white/5 p-8"
        >
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-zion-gold" />
            Quick Start — 3 Steps
          </h2>
          <p className="text-white/40 text-sm mb-6">From zero to mining in under 5 minutes.</p>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Create Wallet",
                color: "text-zion-cyan border-zion-cyan/20 bg-zion-cyan/10",
                items: [
                  "Download zion-wallet for your OS",
                  "Run: zion-wallet gen-mnemonic --out my-wallet.json --print",
                  "Write down 24 words on paper — your backup!",
                ],
              },
              {
                step: "2",
                title: "Start Mining",
                color: "text-zion-gold border-zion-gold/20 bg-zion-gold/10",
                items: [
                  "Download zion-miner for your OS",
                  `Run: zion-miner --pool stratum+tcp://${POOL}:3333 --wallet YOUR_ADDRESS`,
                  "Watch hashrate & accepted shares",
                ],
              },
              {
                step: "3",
                title: "Check Balance",
                color: "text-zion-purple border-zion-purple/20 bg-zion-purple/10",
                items: [
                  "Run: zion-wallet balance --address YOUR_ADDRESS",
                  "Visit Explorer at zionterranova.com/explorer",
                  "Send: zion-wallet send --to RECIPIENT --amount 100",
                ],
              },
            ].map((s) => (
              <div key={s.step} className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border ${s.color}`}>
                  {s.step}
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">{s.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {s.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-zion-gold mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* One-line install */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">
              One-line install (Linux / macOS)
            </p>
            <div className="rounded-xl bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto">
              <span className="text-gray-500">$</span>{" "}
              curl -fsSL https://raw.githubusercontent.com/Zion-TerraNova/2.9.5-NativeAwakening/main/install.sh | bash
            </div>
          </div>
        </motion.section>

        {/* ═══════ ALGORITHMS ═══════ */}
        <SectionAnchor id="algorithms" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Layers className="w-6 h-6 text-zion-purple" />
            Supported Algorithms
          </h2>
          <p className="text-white/40 text-sm mb-5">
            Cosmic Harmony v3 rotates RandomX + Yescrypt + Blake3 for ASIC resistance.
            Connect on port 3333 for auto-algo or pick a dedicated port.
          </p>

          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px_1fr] gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02] hidden md:grid">
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Algorithm</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Type</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Memory</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Best For</span>
            </div>
            {algorithms.map((algo, i) => (
              <div
                key={i}
                className="grid grid-cols-1 md:grid-cols-[1fr_80px_80px_1fr] gap-2 px-6 py-4 border-b border-white/[0.04] last:border-0"
              >
                <div>
                  <span className="text-sm font-medium text-white/80">{algo.name}</span>
                  <span className="block text-[10px] text-zion-cyan/60 font-mono mt-0.5">
                    {algo.stratum}
                  </span>
                </div>
                <span className="text-sm text-white/50 hidden md:block">{algo.type}</span>
                <span className="text-sm text-white/50 hidden md:block">{algo.memory}</span>
                <span className="text-sm text-white/40">{algo.bestFor}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ MINING GUIDES (tabs) ═══════ */}
        <SectionAnchor id="guides" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-zion-gold" />
            Mining Guides
          </h2>
          <p className="text-white/40 text-sm mb-5">
            Step-by-step for any hardware — from Raspberry Pi to a GPU rig.
          </p>

          {/* Tab selector */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {guideTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-white/10 border-white/20 text-white font-medium"
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                <tab.icon
                  className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ""}`}
                />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── CPU Mining ── */}
          {activeTab === "cpu" && (
            <motion.div key="cpu" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-zion-cyan" />
                  CPU Mining with ZION Native Miner
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  Works on any x86_64 or ARM64 CPU. Best algos:{" "}
                  <strong className="text-white/60">Cosmic Harmony v3</strong>,{" "}
                  <strong className="text-white/60">RandomX</strong>,{" "}
                  <strong className="text-white/60">Yescrypt</strong> (low-memory).
                </p>
                <div className="space-y-4">
                  <CodeBlock
                    title="Option A — Pre-compiled binary (recommended)"
                    code={`# Download from GitHub Release
# → https://github.com/Zion-TerraNova/2.9.5-NativeAwakening/releases/tag/v2.9.6

# Linux/macOS — one-line install:
curl -fsSL https://raw.githubusercontent.com/Zion-TerraNova/2.9.5-NativeAwakening/main/install.sh | bash

# Or download manually and make executable:
chmod +x zion-miner-linux-x86_64
./zion-miner-linux-x86_64 --version`}
                  />
                  <CodeBlock
                    title="Option B — Build from source"
                    code={`git clone https://github.com/Zion-TerraNova/Zion-2.9.5.git
cd Zion-2.9.5
cargo build --release -p zion-miner
ls -la target/release/zion-miner`}
                  />
                  <CodeBlock
                    title="Start mining (pool)"
                    code={`zion-miner \\
  --algo cosmic-harmony-v3 \\
  --pool stratum+tcp://${POOL}:3333 \\
  --wallet YOUR_ZION_ADDRESS \\
  --threads $(nproc)`}
                  />
                  <CodeBlock
                    title="Alternative: XMRig for RandomX"
                    code={`./xmrig \\
  -o stratum+tcp://${POOL}:3334 \\
  -u YOUR_ZION_ADDRESS \\
  -p x \\
  -a rx/0 \\
  --threads=$(nproc)`}
                  />
                  <div className="rounded-xl bg-zion-cyan/5 border border-zion-cyan/10 p-4">
                    <h4 className="text-sm font-medium text-zion-cyan mb-2">💡 CPU Tips</h4>
                    <ul className="text-sm text-white/40 space-y-1">
                      <li>• Enable huge pages for RandomX: <code className="text-zion-cyan/60 text-xs">sudo sysctl -w vm.nr_hugepages=1280</code></li>
                      <li>• Leave 1–2 cores free for system if mining 24/7</li>
                      <li>• Monitor temperature: keep below 85°C</li>
                      <li>• ARM64 (Raspberry Pi 4/5): use Yescrypt for best perf/watt</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── GPU Mining ── */}
          {activeTab === "gpu" && (
            <motion.div key="gpu" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-zion-gold" />
                  GPU Mining — Metal, CUDA & OpenCL
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  Apple Metal (M1–M4), NVIDIA CUDA (GTX/RTX), AMD OpenCL (RX/Vega).
                </p>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10 text-white/50">Apple Silicon</span>
                    <h4 className="text-sm font-medium text-white/80">Metal (macOS)</h4>
                  </div>
                  <CodeBlock
                    code={`cargo build --release -p zion-miner --features metal

./target/release/zion-miner \\
  --algo cosmic-harmony-v3 \\
  --pool stratum+tcp://${POOL}:3333 \\
  --wallet YOUR_ZION_ADDRESS \\
  --gpu metal --gpu-intensity 80`}
                  />
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">NVIDIA</span>
                    <h4 className="text-sm font-medium text-white/80">CUDA (Linux/Windows)</h4>
                  </div>
                  <CodeBlock
                    code={`# Requires NVIDIA Driver ≥ 535 + CUDA ≥ 12.0
cargo build --release -p zion-miner --features cuda

./target/release/zion-miner \\
  --algo autolykos2 \\
  --pool stratum+tcp://${POOL}:3336 \\
  --wallet YOUR_ZION_ADDRESS \\
  --gpu cuda --gpu-devices 0,1`}
                  />
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 border border-red-500/20 text-red-400">AMD</span>
                    <h4 className="text-sm font-medium text-white/80">OpenCL (Linux/Windows)</h4>
                  </div>
                  <CodeBlock
                    code={`# Requires AMD ROCm ≥ 5.0 or AMDGPU-PRO
cargo build --release -p zion-miner --features opencl

./target/release/zion-miner \\
  --algo autolykos2 \\
  --pool stratum+tcp://${POOL}:3336 \\
  --wallet YOUR_ZION_ADDRESS \\
  --gpu opencl`}
                  />
                </div>

                <div className="rounded-xl bg-zion-gold/5 border border-zion-gold/10 p-4">
                  <h4 className="text-sm font-medium text-zion-gold mb-2">⚡ GPU Tips</h4>
                  <ul className="text-sm text-white/40 space-y-1">
                    <li>• Autolykos v2 is best for GPU — memory-hard, ASIC-resistant</li>
                    <li>• Cosmic Harmony v3 works on CPU + GPU simultaneously</li>
                    <li>• Undervolt for 20–30% power saving</li>
                    <li>• Keep GPU &lt; 80°C, VRAM &lt; 95°C</li>
                    <li>• <code className="text-zion-gold/60 text-xs">--gpu-intensity 60-80</code> for desktop use while mining</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Pool Mining ── */}
          {activeTab === "pool" && (
            <motion.div key="pool" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-zion-purple" />
                  Pool Mining — Steady Rewards
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  Combines hashrate from many miners for frequent, predictable payouts. Best for most miners.
                </p>

                <div className="rounded-xl bg-white/[0.02] border border-white/10 p-5 mb-5">
                  <h4 className="text-sm font-medium text-white/60 mb-3">ZION Official Pool Endpoints</h4>
                  <div className="space-y-2">
                    {algorithms.map((algo, i) => (
                      <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-1 py-2 border-b border-white/[0.04] last:border-0">
                        <span className="text-sm text-white/70">{algo.name}</span>
                        <code className="text-xs font-mono text-zion-cyan/70">{algo.stratum}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <CodeBlock
                  title="Quick start — Pool mining"
                  code={`zion-miner \\
  --algo cosmic-harmony-v3 \\
  --pool stratum+tcp://${POOL}:3333 \\
  --wallet YOUR_ZION_ADDRESS \\
  --worker-name my-rig-01 \\
  --threads $(nproc)`}
                />

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Fee", value: "1%", desc: "Lowest in class" },
                    { label: "Payout", value: "PPLNS", desc: "Pay-per-last-N-shares" },
                    { label: "Min Payout", value: "10 ZION", desc: "Automatic transfer" },
                    { label: "Interval", value: "Every 2h", desc: "When threshold met" },
                  ].map((feat, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-white/30 uppercase tracking-wider">{feat.label}</span>
                        <span className="text-sm font-medium text-white/80">{feat.value}</span>
                      </div>
                      <span className="text-[11px] text-white/25">{feat.desc}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-xl bg-zion-purple/5 border border-zion-purple/10 p-4">
                  <h4 className="text-sm font-medium text-zion-purple mb-2">📊 Monitor Your Miner</h4>
                  <p className="text-sm text-white/40">
                    Track hashrate, shares, and payouts on the{" "}
                    <Link href="/pool" className="text-zion-purple underline hover:text-white transition-colors">Pool Dashboard</Link>.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Solo Mining ── */}
          {activeTab === "solo" && (
            <motion.div key="solo" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  Solo Mining — Full Block Rewards
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  Mine directly against the blockchain. Full 50 ZION + fees per block.
                </p>

                <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 mb-5">
                  <h4 className="text-sm font-medium text-amber-400 mb-1">⚠️ Who should solo mine?</h4>
                  <p className="text-sm text-white/40">
                    Recommended if you have significant hashrate (&gt;10% of network). Otherwise, pool mining gives more consistent payouts.
                  </p>
                </div>

                <CodeBlock
                  title="Step 1 — Run your own full node"
                  code={`zion-node --config config/mainnet.toml --rpc-port 8444`}
                />
                <div className="mt-4">
                  <CodeBlock
                    title="Step 2 — Mine against your node"
                    code={`zion-miner \\
  --algo cosmic-harmony-v3 \\
  --node http://127.0.0.1:8444 \\
  --wallet YOUR_ZION_ADDRESS \\
  --threads $(nproc) \\
  --solo`}
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                    <h4 className="text-sm font-medium text-emerald-400 mb-2">✅ Pros</h4>
                    <ul className="text-sm text-white/40 space-y-1">
                      <li>• Full 50 ZION block reward</li>
                      <li>• No pool fees</li>
                      <li>• Maximum decentralization</li>
                      <li>• Privacy — no pool knows your address</li>
                    </ul>
                  </div>
                  <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4">
                    <h4 className="text-sm font-medium text-red-400 mb-2">❌ Cons</h4>
                    <ul className="text-sm text-white/40 space-y-1">
                      <li>• Irregular payouts (luck-based)</li>
                      <li>• Need to run a full node</li>
                      <li>• High variance with low hashrate</li>
                      <li>• No partial share rewards</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.section>

        {/* ═══════ HARDWARE COMPARISON ═══════ */}
        <SectionAnchor id="hardware" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="w-6 h-6 text-zion-gold" />
            Hardware Comparison
          </h2>
          <p className="text-white/40 text-sm mb-5">Approximate values for Cosmic Harmony v3 / RandomX / Autolykos v2.</p>

          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_80px_100px] gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02] hidden md:grid">
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Hardware</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Hashrate</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Power</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Efficiency</span>
            </div>
            {hardware.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-2 md:grid-cols-[1fr_100px_80px_100px] gap-2 px-6 py-3 border-b border-white/[0.04] last:border-0"
              >
                <div>
                  <span className="text-sm text-white/80">{row.hw}</span>
                  <span className="block md:hidden text-[10px] text-white/25 mt-0.5">{row.hr} · {row.power}</span>
                </div>
                <span className="text-sm font-mono text-zion-cyan/70 hidden md:block">{row.hr}</span>
                <span className="text-sm text-white/40 hidden md:block">{row.power}</span>
                <span className="text-sm text-white/50 hidden md:block">{row.eff}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ NODE SETUP ═══════ */}
        <SectionAnchor id="node-setup" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-10"
        >
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Server className="w-6 h-6 text-zion-cyan" />
              Run a Full Node
            </h2>
            <p className="text-white/50 text-sm">
              Strengthen the network by validating transactions and relaying blocks.
              10 minutes from zero to synced — no special hardware required.
            </p>
          </div>

          {/* System Requirements */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Cog className="w-5 h-5 text-zion-gold" />
              System Requirements
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nodeRequirements.map((req, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <req.icon className={`w-4 h-4 ${req.color}`} />
                    <span className="text-[11px] text-white/40 uppercase tracking-wider">{req.label}</span>
                  </div>
                  <span className="text-sm text-white/80">{req.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Installation */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Download className="w-5 h-5 text-zion-cyan" />
              Installation
            </h3>

            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zion-gold/10 border border-zion-gold/20 text-zion-gold text-xs font-bold">1</span>
                <h4 className="text-white font-medium">Pre-compiled Binary (recommended)</h4>
              </div>
              <CodeBlock
                code={`# Download from GitHub Release
# → ${GH_RELEASE}

# Or use one-line install:
curl -fsSL https://raw.githubusercontent.com/Zion-TerraNova/2.9.5-NativeAwakening/main/install.sh | bash

# Manual:
chmod +x zion-node-linux-x86_64
./zion-node-linux-x86_64 --version`}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zion-cyan/10 border border-zion-cyan/20 text-zion-cyan text-xs font-bold">2</span>
                <h4 className="text-white font-medium">Build from Source</h4>
              </div>
              <CodeBlock
                code={`git clone https://github.com/Zion-TerraNova/Zion-2.9.5.git
cd Zion-2.9.5
cargo build --release -p zion-node
# Binary → target/release/zion-node`}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zion-purple/10 border border-zion-purple/20 text-zion-purple text-xs font-bold">3</span>
                <h4 className="text-white font-medium">Docker</h4>
              </div>
              <CodeBlock
                code={`docker pull ghcr.io/zion-terranova/zion-node:2.9.5

docker run -d \\
  --name zion-node \\
  -p 8334:8334 -p 8444:8444 \\
  -v zion-data:/data \\
  ghcr.io/zion-terranova/zion-node:2.9.5 \\
  --config /etc/zion/mainnet.toml`}
              />
            </div>
          </div>

          {/* Network Configuration */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Network className="w-5 h-5 text-zion-purple" />
              Network Configuration
            </h3>

            <div className="flex items-center gap-2 mb-4">
              {networkConfigs.map((net, i) => (
                <button
                  key={i}
                  onClick={() => setActiveNetwork(i)}
                  className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                    activeNetwork === i
                      ? net.badge + " font-medium"
                      : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {net.name}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
              <p className="text-white/50 text-sm mb-4">
                {networkConfigs[activeNetwork].description} — config:{" "}
                <code className="text-zion-cyan/80 bg-zion-cyan/5 px-2 py-0.5 rounded text-xs">
                  config/{networkConfigs[activeNetwork].file}
                </code>
              </p>
              <CodeBlock
                title={networkConfigs[activeNetwork].file}
                code={`[network]
name = "${networkConfigs[activeNetwork].name.toLowerCase()}"
p2p_port = 8334
rpc_port = 8444
max_peers = 128

[consensus]
algorithm = "cosmic-harmony-v3"
block_time = 60
difficulty_adjustment = "per-block"

[mining]
stratum_port = 3333
reward_address = "YOUR_ZION_ADDRESS"

[storage]
data_dir = "~/.zion/${networkConfigs[activeNetwork].name.toLowerCase()}"

[peers]
bootstrap = [
  "${POOL}:8334"
]`}
              />
            </div>
          </div>

          {/* Ports & Firewall */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Ports & Firewall
            </h3>

            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
              <div className="grid grid-cols-4 gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02]">
                <span className="text-[11px] text-white/30 uppercase tracking-wider">Port</span>
                <span className="text-[11px] text-white/30 uppercase tracking-wider">Protocol</span>
                <span className="text-[11px] text-white/30 uppercase tracking-wider">Purpose</span>
                <span className="text-[11px] text-white/30 uppercase tracking-wider text-right">Required</span>
              </div>
              {ports.map((p, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 px-6 py-3 border-b border-white/[0.04] last:border-0">
                  <span className="font-mono text-sm text-zion-cyan/80">{p.port}</span>
                  <span className="text-sm text-white/50">{p.protocol}</span>
                  <span className="text-sm text-white/70">{p.purpose}</span>
                  <span className="text-right">
                    {p.required ? (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">Required</span>
                    ) : (
                      <span className="text-[10px] bg-white/5 text-white/30 border border-white/10 px-2 py-0.5 rounded-full">Optional</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <CodeBlock
                title="UFW Firewall (Ubuntu/Debian)"
                code={`sudo ufw allow 8334/tcp comment "ZION P2P"
sudo ufw allow from 127.0.0.1 to any port 8444 proto tcp comment "ZION RPC"
sudo ufw status`}
              />
            </div>
          </div>

          {/* CLI Reference */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-zion-gold" />
              Node CLI Reference
            </h3>

            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
              {cliCommands.map((c, i) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-6 py-3.5 border-b border-white/[0.04] last:border-0">
                  <code className="text-sm font-mono text-zion-cyan/80 break-all">{c.cmd}</code>
                  <span className="text-xs text-white/30 md:text-right shrink-0">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verify Node */}
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 space-y-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Rocket className="w-5 h-5 text-emerald-400" />
              Verify Your Node
            </h3>
            <CodeBlock
              title="Check sync status"
              code={`curl -s http://localhost:8444 \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getBlockchainInfo"}' | jq .`}
            />
            <CodeBlock
              title="Check peers"
              code={`curl -s http://localhost:8444 \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getPeerCount"}' | jq .`}
            />
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-sm text-white/60">
                  <p className="font-medium text-emerald-400 mb-1">Success criteria</p>
                  <ul className="space-y-1 text-white/40">
                    <li>• Block height matches <Link href="/explorer" className="text-zion-cyan/60 hover:text-zion-cyan underline">Explorer</Link></li>
                    <li>• 2+ peers connected</li>
                    <li>• New blocks every ~60 seconds</li>
                    <li>• RPC responds to queries</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ FAQ ═══════ */}
        <SectionAnchor id="faq" />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-white mb-5 flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-400" />
            FAQ & Troubleshooting
          </h2>

          <div className="space-y-3">
            {faqItems.map((faq, idx) => (
              <div key={idx} className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm font-semibold text-white/80 pr-4">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-zion-gold shrink-0 transition-transform ${openFaqIndex === idx ? "rotate-180" : ""}`} />
                </button>
                {openFaqIndex === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-5 pb-5"
                  >
                    <p className="text-sm text-white/50 leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-10 text-center"
        >
          <Pickaxe className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">Ready to mine ZION?</h2>
          <p className="mt-4 text-gray-100 max-w-2xl mx-auto">
            Join the community. Every hash strengthens the network.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/download"
              className="inline-flex items-center gap-2 rounded-2xl bg-zion-gold/80 px-6 py-3 text-sm font-semibold text-black border border-zion-gold hover:brightness-110 transition-all"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Download Binaries
            </Link>
            <Link
              href="/pool"
              className="inline-flex items-center gap-2 rounded-2xl bg-zion-purple/70 px-6 py-3 text-sm font-semibold text-white border border-zion-purple"
            >
              <Globe className="h-4 w-4" />
              Pool Dashboard
            </Link>
            <Link
              href={GH_GUIDE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-6 py-3 text-sm font-semibold text-white"
            >
              <Github className="h-4 w-4" />
              Full Guide on GitHub
            </Link>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-6 py-3 text-sm font-semibold text-gray-300"
            >
              Explorer
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
