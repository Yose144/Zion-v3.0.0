'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, SignalHigh, Orbit, ArrowUpRight, ChevronDown, LayoutDashboard, Pickaxe, Server, BookOpen, TrendingUp } from 'lucide-react';

type NavItem = { href: string; label: string; children?: NavItem[] };
type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: 'Mission',
    items: [
      { href: '/', label: 'Home' },
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/network', label: 'Network' },
      { href: '/roadmap', label: 'Roadmap' },
    ],
  },
  {
    title: 'Stacks',
    items: [
      { href: '/warp', label: 'Warp' },
      { href: '/dao', label: 'DAO' },
      { href: '/bridge', label: 'Bridge' },
      { href: '/download', label: 'Download' },
      { href: '/pool', label: 'Pool' },
      {
        href: '/mining',
        label: 'Mining & Node',
      },
    ],
  },
  {
    title: 'Knowledge',
    items: [
      { href: '/explorer', label: 'Explorer' },
      { href: '/genesis', label: 'Genesis' },
      { href: '/api-reference', label: 'API' },
      { href: '/docs', label: 'Docs' },
    ],
  },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const pathname = usePathname();
  const activeGroup = navGroups.find((group) => group.title === openGroup);

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
  <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-zion-purple/30 via-transparent to-zion-cyan/30 blur-3xl opacity-40" />
      <div className="zion-container py-4 relative">
        <div className="zion-panel flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center relative overflow-hidden border border-white/20 group-hover:border-zion-gold/50 transition-colors bg-black/40">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,215,0,0.3),transparent_60%)]" />
              <Image 
                src="/LogoStargate.jpg" 
                alt="ZION Logo" 
                width={48} 
                height={48}
                className="relative z-10 object-cover w-full h-full"
              />
            </div>
            <span className="text-2xl font-bold text-gradient tracking-tight">ZION</span>
            <span className="text-[11px] px-2 py-1 rounded bg-white/5 border border-white/10 uppercase tracking-widest">
              2.9.7 &ldquo;On the Star&rdquo;
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6" data-nav-desktop>
            <div className="relative">
              <div className="flex items-center gap-2">
                {navGroups.map((group) => {
                  const isActive = openGroup === group.title;
                  return (
                    <button
                      key={group.title}
                      type="button"
                      onClick={() => setOpenGroup(isActive ? null : group.title)}
                      className={`inline-flex items-center gap-1 rounded-2xl border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition-colors ${
                        isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                      aria-expanded={isActive}
                    >
                      {group.title}
                      <ChevronDown className={`h-3 w-3 transition-transform ${isActive ? 'rotate-180' : ''}`} />
                    </button>
                  );
                })}
              </div>
              {activeGroup && (
                <div className="absolute right-0 mt-3 w-72 rounded-3xl border border-white/10 bg-black/80 p-4 shadow-[0_15px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500">{activeGroup.title}</p>
                  <div className="mt-3 flex flex-col gap-1">
                    {activeGroup.items.map((item) => (
                      <div key={item.href}>
                        <Link
                          href={item.href}
                          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition block ${
                            pathname === item.href ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'
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
            </div>
            <Link
              href="/network"
              title="Network"
              className="p-2 rounded-xl border border-white/20 hover:border-zion-cyan/50 bg-black/30 backdrop-blur transition-colors inline-flex items-center justify-center group relative"
            >
              <SignalHigh className="w-4 h-4 text-zion-cyan" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black/90 border border-white/10 rounded px-2 py-0.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Network</span>
            </Link>
            <Link
              href="/explorer"
              title="Explorer"
              className="p-2 rounded-xl border border-white/20 hover:border-zion-gold/50 bg-black/30 backdrop-blur transition-colors inline-flex items-center justify-center group relative"
            >
              <Orbit className="w-4 h-4 text-zion-gold" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black/90 border border-white/10 rounded px-2 py-0.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Explorer</span>
            </Link>
            <Link
              href="/pool"
              title="Pool"
              className="p-2 rounded-xl border border-white/20 hover:border-zion-purple/50 bg-black/30 backdrop-blur transition-colors inline-flex items-center justify-center group relative"
            >
              <Pickaxe className="w-4 h-4 text-zion-purple" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black/90 border border-white/10 rounded px-2 py-0.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Pool</span>
            </Link>
            <Link
              href="/dashboard"
              title="Dashboard"
              className="p-2 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan inline-flex items-center justify-center shadow-[0_10px_30px_rgba(147,51,234,0.35)] group relative"
            >
              <LayoutDashboard className="w-4 h-4 text-white" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black/90 border border-white/10 rounded px-2 py-0.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Dashboard</span>
            </Link>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-white p-3 rounded-xl border border-white/20 hover:border-white/40 active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={isOpen ? 'Zavřít menu' : 'Otevřít menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <div className="mt-3 hidden sm:flex items-center justify-end text-xs text-gray-400">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-gray-500">
            <Orbit className="w-3 h-3 text-zion-cyan" />
            WARP STATUS · Online
          </div>
        </div>

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
            <div className="md:hidden fixed top-0 right-0 bottom-0 w-[min(320px,85vw)] bg-black/95 backdrop-blur-xl border-l border-white/10 z-50 overflow-y-auto overscroll-contain animate-[slideIn_0.25s_ease-out]">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <span className="text-sm font-bold text-gradient">ZION Menu</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl border border-white/20 hover:border-white/40 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Zavřít menu"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
              <div className="p-4 space-y-5">
                {navGroups.map((group) => (
                  <div key={group.title}>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 mb-2 px-1">{group.title}</p>
                    {group.items.map((item) => (
                      <div key={item.href}>
                        <Link
                          href={item.href}
                          className={`block rounded-xl px-3 py-3 text-sm font-semibold transition min-h-[44px] flex items-center ${
                            pathname === item.href ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 active:bg-white/10'
                          }`}
                          onClick={() => setIsOpen(false)}
                        >
                          {item.label}
                        </Link>
                        {item.children?.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`block rounded-xl pl-7 pr-3 py-2.5 text-[13px] transition min-h-[40px] flex items-center ${
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
                ))}
                <div className="h-px w-full bg-white/10" />
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Link
                    href="/explorer"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 inline-flex items-center gap-2 min-h-[44px] active:bg-white/10"
                  >
                    <Orbit className="w-3 h-3 text-zion-gold shrink-0" /> Explorer
                  </Link>
                  <Link
                    href="/pool"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 inline-flex items-center gap-2 min-h-[44px] active:bg-white/10"
                  >
                    <Pickaxe className="w-3 h-3 text-zion-purple shrink-0" /> Pool
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan px-3 py-3 inline-flex items-center gap-2 text-white min-h-[44px] font-semibold"
                  >
                    Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
