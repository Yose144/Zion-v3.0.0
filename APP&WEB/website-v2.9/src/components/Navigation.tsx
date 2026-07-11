'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  Menu, X, SignalHigh, Orbit, ChevronDown, LayoutDashboard, Pickaxe, Shield,
  HardHat, Download, Coins, ArrowLeftRight, Landmark, Wallet, BookOpen,
  Newspaper, Map, Sparkles, Rocket, Brain, Flower2, Globe2, Zap, Atom, Building2,
  CircuitBoard, Github, Layers, Network as NetworkIcon, ArrowRightLeft,
} from 'lucide-react';
import NavAuthButton from './NavAuthButton';
import BackgroundToggle from './BackgroundToggle';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { SITE_RELEASE_LABEL } from '@/lib/site';

type NavItem = { href: string; label: string; children?: NavItem[] };
type NavGroup = { title: string; icon: typeof SignalHigh; color: string; items: NavItem[] };

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const pathname = usePathname();
  const { lang, setLang } = useLang();

  const navItemMatches = (href: string) =>
    pathname === href || (href === '/terranova' && pathname.startsWith('/terranova')) || (href === '/quantum-revolution' && pathname.startsWith('/quantum-revolution')) || (href === '/tree-of-life' && pathname.startsWith('/tree-of-life')) || (href === '/wiki' && pathname === '/wiki');

  /* ── 4 groups with icons + RASTA accent colors ── */
  const navGroups: NavGroup[] = [
    {
      title: tr('nav', 'network_group', lang),
      icon: NetworkIcon,
      color: '16, 185, 129',
      items: [
        { href: '/network', label: tr('nav', 'network', lang) },
        { href: '/explorer', label: tr('nav', 'explorer', lang) },
        { href: '/pool', label: tr('nav', 'pool', lang) },
        { href: '/mining', label: tr('nav', 'mining', lang) },
        { href: '/download', label: tr('nav', 'download', lang) },
      ],
    },
    {
      title: tr('nav', 'defi_group', lang),
      icon: Coins,
      color: '251, 191, 36',
      items: [
        { href: '/defi', label: tr('nav', 'defi', lang) },
        { href: '/ziondex', label: 'ZionDex', children: [
          { href: '/dex', label: 'Swap Interface' },
          { href: '/dex/liquidity', label: 'Liquidity Pools' },
          { href: '/dex/portfolio', label: 'Portfolio' },
        ] },
        { href: '/cex', label: tr('nav', 'cex', lang) },
        { href: '/warp', label: tr('nav', 'warp', lang) },
        { href: '/bridge', label: tr('nav', 'bridge', lang) },
        { href: '/dao', label: tr('nav', 'dao', lang) },
        { href: '/wallet', label: tr('nav', 'wallet', lang) },
      ],
    },
    {
      title: tr('nav', 'layers_group', lang),
      icon: Layers,
      color: '239, 68, 68',
      items: [
        { href: '/l3-hiran', label: tr('nav', 'l3_hiran', lang) },
        { href: '/l4-oasis', label: tr('nav', 'l4_oasis', lang) },
        { href: '/l5-free-world', label: tr('nav', 'l5_free_world', lang) },
        { href: '/l6-issobella', label: tr('nav', 'l6_issobella', lang) },
      ],
    },
    {
      title: tr('nav', 'learn_group', lang),
      icon: BookOpen,
      color: '16, 185, 129',
      items: [
        { href: '/docs', label: tr('nav', 'docs', lang) },
        { href: '/news', label: tr('nav', 'news', lang) },
        { href: '/roadmap', label: tr('nav', 'roadmap', lang) },
        { href: '/genesis', label: tr('nav', 'genesis', lang) },
        { href: '/terranova', label: tr('nav', 'terranova', lang) },
        { href: '/tree-of-life', label: tr('nav', 'tree_of_life', lang), children: [
          { href: '/tree-of-life#evoluzion', label: 'evoluZion V2' },
          { href: '/tree-of-life#proof-of-care', label: 'Proof-of-Care' },
          { href: '/tree-of-life#bodhisattva', label: 'Bodhisattva Vow' },
        ] },
      ],
    },
  ];

  const activeGroup = navGroups.find((group) => group.title === openGroup);

  /* ── HERO icons — top panel, RASTA colored ── */
  /* Rasta: green (emerald) → gold (zion-gold) → red (rose/red) */
  const heroIcons = [
    { href: '/explorer', icon: Orbit, color: '16, 185, 129', label: tr('nav', 'explorer', lang) },       /* green */
    { href: '/pool', icon: Pickaxe, color: '251, 191, 36', label: tr('nav', 'pool', lang) },               /* gold */
    { href: '/network', icon: SignalHigh, color: '239, 68, 68', label: tr('nav', 'network', lang) },      /* red */
    { href: '/docs', icon: BookOpen, color: '16, 185, 129', label: tr('nav', 'docs', lang) },             /* green */
    { href: '/wallet', icon: Wallet, color: '251, 191, 36', label: tr('nav', 'wallet', lang) },            /* gold */
  ];

  /* ── Secondary icons — medium, core ecosystem ── */
  const secondaryIcons = [
    { href: '/mining', icon: HardHat, color: '245, 158, 11', label: tr('nav', 'mining', lang) },
    { href: '/defi', icon: Coins, color: '16, 185, 129', label: tr('nav', 'defi', lang) },
    { href: '/download', icon: Download, color: '251, 191, 36', label: tr('nav', 'download', lang) },
  ];

  /* ── Tertiary icons — small, rest of ecosystem ── */
  const tertiaryIcons = [
    { href: '/bridge', icon: ArrowLeftRight, color: '59, 130, 246', label: tr('nav', 'bridge', lang) },
    { href: '/ziondex', icon: ArrowRightLeft, color: '16, 185, 129', label: 'ZionDex' },
    { href: '/dex', icon: Zap, color: '251, 191, 36', label: 'DEX Swap' },
    { href: '/dao', icon: Landmark, color: '147, 51, 234', label: tr('nav', 'dao', lang) },
    { href: '/cex', icon: Building2, color: '236, 72, 153', label: tr('nav', 'cex', lang) },
    { href: '/warp', icon: CircuitBoard, color: '99, 102, 241', label: tr('nav', 'warp', lang) },
    { href: '/l3-hiran', icon: Brain, color: '139, 92, 246', label: tr('nav', 'l3_hiran', lang) },
    { href: '/l4-oasis', icon: Flower2, color: '217, 70, 239', label: tr('nav', 'l4_oasis', lang) },
    { href: '/l5-free-world', icon: Rocket, color: '14, 165, 233', label: tr('nav', 'l5_free_world', lang) },
    { href: '/l6-issobella', icon: Zap, color: '244, 63, 94', label: tr('nav', 'l6_issobella', lang) },
    { href: '/terranova', icon: Globe2, color: '34, 197, 94', label: tr('nav', 'terranova', lang) },
    { href: '/tree-of-life', icon: Sparkles, color: '251, 191, 36', label: tr('nav', 'tree_of_life', lang) },
    { href: '/news', icon: Newspaper, color: '249, 115, 22', label: tr('nav', 'news', lang) },
    { href: '/roadmap', icon: Map, color: '99, 102, 241', label: tr('nav', 'roadmap', lang) },
    { href: '/genesis', icon: Sparkles, color: '251, 191, 36', label: tr('nav', 'genesis', lang) },
    { href: '/quantum-revolution', icon: Atom, color: '251, 191, 36', label: tr('nav', 'quantum_revolution', lang) },
  ];

  const groupLabels: Record<string, string> = {
    [tr('nav', 'network_group', lang)]: tr('nav', 'network_group', lang),
    [tr('nav', 'defi_group', lang)]: tr('nav', 'defi_group', lang),
    [tr('nav', 'layers_group', lang)]: tr('nav', 'layers_group', lang),
    [tr('nav', 'learn_group', lang)]: tr('nav', 'learn_group', lang),
  };

  /* Close mobile menu on route change */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setIsOpen(false);
      setOpenGroup(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  /* Scroll lock when mobile menu open */
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
    return () => document.body.classList.remove('menu-open');
  }, [isOpen]);

  /* Escape key closes menus */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setOpenGroup(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* Close desktop dropdown on click outside */
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-nav-desktop]')) {
        setOpenGroup(null);
      }
    };
    if (openGroup) {
      document.addEventListener('click', handleClick);
    }
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [openGroup]);

  /* Close on resize from mobile to desktop */
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setIsOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      {/* Rasta ambient glow — green → gold → amber */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-r from-emerald-500/14 via-zion-gold/16 to-amber-600/12 blur-3xl opacity-75" />
      <div className="relative mx-auto w-[min(90vw,1320px)] py-2" data-nav-desktop>
        {/* ═══════════════════════════════════════════════════
            FLOOR 1 — MAIN BAR
            Logo | 4 HERO icons (rasta) | lang + GitHub + auth + dashboard
            ═══════════════════════════════════════════════════ */}
        <div className="relative rounded-2xl bg-linear-to-r from-emerald-500/60 via-zion-gold/70 to-red-500/60 p-[1px] shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
          {/* Rasta gradient top accent line */}
          <div className="pointer-events-none absolute -top-px left-2 right-2 h-px rounded-t-2xl bg-linear-to-r from-emerald-400/80 via-zion-gold/90 to-red-400/80" />
          <div className="zion-panel relative flex items-center justify-between gap-1.5 sm:gap-2 rounded-[15px] bg-black/85 px-2 sm:px-3 py-1.5 sm:py-2 md:px-4"
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >

          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center relative overflow-hidden border border-white/15 group-hover:border-zion-gold/50 transition-colors bg-transparent shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(111,255,240,0.08),transparent_65%)]" />
              <Image
                src="/stargate-icon.png"
                alt="ZION TerraNova Stargate"
                width={40}
                height={40}
                className="relative z-10 w-full h-full object-contain"
                priority
              />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-base sm:text-lg font-bold text-gradient-soft tracking-tight">ZION</span>
              <span className="text-[7px] sm:text-[8px] px-1 sm:px-1.5 py-0.5 mt-0.5 rounded-full bg-white/6 border border-white/10 uppercase tracking-[0.18em] sm:tracking-[0.22em] text-white/60">
                {SITE_RELEASE_LABEL}
              </span>
            </div>
          </Link>

          {/* 4 HERO icons — BIG, rasta colored, inline in main bar */}
          <div className="hidden md:flex items-center justify-center gap-2">
            {heroIcons.map((ml) => {
              const isActive = navItemMatches(ml.href);
              return (
                <Link
                  key={ml.href}
                  href={ml.href}
                  title={ml.label}
                  className="group relative flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 transition-all hover:scale-105 shrink-0"
                  style={{
                    borderColor: isActive ? `rgba(${ml.color}, 0.65)` : 'rgba(255,255,255,0.08)',
                    backgroundColor: isActive ? `rgba(${ml.color}, 0.15)` : 'rgba(0,0,0,0.4)',
                    boxShadow: isActive ? `0 0 16px rgba(${ml.color}, 0.3)` : 'none',
                  }}
                >
                  <ml.icon
                    className="w-4 h-4"
                    style={{ color: isActive ? `rgb(${ml.color})` : `rgba(${ml.color}, 0.8)` }}
                  />
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider hidden lg:inline"
                    style={{ color: isActive ? `rgb(${ml.color})` : 'rgba(255,255,255,0.7)' }}
                  >
                    {ml.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Right cluster: lang + GitHub + auth + dashboard */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/15 bg-black/75 text-xs font-semibold hover:border-white/30 hover:bg-black transition-colors text-gray-300 hover:text-white"
              title={lang === 'cs' ? tr('nav', 'switch_to_en', lang) : tr('nav', 'switch_to_cs', lang)}
            >
              {lang === 'cs' ? tr('nav', 'language_toggle_desktop_cs', lang) : tr('nav', 'language_toggle_desktop_en', lang)}
            </button>
            <Link
              href="https://github.com/Zion-TerraNova/v3-Mainnet"
              target="_blank"
              rel="noreferrer"
              title="GitHub"
              className="hidden md:inline-flex p-2 rounded-xl border border-zion-gold/30 bg-linear-to-br from-zion-gold/10 to-amber-600/8 items-center justify-center shadow-[0_0_14px_rgba(251,191,36,0.15)] hover:shadow-[0_0_22px_rgba(251,191,36,0.35)] hover:border-zion-gold/50 transition-all group relative"
            >
              <Github className="w-4 h-4 text-zion-gold" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black/90 border border-zion-gold/20 rounded px-2 py-0.5 text-zion-gold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">GitHub</span>
            </Link>
            <NavAuthButton />
            <Link
              href="/dashboard"
              title={tr('nav', 'dashboard', lang)}
              className="p-1.5 sm:p-2 rounded-xl border border-white/15 bg-black/85 inline-flex items-center justify-center shadow-[0_14px_38px_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-0.5 hover:border-zion-gold/50 group relative"
            >
              <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black/90 border border-white/10 rounded px-2 py-0.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">{tr('nav', 'dashboard', lang)}</span>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-white p-3 rounded-xl border border-white/20 bg-white/5 hover:border-white/40 active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={isOpen ? tr('nav', 'close_menu', lang) : tr('nav', 'open_menu', lang)}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            FLOOR 2 — SECONDARY + TERTIARY ICONS + GROUP DROPDOWNS
            ═══════════════════════════════════════════════════ */}
        <div className="mt-1 hidden md:flex items-center justify-between gap-2 relative">
          {/* Rasta accent line */}
          <div className="pointer-events-none absolute -top-0.5 left-1/6 right-1/6 h-px bg-linear-to-r from-transparent via-emerald-500/40 via-zion-gold/50 via-red-500/40 to-transparent" />

          {/* Icons + group dropdowns */}
          <div className="flex items-center gap-1 flex-1 justify-center overflow-x-auto no-scrollbar min-w-0">
            {/* Secondary icons — medium */}
            {secondaryIcons.map((ml) => {
              const isActive = navItemMatches(ml.href);
              return (
                <Link
                  key={ml.href}
                  href={ml.href}
                  title={ml.label}
                  className="group relative flex flex-col items-center justify-center w-8 h-8 rounded-lg border transition-all hover:scale-110 shrink-0"
                  style={{
                    borderColor: isActive ? `rgba(${ml.color}, 0.5)` : 'rgba(255,255,255,0.06)',
                    backgroundColor: isActive ? `rgba(${ml.color}, 0.13)` : 'rgba(0,0,0,0.3)',
                  }}
                >
                  <ml.icon
                    className="w-3.5 h-3.5"
                    style={{ color: isActive ? `rgb(${ml.color})` : 'rgba(255,255,255,0.55)' }}
                  />
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] bg-black/95 border border-white/10 rounded px-1.5 py-0.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {ml.label}
                  </span>
                </Link>
              );
            })}

            {/* Divider */}
            <div className="mx-0.5 h-5 w-px bg-white/8 shrink-0" />

            {/* Tertiary icons — small */}
            {tertiaryIcons.map((ml) => {
              const isActive = navItemMatches(ml.href);
              return (
                <Link
                  key={ml.href}
                  href={ml.href}
                  title={ml.label}
                  className="group relative flex flex-col items-center justify-center w-7 h-7 rounded-lg border transition-all hover:scale-110 shrink-0"
                  style={{
                    borderColor: isActive ? `rgba(${ml.color}, 0.45)` : 'rgba(255,255,255,0.03)',
                    backgroundColor: isActive ? `rgba(${ml.color}, 0.1)` : 'transparent',
                  }}
                >
                  <ml.icon
                    className="w-3 h-3"
                    style={{ color: isActive ? `rgb(${ml.color})` : 'rgba(255,255,255,0.35)' }}
                  />
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] bg-black/95 border border-white/10 rounded px-1.5 py-0.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {ml.label}
                  </span>
                </Link>
              );
            })}

            {/* Divider */}
            <div className="mx-1 h-5 w-px bg-white/8 shrink-0" />

            {/* Group dropdown buttons */}
            {navGroups.map((group) => {
              const isActive = openGroup === group.title;
              const groupHasActiveChild = group.items.some((item) => navItemMatches(item.href));
              return (
                <div key={group.title} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(isActive ? null : group.title)}
                    className={`group inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all ${
                      isActive
                        ? 'border-zion-gold/40 bg-linear-to-br from-emerald-500/15 via-zion-gold/12 to-red-500/12 text-white shadow-[0_8px_20px_rgba(0,0,0,0.25),0_0_12px_rgba(251,191,36,0.12)]'
                        : groupHasActiveChild
                          ? 'border-emerald-500/30 bg-black/60 text-white hover:border-zion-gold/40'
                          : 'border-white/8 bg-black/60 text-gray-400 hover:border-zion-gold/30 hover:bg-black/80 hover:text-white'
                    }`}
                    aria-expanded={isActive}
                  >
                    <group.icon
                      className="w-3 h-3"
                      style={{ color: isActive ? `rgb(${group.color})` : `rgba(${group.color}, 0.7)` }}
                    />
                    <span className="group-hover:text-zion-gold transition-colors">{groupLabels[group.title] ?? group.title}</span>
                    <ChevronDown className={`h-2.5 w-2.5 transition-transform ${isActive ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Background toggle */}
          <div className="shrink-0">
            <BackgroundToggle placement="nav" />
          </div>
        </div>

        {/* ═══ GROUP DROPDOWN PANEL ═══ */}
        {activeGroup && (
          <div className="mt-1 hidden md:block absolute left-1/2 -translate-x-1/2 w-[min(20rem,90vw)] rounded-3xl border border-zion-gold/20 bg-black/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55),0_0_24px_rgba(251,191,36,0.1)] backdrop-blur-2xl z-50">
            <div className="mb-2 h-0.5 w-full rounded-full bg-linear-to-r from-emerald-500/50 via-zion-gold/60 to-red-500/40" />
            <div className="flex items-center gap-2 mb-3">
              <activeGroup.icon className="w-4 h-4" style={{ color: `rgb(${activeGroup.color})` }} />
              <p className="text-[10px] uppercase tracking-[0.4em] text-zion-gold/70">{groupLabels[activeGroup.title] ?? activeGroup.title}</p>
            </div>
            <div className="flex flex-col gap-1">
              {activeGroup.items.map((item) => (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition block ${
                      navItemMatches(item.href) ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                    onClick={() => setOpenGroup(null)}
                  >
                    {item.label}
                  </Link>
                  {item.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`rounded-2xl pl-8 pr-4 py-2.5 text-[13px] transition block ${
                        pathname === child.href ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      }`}
                      onClick={() => setOpenGroup(null)}
                    >
                      <span className="text-white/20 mr-2">└</span>
                      {child.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ MOBILE OVERLAY + MENU ═══ */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            {/* Slide-in panel */}
            <div className="md:hidden fixed top-0 right-0 bottom-0 w-[min(320px,85vw)] bg-black/95 backdrop-blur-xl border-l-2 border-zion-gold/30 z-50 overflow-y-auto overscroll-contain animate-[slideIn_0.25s_ease-out]" style={{ borderImage: 'linear-gradient(to bottom, rgba(16,185,129,0.4), rgba(251,191,36,0.5), rgba(239,68,68,0.4)) 1' }}>
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <span className="text-sm font-bold text-gradient">{tr('nav', 'menu_title', lang)}</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl border border-white/20 hover:border-zion-gold/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={tr('nav', 'close_menu', lang)}
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
              {/* Rasta accent line */}
              <div className="h-0.5 w-full bg-linear-to-r from-emerald-500/50 via-zion-gold/60 to-red-500/40" />
              <div className="p-4 space-y-2">
                {/* Home shortcut — always visible */}
                <Link
                  href="/"
                  className={`rounded-xl px-3 py-3 text-sm font-semibold transition min-h-[44px] flex items-center ${
                    pathname === '/' ? 'bg-white/10 text-white' : 'text-gray-200 hover:bg-white/5 active:bg-white/10'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {tr('nav', 'home', lang)}
                </Link>
                {navGroups.map((group) => {
                  const isExpanded = openGroup === group.title;
                  return (
                    <div key={group.title} className="border-t border-white/5 pt-2">
                      <button
                        type="button"
                        onClick={() => setOpenGroup(isExpanded ? null : group.title)}
                        className="w-full flex items-center justify-between rounded-xl px-3 py-3 text-[11px] uppercase tracking-[0.32em] text-gray-400 hover:text-white hover:bg-white/5 min-h-[44px]"
                        aria-expanded={isExpanded}
                      >
                        <span className="flex items-center gap-2">
                          <group.icon className="w-3.5 h-3.5" style={{ color: `rgba(${group.color}, 0.8)` }} />
                          {groupLabels[group.title] ?? group.title}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180 text-white' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="mt-1 ml-1 border-l border-white/10 pl-2 space-y-0.5">
                          {group.items.map((item) => (
                            <div key={item.href}>
                              <Link
                                href={item.href}
                                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition min-h-[40px] flex items-center ${
                                  navItemMatches(item.href)
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-300 hover:bg-white/5 active:bg-white/10'
                                }`}
                                onClick={() => setIsOpen(false)}
                              >
                                {item.label}
                              </Link>
                              {item.children?.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={`rounded-xl pl-7 pr-3 py-2 text-[13px] transition min-h-[36px] flex items-center ${
                                    pathname === child.href ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 active:bg-white/10'
                                  }`}
                                  onClick={() => setIsOpen(false)}
                                >
                                  <span className="text-white/20 mr-2">└</span>
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="h-px w-full bg-white/10" />
                <div className="flex justify-center">
                  <button
                    onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-xs font-semibold hover:border-white/30 transition-colors text-gray-300 hover:text-white"
                  >
                    {lang === 'cs' ? tr('nav', 'language_toggle_mobile_cs', lang) : tr('nav', 'language_toggle_mobile_en', lang)}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Link
                    href="/explorer"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 inline-flex items-center gap-2 min-h-[44px] active:bg-white/10"
                  >
                    <Orbit className="w-3 h-3 text-zion-gold shrink-0" /> {tr('nav', 'explorer', lang)}
                  </Link>
                  <Link
                    href="/pool"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 inline-flex items-center gap-2 min-h-[44px] active:bg-white/10"
                  >
                    <Pickaxe className="w-3 h-3 text-zion-purple shrink-0" /> {tr('nav', 'pool', lang)}
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan px-3 py-3 inline-flex items-center gap-2 text-white min-h-[44px] font-semibold"
                  >
                    {tr('nav', 'dashboard', lang)}
                  </Link>
                  <Link
                    href="/dashboard/mission-control"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 inline-flex items-center gap-2 min-h-[44px] active:bg-white/10"
                  >
                    <LayoutDashboard className="w-3 h-3 text-zion-gold shrink-0" /> Mission Control
                  </Link>
                  <Link
                    href="/dashboard/guardian"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 inline-flex items-center gap-2 min-h-[44px] active:bg-white/10"
                  >
                    <Shield className="w-3 h-3 text-zion-gold shrink-0" /> {tr('nav', 'guardian', lang)}
                  </Link>
                </div>
                {/* GitHub — highlighted in mobile menu */}
                <a
                  href="https://github.com/Zion-TerraNova/v3-Mainnet/tree/main"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="mt-2 rounded-xl border border-zion-gold/30 bg-linear-to-r from-zion-gold/10 to-amber-600/8 px-3 py-3 inline-flex items-center justify-center gap-2 min-h-[44px] text-zion-gold font-semibold shadow-[0_0_14px_rgba(251,191,36,0.12)]"
                >
                  <Github className="w-4 h-4" />
                  GitHub · Mainnet Beta
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
