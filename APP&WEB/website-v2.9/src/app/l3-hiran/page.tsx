'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Brain, Cpu, Globe, Zap, Sparkles, ArrowRight,
  CheckCircle2, Clock, Server, Activity, BookOpen,
  ShoppingCart, Database, MessageCircle, Layers, Shield,
  Microchip, FlaskConical, BarChart3, Cable, Bot,
  Gamepad2, Wifi, WifiOff
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import HiranyagarbhaChat from '@/components/HiranyagarbhaChat';

const HIRAN_API = process.env.NEXT_PUBLIC_HIRAN_API ?? 'http://127.0.0.1:8002';
const HIRANYAGARBHA_API = process.env.NEXT_PUBLIC_HIRANYAGARBHA_API ?? 'http://127.0.0.1:8001';

const getOrchestration = (cs: boolean) => [
  {
    title: cs ? 'Deployment' : 'Deployment',
    desc: cs
      ? 'Automatický provisioning GPU instance na Vast.ai — RTX 4090, A100. Docker kontejnery s inference endpointem.'
      : 'Automated GPU instance provisioning on Vast.ai — RTX 4090, A100. Docker containers with inference endpoint.',
    icon: Server,
    color: 'text-cyan-400',
  },
  {
    title: cs ? 'Monitoring' : 'Monitoring',
    desc: cs
      ? 'Prometheus + Grafana telemetrie — inference latence, VRAM využití, token throughput, error rate.'
      : 'Prometheus + Grafana telemetry — inference latency, VRAM usage, token throughput, error rate.',
    icon: Activity,
    color: 'text-emerald-400',
  },
  {
    title: cs ? 'RAG Pipeline' : 'RAG Pipeline',
    desc: cs
      ? 'ChromaDB + all-MiniLM-L6-v2 embeddings. 33 knowledge documents. Query router pro hybridní retrieval.'
      : 'ChromaDB + all-MiniLM-L6-v2 embeddings. 33 knowledge documents. Query router for hybrid retrieval.',
    icon: Database,
    color: 'text-purple-400',
  },
  {
    title: cs ? 'Fine-tuning' : 'Fine-tuning',
    desc: cs
      ? 'QLoRA curriculum 5 stages. Rank 16-64. 22 181 instruction pairs. Unsloth/Meta-Llama-3.1-8B base.'
      : 'QLoRA curriculum 5 stages. Rank 16-64. 22,181 instruction pairs. Unsloth/Meta-Llama-3.1-8B base.',
    icon: Zap,
    color: 'text-amber-400',
  },
];

