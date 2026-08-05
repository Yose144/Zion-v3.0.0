'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState, useCallback } from 'react';
import {
  ArrowRight,
  Blocks,
  Globe,
  HardHat,
  ScrollText,
  LayoutDashboard,
  Sparkles,
  Swords,
  Activity,
  Database,
  TrendingUp,
  Droplets,
  Shield,
  Zap,
  Cpu,
  Wallet,
  Bot,
  Satellite,
  Terminal,
  Rocket,
  ExternalLink,
  Github,
  BookOpen,
  Flame,
  Newspaper,
  Calendar,
  Coins,
  Network,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { apiClient } from '@/lib/api';
import { usePolling } from '@/hooks/usePolling';
import CosmicFlowers from './CosmicFlowers';
import MainnetCountdown from './MainnetCountdown';

/* ── Types ── */
interface BlockchainStats {
  total_blocks?: number;
  total_supply?: number;
  circulating_supply?: number;
  transactions?: number;
  difficulty?: number;
  mempool_size?: number;
}

/* ── Copy ── */
const Copy = {
  heroTagline: { cs: `V31 · zion-multichain live`, en: `V31 · zion-multichain live` },
  heroTitle: { cs: `ZION Terra Nova`, en: `ZION Terra Nova` },
  heroSub: { cs: `Nativní Rust blockchain s Multi-Chain L2 vrstvou — 13 chain rodin, trustless bridge, atomic swap, ZionDex.`, en: `Native Rust blockchain with Multi-Chain L2 layer — 13 chain families, trustless bridge, atomic swap, ZionDex.` },
  heroCtaNetwork: { cs: `Síť`, en: `Network` },
  heroCtaDocs: { cs: `Dokumentace`, en: `Docs` },
  heroCtaDownload: { cs: `Miner`, en: `Miner` },
  gateways: { cs: `Vstupy`, en: `Gateways` },
  gatewaysTitle: { cs: `Přehledný řídicí panel`, en: `Clean control panel` },
  gatewaysSub: { cs: `Méně šumu, jasné směry: síť, těžba, dokumentace, plán a Terra Nova.`, en: `Less noise, clearer direction: network, mining, docs, roadmap and Terra Nova.` },
  live: { cs: `Živá síť`, en: `Live network` },
  release: { cs: `Nový release`, en: `New release` },
  releaseTitle: { cs: `ZION v3.1.0 — Terminal Miner & Desktop App`, en: `ZION v3.1.0 — Terminal Miner & Desktop App` },
  news: { cs: `Novinky`, en: `News` },
  terminal: { cs: `Web terminál`, en: `Web terminal` },
  terminalSub: { cs: `Node, pool, bridge, swap a DAO příkazy přímo v prohlížeči.`, en: `Node, pool, bridge, swap and DAO commands right in the browser.` },
  explore: { cs: `Prozkoumat`, en: `Explore` },
  roadmap: { cs: `Roadmapa`, en: `Roadmap` },
  whitepaper: { cs: `Whitepaper`, en: `Whitepaper` },
  onboard: { cs: `Začít`, en: `Onboard` },
};

const fadeUp = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.4 } };

/* ── Section Header ── */
function SectionHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-4 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zion-gold">{kicker}</p>
      <h2 className="text-2xl font-bold leading-tight text-white sm:text-3xl">{title}</h2>
      {sub && <p className="max-w-xl text-sm leading-relaxed text-gray-400">{sub}</p>}
    </div>
  );
}

