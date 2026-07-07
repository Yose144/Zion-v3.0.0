"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Check,
  ChevronRight,
  Cog,
  Copy,
  Cpu,
  Database,
  Download,
  FileCode2,
  Globe,
  HardDrive,
  Layers,
  Monitor,
  Network,
  Rocket,
  Server,
  Settings,
  Shield,
  Terminal,
  Wifi,
  Zap,
} from "lucide-react";
import { SITE_PRIMARY_HOST } from "@/lib/site";

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
      <pre className="zion-tile p-4 pr-12 text-sm text-zion-cyan/80 font-mono overflow-x-auto whitespace-pre-wrap break-all">
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

/* ── data ────────────────────────────────────────────────── */

const requirements = [
  { icon: Cpu, label: "CPU", value: "2+ cores (ARM64 or x86_64)", color: "text-zion-cyan" },
  { icon: HardDrive, label: "RAM", value: "4 GB minimum (8 GB recommended)", color: "text-zion-gold" },
  { icon: Database, label: "Disk", value: "20 GB SSD (grows ~2 GB/year)", color: "text-zion-purple" },
  { icon: Wifi, label: "Network", value: "Stable broadband, 10 Mbps+", color: "text-emerald-400" },
  { icon: Monitor, label: "OS", value: "Linux, macOS, Windows (WSL2)", color: "text-blue-400" },
];

const ports = [
  { port: "8333", protocol: "TCP", purpose: "P2P peer-to-peer", required: true },
  { port: "8443", protocol: "TCP", purpose: "JSON-RPC API", required: false },
  { port: "8444", protocol: "TCP", purpose: "Stratum mining", required: false },
  { port: "8080", protocol: "TCP", purpose: "Pool API", required: false },
];

const networkConfigs = [
  {
    name: "Mainnet",
    file: "mainnet.toml",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    description: "Mainnet launch line — countdown to 31 December 2026",
  },
  {
    name: "Testnet",
    file: "testnet.toml",
    badge: "bg-zion-gold/10 text-zion-gold border-zion-gold/20",
    description: "Testing with free test coins",
  },
  {
    name: "Devnet",
    file: "devnet.toml",
    badge: "bg-zion-purple/10 text-zion-purple border-zion-purple/20",
    description: "Local development network",
  },
];

const cliCommands = [
  { cmd: "zion-node --version", desc: "Check installed version" },
  { cmd: "zion-node --config mainnet.toml", desc: "Start with config file" },
  { cmd: "zion-node --network mainnet --rpc-port 8443", desc: "Override RPC port" },
  { cmd: `zion-node --peers ${SITE_PRIMARY_HOST}:8333`, desc: "Manual peer (Edge VPS seed)" },
  { cmd: "zion-node --log-level debug", desc: "Verbose logging" },
  { cmd: "zion-node --data-dir /custom/path", desc: "Custom data directory" },
];

/* ── component ──────────────────────────────────────────── */

