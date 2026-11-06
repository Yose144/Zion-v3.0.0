'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  Menu, X, SignalHigh, Orbit, ChevronDown, LayoutDashboard, Pickaxe,
  Wallet, BookOpen, Github, Scale, ArrowRight,
} from 'lucide-react';
import NavAuthButton from './NavAuthButton';
import NotificationBell from './NotificationBell';
import { useLang, LANGS, langMeta, type Lang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { SITE_RELEASE_LABEL } from '@/lib/site';

type NavItem = { href: string; label: string; children?: NavItem[] };
type NavGroup = { title: string; color: string; items: NavItem[] };

/* Stable DOM id for a nav href (used by aria-controls) */
const anchorId = (prefix: string, href: string) =>
  `${prefix}-${href.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`;

/**
 * Přepínač jazyka — 5 kódů (cs/en/es/pt/fr) podle rozhodnutí 👤 2026-11-05
 * („cely ecosystem by mel podporovat nativne prepinani 5 jazyku").
 * `<details>` je záměrně: funguje klávesnicí i dotykem bez JS stavu.
 * Texty v es/pt/fr zatím nejsou → `tr()`/`tx()` spadnou na angličtinu.
 */
function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const current = langMeta(lang);
  const pick = (code: Lang) => (e: React.MouseEvent<HTMLButtonElement>) => {
    setLang(code);
    e.currentTarget.closest('details')?.removeAttribute('open');
  };
  return (
    <details className="relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1 rounded-lg border border-white/15 bg-black/75 font-semibold text-zion-gold/85 transition-colors hover:border-white/30 hover:bg-black hover:text-white ${compact ? 'min-h-[44px] px-4 py-2 text-xs' : 'px-2 py-1 text-[10px]'}`}
        title={`${current.label} — ${current.short}`}
        aria-label={`Language: ${current.label}`}
      >
        <span aria-hidden>{current.flag}</span>
        <span>{current.short}</span>
      </summary>
      <div className="absolute right-0 z-[80] mt-1 w-44 overflow-hidden rounded-lg border border-white/15 bg-[#0b0b12] shadow-2xl">
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={pick(l.code)}
            aria-current={l.code === lang ? 'true' : undefined}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/10 ${l.code === lang ? 'text-zion-gold' : 'text-gray-200'}`}
          >
            <span aria-hidden>{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">{l.short}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [panelScrollable, setPanelScrollable] = useState(false);
  const pathname = usePathname() ?? '';
  const { lang, setLang } = useLang();

  /* Current in-page anchor (hash) — read after mount to avoid hydration drift */
  const [hash, setHash] = useState('');
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [pathname]);

  /* Shrink nav into a thin bar after scrolling down */
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItemMatches = (href: string) =>
    pathname === href || (href === '/terranova' && pathname.startsWith('/terranova')) || (href === '/quantum-revolution' && pathname.startsWith('/quantum-revolution')) || (href === '/tree-of-life' && pathname.startsWith('/tree-of-life'));

  /* Href may carry a #hash — compare path and anchor separately so `/market#swap` is not active on `/market` */
  const linkMatches = (href: string) => {
    const [path, anchor] = href.split('#');
    if (anchor) return pathname === path && hash === `#${anchor}`;
    return navItemMatches(path);
  };

  /* ── 4 menu groups ── */
  const navGroups: NavGroup[] = [
    {
      title: tr('nav', 'network_group', lang),
      color: '6, 105, 40',
      items: [
        { href: '/network', label: tr('nav', 'network', lang), children: [
          { href: '/monitoring', label: tr('nav', 'monitoring', lang) },
          { href: '/g8', label: tr('nav', 'g8', lang) },
          { href: '/miner-stats', label: tr('nav', 'miner_stats', lang) },
        ] },
        { href: '/explorer', label: tr('nav', 'explorer', lang) },
        { href: '/pool', label: tr('nav', 'pool', lang) },
        { href: '/mining', label: tr('nav', 'mining', lang) },
        { href: '/download', label: tr('nav', 'download', lang) },
      ],
    },
    {
      title: tr('nav', 'defi_group', lang),
      color: '252, 209, 22',
      items: [
        { href: '/market', label: tr('nav', 'overview', lang), children: [
          { href: '/market#swap', label: tr('nav', 'swap', lang) },
          { href: '/market#bridge', label: tr('nav', 'bridge', lang) },
          { href: '/market#dex', label: tr('nav', 'dex', lang) },
          { href: '/market#bridge', label: tr('nav', 'warp', lang) },
          { href: '/market#earn', label: tr('nav', 'earn', lang) },
          { href: '/market#auction', label: tr('nav', 'auction', lang) },
        ] },
        { href: '/dao', label: tr('nav', 'dao_governance', lang) },
        { href: '/cex', label: tr('nav', 'cex', lang) },
        { href: '/wallet', label: tr('nav', 'wallet', lang) },
      ],
    },
    {
      title: tr('nav', 'layers_group', lang),
      color: '228, 30, 43',
      items: [
        { href: '/world', label: tr('nav', 'world', lang) },
        { href: '/l3-hiran', label: tr('nav', 'l3_hiran', lang) },
        {
          href: '/l4-oasis',
          label: tr('nav', 'l4_oasis', lang),
          children: [
            { href: '/l4-oasis/avatars', label: tr('nav', 'l4_oasis_avatars', lang) },
          ],
        },
        {
          href: '/l5-free-world',
          label: tr('nav', 'l5_free_world', lang),
          children: [
            { href: '/terranova/genesis', label: tr('nav', 'terra_garden_genesis', lang) },
            { href: '/terranova/dharma-temple', label: tr('nav', 'terra_dharma_temple', lang) },
            { href: '/terranova/te-piko-ora', label: tr('nav', 'terra_te_piko_ora', lang) },
            { href: '/terranova/golden-republic-bohemia', label: tr('nav', 'terra_golden_republic_bohemia', lang) },
            { href: '/terranova/bodhi-lanka', label: tr('nav', 'terra_bodhi_lanka', lang) },
            { href: '/terranova/nova-amerika', label: tr('nav', 'terra_lumi', lang) },
            { href: '/terranova/uluru', label: tr('nav', 'terra_uluru', lang) },
            { href: '/terranova/maria-del-camino', label: tr('nav', 'terra_maria_del_camino', lang) },
            { href: '/terranova/boa-esperanca', label: tr('nav', 'terra_boa_esperanca', lang) },
            { href: '/terranova/ekam', label: tr('nav', 'terra_ekam', lang) },
            { href: '/terranova/kailash', label: tr('nav', 'terra_kailash', lang) },
            { href: '/terranova/amenti', label: tr('nav', 'terra_amenti', lang) },
            { href: '/terranova/kralovstvi-srdce', label: tr('nav', 'terra_kralovstvi_srdce', lang) },
          ],
        },
        {
          href: '/l6-issobella',
          label: tr('nav', 'l6_issobella', lang),
          children: [{ href: '/terranova/nabukano', label: tr('nav', 'terra_nabukano', lang) }],
        },
        { href: '/ai-native', label: tr('nav', 'ai_native', lang) },
      ],
    },
    {
      title: tr('nav', 'learn_group', lang),
      color: '6, 105, 40',
      items: [
        { href: '/docs', label: tr('nav', 'docs', lang) },
        { href: '/whitepapers', label: tr('nav', 'whitepapers', lang) },
        { href: '/news', label: tr('nav', 'news', lang) },
        { href: '/roadmap', label: tr('nav', 'roadmap', lang) },
        { href: '/team', label: tr('nav', 'team', lang) },
        { href: '/genesis', label: tr('nav', 'genesis', lang) },
        { href: '/terranova', label: tr('nav', 'terranova', lang) },
        { href: '/zion-archive', label: 'Zion Archive' },
        { href: '/tree-of-life', label: tr('nav', 'tree_of_life', lang), children: [
          { href: '/tree-of-life#evoluzion', label: 'evoluZion V2' },
          { href: '/tree-of-life#proof-of-care', label: 'Proof-of-Care' },
          { href: '/tree-of-life#bodhisattva', label: 'Bodhisattva Vow' },
        ] },
      ],
    },
  ];

  const activeGroup = navGroups.find((group) => group.title === openGroup);
  /* Wide panel: split long link lists into two columns so the panel never looks half-empty.
     Items that open a subtree span both columns — only use two columns when that leaves no hole. */
  const multiCol = (() => {
    const items = activeGroup?.items ?? [];
    if (items.length < 4) return false;
    const spanIndex = items.findIndex((item) => item.children?.length);
    return spanIndex === -1 || spanIndex % 2 === 0;
  })();
  const panelScrollRef = useRef<HTMLDivElement>(null);

  /* Detect whether the mega panel content overflows (drives the bottom fade) */
  useEffect(() => {
    const el = panelScrollRef.current;
    if (!el) {
      setPanelScrollable(false);
      return;
    }
    const measure = () => setPanelScrollable(el.scrollHeight - el.clientHeight > 4);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [openGroup, openSub, lang]);

  /* Open/close a group; auto-expand the sub-list that contains the current page */
  const toggleGroup = (title: string) => {
    const next = openGroup === title ? null : title;
    setOpenGroup(next);
    if (!next) {
      setOpenSub(null);
      return;
    }
    const group = navGroups.find((g) => g.title === next);
    const matching = group?.items.find((item) =>
      item.children?.some((child) => linkMatches(child.href))
    );
    setOpenSub(matching?.href ?? null);
  };

  const toggleSub = (href: string) => setOpenSub((cur) => (cur === href ? null : href));

  const closeMenus = () => {
    setIsOpen(false);
    setOpenGroup(null);
    setOpenSub(null);
  };

  /* ── HERO icons — top panel, RASTA colored ── */
  /* Rasta: green (emerald) → gold (zion-gold) → red (rose/red) */
  const heroIcons = [
    { href: '/explorer', icon: Orbit, color: '6, 105, 40', label: tr('nav', 'explorer', lang) },       /* green */
    { href: '/pool', icon: Pickaxe, color: '252, 209, 22', label: tr('nav', 'pool', lang) },               /* gold */
    { href: '/network', icon: SignalHigh, color: '228, 30, 43', label: tr('nav', 'network', lang) },      /* red */
    { href: '/dao', icon: Scale, color: '147, 51, 234', label: tr('nav', 'dao', lang) },
    { href: '/docs', icon: BookOpen, color: '6, 105, 40', label: tr('nav', 'docs', lang) },             /* green */
    { href: '/wallet', icon: Wallet, color: '252, 209, 22', label: tr('nav', 'wallet', lang) },            /* gold */
  ];

  /* Close mobile menu on ACTUAL route change (not initial mount) */
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    setIsOpen(false);
    setOpenGroup(null);
    setOpenSub(null);
  }, [pathname]);

  /* Scroll lock when mobile menu open — preserves scroll position + prior style */
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const prevTop = document.body.style.top;
    const lockedPath = window.location.pathname;
    document.body.classList.add('menu-open');
    document.body.style.top = `-${scrollY}px`;
    return () => {
      document.body.classList.remove('menu-open');
      document.body.style.top = prevTop;
      if (window.location.pathname === lockedPath) {
        window.scrollTo({ top: scrollY, behavior: 'instant' });
      }
    };
  }, [isOpen]);

  /* Focus management: into drawer on open, trap Tab, back to trigger on close */
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isOpen) {
      const el = drawerRef.current;
      const first = el?.querySelector<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])'
      );
      first?.focus({ preventScroll: true });
      const trigger = menuButtonRef.current;
      return () => trigger?.focus({ preventScroll: true });
    }
  }, [isOpen]);

  const handleDrawerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !drawerRef.current) return;
    const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /* Escape key closes menus */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setOpenGroup(null);
        setOpenSub(null);
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
        setOpenSub(null);
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
      if (window.innerWidth >= 1280) setIsOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <nav
      className={`fixed left-0 right-0 z-50 transition-all duration-300 ease-out ${
        scrolled ? 'top-0' : 'top-2 sm:top-3 md:top-4'
      }`}
    >
      {/* Subtle ambient glow */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 bg-linear-to-r from-zion-cyan/10 via-zion-gold/12 to-zion-gold/10 blur-2xl opacity-60 transition-all duration-300 ${scrolled ? 'h-10' : 'h-16'}`} />
      <div className={`relative mx-auto w-[min(96vw,1080px)] transition-all duration-300 ${scrolled ? 'py-0' : 'py-1'}`} data-nav-desktop>
        {/* ═══════════════════════════════════════════════════
            FLOOR 1 — MAIN BAR
            Logo | 6 HERO icons (rasta) | lang + GitHub + auth + dashboard
            ═══════════════════════════════════════════════════ */}
        <div className="relative rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-[1px] shadow-[0_16px_60px_rgba(0,0,0,0.35)] transition-all duration-300">
          {/* Rasta gradient top accent line — thicker and narrower */}
          <div className={`pointer-events-none absolute -top-px left-12 right-12 rounded-t-2xl bg-linear-to-r from-zion-cyan/60 via-zion-gold/70 to-zion-purple/60 transition-all duration-300 ${scrolled ? 'h-0.5 left-10 right-10' : 'h-1'}`} />
          <div className={`relative flex items-center justify-between gap-1.5 rounded-[15px] bg-black/70 px-2 sm:px-3 transition-all duration-300 ${scrolled ? 'py-1' : 'py-1'}`}
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >

          {/* Logo */}
          <Link prefetch={false} href="/" className="flex items-center space-x-2 group shrink-0">
            <div className={`rounded-lg flex items-center justify-center relative overflow-hidden border border-white/15 group-hover:border-zion-gold/50 transition-all duration-300 bg-transparent shadow-[0_6px_18px_rgba(0,0,0,0.3)] ${scrolled ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-8 h-8 sm:w-9 sm:h-9'}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,105,40,0.08),transparent_65%)]" />
              <img
                src="/symbol-200x200.png"
                alt="ZION TerraNova"
                width={40}
                height={40}
                fetchPriority="high"
                className="relative z-10 w-full h-full object-contain rounded-lg"
              />
            </div>
            <div className="flex flex-col leading-none transition-all duration-300">
              <span className="text-sm sm:text-base font-bold text-gradient-soft tracking-tight">ZION</span>
              <span className="hidden sm:inline text-[10px] sm:text-[10px] px-1 sm:px-1 py-0.5 mt-0.5 rounded-full bg-white/6 border border-white/10 uppercase tracking-[0.18em] text-white/60">
                {SITE_RELEASE_LABEL}
              </span>
            </div>
          </Link>

          {/* HERO icons — BIG, rasta colored, inline in main bar (labels appear from 2xl) */}
          <div className="hidden xl:flex items-center justify-center gap-1 2xl:gap-1.5">
            {heroIcons.map((ml) => {
              const isActive = navItemMatches(ml.href);
              return (
                <Link
                  prefetch={false} key={ml.href}
                  href={ml.href}
                  title={ml.label}
                  className={`group relative flex items-center gap-1 rounded-lg border transition-all hover:scale-105 shrink-0 ${scrolled ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}
                  style={{
                    borderColor: isActive ? `rgba(${ml.color}, 0.55)` : 'rgba(255,255,255,0.08)',
                    backgroundColor: isActive ? `rgba(${ml.color}, 0.12)` : 'rgba(0,0,0,0.4)',
                    boxShadow: isActive ? `0 0 12px rgba(${ml.color}, 0.22)` : 'none',
                  }}
                >
                  <ml.icon
                    className={`transition-all duration-300 ${scrolled ? 'w-4 h-4' : 'w-3.5 h-3.5'}`}
                    style={{ color: isActive ? `rgb(${ml.color})` : `rgba(${ml.color}, 0.8)` }}
                  />
                  <span
                    className="nav-touch-label hidden 2xl:inline text-[10px] font-bold uppercase tracking-wider transition-all duration-300"
                    style={{ color: isActive ? `rgb(${ml.color})` : 'rgba(255,255,255,0.7)' }}
                  >
                    {ml.label}
                  </span>
                  {/* Icon-only mode gets a tooltip so the label stays discoverable */}
                  <span className="pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded border border-white/10 bg-black/90 px-2 py-0.5 text-[10px] text-white/80 opacity-0 transition-opacity group-hover:opacity-100 2xl:hidden">
                    {ml.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Right cluster: lang + GitHub + auth + dashboard */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="hidden sm:block">
              <LangSwitcher />
            </div>
            <Link
              prefetch={false} href="https://github.com/Zion-TerraNova/v3-Mainnet"
              target="_blank"
              rel="noreferrer"
              title="GitHub"
              className={`hidden xl:inline-flex rounded-lg border border-zion-gold/30 bg-linear-to-br from-zion-gold/10 to-zion-gold/8 items-center justify-center shadow-[0_0_10px_rgba(252, 209, 22,0.12)] hover:shadow-[0_0_18px_rgba(252, 209, 22,0.28)] hover:border-zion-gold/50 transition-all group relative ${scrolled ? 'p-1' : 'p-1.5'}`}
            >
              <Github className={`text-zion-gold transition-all duration-300 ${scrolled ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black/90 border border-zion-gold/20 rounded px-2 py-0.5 text-zion-gold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">GitHub</span>
            </Link>
            <NavAuthButton />
            <NotificationBell />
            <Link
              prefetch={false} href="/dashboard"
              title={tr('nav', 'dashboard', lang)}
              className={`hidden xl:inline-flex rounded-lg border border-white/15 bg-black/85 items-center justify-center shadow-[0_10px_28px_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5 hover:border-zion-gold/50 group relative ${scrolled ? 'p-1' : 'p-1.5'}`}
            >
              <LayoutDashboard className={`text-white transition-all duration-300 ${scrolled ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black/90 border border-white/10 rounded px-2 py-0.5 text-zion-gold/85 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">{tr('nav', 'dashboard', lang)}</span>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={menuButtonRef}
            onClick={() => setIsOpen(!isOpen)}
            className="text-white p-2 rounded-xl border border-white/20 bg-white/5 hover:border-white/40 active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center xl:hidden"
            aria-label={isOpen ? tr('nav', 'close_menu', lang) : tr('nav', 'open_menu', lang)}
            aria-expanded={isOpen}
            aria-controls="mobile-nav-drawer"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          </div>
        </div>

        {/* ═══ FLOOR 2 — GROUP PILLS (visible from lg, where the icon bar is hidden) ═══ */}
        <div className="hidden lg:flex items-center justify-center relative rounded-full border border-white/[0.06] bg-black/25 backdrop-blur-md px-3 py-1 shadow-none transition-all duration-300 mt-1.5 max-w-full overflow-hidden">
          <div className="flex items-center gap-1.5 xl:gap-2 flex-1 justify-center overflow-x-auto no-scrollbar min-w-0">
            {/* Group dropdown buttons */}
            {navGroups.map((group) => {
              const isActive = openGroup === group.title;
              const groupHasActiveChild = group.items.some((item) => linkMatches(item.href) || item.children?.some((child) => linkMatches(child.href)));
              return (
                <div key={group.title} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] xl:tracking-[0.22em] transition-all ${
                      isActive
                        ? 'border-zion-gold/40 bg-zion-gold/10 text-zion-gold shadow-[0_0_12px_rgba(252, 209, 22,0.12)]'
                        : groupHasActiveChild
                          ? 'border-zion-cyan/25 bg-black/50 text-white hover:border-zion-gold/30 hover:bg-black/70'
                          : 'border-white/[0.08] bg-black/40 text-zion-gold/80 hover:border-zion-gold/25 hover:bg-black/60 hover:text-white'
                    }`}
                    aria-expanded={isActive}
                    aria-controls="nav-mega-panel"
                    aria-haspopup="true"
                  >
                    <span
                      className="h-1 w-1 rounded-full shrink-0"
                      style={{ backgroundColor: `rgba(${group.color}, ${isActive || groupHasActiveChild ? 0.95 : 0.45})` }}
                    />
                    <span className="group-hover:text-zion-gold transition-colors">{group.title}</span>
                    <ChevronDown className={`h-[9px] w-[9px] shrink-0 transition-transform ${isActive ? 'rotate-180 text-zion-gold' : 'text-current'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ MEGA PANEL — scrollable, subgroups collapsible (desktop only) ═══ */}
        {activeGroup && !isOpen && (
          <div
            id="nav-mega-panel"
            className="hidden lg:block absolute left-1/2 top-full z-50 mt-1.5 w-[min(46rem,94vw)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-black/92 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            <div
              className="h-0.5 w-full"
              style={{ background: `linear-gradient(to right, rgba(${activeGroup.color},0.25), rgba(${activeGroup.color},0.85), rgba(${activeGroup.color},0.25))` }}
            />
            {/* Panel header */}
            <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-1">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `rgb(${activeGroup.color})`, boxShadow: `0 0 10px rgba(${activeGroup.color},0.7)` }}
                />
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.35em] text-zion-gold/70">{activeGroup.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenGroup(null)}
                className="shrink-0 rounded-lg border border-white/10 p-1 text-white/50 transition-colors hover:border-white/25 hover:text-white"
                aria-label={tr('nav', 'close_menu', lang)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scroll area — never grows past the viewport */}
            <div
              ref={panelScrollRef}
              className="nav-scroll overflow-y-auto overscroll-contain px-3 pb-3"
              style={{ maxHeight: 'calc(100dvh - 14.5rem)' }}
            >
              <div className={`grid gap-1 ${multiCol ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                {activeGroup.items.map((item) => {
                  const hasKids = !!item.children?.length;
                  const subOpen = openSub === item.href;
                  const itemActive = linkMatches(item.href);
                  const kidActive = item.children?.some((child) => linkMatches(child.href));
                  const subId = anchorId('navsub', item.href);

                  if (!hasKids) {
                    return (
                      <Link
                        prefetch={false}
                        key={item.href + item.label}
                        href={item.href}
                        onClick={() => setOpenGroup(null)}
                        className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                          itemActive
                            ? 'bg-white/10 text-white'
                            : 'text-zion-gold/85 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        {itemActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zion-gold/70" />}
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={item.href + item.label}
                      className={`overflow-hidden rounded-xl border transition-colors ${multiCol ? 'sm:col-span-2' : ''} ${
                        subOpen || kidActive ? 'border-white/10 bg-white/[0.03]' : 'border-white/[0.05] bg-transparent'
                      }`}
                    >
                      <div className="flex items-stretch">
                        <Link
                          prefetch={false}
                          href={item.href}
                          onClick={() => setOpenGroup(null)}
                          className={`flex min-w-0 flex-1 items-center gap-2 rounded-l-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                            itemActive ? 'text-white' : 'text-zion-gold/85 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {kidActive && !subOpen && (
                            <span
                              className="h-1 w-1 shrink-0 rounded-full"
                              style={{ backgroundColor: `rgb(${activeGroup.color})` }}
                            />
                          )}
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleSub(item.href)}
                          aria-expanded={subOpen}
                          aria-controls={subId}
                          aria-label={`${item.label} — ${subOpen ? tr('nav', 'close_menu', lang) : tr('nav', 'open_menu', lang)}`}
                          className="flex shrink-0 items-center gap-1.5 border-l border-white/5 px-3 text-white/40 transition-colors hover:bg-white/5 hover:text-zion-gold"
                        >
                          <span className="text-[10px] font-semibold tabular-nums text-white/30">{item.children!.length}</span>
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${subOpen ? 'rotate-180 text-zion-gold' : ''}`} />
                        </button>
                      </div>
                      {subOpen && (
                        <div
                          id={subId}
                          className="grid grid-cols-1 gap-0.5 border-t border-white/5 p-2 sm:grid-cols-2"
                        >
                          {item.children!.map((child) => {
                            const childActive = linkMatches(child.href);
                            return (
                              <Link
                                prefetch={false}
                                key={child.href + child.label}
                                href={child.href}
                                onClick={() => setOpenGroup(null)}
                                className={`group flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                                  childActive
                                    ? 'bg-white/10 text-white'
                                    : 'text-zion-gold/70 hover:bg-white/5 hover:text-zion-gold'
                                }`}
                              >
                                <span
                                  className={`h-1 w-1 shrink-0 rounded-full transition-colors ${childActive ? 'bg-zion-gold' : 'bg-white/20 group-hover:bg-zion-gold/70'}`}
                                />
                                <span className="truncate">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Scroll affordance — only when the list is actually longer than the panel */}
            {panelScrollable && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-2xl bg-linear-to-t from-black via-black/80 to-transparent"
              />
            )}
          </div>
        )}

        {/* ═══ MOBILE OVERLAY + MENU ═══ */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={closeMenus}
              aria-hidden="true"
            />
            {/* Slide-in panel */}
            <div
              ref={drawerRef}
              id="mobile-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-nav-title"
              className="fixed inset-y-0 right-0 flex h-screen h-dvh w-[min(420px,94vw)] flex-col overflow-hidden border-l-2 border-zion-gold/30 bg-black/95 backdrop-blur-xl z-50 animate-[slideIn_0.25s_ease-out]"
              style={{
                height: '100dvh',
                maxHeight: '100vh',
                borderImage: 'linear-gradient(to bottom, rgba(6, 105, 40,0.4), rgba(252, 209, 22,0.5), rgba(228, 30, 43,0.4)) 1',
              }}
              onKeyDown={handleDrawerKeyDown}
            >
              <div
                className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 pb-4"
                style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
              >
                <span id="mobile-nav-title" className="text-sm font-bold text-gradient">{tr('nav', 'menu_title', lang)}</span>
                <button
                  onClick={closeMenus}
                  className="p-2 rounded-xl border border-white/20 hover:border-zion-gold/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={tr('nav', 'close_menu', lang)}
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
              {/* Rasta accent line */}
              <div className="h-0.5 w-full bg-linear-to-r from-zion-cyan/50 via-zion-gold/60 to-zion-purple/40" />
              <div
                className="nav-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-2"
                style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
              >
                {/* Home shortcut — always visible */}
                <Link
                  prefetch={false} href="/"
                  className={`rounded-xl px-3 py-3 text-base font-semibold transition min-h-[48px] flex items-center ${
                    pathname === '/' ? 'bg-white/10 text-white' : 'text-zion-gold/90 hover:bg-white/5 active:bg-white/10'
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
                        onClick={() => toggleGroup(group.title)}
                        className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-3 text-sm uppercase tracking-[0.16em] text-zion-gold/85 hover:text-white hover:bg-white/5 min-h-[48px]"
                        aria-expanded={isExpanded}
                        aria-controls={anchorId('navmobile', group.title)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: `rgba(${group.color}, ${isExpanded ? 0.95 : 0.5})` }}
                          />
                          <span className="truncate">{group.title}</span>
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180 text-white' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div id={anchorId('navmobile', group.title)} className="mt-1 ml-1 border-l border-white/10 pl-2 space-y-0.5">
                          {group.items.map((item) => {
                            const hasKids = !!item.children?.length;
                            const subOpen = openSub === item.href;
                            const subId = anchorId('navmobilesub', item.href);
                            return (
                              <div key={item.href + item.label}>
                                <div className="flex items-stretch gap-1">
                                  <Link
                                    prefetch={false} href={item.href}
                                    className={`min-w-0 flex-1 rounded-xl px-3 py-3 text-base font-medium transition min-h-[44px] flex items-center ${
                                      linkMatches(item.href)
                                        ? 'bg-white/10 text-white'
                                        : 'text-zion-gold/85 hover:bg-white/5 active:bg-white/10'
                                    }`}
                                    onClick={() => setIsOpen(false)}
                                  >
                                    <span className="truncate">{item.label}</span>
                                  </Link>
                                  {hasKids && (
                                    <button
                                      type="button"
                                      onClick={() => toggleSub(item.href)}
                                      aria-expanded={subOpen}
                                      aria-controls={subId}
                                      aria-label={`${item.label} — ${subOpen ? tr('nav', 'close_menu', lang) : tr('nav', 'open_menu', lang)}`}
                                      className={`flex shrink-0 items-center gap-1 rounded-xl border px-3 min-h-[44px] min-w-[44px] justify-center transition-colors ${
                                        subOpen
                                          ? 'border-zion-gold/40 bg-zion-gold/10 text-zion-gold'
                                          : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white'
                                      }`}
                                    >
                                      <span className="text-[10px] font-semibold tabular-nums">{item.children!.length}</span>
                                      <ChevronDown className={`h-4 w-4 transition-transform ${subOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                  )}
                                </div>
                                {hasKids && subOpen && (
                                  <div id={subId} className="mb-1 ml-3 mt-1 border-l border-white/10 pl-2 space-y-0.5">
                                    {item.children!.map((child) => (
                                      <Link
                                        prefetch={false} key={child.href + child.label}
                                        href={child.href}
                                        className={`rounded-xl px-3 py-2.5 text-sm transition min-h-[44px] flex items-center ${
                                          linkMatches(child.href) ? 'bg-white/10 text-white' : 'text-zion-gold/75 hover:bg-white/5 active:bg-white/10'
                                        }`}
                                        onClick={() => setIsOpen(false)}
                                      >
                                        <span className="truncate">{child.label}</span>
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="h-px w-full bg-white/10" />
                <div className="flex justify-center">
                  <LangSwitcher compact />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Link
                    prefetch={false} href="/explorer"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 inline-flex items-center justify-center min-h-[44px] active:bg-white/10 text-center"
                  >
                    {tr('nav', 'explorer', lang)}
                  </Link>
                  <Link
                    prefetch={false} href="/pool"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 inline-flex items-center justify-center min-h-[44px] active:bg-white/10 text-center"
                  >
                    {tr('nav', 'pool', lang)}
                  </Link>
                  <Link
                    prefetch={false} href="/dao"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-zion-purple/30 bg-zion-purple/10 px-3 py-3 inline-flex items-center justify-center min-h-[44px] active:bg-white/10 text-center"
                  >
                    {tr('nav', 'dao_governance', lang)}
                  </Link>
                  <Link
                    prefetch={false} href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan px-3 py-3 inline-flex items-center justify-center text-white min-h-[44px] font-semibold text-center"
                  >
                    {tr('nav', 'dashboard', lang)}
                  </Link>
                  <Link
                    prefetch={false} href="/dashboard/guardian"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 inline-flex items-center justify-center min-h-[44px] active:bg-white/10 text-center"
                  >
                    {tr('nav', 'guardian', lang)}
                  </Link>
                </div>
                {/* GitHub — highlighted in mobile menu */}
                <a
                  href="https://github.com/Zion-TerraNova/v3-Mainnet/tree/main"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="mt-2 rounded-xl border border-zion-gold/30 bg-linear-to-r from-zion-gold/10 to-zion-gold/8 px-3 py-3 inline-flex items-center justify-center min-h-[44px] text-zion-gold font-semibold shadow-[0_0_14px_rgba(252, 209, 22,0.12)]"
                >
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