/* ── Hero ── */
function HeroLite() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  return (
    <section className="relative px-4 pt-14 pb-8 sm:pt-18 sm:pb-10 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-700/10 blur-3xl" />
        <div className="absolute top-40 -right-32 w-[400px] h-[400px] rounded-full bg-cyan-500/8 blur-3xl" />
      </div>
      <CosmicFlowers className="z-0 hidden md:block opacity-70" />

      <div className="zion-container relative z-10">
        <motion.div {...fadeUp} className="mb-4 flex flex-wrap items-center gap-2">
          <span className="zion-kicker border-zion-gold/25 bg-zion-gold/10 text-zion-gold">
            <Sparkles className="w-3.5 h-3.5" />
            {tr('hero', 'badge_version', lang)}
          </span>
          <a href="https://github.com/Zion-TerraNova/v3-Mainnet" target="_blank" rel="noreferrer" className="zion-kicker border-white/10 bg-black/40 text-gray-300 hover:text-white group">
            <Github className="h-3.5 w-3.5" />
            GitHub
            <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100" />
          </a>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_0.85fr] gap-6 xl:gap-10 items-start">
          <div className="space-y-4">
            <div>
              <p className="text-base md:text-lg text-zion-cyan font-semibold mb-1 tracking-wide">{Copy.heroTagline[cs ? 'cs' : 'en']}</p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.08] tracking-tight">
                <span className="text-gradient-soft">{Copy.heroTitle[cs ? 'cs' : 'en']}</span>
              </h1>
              <p className="mt-2 text-base md:text-lg text-white/60">{Copy.heroSub[cs ? 'cs' : 'en']}</p>
            </div>
            <p className="text-base text-gray-300 max-w-xl leading-relaxed">{tr('hero', 'description', lang)}</p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <Link href="/network" className="zion-button-primary group" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                {Copy.heroCtaNetwork[cs ? 'cs' : 'en']}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/docs" className="zion-button-secondary">
                <Shield className="w-4 h-4" />
                {Copy.heroCtaDocs[cs ? 'cs' : 'en']}
              </Link>
              <Link href="/download" className="zion-button-secondary">
                <Cpu className="w-4 h-4" />
                {Copy.heroCtaDownload[cs ? 'cs' : 'en']}
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: tr('hero', 'metric_loc', lang), value: '52 590', icon: Zap },
                { label: tr('hero', 'metric_nodes', lang), value: '2 / 2', icon: Satellite },
                { label: tr('hero', 'metric_tests', lang), value: '780+', icon: Activity },
              ].map((m) => (
                <div key={m.label} className="zion-panel-soft p-2.5">
                  <m.icon className="w-3.5 h-3.5 text-zion-gold mb-1" />
                  <div className="text-base font-bold text-white truncate">{m.value}</div>
                  <div className="text-[9px] uppercase tracking-wide text-gray-500 leading-tight">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="zion-rainbow-card p-3" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <MainnetCountdown embedded />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Quick Links ── */
function QuickLinksLite() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const links = [
    { href: '/explorer', label: 'Explorer', desc: cs ? 'Bloky, tx, adresy' : 'Blocks, tx, addresses', icon: Blocks, rc: '251, 191, 36' },
    { href: '/network', label: cs ? 'Síť' : 'Network', desc: cs ? 'Uzly, latence' : 'Nodes, latency', icon: Globe, rc: '6, 182, 212' },
    { href: '/pool', label: cs ? 'Pool' : 'Pool', desc: cs ? 'Hashrate, mineri' : 'Hashrate, miners', icon: HardHat, rc: '147, 51, 234' },
    { href: '/docs', label: cs ? 'Dokumentace' : 'Docs', desc: cs ? 'Guides, API' : 'Guides, API', icon: ScrollText, rc: '16, 185, 129' },
    { href: '/roadmap', label: cs ? 'Roadmapa' : 'Roadmap', desc: 'L1-L6', icon: LayoutDashboard, rc: '236, 72, 153' },
    { href: '/terranova', label: 'Terra Nova', desc: cs ? 'Kniha, příběh' : 'Book, story', icon: Sparkles, rc: '245, 158, 11' },
  ];

  return (
    <section className="px-4 py-6 sm:py-8">
      <div className="zion-container">
        <SectionHeader
          kicker={Copy.gateways[cs ? 'cs' : 'en']}
          title={Copy.gatewaysTitle[cs ? 'cs' : 'en']}
          sub={Copy.gatewaysSub[cs ? 'cs' : 'en']}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="zion-rainbow-sub group flex flex-col items-center gap-2 p-3 text-center"
              style={{ '--rc': link.rc } as React.CSSProperties}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border" style={{ borderColor: `rgba(${link.rc},0.4)`, backgroundColor: `rgba(${link.rc},0.12)` }}>
                <link.icon className="h-5 w-5" style={{ color: `rgb(${link.rc})` }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{link.label}</h3>
                <p className="text-[10px] leading-tight text-gray-400">{link.desc}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70 transition-all" />
            </Link>
          ))}
        </div>

        <Link href="/doge-vs-zion" className="zion-rainbow-sub group mt-2 flex items-center gap-3 p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/10">
            <Swords className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">Doge vs ZION</h3>
            <p className="text-[10px] text-gray-400">{cs ? 'Arkáda — 5 her, showdown, stargate' : 'Arcade — 5 games, showdown, stargate'}</p>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70" />
        </Link>
      </div>
    </section>
  );
}