export default function NodeSetupClient() {
  const [activeNetwork, setActiveNetwork] = useState(0);

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* ── Background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-cyan/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-cyan/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-12">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative zion-rainbow-card backdrop-blur-xl p-8 md:p-12 overflow-hidden"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="absolute inset-0 bg-linear-to-br from-zion-cyan/5 via-transparent to-zion-purple/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-zion-cyan/10 border border-zion-cyan/20">
                <Server className="w-7 h-7 text-zion-cyan" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gradient">
                  Run a Full Node
                </h1>
                <p className="text-white/40 text-sm mt-0.5">
                  10 minutes from zero to synced
                </p>
              </div>
            </div>
            <p className="text-white/50 max-w-2xl text-lg">
              Strengthen the ZION network by running your own full node. Validate
              transactions, relay blocks, and contribute to decentralization — no
              special hardware required.
            </p>
          </div>
        </motion.section>

        {/* ═══════ SYSTEM REQUIREMENTS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Cog className="w-5 h-5 text-zion-gold" />
            System Requirements
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {requirements.map((req, i) => (
              <div
                key={i}
                className="zion-rainbow-sub p-5"
                style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
              >
                <div className="flex items-center gap-2 mb-2">
                  <req.icon className={`w-4 h-4 ${req.color}`} />
                  <span className="text-[11px] text-white/40 uppercase tracking-wider">
                    {req.label}
                  </span>
                </div>
                <span className="text-sm text-white/80">{req.value}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ INSTALLATION ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Download className="w-5 h-5 text-zion-cyan" />
            Installation
          </h2>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zion-gold/10 border border-zion-gold/20 text-zion-gold text-xs font-bold">
                  1
                </span>
                <h3 className="text-white font-medium">Clone & Build from Source</h3>
              </div>
              <CodeBlock
                code={`git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6
cargo build --release -p zion-node
# Binary → target/release/zion-node`}
              />
            </div>

            {/* Step 2 — Docker */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zion-cyan/10 border border-zion-cyan/20 text-zion-cyan text-xs font-bold">
                  2
                </span>
                <h3 className="text-white font-medium">
                  Or: Docker (Recommended)
                </h3>
              </div>
              <CodeBlock
                code={`# Pull official image
docker pull ghcr.io/zion-terranova/zion-node:2.9.8

# Run with persistent storage
docker run -d \\
  --name zion-node \\
  -p 8333:8333 \\
  -p 8443:8443 \\
  -v zion-data:/data \\
  ghcr.io/zion-terranova/zion-node:2.9.8 \\
  --config /etc/zion/mainnet.toml`}
              />
            </div>

            {/* Step 3 — Docker Compose */}
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zion-purple/10 border border-zion-purple/20 text-zion-purple text-xs font-bold">
                  3
                </span>
                <h3 className="text-white font-medium">
                  Or: Docker Compose (Full Stack)
                </h3>
              </div>
              <CodeBlock
                code={`# From repo root
docker compose -f docker/docker-compose.mainnet.yml up -d

# Check logs
docker compose -f docker/docker-compose.mainnet.yml logs -f zion-node`}
              />
            </div>
          </div>
        </motion.section>

        {/* ═══════ NETWORK CONFIGURATION ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Network className="w-5 h-5 text-zion-purple" />
            Network Configuration
          </h2>

          {/* Network tabs */}
          <div className="flex items-center gap-2 mb-5">
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

          <div className="zion-rainbow-sub p-6 space-y-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <p className="text-white/50 text-sm">
              {networkConfigs[activeNetwork].description} — config file:{" "}
              <code className="text-zion-cyan/80 bg-zion-cyan/5 px-2 py-0.5 rounded text-xs">
                config/{networkConfigs[activeNetwork].file}
              </code>
            </p>

            <CodeBlock
              title={networkConfigs[activeNetwork].file}
              code={`[network]
name = "${networkConfigs[activeNetwork].name.toLowerCase()}"
p2p_port = 8333
rpc_port = 8443
max_peers = 128

[consensus]
algorithm = "cosmic_harmony"
block_time = 60       # seconds
difficulty_adjustment = "per-block"

[mining]
stratum_port = 8444
reward_address = "YOUR_ZION_ADDRESS"

[storage]
data_dir = "~/.zion/${networkConfigs[activeNetwork].name.toLowerCase()}"
max_db_size = "20GB"

[logging]
level = "info"         # debug | info | warn | error
format = "structured"  # structured | plain
file = "zion.log"

[peers]
bootstrap = [
  "${SITE_PRIMARY_HOST}:8333"
]`}
            />
          </div>
        </motion.section>

        {/* ═══════ PORTS & FIREWALL ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            Ports & Firewall
          </h2>

          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02]">
              <span className="text-[11px] text-white/30 uppercase tracking-wider">Port</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider hidden sm:block">Protocol</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider hidden sm:block">Purpose</span>
              <span className="text-[11px] text-white/30 uppercase tracking-wider text-right hidden lg:block">Required</span>
            </div>
            {ports.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 px-6 py-3 border-b border-white/[0.04] last:border-0"
              >
                <span className="font-mono text-sm text-zion-cyan/80">{p.port}</span>
                <span className="text-sm text-white/50">{p.protocol}</span>
                <span className="text-sm text-white/70">{p.purpose}</span>
                <span className="text-right">
                  {p.required ? (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      Required
                    </span>
                  ) : (
                    <span className="text-[10px] bg-white/5 text-white/30 border border-white/10 px-2 py-0.5 rounded-full">
                      Optional
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <CodeBlock
              title="UFW Firewall (Ubuntu/Debian)"
              code={`# P2P — required for node
sudo ufw allow 8333/tcp comment "ZION P2P"

# RPC — optional, restrict to localhost
sudo ufw allow from 127.0.0.1 to any port 8443 proto tcp comment "ZION RPC"

# Verify
sudo ufw status`}
            />
          </div>
        </motion.section>

        {/* ═══════ CLI REFERENCE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-zion-gold" />
            CLI Reference
          </h2>

          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            {cliCommands.map((c, i) => (
              <div
                key={i}
                className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-6 py-3.5 border-b border-white/[0.04] last:border-0"
              >
                <code className="text-sm font-mono text-zion-cyan/80 break-all">
                  {c.cmd}
                </code>
                <span className="text-xs text-white/30 md:text-right shrink-0">
                  {c.desc}
                </span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ VERIFY NODE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-emerald-400" />
            Verify Your Node
          </h2>

          <div className="zion-rainbow-sub p-6 space-y-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <p className="text-white/50 text-sm">
              After your node starts, verify it&apos;s syncing correctly:
            </p>

            <CodeBlock
              title="Check sync status"
              code={`# JSON-RPC call
curl -s http://localhost:8443 \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getBlockchainInfo"}' | jq .

# Expected: "syncing": true, "block_height" increasing`}
            />

            <CodeBlock
              title="Check peer connections"
              code={`curl -s http://localhost:8443 \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getPeerCount"}' | jq .

# Expected: "result": 2+ peers`}
            />

            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-sm text-white/60">
                  <p className="font-medium text-emerald-400 mb-1">
                    Success criteria
                  </p>
                  <ul className="space-y-1 text-white/40">
                    <li>• Block height matches{" "}
                      <Link href="/explorer" className="text-zion-cyan/60 hover:text-zion-cyan transition-colors underline">
                        Explorer
                      </Link>
                    </li>
                    <li>• 2+ peers connected</li>
                    <li>• New blocks arriving every ~60 seconds</li>
                    <li>• RPC responds to queries</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ TROUBLESHOOTING ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            Troubleshooting
          </h2>

          <div className="space-y-3">
            {[
              {
                q: "Node won't start",
                a: 'Check Rust ≥ 1.75 (`rustc --version`). Ensure port 8333 is free (`lsof -i :8333`). Try `--log-level debug` for details.',
              },
              {
                q: "No peers connecting",
                a: `Verify firewall allows TCP 8333. Try manual peer: \`--peers ${SITE_PRIMARY_HOST}:8333\` (Edge VPS seed). Check DNS resolution.`,
              },
              {
                q: "Sync stuck / slow",
                a: "IBD (Initial Block Download) can take minutes to hours. Ensure SSD (not HDD). Increase `max_peers` in config to 256.",
              },
              {
                q: "High memory usage",
                a: "Normal during IBD. Set `--max-db-cache 512` to limit cache. After sync, usage drops to ~200 MB.",
              },
            ].map((item, i) => (
              <details
                key={i}
                className="zion-rainbow-sub group"
                style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
              >
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                  <span className="text-sm text-white/80 font-medium">
                    {item.q}
                  </span>
                  <ChevronRight className="w-4 h-4 text-white/30 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-6 pb-4 text-sm text-white/50">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="zion-cta-banner p-8 text-center"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <h2 className="text-xl font-bold text-gradient mb-3">
            Node Running? Start Mining!
          </h2>
          <p className="text-white/40 text-sm mb-6 max-w-lg mx-auto">
            Connect your miner to your own node for maximum decentralization and
            lowest latency.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/mining/guides"
              className="px-6 py-3 rounded-xl bg-linear-to-r from-zion-gold to-amber-600 text-black font-semibold text-sm hover:brightness-110 transition-all"
            >
              Mining Guides →
            </Link>
            <Link
              href="/explorer"
              className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-sm transition-all"
            >
              View Explorer
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
