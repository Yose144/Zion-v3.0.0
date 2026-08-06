"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, Brain, Cpu, Gauge, Network, Radar, Zap } from 'lucide-react';
import { SITE_POOL_PRIMARY } from '@/lib/site';

const protocols = [
  {
    title: 'Universal miner',
    description: 'Rust core + Python commander, rotates RandomX ⇄ Yescrypt ⇄ Autolykos v2 ⇄ KawPow with ML heuristics.',
    icon: Cpu
  },
  {
    title: 'AI pool orchestrator',
    description: 'Observability hooks feed the consciousness mining AI: block propagation, latency, power budgets.',
    icon: Brain
  },
  {
    title: 'Critical-path telemetry',
    description: 'RPC, stratum, GPU/CPU fleet, and guardian validators streamed into Grafana + WARP 2.0.',
    icon: Radar
  }
];

const supportedAlgorithms = [
  { name: 'Cosmic Harmony', type: 'Native', detail: 'ZION Native Algorithm · Ekam Deeksha v2 · Rust/OpenCL', port: '8444', algo: 'cosmic_harmony' },
  { name: 'RandomX', type: 'CPU', detail: 'XMRig Compatible · Modern CPUs', port: '8444', algo: 'randomx' },
  { name: 'Yescrypt', type: 'CPU', detail: 'Legacy Support · Low Power', port: '8444', algo: 'yescrypt' },
  { name: 'Autolykos v2', type: 'GPU', detail: 'GPU Mining · 6GB+ VRAM', port: '8444', algo: 'autolykos2' }
];

const minerSteps = [
  {
    title: 'Build from source',
    code: 'git clone https://github.com/Zion-TerraNova/2.9.6.git\ncd 2.9.6/V3\ncargo build --release -p zion-miner'
  },
  {
    title: 'Start GPU miner (Edge pool)',
    code: `ZION_POOL_ADDR=${SITE_POOL_PRIMARY} \\
ZION_WORKER_NAME=my-worker \\
ZION_MINER_ID=YOUR_ZION_ADDRESS \\
ZION_LOOP_COUNT=1000000 \\
ZION_GPU_BACKEND=opencl \\
ZION_GPU_WORK_SIZE=4096 \\
./target/release/zion-miner`
  },
  {
    title: 'Start CPU miner (Edge pool)',
    code: `ZION_POOL_ADDR=${SITE_POOL_PRIMARY} \\
ZION_WORKER_NAME=my-worker \\
ZION_MINER_ID=YOUR_ZION_ADDRESS \\
ZION_LOOP_COUNT=1000000 \\
./target/release/zion-miner`
  }
];

const alternativeStacks = [
  { name: 'XMRig', usage: 'RandomX tuned for modern CPUs', link: 'https://github.com/xmrig/xmrig' },
  { name: 'ZION Native', usage: 'Official Python/C++ Miner', link: 'https://github.com/Zion-TerraNova' }
];

export default function MiningClient() {
  return (
    <div className="zion-shell min-h-screen pt-32 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-5xl space-y-10">
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="zion-rainbow-card p-10 backdrop-blur-xl text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Quantum Leap mining stack</p>
          <h1 className="text-5xl md:text-6xl font-semibold text-gradient mt-4">Universal miner + ML orchestrator</h1>
          <p className="mt-6 text-lg text-gray-300">
            Same playbook core contributors use to maintain validators, GPU farms, and consciousness mining telemetry across BTC · ETH · SOL bridges.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {protocols.map((protocol) => (
            <motion.div
              key={protocol.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="zion-rainbow-sub p-6"
              style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
            >
              <protocol.icon className="h-10 w-10 text-zion-gold" />
              <h3 className="mt-4 text-xl font-semibold text-white">{protocol.title}</h3>
              <p className="mt-2 text-sm text-gray-300">{protocol.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Pool access</p>
              <h2 className="text-3xl font-semibold text-white">Stratum endpoints</h2>
              <p className="text-sm text-gray-400">Auto-detect or pin a specific algorithm port.</p>
            </div>
            <div className="zion-tile px-4 py-2 text-sm font-mono text-zion-cyan">stratum+tcp://{SITE_POOL_PRIMARY}</div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {supportedAlgorithms.map((algo) => (
              <div key={algo.name} className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">{algo.name}</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{algo.type}</p>
                  </div>
                  <span className="rounded-full bg-black/50 px-4 py-1 text-sm text-zion-cyan">:{algo.port}</span>
                </div>
                <p className="mt-3 text-sm text-gray-300">{algo.detail}</p>
                <p className="mt-1 text-xs text-gray-500">CLI flag: <code className="text-zion-gold">--algorithm {algo.algo}</code></p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-zion-gold" />
            <h2 className="text-3xl font-semibold text-white">Command center</h2>
          </div>
          <p className="mt-2 text-sm text-gray-400">Universal miner rotates algorithms, streams telemetry to the AI orchestrator, and feeds consciousness multipliers.</p>
          <div className="mt-6 grid gap-4">
            {minerSteps.map((step, idx) => (
              <div key={step.title} className="zion-rainbow-sub p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Step {idx + 1}</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{step.title}</h3>
                <pre className="mt-4 zion-tile p-4 text-sm text-gray-200 overflow-x-auto">
{step.code}
                </pre>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-gray-400">
            Tip: add <code className="text-zion-cyan">--power-cap 180</code> or <code className="text-zion-cyan">--rotate-interval 900</code> to dynamically balance GPU thermals with consciousness multipliers.
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-4">
            <Gauge className="h-6 w-6 text-zion-gold" />
            <h2 className="text-3xl font-semibold text-white">Alternative stacks</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {alternativeStacks.map((stack) => (
              <div key={stack.name} className="zion-rainbow-sub p-5 flex flex-col" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <Network className="h-5 w-5 text-zion-cyan" />
                  <div>
                    <p className="text-lg font-semibold text-white">{stack.name}</p>
                    <p className="text-sm text-gray-400">{stack.usage}</p>
                  </div>
                </div>
                <Link href={stack.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-zion-cyan">
                  Download
                  ↗
                </Link>
              </div>
            ))}
          </div>
        </motion.section>

  <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-cta-banner p-10 text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <BookOpen className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-4 text-3xl font-semibold text-white">Need full playbooks?</h2>
          <p className="mt-3 text-base text-gray-200 max-w-3xl mx-auto">
            Deep dives live inside docs, FINAL_REPORT_v2.9.0_SESSION, and the /download pack (benchmarks, config templates, observability dashboards).
          </p>
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:justify-center">
            <Link href="/docs" className="rounded-2xl bg-white/80 px-8 py-3 text-black font-semibold">Open docs</Link>
            <Link href="/download" className="rounded-2xl border border-white/50 px-8 py-3 text-white">Get builder pack</Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
