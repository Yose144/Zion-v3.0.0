'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Brain, Cpu, Globe, Zap, Sparkles, ArrowRight,
  CheckCircle2, Clock, Server, Activity, BookOpen,
  ShoppingCart, Database, MessageCircle, Layers, Shield
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import HiranyagarbhaChat from '@/components/HiranyagarbhaChat';

const getOrchestration = (cs: boolean) => [
  {
    title: cs ? 'Deployment' : 'Deployment',
    desc: cs
      ? 'Automatický provisioning GPU instance na Vast.ai — RTX 4090, A100. Docker kontejnery s inference endpointem.'
      : 'Automated GPU instance provisioning on Vast.ai — RTX 4090, A100. Docker containers with inference endpoint.',
    icon: Server,
    color: 'text-cyan-400',
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/5',
  },
  {
    title: cs ? 'Monitoring' : 'Monitoring',
    desc: cs
      ? 'Prometheus + Grafana telemetrie — inference latence, VRAM využití, token throughput, error rate.'
      : 'Prometheus + Grafana telemetry — inference latency, VRAM usage, token throughput, error rate.',
    icon: Activity,
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
  },
  {
    title: cs ? 'RAG Pipeline' : 'RAG Pipeline',
    desc: cs
      ? 'ChromaDB + all-MiniLM-L6-v2 embeddings. 33 knowledge documents. Query router pro hybridní retrieval.'
      : 'ChromaDB + all-MiniLM-L6-v2 embeddings. 33 knowledge documents. Query router for hybrid retrieval.',
    icon: Database,
    color: 'text-purple-400',
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/5',
  },
  {
    title: cs ? 'Fine-tuning' : 'Fine-tuning',
    desc: cs
      ? 'QLoRA curriculum 5 stages. Rank 16-64. 22 181 instruction pairs. Unsloth/Meta-Llama-3.1-8B base.'
      : 'QLoRA curriculum 5 stages. Rank 16-64. 22,181 instruction pairs. Unsloth/Meta-Llama-3.1-8B base.',
    icon: Zap,
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
  },
];

const getMarketplace = (cs: boolean) => [
  {
    name: 'Hiran v2.2 Model',
    version: 'FP16 · ~15 GB',
    status: 'live',
    desc: cs
      ? 'Domain-specific fine-tuned model pro ZION ekosystém. 5 stagí QLoRA tréninku.'
      : 'Domain-specific fine-tuned model for ZION ecosystem. 5-stage QLoRA training.',
    tags: ['LLM', 'Fine-tuned', '8B'],
    color: 'border-cyan-500/30 bg-cyan-500/5',
  },
  {
    name: 'Hiran v2.3 (WIP)',
    version: 'DeepSpeed ZeRO-3 · 32B',
    status: 'planned',
    desc: cs
      ? 'Full fine-tuning s hybridním RAG. 48K pairs, 9 stagí. 4x A100 80GB target.'
      : 'Full fine-tuning with hybrid RAG. 48K pairs, 9 stages. 4x A100 80GB target.',
    tags: ['LLM', 'Full FT', '32B'],
    color: 'border-purple-500/30 bg-purple-500/5',
  },
  {
    name: 'ZION RAG Corpus',
    version: 'v1.0 · 33 docs',
    status: 'live',
    desc: cs
      ? 'Knowledge documents pro hybrid retrieval — religion, history, science, philosophy, art.'
      : 'Knowledge documents for hybrid retrieval — religion, history, science, philosophy, art.',
    tags: ['Dataset', 'RAG', 'Multilingual'],
    color: 'border-emerald-500/30 bg-emerald-500/5',
  },
];

const getPhases = (cs: boolean) => [
  {
    phase: cs ? 'Stage 1: Foundation' : 'Stage 1: Foundation',
    period: 'Rank 16 · 2 epochs',
    status: 'done',
    loss: '~1.297',
    items: cs
      ? ['3 869 pairs', 'Fee split, L1-L6', 'Issobella basics']
      : ['3,869 pairs', 'Fee split, L1-L6', 'Issobella basics'],
  },
  {
    phase: cs ? 'Stage 2: Zion Core' : 'Stage 2: Zion Core',
    period: 'Rank 32 · 3 epochs',
    status: 'done',
    loss: '~1.040',
    items: cs
      ? ['2 368 pairs', 'Mining, DAO, bridge', 'Consensus details']
      : ['2,368 pairs', 'Mining, DAO, bridge', 'Consensus details'],
  },
  {
    phase: cs ? 'Stage 3: Cross-domain' : 'Stage 3: Cross-domain',
    period: 'Rank 64 · 2 epochs',
    status: 'done',
    loss: '~1.246',
    items: cs
      ? ['11 434 pairs', 'Religion, science, history', 'Comparative analysis']
      : ['11,434 pairs', 'Religion, science, history', 'Comparative analysis'],
  },
  {
    phase: cs ? 'Stage 4: RAG Synthesis' : 'Stage 4: RAG Synthesis',
    period: 'Rank 64 · 1 epoch',
    status: 'done',
    loss: '~2.469',
    items: cs
      ? ['2 052 pairs', 'Retrieval + generation', 'Hybrid inference']
      : ['2,052 pairs', 'Retrieval + generation', 'Hybrid inference'],
  },
];