const getModelCards = (cs: boolean) => [
  {
    name: 'Hiran v2.2',
    status: 'live',
    base: 'unsloth/Meta-Llama-3.1-8B-Instruct',
    method: 'QLoRA',
    size: '~15 GB (FP16)',
    speed: '~40 tok/s',
    vram: '~16 GB',
    hardware: 'RTX 4090 (Vast.ai)',
    dataset: '22,181 pairs · 5 stages',
    tags: ['LLM', 'Fine-tuned', '8B', 'Live'],
    color: 'border-cyan-500/30 bg-cyan-500/5',
  },
  {
    name: 'Hiran v2.3',
    status: 'wip',
    base: 'nvidia/OpenReasoning-Nemotron-32B',
    method: 'DeepSpeed ZeRO-3',
    size: '32B params · BF16',
    speed: 'TBD',
    vram: '4x A100 80GB',
    hardware: '4x A100 80GB target',
    dataset: '48,436 weighted · 9 stages',
    tags: ['LLM', 'Full FT', '32B', 'RAG'],
    color: 'border-purple-500/30 bg-purple-500/5',
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

const getRagArch = (cs: boolean) => [
  {
    title: cs ? '33 Knowledge Docs' : '33 Knowledge Docs',
    desc: cs ? 'Religion, history, science, philosophy, art, medicine, literature, mythology, languages.' : 'Religion, history, science, philosophy, art, medicine, literature, mythology, languages.',
    icon: Database,
    color: 'text-emerald-400',
  },
  {
    title: 'ChromaDB',
    desc: cs ? 'Vector DB s all-MiniLM-L6-v2 embeddings. Multi-collection cosine-similarity retrieval.' : 'Vector DB with all-MiniLM-L6-v2 embeddings. Multi-collection cosine-similarity retrieval.',
    icon: Microchip,
    color: 'text-cyan-400',
  },
  {
    title: cs ? 'Query Router' : 'Query Router',
    desc: cs ? 'Klasifikuje dotazy: zion_only, knowledge_rag, hybrid. Dynamický routing.' : 'Classifies queries: zion_only, knowledge_rag, hybrid. Dynamic routing.',
    icon: Cable,
    color: 'text-purple-400',
  },
  {
    title: cs ? 'Hybrid Inference' : 'Hybrid Inference',
    desc: cs ? 'Kombinace fine-tuned modelu + retrieved context v jednom inference kroku.' : 'Combines fine-tuned model + retrieved context in a single inference step.',
    icon: Bot,
    color: 'text-amber-400',
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

export default function L3HiranPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const orchestration = getOrchestration(cs);
  const modelCards = getModelCards(cs);
  const phases = getPhases(cs);
  const ragArch = getRagArch(cs);
  const marketplace = getMarketplace(cs);

  const [hiranStatus, setHiranStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [orchStatus, setOrchStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [agentCount, setAgentCount] = useState<number | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const r = await fetch(`${HIRAN_API}/health`, { cache: 'no-store' });
        setHiranStatus(r.ok ? 'online' : 'offline');
      } catch {
        setHiranStatus('offline');
      }
      try {
        const r2 = await fetch(`${HIRANYAGARBHA_API}/health`, { cache: 'no-store' });
        const d = await r2.json();
        setOrchStatus(r2.ok ? 'online' : 'offline');
        if (d.active_agents !== undefined) setAgentCount(d.active_agents);
      } catch {
        setOrchStatus('offline');
      }
    }
    checkStatus();
    const id = setInterval(checkStatus, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '139, 92, 246' } as React.CSSProperties}
        >
          <div className="space-y-5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-purple-300 uppercase">
                <Brain className="h-4 w-4" />
                L3 · Hiran · AI Layer
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs">
                {hiranStatus === 'checking' ? <Clock className="h-3 w-3 text-amber-400 animate-spin" /> : hiranStatus === 'online' ? <Wifi className="h-3 w-3 text-emerald-400" /> : <WifiOff className="h-3 w-3 text-red-400" />}
                <span className={hiranStatus === 'online' ? 'text-emerald-300' : hiranStatus === 'offline' ? 'text-red-300' : 'text-amber-300'}>
                  Hiran {hiranStatus === 'checking' ? '…' : hiranStatus}
                </span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs">
                {orchStatus === 'checking' ? <Clock className="h-3 w-3 text-amber-400 animate-spin" /> : orchStatus === 'online' ? <Wifi className="h-3 w-3 text-emerald-400" /> : <WifiOff className="h-3 w-3 text-red-400" />}
                <span className={orchStatus === 'online' ? 'text-emerald-300' : orchStatus === 'offline' ? 'text-red-300' : 'text-amber-300'}>
                  Orchestrator {orchStatus === 'checking' ? '…' : orchStatus}{agentCount !== null ? ` · ${agentCount} agent` : ''}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {cs ? 'AI vrstva ZION ekosystému' : 'AI layer of the ZION ecosystem'}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {cs ? 'Hiran v2.2 — L3' : 'Hiran v2.2 — L3'}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {cs
                ? 'Orchestrací nástroj pro ZION AI. Domain-specific model (QLoRA 8B), hybridní RAG pipeline, fine-tuning marketplace a inference deployment na Vast.ai. Hiran v2.3 s 32B base a full fine-tuningem je ve vývoji.'
                : 'Orchestration hub for ZION AI. Domain-specific model (QLoRA 8B), hybrid RAG pipeline, fine-tuning marketplace, and inference deployment on Vast.ai. Hiran v2.3 with 32B base and full fine-tuning is in development.'}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-cyan-200">
                <Cpu className="h-3 w-3" /> 8B · QLoRA · FP16
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-purple-200">
                <Database className="h-3 w-3" /> 33 docs · ChromaDB
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Zap className="h-3 w-3" /> ~40 tok/s
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── MODEL CARDS ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Modely' : 'Models'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Microchip className="h-7 w-7 text-cyan-400" />
              {cs ? 'Hiran Model Cards' : 'Hiran Model Cards'}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {modelCards.map((model) => (
              <div key={model.name} className={`rounded-2xl border p-6 ${model.color}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{model.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{model.base}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${
                    model.status === 'live'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                  }`}>
                    {model.status === 'live' ? 'Live' : 'WIP'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                  <div><p className="text-xs text-gray-500">{cs ? 'Metoda' : 'Method'}</p><p className="text-gray-300 font-mono">{model.method}</p></div>
                  <div><p className="text-xs text-gray-500">{cs ? 'Velikost' : 'Size'}</p><p className="text-gray-300 font-mono">{model.size}</p></div>
                  <div><p className="text-xs text-gray-500">{cs ? 'Rychlost' : 'Speed'}</p><p className="text-gray-300 font-mono">{model.speed}</p></div>
                  <div><p className="text-xs text-gray-500">VRAM</p><p className="text-gray-300 font-mono">{model.vram}</p></div>
                  <div><p className="text-xs text-gray-500">{cs ? 'Hardware' : 'Hardware'}</p><p className="text-gray-300 font-mono">{model.hardware}</p></div>
                  <div><p className="text-xs text-gray-500">{cs ? 'Dataset' : 'Dataset'}</p><p className="text-gray-300 font-mono">{model.dataset}</p></div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {model.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-400">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── TRAINING PHASES ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-white/10 bg-white/5 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Trénink' : 'Training'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <FlaskConical className="h-7 w-7 text-amber-400" />
              {cs ? 'Tréninkové fáze v2.2' : 'Training Phases v2.2'}
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {phases.map((phase) => (
              <div key={phase.phase} className="zion-tile">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{phase.phase}</span>
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
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── RAG ARCHITECTURE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Architektura' : 'Architecture'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Database className="h-7 w-7 text-purple-400" />
              {cs ? 'Hybrid RAG — v2.3' : 'Hybrid RAG — v2.3'}
            </h2>
            <p className="text-sm text-gray-400">
              {cs ? 'Protože obecné znalosti jsou příliš rozsáhlé pro 32B parametrů, v2.3 používá RAG vedle FT.' : 'Because general knowledge is too large for 32B parameters, v2.3 uses RAG alongside FT.'}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ragArch.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <item.icon className={`h-6 w-6 ${item.color} mb-3`} />
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── CHAT ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-black/40 to-purple-500/10 p-8"
        >
          <div className="mx-auto max-w-3xl text-center mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <MessageCircle className="h-3.5 w-3.5" />
              {cs ? 'Živý chat' : 'Live Chat'}
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl text-gradient">
              {cs ? 'Zeptej se Hiranyagarbhy' : 'Ask Hiranyagarbha'}
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
        </motion.section>

        {/* ── AI MARKETPLACE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Marketplace' : 'Marketplace'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ShoppingCart className="h-7 w-7 text-emerald-400" />
              {cs ? 'AI Marketplace' : 'AI Marketplace'}
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {marketplace.map((item) => (
              <div key={item.name} className={`rounded-2xl border p-5 ${item.color}`}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-white">{item.name}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${
                    item.status === 'live'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                  }`}>
                    {item.status === 'live' ? 'Live' : (cs ? 'Plánováno' : 'Planned')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{item.version}</p>
                <p className="text-sm text-gray-400 mb-4">{item.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-400">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── ORCHESTRATION ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-white/10 bg-white/5 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Operace' : 'Operations'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Server className="h-7 w-7 text-cyan-400" />
              {cs ? 'Orchestrace & Deployment' : 'Orchestration & Deployment'}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {orchestration.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <item.icon className={`h-6 w-6 ${item.color} mb-3`} />
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── LINKS ── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-transparent to-cyan-500/10 p-5 sm:p-8 md:p-10"
        >
          <h2 className="text-2xl font-semibold text-white text-center mb-6">
            {cs ? 'Více o L3 a ekosystému' : 'Learn more about L3 and the ecosystem'}
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/ai-native" className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 px-6 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10 transition-colors">
              <Brain className="h-4 w-4" /> AI Native
            </Link>
            <Link href="/warp" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <Globe className="h-4 w-4" /> L3 WARP
            </Link>
            <Link href="/l4-oasis" className="inline-flex items-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/5 px-6 py-3 text-sm font-semibold text-orange-200 hover:bg-orange-500/10 transition-colors">
              <Gamepad2 className="h-4 w-4" /> L4 Oasis
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