/* ── Live Stats ── */
function LiveStatsLite() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [stats, setStats] = useState<BlockchainStats>({});

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/blockchain/stats');
      if (res.ok) setStats((await res.json()).data ?? {});
    } catch { /* ignore */ }
  }, []);
  usePolling(fetchStats, 15000);

  const items = [
    { icon: Database, label: cs ? 'Bloky' : 'Blocks', value: stats.total_blocks ?? '—', color: 'text-emerald-400' },
    { icon: Coins, label: cs ? 'Zásoba' : 'Supply', value: stats.total_supply ? `${(stats.total_supply / 1e9).toFixed(2)}B` : '—', color: 'text-zion-gold' },
    { icon: Network, label: cs ? 'Tx' : 'Tx', value: stats.transactions ?? '—', color: 'text-zion-cyan' },
    { icon: Activity, label: cs ? 'Obtížnost' : 'Difficulty', value: stats.difficulty ? `${(stats.difficulty / 1e6).toFixed(2)}M` : '—', color: 'text-purple-400' },
  ];

  return (
    <section className="px-4 py-4">
      <div className="zion-container">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="zion-panel-soft p-3 text-center">
              <item.icon className={`h-4 w-4 ${item.color} mx-auto mb-1`} />
              <div className="text-lg font-bold text-white">{item.value}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Multichain + Bridge ── */
function MultichainLite() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  return (
    <section className="px-4 py-6">
      <div className="zion-container">
        <SectionHeader
          kicker={cs ? 'L2' : 'L2'}
          title={cs ? 'Multichain — 13 chain rodin' : 'Multichain — 13 chain families'}
          sub={cs ? 'Bridge, WARP, HTLC swap, ZionDex a DAO v jednom servisu.' : 'Bridge, WARP, HTLC swap, ZionDex and DAO in one service.'}
        />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="zion-rainbow-card p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">{cs ? 'Bridge L1 ↔ Base' : 'Bridge L1 ↔ Base'}</h3>
            </div>
            <p className="text-sm text-gray-400 mb-3">{cs ? 'Lock-mint / burn-release. 1:1 peg, 5/7 validátorů.' : 'Lock-mint / burn-release. 1:1 peg, 5/7 validators.'}</p>
            <Link href="/multichain#bridge" className="zion-button-primary text-xs">
              {cs ? 'Bridge' : 'Bridge'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="zion-rainbow-card p-4" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-5 w-5 text-zion-cyan" />
              <h3 className="text-base font-bold text-white">{cs ? 'WARP Cross-Chain' : 'WARP Cross-Chain'}</h3>
            </div>
            <p className="text-sm text-gray-400 mb-3">{cs ? 'BTC, SOL, ETH, Cosmos, Cardano, Lightning, TON...' : 'BTC, SOL, ETH, Cosmos, Cardano, Lightning, TON...'}</p>
            <Link href="/multichain#warp" className="zion-button-primary text-xs">
              {cs ? 'WARP' : 'WARP'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Release Highlight ── */
function ReleaseLite() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  return (
    <section className="px-4 py-4">
      <div className="zion-container">
        <div className="zion-rainbow-card p-4 sm:p-5" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="rounded-full bg-zion-gold/15 p-2.5 border border-zion-gold/30 w-fit">
              <Rocket className="h-5 w-5 text-zion-gold" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-zion-gold">{Copy.release[cs ? 'cs' : 'en']}</p>
              <h3 className="text-lg font-bold text-white">{Copy.releaseTitle[cs ? 'cs' : 'en']}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-cli" target="_blank" rel="noreferrer" className="zion-button-primary text-xs">
                <Terminal className="h-3.5 w-3.5" />
                {cs ? 'Terminal Miner' : 'Terminal Miner'}
              </a>
              <a href="https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-desktop" target="_blank" rel="noreferrer" className="zion-button-secondary text-xs">
                <Wallet className="h-3.5 w-3.5" />
                {cs ? 'Desktop App' : 'Desktop App'}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── News (3 latest) ── */
function NewsLite() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const articles = [
    { date: '2026-08-03', tag: cs ? 'Release' : 'Release', tagColor: 'text-zion-gold', title: cs ? 'ZION v3.1.0 Terminal Miner pro všechny platformy' : 'ZION v3.1.0 Terminal Miner for all platforms', href: '/download' },
    { date: '2026-08-01', tag: 'Multichain', tagColor: 'text-emerald-400', title: cs ? 'Jednotný Multichain servis na portu 8453' : 'Unified Multichain service on port 8453', href: '/multichain' },
    { date: '2026-07-20', tag: cs ? 'Mainnet' : 'Mainnet', tagColor: 'text-zion-cyan', title: cs ? 'Block retention fix a nový genesis' : 'Block retention fix and new genesis', href: '/news' },
  ];

  return (
    <section className="px-4 py-6">
      <div className="zion-container">
        <SectionHeader kicker={Copy.news[cs ? 'cs' : 'en']} title={cs ? 'Aktuálně' : 'Latest'} />
        <div className="space-y-2">
          {articles.map((a) => (
            <Link key={a.href + a.title} href={a.href} className="zion-rainbow-sub group flex items-center gap-3 p-3" style={{ '--rc': '107, 114, 128' } as React.CSSProperties}>
              <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-bold uppercase ${a.tagColor}`}>{a.tag}</span>
                  <span className="text-[10px] text-gray-500">{a.date}</span>
                </div>
                <h3 className="text-sm font-semibold text-white truncate group-hover:text-zion-gold transition-colors">{a.title}</h3>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70" />
            </Link>
          ))}
        </div>
        <div className="mt-3 text-right">
          <Link href="/news" className="text-xs text-zion-cyan hover:underline">{cs ? 'Všechny novinky →' : 'All news →'}</Link>
        </div>
      </div>
    </section>
  );
}

/* ── Terminal Teaser ── */
function TerminalTeaser() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  return (
    <section className="px-4 py-4">
      <div className="zion-container">
        <div className="zion-rainbow-card p-4 sm:p-5" style={{ '--rc': '107, 114, 128' } as React.CSSProperties}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Terminal className="h-6 w-6 text-gray-400" />
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">{Copy.terminal[cs ? 'cs' : 'en']}</h3>
              <p className="text-sm text-gray-400">{Copy.terminalSub[cs ? 'cs' : 'en']}</p>
            </div>
            <Link href="/docs" className="zion-button-primary text-xs">
              <Terminal className="h-3.5 w-3.5" />
              {cs ? 'Otevřít' : 'Open'}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Features ── */
function FeaturesLite() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const features = [
    { icon: Cpu, label: cs ? 'Nativní Rust' : 'Native Rust', desc: cs ? 'L1 blockchain od nuly, žádný fork.' : 'L1 blockchain from scratch, no fork.' },
    { icon: Globe, label: 'Multi-Chain', desc: cs ? '13 chain rodin, bridge, WARP, swap.' : '13 chain families, bridge, WARP, swap.' },
    { icon: Bot, label: 'AI-Native', desc: cs ? 'Proof-of-Care, CHv4, Bodhisattva Vow.' : 'Proof-of-Care, CHv4, Bodhisattva Vow.' },
    { icon: Droplets, label: 'ZionDex', desc: cs ? 'AMM router s multi-hop routing.' : 'AMM router with multi-hop routing.' },
    { icon: Shield, label: 'DAO', desc: cs ? 'L1 memo governance, multi-sig treasury.' : 'L1 memo governance, multi-sig treasury.' },
    { icon: TrendingUp, label: 'DeFi', desc: cs ? 'Pool, staking, farming, revenue sharing.' : 'Pool, staking, farming, revenue sharing.' },
  ];

  return (
    <section className="px-4 py-6">
      <div className="zion-container">
        <SectionHeader kicker={cs ? 'Proč ZION' : 'Why ZION'} title={cs ? 'Základní vlastnosti' : 'Core features'} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.label} className="zion-rainbow-sub p-3" style={{ '--rc': '107, 114, 128' } as React.CSSProperties}>
              <f.icon className="h-5 w-5 text-zion-cyan mb-2" />
              <h3 className="text-sm font-bold text-white">{f.label}</h3>
              <p className="text-[10px] text-gray-400 leading-tight">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Roadmap ── */
function RoadmapLite() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const phases = [
    { done: true, label: 'Q3 2025', title: cs ? 'Mainnet Alpha' : 'Mainnet Alpha' },
    { done: true, label: 'Q4 2025', title: cs ? 'V3.0 Mainnet' : 'V3.0 Mainnet' },
    { done: true, label: 'Q2 2026', title: 'V31 Multichain' },
    { done: false, label: 'Q4 2026', title: cs ? 'V3.1 Mainnet' : 'V3.1 Mainnet' },
  ];

  return (
    <section className="px-4 py-4">
      <div className="zion-container">
        <SectionHeader kicker={Copy.roadmap[cs ? 'cs' : 'en']} title={cs ? 'Časová osa' : 'Timeline'} />
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {phases.map((p, i) => (
            <div key={p.title} className="shrink-0 flex items-center gap-2">
              <div className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${p.done ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                {p.label}
              </div>
              <span className="text-xs text-gray-300 whitespace-nowrap">{p.title}</span>
              {i < phases.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-gray-600 shrink-0" />}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Link href="/roadmap" className="text-xs text-zion-cyan hover:underline">{cs ? 'Celá roadmapa →' : 'Full roadmap →'}</Link>
        </div>
      </div>
    </section>
  );
}

/* ── Explore ── */
function ExploreLite() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  return (
    <section className="px-4 py-6">
      <div className="zion-container">
        <SectionHeader kicker={Copy.explore[cs ? 'cs' : 'en']} title={cs ? 'Další zdroje' : 'More resources'} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/whitepapers" className="zion-rainbow-sub group flex items-center gap-3 p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <BookOpen className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-semibold text-white">{Copy.whitepaper[cs ? 'cs' : 'en']}</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70 ml-auto" />
          </Link>
          <Link href="/onboard" className="zion-rainbow-sub group flex items-center gap-3 p-3" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <Flame className="h-5 w-5 text-zion-cyan" />
            <span className="text-sm font-semibold text-white">{Copy.onboard[cs ? 'cs' : 'en']}</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70 ml-auto" />
          </Link>
          <Link href="/tree-of-life" className="zion-rainbow-sub group flex items-center gap-3 p-3" style={{ '--rc': '236, 72, 153' } as React.CSSProperties}>
            <Sparkles className="h-5 w-5 text-pink-400" />
            <span className="text-sm font-semibold text-white">Tree of Life</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70 ml-auto" />
          </Link>
          <Link href="/l4-oasis" className="zion-rainbow-sub group flex items-center gap-3 p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <Globe className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-semibold text-white">OASIS</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70 ml-auto" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Main Page ── */
export default function HomePageLite() {
  return (
    <main className="zion-page">
      <HeroLite />
      <LiveStatsLite />
      <QuickLinksLite />
      <MultichainLite />
      <ReleaseLite />
      <NewsLite />
      <TerminalTeaser />
      <FeaturesLite />
      <RoadmapLite />
      <ExploreLite />
    </main>
  );
}
