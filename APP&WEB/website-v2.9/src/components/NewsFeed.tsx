'use client';

import Link from 'next/link';
import { Newspaper, ArrowRight, Calendar } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

// ─── Article type ─────────────────────────────────────────────────────────────

export interface NewsArticle {
  slug: string;
  date: string;            // ISO date
  tag: { cs: string; en: string };
  tagColor: string;        // tailwind text color
  title: { cs: string; en: string };
  summary: { cs: string; en: string };
  href: string;            // internal or external link
  external?: boolean;
}

// ─── Articles data ────────────────────────────────────────────────────────────

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    slug: 'zion-cli-rollout',
    date: '2026-04-21',
    tag: { cs: 'CLI', en: 'CLI' },
    tagColor: 'text-zion-cyan',
    title: {
      cs: 'ZION CLI je nově součástí veřejného webu, dokumentace a download surface',
      en: 'ZION CLI is now part of the public website, docs, and download surface',
    },
    summary: {
      cs: 'Nový sjednocený operátorský gateway pro node, pool, miner, agent, bridge, DAO, deploy a monitoring má vlastní docs sekci, zmínku na homepage a samostatný blok na download page. Veřejné binární release artefakty teď doháníme jako další krok.',
      en: 'The new unified operator gateway for node, pool, miner, agent, bridge, DAO, deploy, and monitoring now has its own docs section, homepage mention, and dedicated block on the download page. Public binary release artifacts are the next step now catching up.',
    },
    href: '/download',
  },
  {
    slug: 'terranova-book',
    date: '2026-04-20',
    tag: { cs: 'Kniha', en: 'Book' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'Terra Nova — čtvrtá kniha ZION je online jako veřejná čtenářská edice',
      en: 'Terra Nova — fourth ZION book is online as a public reader\'s edition',
    },
    summary: {
      cs: 'Kompletní čtenářská edice TerraNovy: od Prologu na orbitální stanici Issobella, přes komunity, AI a péči, architekturu L1–L6, hvězdný horizont až po Zlatý Kompas sedmi směrů. Bilingvální CZ/EN, propojená s interaktivním Kompasem.',
      en: 'Complete reader\'s edition of TerraNova: from the Prologue on orbital station Issobella, through communities, AI and care, L1–L6 architecture, stellar horizon to the Golden Compass of seven directions. Bilingual CZ/EN, linked with the interactive Compass.',
    },
    href: '/terranova',
  },
  {
    slug: 'gpu-benchmark-matrix',
    date: '2026-04-02',
    tag: { cs: 'Mining', en: 'Mining' },
    tagColor: 'text-cyan-400',
    title: {
      cs: 'GPU Benchmark Matrix — 8 GPU od GTX 1060 po H100 SXM (81.7 KH/s)',
      en: 'GPU Benchmark Matrix — 8 GPUs from GTX 1060 to H100 SXM (81.7 KH/s)',
    },
    summary: {
      cs: 'Kompletní benchmark Ekam Deeksha v2 napříč 8 GPU. H100 SXM dosáhl 81.7 KH/s (nový rekord), RTX 3060 je král cena/výkon (344 KH/$). TPB=24 (¾ warpu) je optimální pro moderní architektury Hopper a Ampere. I 3GB karty těží!',
      en: 'Complete Ekam Deeksha v2 benchmark across 8 GPUs. H100 SXM reached 81.7 KH/s (new record), RTX 3060 is the cost-efficiency king (344 KH/$). TPB=24 (¾ warp) is optimal for modern Hopper and Ampere architectures. Even 3GB cards can mine!',
    },
    href: '/benchmarks',
  },
  {
    slug: 'defi-mainnet-live',
    date: '2026-04-02',
    tag: { cs: 'DeFi', en: 'DeFi' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'wZION DEX je live na Base Mainnet — swap, bridge a portfolio',
      en: 'wZION DEX is live on Base Mainnet — swap, bridge & portfolio',
    },
    summary: {
      cs: 'Uniswap V3 pool wZION/WETH nasazen na Base Mainnet s reálnou likviditou. Na zionterranova.com/defi nyní funguje přímý swap ETH↔wZION, burn bridge (wZION→ZION L1) a portfolio dashboard s live cenami z on-chain poolu.',
      en: 'Uniswap V3 wZION/WETH pool deployed on Base Mainnet with real liquidity. zionterranova.com/defi now features direct ETH↔wZION swap, burn bridge (wZION→ZION L1), and a portfolio dashboard with live on-chain pool prices.',
    },
    href: '/defi',
  },
  {
    slug: 'ekam-deeksha-featured-cz-en-rollout',
    date: '2026-03-31',
    tag: { cs: 'Kniha', en: 'Book' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'Ekam Deeksha zvýrazněna na homepage + kompletní CZ/EN překlady ve Web 2.9',
      en: 'Ekam Deeksha now featured on homepage + complete CZ/EN translations across Web 2.9',
    },
    summary: {
      cs: 'Kniha Ekam Deeksha je nově výrazně zvýrazněná na homepage a přidaná do novinek. Současně postupně sjednocujeme kompletní české a anglické texty napříč Web 2.9, aby byl obsah konzistentní v obou jazycích.',
      en: 'Ekam Deeksha is now prominently highlighted on the homepage and added to News. In parallel, we are rolling out complete Czech and English copy consistency across Web 2.9 for a unified bilingual experience.',
    },
    href: '/docs#book-ekam-full',
  },
  {
    slug: 'defi-hub-launch',
    date: '2026-03-30',
    tag: { cs: 'DeFi', en: 'DeFi' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'ZION L2 DeFi kontrakty nasazeny — Bridge, DEX pool a wZION na Base',
      en: 'ZION L2 DeFi contracts deployed — Bridge, DEX pool & wZION on Base',
    },
    summary: {
      cs: 'wZION ERC-20, ZIONBridge a Uniswap V3 pool (wZION/WETH 0.3%) nasazeny na Base. Relay propojuje ZION L1 s Base. Bridge umožňuje lock/mint a burn/unlock. DEX pool s počáteční likviditou 50 wZION + 0.0005 WETH.',
      en: 'wZION ERC-20, ZIONBridge, and Uniswap V3 pool (wZION/WETH 0.3%) deployed on Base. Relay connects ZION L1 with Base. Bridge enables lock/mint and burn/unlock. DEX pool seeded with 50 wZION + 0.0005 WETH.',
    },
    href: '/defi',
  },
  {
    slug: 'coingecko-listing',
    date: '2026-03-30',
    tag: { cs: 'Listing', en: 'Listing' },
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
    tag: { cs: 'Mainnet', en: 'Mainnet' },
    tagColor: 'text-blue-400',
    title: {
      cs: 'V3 Test Mainnet — 3-node mesh síť v provozu',
      en: 'V3 Test Mainnet — 3-node mesh network operational',
    },
    summary: {
      cs: 'ZION V3 test mainnet běží se 3 nody (Praha, USA, Singapur). Kanonický runtime v2.9.8 Ekam Deeksha, veřejný mining pool a Prometheus telemetrie. Chain height přes 470+ bloků.',
      en: 'ZION V3 test mainnet running with 3 nodes (Prague, USA, Singapore). Canonical runtime v2.9.8 Ekam Deeksha, public mining pool, Prometheus telemetry. Chain height over 470+ blocks.',
    },
    href: '/network',
  },
  {
    slug: 'bridge-testnet-deploy',
    date: '2026-03-10',
    tag: { cs: 'L2', en: 'L2' },
    tagColor: 'text-purple-400',
    title: {
      cs: 'L1↔L2 Bridge nasazen — relay propojuje ZION s Base',
      en: 'L1↔L2 Bridge deployed — relay connects ZION with Base',
    },
    summary: {
      cs: 'Rust relay propojuje ZION L1 s Base. Lock ZION → mint wZION, burn wZION → unlock ZION. Guardian threshold validace, 60-block finality na L1, 64-block finality na EVM.',
      en: 'Rust relay connects ZION L1 with Base. Lock ZION → mint wZION, burn wZION → unlock ZION. Guardian threshold validation, 60-block finality on L1, 64-block finality on EVM.',
    },
    href: '/bridge',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const HOMEPAGE_LIMIT = 4;

export default function NewsFeed() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const visibleArticles = NEWS_ARTICLES.slice(0, HOMEPAGE_LIMIT);
  const hasMore = NEWS_ARTICLES.length > HOMEPAGE_LIMIT;

  return (
    <section className="relative py-20 px-4 overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-zion-gold/[0.02] to-transparent pointer-events-none" />

      <div className="zion-container relative">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <Newspaper className="w-5 h-5 text-zion-gold" />
            <span className="text-sm uppercase tracking-[0.4em] text-gray-400">
              {cs ? 'Novinky a aktualizace' : 'News & Updates'}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            <span className="text-gradient">
              {cs ? 'Novinky' : 'News'}
            </span>
          </h2>
          <p className="text-lg text-gray-300 mt-3 max-w-2xl">
            {cs
              ? 'Poslední zprávy z vývoje ZION ekosystému, DeFi, listingu a sítě.'
              : 'Latest updates from the ZION ecosystem development, DeFi, listings, and network.'}
          </p>
        </div>

        {/* Articles grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleArticles.map((article) => (
            <div key={article.slug}>
              <Link
                href={article.href}
                target={article.external ? '_blank' : undefined}
                rel={article.external ? 'noopener noreferrer' : undefined}
                className="group relative block h-full rounded-3xl border border-white/10 bg-white/3 hover:bg-white/6 transition-all duration-300 overflow-hidden"
              >
                {/* Gradient accent top */}
                <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-zion-gold/30 to-transparent" />

                <div className="p-6">
                  {/* Meta row */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border border-white/10 bg-white/5 ${article.tagColor}`}>
                      {cs ? article.tag.cs : article.tag.en}
                    </span>
                    <span className="text-[11px] text-white/30 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {article.date}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-white group-hover:text-zion-gold transition-colors mb-3 leading-snug">
                    {cs ? article.title.cs : article.title.en}
                  </h3>

                  {/* Summary */}
                  <p className="text-sm text-white/45 leading-relaxed mb-4">
                    {cs ? article.summary.cs : article.summary.en}
                  </p>

                  {/* Read more */}
                  <div className="flex items-center gap-1.5 text-xs text-zion-gold/60 group-hover:text-zion-gold transition-colors">
                    <span>{cs ? 'Číst více' : 'Read more'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* View all link */}
        {hasMore && (
          <div className="mt-8 text-center">
            <Link
              href="/news"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/60 hover:text-white transition-all text-sm"
            >
              {cs ? `Všechny novinky (${NEWS_ARTICLES.length})` : `All news (${NEWS_ARTICLES.length})`}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