export default function L3HiranPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const orchestration = getOrchestration(cs);
  const marketplace = getMarketplace(cs);
  const phases = getPhases(cs);

  return (
    <main className="min-h-screen bg-[#030408] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(147,51,234,0.12),transparent_60%)]" />
        <div className="zion-container relative pt-28 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-purple-300">
              <Brain className="h-3.5 w-3.5" />
              {cs ? 'L3 AI vrstva' : 'L3 AI Layer'}
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              <span className="bg-linear-to-r from-purple-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Hiran v2.2
              </span>
            </h1>
            <p className="mt-5 text-lg text-gray-400 leading-relaxed">
              {cs
                ? 'Orchestrací nástroj pro ZION AI. Domain-specific model, RAG pipeline, fine-tuning a marketplace AI komponent.'
                : 'Orchestration hub for ZION AI. Domain-specific model, RAG pipeline, fine-tuning and AI marketplace.'}
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/ai-native"
                className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-purple-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-transform hover:-translate-y-0.5"
              >
                <MessageCircle className="h-4 w-4" />
                {cs ? 'AI Native' : 'AI Native'}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Orchestration */}
      <section className="zion-container py-16">
        <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">
          {cs ? 'Orchestrace' : 'Orchestration'}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {orchestration.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-3xl border ${item.border} ${item.bg} p-6 backdrop-blur-sm`}
            >
              <item.icon className={`h-8 w-8 ${item.color}`} />
              <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Chat */}
      <section className="border-t border-white/10">
        <div className="zion-container py-16">
          <div className="mx-auto max-w-3xl text-center mb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <MessageCircle className="h-3.5 w-3.5" />
              {cs ? 'Živý chat' : 'Live Chat'}
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              <span className="bg-linear-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                {cs ? 'Zeptej se Hiranyagarbhy' : 'Ask Hiranyagarbha'}
              </span>
            </h2>
            <p className="mt-3 text-gray-400">
              {cs
                ? 'Domain-specific AI asistent trénovaný na ZION codebase a dokumentaci.'
                : 'Domain-specific AI assistant trained on ZION codebase and documentation.'}
            </p>
          </div>
          <div className="mx-auto max-w-2xl">
            <HiranyagarbhaChat lang={lang} />
          </div>
        </div>
      </section>

      {/* Training Phases */}
      <section className="border-t border-white/10">
        <div className="zion-container py-16">
          <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">
            {cs ? 'Tréninkové fáze v2.2' : 'Training Phases v2.2'}
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {phases.map((phase, i) => (
              <motion.div
                key={phase.phase}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold">{phase.phase}</span>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/20">
                    {phase.status === 'done' ? (cs ? 'Hotovo' : 'Done') : phase.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-1">{phase.period}</p>
                <p className="text-xs text-cyan-400 mb-3">Final loss: {phase.loss}</p>
                <ul className="space-y-2">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Marketplace */}
      <section className="border-t border-white/10">
        <div className="zion-container py-16">
          <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">
            {cs ? 'AI Marketplace' : 'AI Marketplace'}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {marketplace.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className={`rounded-3xl border ${item.color} p-6`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-lg font-bold">{item.name}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    item.status === 'live'
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                  }`}>
                    {item.status === 'live' ? (cs ? 'Live' : 'Live') : (cs ? 'Plánováno' : 'Planned')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{item.version}</p>
                <p className="text-sm text-gray-400 mb-4">{item.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Links */}
      <section className="border-t border-white/10">
        <div className="zion-container py-12">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/warp"
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-5 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            >
              <Globe className="h-4 w-4" />
              {cs ? 'L3 WARP →' : 'L3 WARP →'}
            </Link>
            <Link
              href="/l4-oasis"
              className="inline-flex items-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/5 px-5 py-2.5 text-sm font-semibold text-orange-300 hover:bg-orange-500/10 transition-colors"
            >
              <Layers className="h-4 w-4" />
              {cs ? 'L4 Oasis →' : 'L4 Oasis →'}
            </Link>
            <Link
              href="/ai-native"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <Brain className="h-4 w-4" />
              {cs ? 'AI Native' : 'AI Native'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
