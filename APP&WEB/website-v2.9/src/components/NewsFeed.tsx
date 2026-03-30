'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Newspaper, ArrowRight, Layers, TrendingUp, Calendar, Tag } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

// ─── Article type ─────────────────────────────────────────────────────────────

export interface NewsArticle {
  slug: string;
  date: string;            // ISO date
  tag: string;
  tagColor: string;        // tailwind text color
  title: { cs: string; en: string };
  summary: { cs: string; en: string };
  href: string;            // internal or external link
  external?: boolean;
}

// ─── Articles data ────────────────────────────────────────────────────────────

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    slug: 'defi-hub-launch',
    date: '2026-03-30',
    tag: 'DeFi',
    tagColor: 'text-yellow-400',
    title: {
      cs: 'ZION L2 DeFi Hub je live — Staking, Farming, DEX & Governance na Base',
      en: 'ZION L2 DeFi Hub is live — Staking, Farming, DEX & Governance on Base',
    },
    summary: {
      cs: 'Kompletní L2 DeFi ekosystém nasazený na Base Sepolia. 8 smart kontraktů — wZION Bridge, ZIONStaking (~12% APR), ZIONFarm (dual rewards), Atomic Swap (HTLC), Uniswap V3 pool (wZION/WETH), Governance s treasury. Vše dostupné na webu i v desktop agentu.',
      en: 'Complete L2 DeFi ecosystem deployed on Base Sepolia. 8 smart contracts — wZION Bridge, ZIONStaking (~12% APR), ZIONFarm (dual rewards), Atomic Swap (HTLC), Uniswap V3 pool (wZION/WETH), Governance with treasury. Available on the website and in the desktop agent.',
    },
    href: '/defi',
  },
  {
    slug: 'coingecko-listing',
    date: '2026-03-30',
    tag: 'Listing',
    tagColor: 'text-green-400',
    title: {
      cs: 'CoinGecko registrace — ZION se připravuje na listing',
      en: 'CoinGecko registration — ZION prepares for listing',
    },
    summary: {
      cs: 'Zahájili jsme proces registrace ZION na CoinGecko. Požadavky: funkční blockchain s veřejným explorerem ✅, obchodovatelný token na DEX (wZION/WETH Uniswap V3 pool na Base) ✅, otevřený zdrojový kód ✅, dokumentace a whitepaper ✅. Čekáme na schválení a mainnet deployment na Base mainnet s reálnou likviditou.',
      en: 'We have started the process of registering ZION on CoinGecko. Requirements: working blockchain with public explorer ✅, tradeable token on DEX (wZION/WETH Uniswap V3 pool on Base) ✅, open source code ✅, documentation and whitepaper ✅. Awaiting approval and Base mainnet deployment with real liquidity.',
    },
    href: '/roadmap',
  },
  {
    slug: 'v3-testnet-live',
    date: '2026-03-15',
    tag: 'Mainnet',
    tagColor: 'text-blue-400',
    title: {
      cs: 'V3 Test Mainnet — 3-node mesh síť v provozu',
      en: 'V3 Test Mainnet — 3-node mesh network operational',
    },
    summary: {
      cs: 'ZION V3 test mainnet běží s 3 nody (Praha, USA, Singapur). Canonical runtime v2.9.8 Ekam Deeksha, veřejný mining pool, Prometheus telemetrie. Chain height přes 470+ bloků.',
      en: 'ZION V3 test mainnet running with 3 nodes (Prague, USA, Singapore). Canonical runtime v2.9.8 Ekam Deeksha, public mining pool, Prometheus telemetry. Chain height over 470+ blocks.',
    },
    href: '/network',
  },
  {
    slug: 'bridge-testnet-deploy',
    date: '2026-03-10',
    tag: 'L2',
    tagColor: 'text-purple-400',
    title: {
      cs: 'L1↔L2 Bridge nasazen na Base Sepolia',
      en: 'L1↔L2 Bridge deployed on Base Sepolia',
    },
    summary: {
      cs: 'Rust relay propojuje ZION L1 s Base Sepolia. Lock ZION → mint wZION, burn wZION → unlock ZION. Guardian threshold validace, 60-block finality na L1, 64-block finality na EVM.',
      en: 'Rust relay connects ZION L1 with Base Sepolia. Lock ZION → mint wZION, burn wZION → unlock ZION. Guardian threshold validation, 60-block finality on L1, 64-block finality on EVM.',
    },
    href: '/bridge',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewsFeed() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <section className="relative py-24 px-4 overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-yellow-400/[0.02] to-transparent pointer-events-none" />

      <div className="zion-container relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-3">
            <Newspaper className="w-5 h-5 text-zion-gold" />
            <span className="text-sm uppercase tracking-[0.4em] text-gray-400">
              {cs ? 'Novinky & Aktualizace' : 'News & Updates'}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            <span className="text-gradient">
              {cs ? 'Novinky' : 'News'}
            </span>
          </h2>
          <p className="text-lg text-gray-300 mt-3 max-w-2xl">
            {cs
              ? 'Poslední zprávy z vývoje ZION ekosystému, DeFi, listingů a sítě.'
              : 'Latest updates from the ZION ecosystem development, DeFi, listings, and network.'}
          </p>
        </motion.div>

        {/* Articles grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {NEWS_ARTICLES.map((article, i) => (
            <motion.div
              key={article.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <Link
                href={article.href}
                target={article.external ? '_blank' : undefined}
                rel={article.external ? 'noopener noreferrer' : undefined}
                className="group relative block h-full rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300 overflow-hidden"
              >
                {/* Gradient accent top */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent" />

                <div className="p-6">
                  {/* Meta row */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border border-white/10 bg-white/5 ${article.tagColor}`}>
                      {article.tag}
                    </span>
                    <span className="text-[11px] text-white/30 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {article.date}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-white group-hover:text-yellow-400 transition-colors mb-3 leading-snug">
                    {cs ? article.title.cs : article.title.en}
                  </h3>

                  {/* Summary */}
                  <p className="text-sm text-white/45 leading-relaxed mb-4">
                    {cs ? article.summary.cs : article.summary.en}
                  </p>

                  {/* Read more */}
                  <div className="flex items-center gap-1.5 text-xs text-yellow-400/60 group-hover:text-yellow-400 transition-colors">
                    <span>{cs ? 'Číst více' : 'Read more'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
