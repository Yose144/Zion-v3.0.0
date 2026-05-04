'use client';

import Link from 'next/link';
import { Book, Compass, FileText, Github, Route, ScrollText } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const getResources = (cs: boolean) => [
  {
    title: 'Current Docs',
    description: 'Opens at /docs#live-index with the current rehearsal topology, version matrix 2.9.6 / 2.9.8 / 2.9.9, miner setup, and launch blockers.',
    icon: Book,
    href: '/docs#live-index',
    accent: 'from-zion-gold/20 to-zion-purple/10',
  },
  {
    title: cs ? 'Stazeni minera' : 'Miner Downloads',
    description: cs ? 'Nativni Rust binarky minera pro macOS, Linux a Windows s Cosmic Harmony.' : 'Native Rust miner binaries for macOS, Linux, and Windows with Cosmic Harmony.',
    icon: ScrollText,
    href: '/download',
    accent: 'from-zion-cyan/20 to-blue-500/10',
  },
  {
    title: cs ? 'Pruzkumnik blockchainu' : 'Block Explorer',
    description: cs ? 'Prochazejte bloky, transakce, adresy a mempool v realnem case.' : 'Browse blocks, transactions, addresses, and mempool in real-time.',
    icon: Compass,
    href: '/explorer',
    accent: 'from-rose-500/20 to-orange-400/10',
  },
];

const getCtas = (cs: boolean) => [
  {
    title: 'Roadmap → Public Launch Gate',
    description: 'Focused path from the controlled 2.9.9 public line and 2.9.8 canonical runtime to closure reports, genesis artifacts, and launch sequencing.',
    icon: Route,
    href: '/roadmap',
  },
  {
    title: 'GitHub /Zion',
    description: cs ? 'Mono-repo s core, minery, poolem, dashboardy, dokumentaci a deploy skripty.' : 'Mono-repo with core, miners, pool, dashboards, docs, and deployment scripts.',
    icon: Github,
    href: 'https://github.com/Zion-TerraNova',
    external: true,
  },
];

export default function DocsRail() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const resources = getResources(cs);
  const ctas = getCtas(cs);
  return (
    <section className="py-20 px-4">
      <div className="zion-container space-y-10">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? 'Navigace' : 'Navigation'}</p>
            <h2 className="text-4xl font-bold text-white">
              {cs ? 'Otevri ' : 'Open the '}<span className="text-gradient">{cs ? 'aktualni dokumentaci, nastroje a zdroje' : 'current docs, tools, and source'}</span>
            </h2>
          </div>
          <p className="text-gray-300 max-w-2xl">
            Everything you need to inspect the current rehearsal network: documentation, mining tools, explorer, and source code.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          {resources.map((resource) => (
            <div
              key={resource.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur relative overflow-hidden"
            >
              <div className={`absolute inset-0 bg-linear-to-br ${resource.accent} opacity-80 pointer-events-none`} />
              <div className="relative space-y-4">
                <resource.icon className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-2xl font-semibold text-white">{resource.title}</h3>
                  <p className="text-sm text-gray-200 mt-2">{resource.description}</p>
                </div>
                <Link href={resource.href} className="text-sm text-zion-gold font-semibold inline-flex items-center gap-2">
                  {cs ? 'Otevrit' : 'Open'}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
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
