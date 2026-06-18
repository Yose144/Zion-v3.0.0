"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Cpu,
  Flame,
  Globe,
  Layers,
  Monitor,
  Pickaxe,
  Rocket,
  Server,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import { SITE_POOL_PRIMARY, SITE_PRIMARY_HOST } from '@/lib/site';

const PRIMARY_STRATUM_BASE = `stratum+tcp://${SITE_PRIMARY_HOST}`;

/* ── copy helper ────────────────────────────────────────── */

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

/* ── guide tabs ──────────────────────────────────────────── */

type GuideTab = "cpu" | "gpu" | "pool" | "solo";

const tabs: { id: GuideTab; label: string; icon: typeof Cpu; color: string }[] = [
  { id: "cpu", label: "CPU Mining", icon: Cpu, color: "text-zion-cyan" },
  { id: "gpu", label: "GPU Mining", icon: Monitor, color: "text-zion-gold" },
  { id: "pool", label: "Pool Mining", icon: Users, color: "text-zion-purple" },
  { id: "solo", label: "Solo Mining", icon: Sparkles, color: "text-emerald-400" },
];

/* ── algorithms table ────────────────────────────────────── */

const algorithms = [
  {
    name: "Cosmic Harmony Deeksha",
    type: "CPU + GPU",
    memory: "256 KB",
    bestFor: "Balanced mining, anti-ASIC",
    stratum: `stratum+tcp://${SITE_POOL_PRIMARY}`,
    algo: "cosmic_harmony",
  },
  {
    name: "RandomX",
    type: "CPU",
    memory: "2 GB",
    bestFor: "CPU-optimized, Monero-proven",
    stratum: `${PRIMARY_STRATUM_BASE}:8444`,
    algo: "randomx",
  },
  {
    name: "Yescrypt",
    type: "CPU",
    memory: "4 KB",
    bestFor: "Low-memory devices, RPi",
    stratum: `${PRIMARY_STRATUM_BASE}:8444`,
    algo: "yescrypt",
  },
  {
    name: "Autolykos v2",
    type: "GPU",
    memory: "2.5 GB",
    bestFor: "GPU mining, Ergo-proven",
    stratum: `${PRIMARY_STRATUM_BASE}:8444`,
    algo: "autolykos2",
  },
];

/* ── component ──────────────────────────────────────────── */

