'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Book, Compass, Github, Route, ScrollText } from 'lucide-react';

const resources = [
  {
    title: 'Guardian Docs',
    description: 'Installation, miner setup, API reference, and configuration guides.',
    icon: Book,
    href: '/docs',
    accent: 'from-zion-gold/20 to-zion-purple/10',
  },
  {
    title: 'Miner Downloads',
    description: 'Native Rust miner binaries for macOS, Linux, and Windows with Cosmic Harmony.',
    icon: ScrollText,
    href: '/download',
    accent: 'from-zion-cyan/20 to-blue-500/10',
  },
  {
    title: 'Block Explorer',
    description: 'Browse blocks, transactions, addresses, and mempool in real-time.',
    icon: Compass,
    href: '/explorer',
    accent: 'from-rose-500/20 to-orange-400/10',
  },
];

const ctas = [
  {
    title: 'Roadmap → MainNet 2026',
    description: 'Full roadmap: Fáze 0–5, Layer Architecture, Constitution, and post-launch strategy.',
    icon: Route,
    href: '/roadmap',
  },
  {
    title: 'GitHub /Zion',
    description: 'Full mono-repo with miners, AI agents, orchestrators, and dashboards.',
    icon: Github,
    href: 'https://github.com/Zion-TerraNova',
    external: true,
  },
];

export default function DocsRail() {
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Navigation</p>
            <h2 className="text-4xl font-bold text-white">
              Access the <span className="text-gradient">docs, downloads, and source code</span>
            </h2>
          </div>
          <p className="text-gray-300 max-w-2xl">
            Everything lives in the public repository: AI agents, miners, dashboards, Kubernetes, docs.
            Jump in, fork, and deploy.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {resources.map((resource, index) => (
            <motion.div
              key={resource.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className={`rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur relative overflow-hidden`}
            >
              <div className={`absolute inset-0 bg-linear-to-br ${resource.accent} opacity-80 pointer-events-none`} />
              <div className="relative space-y-4">
                <resource.icon className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-2xl font-semibold text-white">{resource.title}</h3>
                  <p className="text-sm text-gray-200 mt-2">{resource.description}</p>
                </div>
                <Link href={resource.href} className="text-sm text-zion-gold font-semibold inline-flex items-center gap-2">
                  Enter deck
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {ctas.map((cta) => (
            <Link
              key={cta.title}
              href={cta.href}
              target={cta.external ? '_blank' : undefined}
              rel={cta.external ? 'noreferrer' : undefined}
              className="rounded-3xl border border-white/10 bg-black/40 p-6 flex items-center gap-4 hover:border-white/30 transition"
            >
              <cta.icon className="w-6 h-6 text-zion-cyan" />
              <div>
                <p className="text-xl font-semibold text-white">{cta.title}</p>
                <p className="text-sm text-gray-300">{cta.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
