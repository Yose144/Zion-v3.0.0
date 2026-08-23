'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Blocks,
  Globe,
  HardHat,
  LayoutDashboard,
  ScrollText,
  Sparkles,
  Swords,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const HomeQuickLinksCopy = {
  explorer: { cs: `Explorer`, en: `Explorer` },
  blocksTxAddresses: { cs: `Bloky, tx, adresy`, en: `Blocks, tx, addresses` },
  network: { cs: `Síť`, en: `Network` },
  nodesLatency: { cs: `Uzly, latence`, en: `Nodes, latency` },
  pool: { cs: `Pool`, en: `Pool` },
  hashrateMiners: { cs: `Hashrate, mineri`, en: `Hashrate, miners` },
  docs: { cs: `Dokumentace`, en: `Docs` },
  guidesApi: { cs: `Guides, API`, en: `Guides, API` },
  roadmap: { cs: `Roadmapa`, en: `Roadmap` },
  l1L6Vision: { cs: `L1-L6 vize`, en: `L1-L6 vision` },
  terraNova: { cs: `Terra Nova`, en: `Terra Nova` },
  bookStory: { cs: `Kniha, příběh`, en: `Book, story` },
  sixGateways: { cs: `Šest vstupů`, en: `Six Gateways` },
  homepageAsACleanControlPanel: { cs: `Homepage jako přehledný řídicí panel`, en: `Homepage as a clean control panel` },
  lessNoiseClearerDirectionNetwo: { cs: `Méně šumu, jasné směry: síť, těžba, dokumentace, plán a příběh Terra Nova.`, en: `Less noise, clearer direction: network, mining, documentation, roadmap, and the Terra Nova story.` },
  arcade: { cs: `ARKÁDA`, en: `ARCADE` },
  whenDogecoinWas000025GamesShow: { cs: `Když Dogecoin stál $0.0002 — 5 her, showdown, stargate`, en: `When Dogecoin was $0.0002 — 5 games, showdown, stargate` },
  multichain: { cs: `Multichain Hub`, en: `Multichain Hub` },
  bridgeWarpSwap: { cs: `Bridge, WARP, swap`, en: `Bridge, WARP, swap` },
};

export default function HomeQuickLinks() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const links = [
    {
      href: '/explorer',
      label: HomeQuickLinksCopy.explorer[cs ? 'cs' : 'en'],
      desc: HomeQuickLinksCopy.blocksTxAddresses[cs ? 'cs' : 'en'],
      icon: Blocks,
      rc: '228, 30, 43', // rasta red
    },
    {
      href: '/network',
      label: HomeQuickLinksCopy.network[cs ? 'cs' : 'en'],
      desc: HomeQuickLinksCopy.nodesLatency[cs ? 'cs' : 'en'],
      icon: Globe,
      rc: '252, 209, 22', // rasta gold
    },
    {
      href: '/pool',
      label: HomeQuickLinksCopy.pool[cs ? 'cs' : 'en'],
      desc: HomeQuickLinksCopy.hashrateMiners[cs ? 'cs' : 'en'],
      icon: HardHat,
      rc: '6, 105, 40', // rasta green
    },
    {
      href: '/docs',
      label: HomeQuickLinksCopy.docs[cs ? 'cs' : 'en'],
      desc: HomeQuickLinksCopy.guidesApi[cs ? 'cs' : 'en'],
      icon: ScrollText,
      rc: '228, 30, 43', // rasta red
    },
    {
      href: '/defi',
      label: HomeQuickLinksCopy.multichain[cs ? 'cs' : 'en'],
      desc: HomeQuickLinksCopy.bridgeWarpSwap[cs ? 'cs' : 'en'],
      icon: Globe,
      rc: '252, 209, 22', // rasta gold
    },
    {
      href: '/roadmap',
      label: HomeQuickLinksCopy.roadmap[cs ? 'cs' : 'en'],
      desc: HomeQuickLinksCopy.l1L6Vision[cs ? 'cs' : 'en'],
      icon: LayoutDashboard,
      rc: '6, 105, 40', // rasta green
    },
    {
      href: '/terranova',
      label: HomeQuickLinksCopy.terraNova[cs ? 'cs' : 'en'],
      desc: HomeQuickLinksCopy.bookStory[cs ? 'cs' : 'en'],
      icon: Sparkles,
      rc: '228, 30, 43', // rasta red
    },
  ];

  return (
    <section className="px-4 py-8 sm:py-10">
      <div className="zion-container space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zion-gold">
              {HomeQuickLinksCopy.sixGateways[cs ? 'cs' : 'en']}
            </p>
            <h2 className="max-w-2xl text-2xl font-bold leading-tight text-white sm:text-3xl">
              {HomeQuickLinksCopy.homepageAsACleanControlPanel[cs ? 'cs' : 'en']}
            </h2>
            <div
              className="mt-2 h-1 w-24 rounded-full bg-gradient-to-r from-[#e41e2b] via-[#fcd116] to-[#066928]"
              aria-hidden="true"
            />
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-gray-400">
            {HomeQuickLinksCopy.lessNoiseClearerDirectionNetwo[cs ? 'cs' : 'en']}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {links.map((link, i) => (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <Link
                href={link.href}
                className="zion-rainbow-sub group relative flex flex-col items-center gap-3 overflow-hidden p-4 text-center"
                style={{ '--rc': link.rc } as React.CSSProperties}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-110"
                  style={{
                    borderColor: `rgba(${link.rc}, 0.4)`,
                    backgroundColor: `rgba(${link.rc}, 0.12)`,
                  }}
                >
                  <link.icon className="h-6 w-6" style={{ color: `rgb(${link.rc})` }} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">{link.label}</h3>
                  <p className="text-[11px] leading-tight text-gray-400">{link.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-all group-hover:translate-x-1 group-hover:text-white/70" />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Doge vs ZION — special card below the 6 gateways */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.42 }}
        >
          <Link
            href="/doge-vs-zion"
            className="zion-rainbow-sub group relative flex items-center gap-4 overflow-hidden p-5"
            style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-110"
              style={{
                borderColor: 'rgba(252, 209, 22, 0.4)',
                backgroundColor: 'rgba(252, 209, 22, 0.12)',
              }}
            >
              <Swords className="h-6 w-6 text-zion-gold" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Doge vs ZION</h3>
                <span className="rounded-full border border-zion-gold/30 bg-zion-gold/10 px-2 py-0.5 text-[9px] font-bold text-zion-gold">
                  {HomeQuickLinksCopy.arcade[cs ? 'cs' : 'en']}
                </span>
              </div>
              <p className="text-[11px] leading-tight text-gray-400">
                {HomeQuickLinksCopy.whenDogecoinWas000025GamesShow[cs ? 'cs' : 'en']}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-all group-hover:translate-x-1 group-hover:text-white/70" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