export default function MiningGuidesClient() {
  const [activeTab, setActiveTab] = useState<GuideTab>("cpu");

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* ── Background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-12">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link
            href="/mining"
            className="hover:text-white/70 transition-colors flex items-center gap-1"
          >
            <Pickaxe className="w-4 h-4" />
            Mining
          </Link>
          <span>/</span>
          <span className="text-white/80">Guides</span>
        </div>

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
                <BookOpen className="w-7 h-7 text-zion-gold" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gradient">
                  Mining Guides
                </h1>
                <p className="text-white/40 text-sm mt-0.5">
                  CPU · GPU · Pool · Solo — every path covered
                </p>
              </div>
            </div>
            <p className="text-white/50 max-w-2xl text-lg">
              Step-by-step instructions for mining ZION with any hardware. From a
              Raspberry Pi to a GPU rig — find your optimal setup below.
            </p>
          </div>
        </motion.section>

        {/* ═══════ ALGORITHMS TABLE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Layers className="w-5 h-5 text-zion-purple" />
            Supported Algorithms
          </h2>

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
                  <span className="block md:hidden text-[10px] text-white/30 mt-0.5">
                    {algo.type} · {algo.memory}
                  </span>
                </div>
                <span className="text-sm text-white/50 hidden md:block">{algo.type}</span>
                <span className="text-sm text-white/50 hidden md:block">{algo.memory}</span>
                <span className="text-sm text-white/40">{algo.bestFor}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ GUIDE TABS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {/* Tab selector */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? `bg-white/10 border-white/20 text-white font-medium`
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ""}`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── CPU Mining Guide ── */}
          {activeTab === "cpu" && (
            <motion.div
              key="cpu"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-zion-cyan" />
                  CPU Mining with ZION Native Miner
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  The easiest way to mine. Works on any x86_64 or ARM64 CPU. Best
                  algorithms: <strong className="text-white/60">Cosmic Harmony v3</strong> (balanced),{" "}
                  <strong className="text-white/60">RandomX</strong> (CPU-optimized),{" "}
                  <strong className="text-white/60">Yescrypt</strong> (low-memory).
                </p>

                <div className="space-y-4">
                  <CodeBlock
                    title="Step 1 — Install dependencies"
                    code={`# Ubuntu/Debian
sudo apt update && sudo apt install -y build-essential git curl

# macOS
xcode-select --install
brew install git curl

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env`}
                  />

                  <CodeBlock
                    title="Step 2 — Build the native miner"
                    code={`git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6
cargo build --release -p zion-miner

# Binary location
ls -la target/release/zion-miner`}
                  />

                  <CodeBlock
                    title="Step 3 — Start mining (pool)"
                    code={`./target/release/zion-miner \\
  --algo cosmic_harmony \
  --pool stratum+tcp://${SITE_POOL_PRIMARY} \
  --wallet YOUR_ZION_ADDRESS \\
  --threads $(nproc)      # use all CPU cores`}
                  />

                  <CodeBlock
                    title="Step 3b — Alternative: XMRig for RandomX"
                    code={`# Download XMRig
wget https://github.com/xmrig/xmrig/releases/latest/download/xmrig-*.tar.gz
tar xzf xmrig-*.tar.gz && cd xmrig-*

# Start
./xmrig \\
  -o ${PRIMARY_STRATUM_BASE}:8444 \
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

          {/* ── GPU Mining Guide ── */}
          {activeTab === "gpu" && (
            <motion.div
              key="gpu"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-zion-gold" />
                  GPU Mining — Metal, CUDA & OpenCL
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  Use your GPU for higher hashrate. Supported: Apple Metal (M1/M2/M3/M4),
                  NVIDIA CUDA (GTX/RTX), AMD OpenCL (RX/Vega/VII).
                </p>

                {/* Metal (macOS) */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10 text-white/50">
                      Apple Silicon
                    </span>
                    <h4 className="text-sm font-medium text-white/80">Metal (macOS)</h4>
                  </div>
                  <CodeBlock
                    code={`# Build with Metal support
cd 2.9.6
cargo build --release -p zion-miner --features metal

# Run with Metal GPU
./target/release/zion-miner \\
  --algo cosmic_harmony \
  --pool stratum+tcp://${SITE_POOL_PRIMARY} \
  --wallet YOUR_ZION_ADDRESS \\
  --gpu metal \\
  --gpu-intensity 80     # 0-100, lower = less heat`}
                  />
                </div>

                {/* CUDA */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      NVIDIA
                    </span>
                    <h4 className="text-sm font-medium text-white/80">CUDA (Linux/Windows)</h4>
                  </div>
                  <CodeBlock
                    code={`# Prerequisites
# NVIDIA Driver ≥ 535 + CUDA Toolkit ≥ 12.0
nvidia-smi   # verify driver

# Build with CUDA
cargo build --release -p zion-miner --features cuda

# Run with CUDA
./target/release/zion-miner \\
  --algo autolykos2 \\
  --pool ${PRIMARY_STRATUM_BASE}:8444 \
  --wallet YOUR_ZION_ADDRESS \\
  --gpu cuda \\
  --gpu-devices 0,1      # multi-GPU`}
                  />
                </div>

                {/* OpenCL */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 border border-red-500/20 text-red-400">
                      AMD
                    </span>
                    <h4 className="text-sm font-medium text-white/80">OpenCL (Linux/Windows)</h4>
                  </div>
                  <CodeBlock
                    code={`# Prerequisites
# AMD ROCm ≥ 5.0 or AMDGPU-PRO driver
clinfo | head -5   # verify OpenCL

# Build with OpenCL
cargo build --release -p zion-miner --features opencl

# Run with OpenCL
./target/release/zion-miner \\
  --algo autolykos2 \\
  --pool ${PRIMARY_STRATUM_BASE}:8444 \
  --wallet YOUR_ZION_ADDRESS \\
  --gpu opencl`}
                  />
                </div>

                <div className="rounded-xl bg-zion-gold/5 border border-zion-gold/10 p-4">
                  <h4 className="text-sm font-medium text-zion-gold mb-2">⚡ GPU Tips</h4>
                  <ul className="text-sm text-white/40 space-y-1">
                    <li>• Autolykos v2 is the best algorithm for GPU mining — memory-hard, ASIC-resistant</li>
                    <li>• Cosmic Harmony Deeksha works on both CPU and GPU simultaneously</li>
                    <li>• Undervolt your GPU for better efficiency (20–30% power saving)</li>
                    <li>• Keep GPU temp &lt; 80°C, VRAM &lt; 95°C</li>
                    <li>• Use <code className="text-zion-gold/60 text-xs">--gpu-intensity 60-80</code> for desktop use while mining</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Pool Mining Guide ── */}
          {activeTab === "pool" && (
            <motion.div
              key="pool"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-zion-purple" />
                  Pool Mining — Steady Rewards
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  Pool mining combines hashrate from many miners for frequent,
                  predictable payouts. Best for most miners.
                </p>

                {/* Pool endpoints */}
                <div className="rounded-xl bg-white/[0.02] border border-white/10 p-5 mb-5">
                  <h4 className="text-sm font-medium text-white/60 mb-3">
                    ZION Official Pool Endpoints
                  </h4>
                  <div className="space-y-2">
                    {[
                      { algo: "Cosmic Harmony Deeksha", endpoint: `stratum+tcp://${SITE_PRIMARY_HOST}:8444`, port: 8444 },
                      { algo: "RandomX", endpoint: `stratum+tcp://${SITE_PRIMARY_HOST}:8444`, port: 8444 },
                      { algo: "Yescrypt", endpoint: `stratum+tcp://${SITE_PRIMARY_HOST}:8444`, port: 8444 },
                      { algo: "Autolykos v2", endpoint: `stratum+tcp://${SITE_PRIMARY_HOST}:8444`, port: 8444 },
                    ].map((ep, i) => (
                      <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-1 py-2 border-b border-white/[0.04] last:border-0">
                        <span className="text-sm text-white/70">{ep.algo}</span>
                        <code className="text-xs font-mono text-zion-cyan/70">{ep.endpoint}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <CodeBlock
                  title="Quick start — Pool mining with native miner"
                  code={`./target/release/zion-miner \\
  --algo cosmic_harmony \
  --pool stratum+tcp://${SITE_POOL_PRIMARY} \
  --wallet YOUR_ZION_ADDRESS \\
  --worker-name my-rig-01 \\
  --threads $(nproc)`}
                />

                <div className="mt-5 space-y-3">
                  <h4 className="text-sm font-medium text-white/60">Pool Features</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "Fee", value: "1%", desc: "Lowest in class" },
                      { label: "Payout", value: "PPLNS", desc: "Pay-per-last-N-shares" },
                      { label: "Min Payout", value: "10 ZION", desc: "Automatic transfer" },
                      { label: "Payout Interval", value: "Every 2h", desc: "When threshold met" },
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
                </div>

                <div className="mt-5 rounded-xl bg-zion-purple/5 border border-zion-purple/10 p-4">
                  <h4 className="text-sm font-medium text-zion-purple mb-2">📊 Monitor Your Miner</h4>
                  <p className="text-sm text-white/40">
                    Track hashrate, shares, and payouts on the{" "}
                    <Link href="/pool" className="text-zion-purple underline hover:text-white transition-colors">
                      Pool Dashboard
                    </Link>
                    . Enter your wallet address to see real-time stats.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Solo Mining Guide ── */}
          {activeTab === "solo" && (
            <motion.div
              key="solo"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  Solo Mining — Full Block Rewards
                </h3>
                <p className="text-white/40 text-sm mb-5">
                  Mine directly against the blockchain. You get the full current
                  block reward plus fees when you find a block — but payouts
                  are less frequent than pool mining.
                </p>

                <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 mb-5">
                  <h4 className="text-sm font-medium text-amber-400 mb-1">⚠️ Who should solo mine?</h4>
                  <p className="text-sm text-white/40">
                    Solo mining is recommended if you have significant hashrate
                    (&gt;10% of network). With low hashrate, you may go weeks or
                    months without finding a block. Consider pool mining instead.
                  </p>
                </div>

                <CodeBlock
                  title="Step 1 — Run your own full node"
                  code={`# Start the node (see Node Setup guide)
./target/release/zion-node \\
  --config config/mainnet.toml \\
  --rpc-port 8443`}
                />

                <div className="mt-4">
                  <CodeBlock
                    title="Step 2 — Mine against your node"
                    code={`./target/release/zion-miner \\
  --algo cosmic_harmony \
  --node http://127.0.0.1:8443 \\
  --wallet YOUR_ZION_ADDRESS \\
  --threads $(nproc) \\
  --solo`}
                  />
                </div>

                <div className="mt-4">
                  <CodeBlock
                    title="Alternative: getblocktemplate RPC"
                    code={`# Request a block template
curl -s http://localhost:8443 \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getBlockTemplate",
    "params": [{
      "address": "YOUR_ZION_ADDRESS",
      "algo": "cosmic_harmony"
    }]
  }' | jq .`}
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                    <h4 className="text-sm font-medium text-emerald-400 mb-2">✅ Pros</h4>
                    <ul className="text-sm text-white/40 space-y-1">
                      <li>• Full current block reward + fees</li>
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
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Zap className="w-5 h-5 text-zion-gold" />
            Hardware Comparison
          </h2>

          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_80px_100px] gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02] hidden md:grid">
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Hardware</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Hashrate</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Power</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Efficiency</span>
            </div>
            {[
              { hw: "Raspberry Pi 5", hr: "~200 H/s", power: "10W", eff: "20 H/W", algo: "Yescrypt" },
              { hw: "Intel i7-12700K", hr: "~8 KH/s", power: "125W", eff: "64 H/W", algo: "RandomX" },
              { hw: "AMD Ryzen 9 7950X", hr: "~15 KH/s", power: "170W", eff: "88 H/W", algo: "RandomX" },
              { hw: "Apple M3 Pro", hr: "~12 KH/s", power: "30W", eff: "400 H/W", algo: "Cosmic Harmony" },
              { hw: "Apple M4 Max", hr: "~22 KH/s", power: "40W", eff: "550 H/W", algo: "Cosmic Harmony" },
              { hw: "NVIDIA RTX 4070", hr: "~85 MH/s", power: "200W", eff: "425 KH/W", algo: "Autolykos v2" },
              { hw: "NVIDIA RTX 4090", hr: "~160 MH/s", power: "350W", eff: "457 KH/W", algo: "Autolykos v2" },
              { hw: "AMD RX 7900 XTX", hr: "~130 MH/s", power: "300W", eff: "433 KH/W", algo: "Autolykos v2" },
            ].map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-2 md:grid-cols-[1fr_100px_80px_100px] gap-2 px-6 py-3 border-b border-white/[0.04] last:border-0"
              >
                <div>
                  <span className="text-sm text-white/80">{row.hw}</span>
                  <span className="block md:hidden text-[10px] text-white/25 mt-0.5">
                    {row.hr} · {row.power}
                  </span>
                </div>
                <span className="text-sm font-mono text-zion-cyan/70 hidden md:block">{row.hr}</span>
                <span className="text-sm text-white/40 hidden md:block">{row.power}</span>
                <span className="text-sm text-white/50 hidden md:block">{row.eff}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/20 mt-2">
            * Approximate values for Cosmic Harmony v3 / RandomX / Autolykos v2. Real performance varies with config.
          </p>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-8 text-center"
        >
          <h2 className="text-xl font-bold text-gradient mb-3">
            Ready to Mine?
          </h2>
          <p className="text-white/40 text-sm mb-6 max-w-lg mx-auto">
            Set up your node, pick an algorithm, and start earning ZION.
            Every hash strengthens the network.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/mining/node-setup"
              className="px-6 py-3 rounded-xl bg-linear-to-r from-zion-cyan to-blue-600 text-white font-semibold text-sm hover:brightness-110 transition-all"
            >
              <Server className="w-4 h-4 inline mr-2" />
              Setup a Node
            </Link>
            <Link
              href="/download"
              className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-sm transition-all"
            >
              Download Miner
            </Link>
            <Link
              href="/pool"
              className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-sm transition-all"
            >
              Pool Dashboard
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
